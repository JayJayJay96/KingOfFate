// Prepares recorded voice clips for the game (owner request 2026-10-10).
//
//   npm run voice                 # voice-raw/ → public/voice/
//   node scripts/prepare-voice.mjs --in <dir> --out <dir>
//
// For every clip id (one, two, juice, ko, versus, fight) it looks for <id>.<mp3|wav|m4a|ogg|aac|
// flac|webm> in the input folder and, with ffmpeg:
//   1. trims silence before and after the voice (so it starts the instant it is triggered),
//   2. evens out loudness (EBU R128, -14 LUFS) and converts to mono 44.1 kHz,
//   3. fits it to the target length: speeds it up (pitch kept) by up to 1.6×, and only trims
//      the tail if it is still too long,
//   4. adds 5 ms / 60 ms fades against clicks and writes <id>.mp3 (128 kbps),
// then writes manifest.json listing every clip present in the output folder.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Target maximum length in seconds; the finale beat can be as short as 0.36 s. */
const MAX_SECONDS = { one: 0.35, two: 0.35, juice: 0.8, ko: 1.0, versus: 1.0, fight: 1.0 };
const CLIPS = Object.keys(MAX_SECONDS);
const EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'webm'];
const MAX_SPEEDUP = 1.6;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : resolve(fallback);
};
const inDir = arg('--in', 'voice-raw');
const outDir = arg('--out', 'public/voice');

function ffmpeg(...a) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
}
function duration(file) {
  const out = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    file,
  ]);
  return Number(String(out).trim());
}

if (!existsSync(inDir)) {
  console.error(`No input folder: ${inDir}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const work = join(tmpdir(), `kof-voice-${process.pid}`);
mkdirSync(work, { recursive: true });

const report = [];
for (const id of CLIPS) {
  const ext = EXTENSIONS.find((e) => existsSync(join(inDir, `${id}.${e}`)));
  if (!ext) continue;
  const src = join(inDir, `${id}.${ext}`);
  const trimmed = join(work, `${id}.wav`);
  ffmpeg(
    '-i',
    src,
    '-af',
    [
      'silenceremove=start_periods=1:start_silence=0.02:start_threshold=-40dB',
      'areverse',
      'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB',
      'areverse',
      'loudnorm=I=-14:TP=-1.5:LRA=7',
    ].join(','),
    '-ac',
    '1',
    '-ar',
    '44100',
    trimmed,
  );
  const raw = duration(src);
  const voiced = duration(trimmed);
  const max = MAX_SECONDS[id];
  const speed = voiced > max ? Math.min(MAX_SPEEDUP, voiced / max) : 1;
  const fitted = voiced / speed;
  const length = Math.min(fitted, max);
  const fade = Math.min(0.06, length / 4);
  const filters = [
    speed > 1 ? `atempo=${speed.toFixed(3)}` : null,
    `atrim=0:${length.toFixed(3)}`,
    'afade=t=in:st=0:d=0.005',
    `afade=t=out:st=${(length - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
  ].filter(Boolean);
  ffmpeg(
    '-i',
    trimmed,
    '-af',
    filters.join(','),
    '-ac',
    '1',
    '-ar',
    '44100',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '128k',
    join(outDir, `${id}.mp3`),
  );
  report.push({
    clip: id,
    raw: `${raw.toFixed(2)} s`,
    voice: `${voiced.toFixed(2)} s`,
    final: `${duration(join(outDir, `${id}.mp3`)).toFixed(2)} s`,
    fitted:
      speed > 1
        ? `sped up ×${speed.toFixed(2)}${fitted > max ? ', tail trimmed' : ''}`
        : 'as is',
  });
}
rmSync(work, { recursive: true, force: true });

const present = CLIPS.filter((id) => readdirSync(outDir).includes(`${id}.mp3`));
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify({ clips: present }, null, 2)}\n`);
console.table(report);
console.log(`manifest.json → ${present.length ? present.join(', ') : '(no clips)'}`);
