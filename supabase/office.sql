-- King of Fate: Office mode (owner decision 2026-10-29).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste all -> Run.
-- Safe to run again: it keeps existing data and the current office code.
--
-- Security model: the tables have Row Level Security ON and NO policies, and the browser roles
-- (anon, authenticated) have no table privileges, so the public key cannot read or write them
-- directly. The game only calls the functions below; each checks the office code (stored as a
-- bcrypt hash) on the server. Wrong codes are counted; after 30 wrong codes in 15 minutes every
-- call is refused until the window passes (slows guessing; see the limits in the README).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.kof_office (
  id int primary key default 1 check (id = 1),
  code_hash text not null,
  setup jsonb,
  setup_version int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.kof_matches (
  match_id text primary key,
  completed_at text not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.kof_failed_codes (
  at timestamptz not null default now()
);

alter table public.kof_office enable row level security;
alter table public.kof_matches enable row level security;
alter table public.kof_failed_codes enable row level security;
revoke all on public.kof_office, public.kof_matches, public.kof_failed_codes
  from anon, authenticated;

-- Default office code 116059 (change it from the game: Office mode -> Change code).
insert into public.kof_office (id, code_hash)
values (1, extensions.crypt('116059', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- Internal: true when the code is right. Not callable from the browser.
create or replace function public.kof_code_ok(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  delete from kof_failed_codes where at < now() - interval '15 minutes';
  if (select count(*) from kof_failed_codes) >= 30 then
    return false;
  end if;
  select code_hash into v_hash from kof_office where id = 1;
  if v_hash is not null and p_code is not null and crypt(p_code, v_hash) = v_hash then
    return true;
  end if;
  insert into kof_failed_codes default values;
  return false;
end;
$$;

create or replace function public.kof_get_setup(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v kof_office;
begin
  if not kof_code_ok(p_code) then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  select * into v from kof_office where id = 1;
  return jsonb_build_object('ok', true, 'setup', v.setup, 'version', v.setup_version);
end;
$$;

-- Optimistic concurrency: saves only if nobody else saved since p_base_version.
create or replace function public.kof_save_setup(p_code text, p_setup jsonb, p_base_version int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v kof_office;
begin
  if not kof_code_ok(p_code) then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  if p_setup is null or jsonb_typeof(p_setup) <> 'object'
     or octet_length(p_setup::text) > 1000000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into v from kof_office where id = 1 for update;
  if v.setup_version <> p_base_version then
    return jsonb_build_object(
      'ok', false, 'error', 'conflict', 'setup', v.setup, 'version', v.setup_version);
  end if;
  update kof_office
    set setup = p_setup, setup_version = setup_version + 1, updated_at = now()
    where id = 1;
  return jsonb_build_object('ok', true, 'version', v.setup_version + 1);
end;
$$;

create or replace function public.kof_list_matches(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not kof_code_ok(p_code) then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  return jsonb_build_object(
    'ok', true,
    'matches',
    coalesce((select jsonb_agg(record order by completed_at) from kof_matches), '[]'::jsonb)
  );
end;
$$;

-- p_mode: 'add' keeps an existing match (a game result is written once), 'upsert' replaces it
-- (merge import: the file wins), 'replace' deletes all history first (import replace all).
create or replace function public.kof_put_matches(p_code text, p_records jsonb, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
begin
  if not kof_code_ok(p_code) then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 5000
     or p_mode not in ('add', 'upsert', 'replace') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  for r in select * from jsonb_array_elements(p_records) loop
    if jsonb_typeof(r->'matchId') is distinct from 'string'
       or jsonb_typeof(r->'completedAt') is distinct from 'string'
       or octet_length(r::text) > 2000000 then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
  end loop;
  if p_mode = 'replace' then
    delete from kof_matches where true;
  end if;
  for r in select * from jsonb_array_elements(p_records) loop
    if p_mode = 'add' then
      insert into kof_matches (match_id, completed_at, record)
        values (r->>'matchId', r->>'completedAt', r)
        on conflict (match_id) do nothing;
    else
      insert into kof_matches (match_id, completed_at, record)
        values (r->>'matchId', r->>'completedAt', r)
        on conflict (match_id) do update
          set completed_at = excluded.completed_at, record = excluded.record, updated_at = now();
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.kof_delete_match(p_code text, p_match_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not kof_code_ok(p_code) then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  delete from kof_matches where match_id = p_match_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.kof_change_code(p_code text, p_new_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not kof_code_ok(p_code) then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  if p_new_code is null or length(p_new_code) < 6 or length(p_new_code) > 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update kof_office set code_hash = crypt(p_new_code, gen_salt('bf')), updated_at = now()
    where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

-- Only the game's functions are callable from the browser; the code check itself is not.
revoke all on function public.kof_code_ok(text) from public, anon, authenticated;
revoke all on function public.kof_get_setup(text) from public;
revoke all on function public.kof_save_setup(text, jsonb, int) from public;
revoke all on function public.kof_list_matches(text) from public;
revoke all on function public.kof_put_matches(text, jsonb, text) from public;
revoke all on function public.kof_delete_match(text, text) from public;
revoke all on function public.kof_change_code(text, text) from public;
grant execute on function public.kof_get_setup(text) to anon, authenticated;
grant execute on function public.kof_save_setup(text, jsonb, int) to anon, authenticated;
grant execute on function public.kof_list_matches(text) to anon, authenticated;
grant execute on function public.kof_put_matches(text, jsonb, text) to anon, authenticated;
grant execute on function public.kof_delete_match(text, text) to anon, authenticated;
grant execute on function public.kof_change_code(text, text) to anon, authenticated;
