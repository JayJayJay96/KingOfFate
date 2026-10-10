import type { ChantWord } from '../animation/finaleTimeline';
import type { AudioSettings } from './audioSettings';
import { noteToFrequency, stepSeconds, STEPS_PER_LOOP, THEMES, type MusicTheme } from './chiptune';
import { createChanter, type VoiceInfo } from './voice';

export type SfxName =
  | 'tick'
  | 'fateTick'
  | 'ko'
  | 'blocked'
  | 'shield'
  | 'wasted'
  | 'vs'
  | 'clash'
  | 'draw'
  | 'score'
  | 'qualify'
  | 'suddenDeath'
  | 'victory'
  | 'coin'
  | 'fight';

/**
 * All sound in the app. Everything is synthesized at runtime (Web Audio + browser speech), so no
 * licensed audio is bundled. Every method is a safe no-op when audio is unavailable or the
 * browser has not been unlocked by a user gesture yet.
 */
export interface SoundEngine {
  readonly webAudio: boolean;
  readonly speech: boolean;
  unlock(): void;
  apply(settings: AudioSettings, customMusicUrl: string | null): void;
  /** Desired background loop; starts as soon as audio is unlocked. */
  setMusic(theme: MusicTheme | null): void;
  setPaused(paused: boolean): void;
  sfx(name: SfxName): void;
  chant(word: ChantWord): void;
  /** Arcade announcer line (English voice); no-op when muted, disabled or unavailable. */
  announce(text: string): void;
  listVoices(): VoiceInfo[];
  onVoicesChanged(listener: () => void): () => void;
  dispose(): void;
}

const LOOKAHEAD_S = 0.15;
/**
 * The announcer speaks only after a just-played effect has landed. In Edge, the Microsoft
 * online voices start playing at the same instant as a K.O./Shield effect and swallow it, so
 * every callout waits this long after the latest effect (owner report 2026-10-10).
 */
export const ANNOUNCE_AFTER_SFX_MS = 450;

/** How long a callout must wait so it starts after the latest effect (0 = speak now). */
export function announceDelayMs(lastSfxAt: number, now: number): number {
  return Math.max(0, lastSfxAt + ANNOUNCE_AFTER_SFX_MS - now);
}
const SCHEDULER_MS = 30;

export function createSoundEngine(): SoundEngine {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const chanter = createChanter();

  let settings: AudioSettings | null = null;
  let customUrl: string | null = null;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let desiredTheme: MusicTheme | null = null;
  let paused = false;
  let sequencer: { theme: MusicTheme; stop: () => void } | null = null;
  let customEl: HTMLAudioElement | null = null;
  let lastSfxAt = -Infinity;
  let pendingAnnounce: ReturnType<typeof setTimeout> | null = null;

  const running = (): AudioContext | null => (ctx && ctx.state === 'running' ? ctx : null);
  const musicLevel = () => (settings && !settings.muted ? settings.music : 0);
  const sfxLevel = () => (settings && !settings.muted ? settings.sfx : 0);
  const voiceLevel = () => (settings && !settings.muted ? settings.voice : 0);
  const wantsCustomMusic = () =>
    desiredTheme === 'select' && settings?.musicSource === 'custom' && !!customUrl;

  function ensureGraph(c: AudioContext) {
    if (master) return;
    master = c.createGain();
    master.connect(c.destination);
    musicBus = c.createGain();
    musicBus.connect(master);
    sfxBus = c.createGain();
    sfxBus.connect(master);
    noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyLevels();
  }

  function applyLevels() {
    const c = ctx;
    if (c && musicBus && sfxBus) {
      musicBus.gain.setTargetAtTime(musicLevel() * 0.35, c.currentTime, 0.03);
      sfxBus.gain.setTargetAtTime(sfxLevel() * 0.6, c.currentTime, 0.03);
    }
    if (customEl) customEl.volume = musicLevel();
  }

  // ---------- synth voices ----------
  function osc(
    c: AudioContext,
    bus: AudioNode,
    type: OscillatorType,
    from: number,
    to: number,
    at: number,
    seconds: number,
    volume: number,
  ) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, at);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + seconds);
    g.gain.setValueAtTime(volume, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(at + seconds + 0.02);
  }

  function noiseHit(
    c: AudioContext,
    bus: AudioNode,
    at: number,
    seconds: number,
    volume: number,
    filter: BiquadFilterType,
    freq: number,
  ) {
    if (!noise) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(volume, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    src.connect(f).connect(g).connect(bus);
    src.start(at);
    src.stop(at + seconds + 0.02);
  }

  // ---------- built-in music ----------
  function startSequencer(theme: MusicTheme) {
    const c = running();
    if (!c || !musicBus) return;
    stopSequencer();
    const t = THEMES[theme];
    const step = stepSeconds(t);
    let next = c.currentTime + 0.05;
    let index = 0;
    const timer = setInterval(() => {
      while (next < c.currentTime + LOOKAHEAD_S) {
        const i = index % STEPS_PER_LOOP;
        const lead = t.lead[i];
        const bass = t.bass[i];
        const hit = t.drums[i];
        if (lead)
          osc(
            c,
            musicBus!,
            'square',
            noteToFrequency(lead),
            noteToFrequency(lead),
            next,
            step * 1.8,
            0.16,
          );
        if (bass)
          osc(
            c,
            musicBus!,
            'triangle',
            noteToFrequency(bass),
            noteToFrequency(bass),
            next,
            step * 0.95,
            0.5,
          );
        if (hit === 'K') osc(c, musicBus!, 'sine', 150, 40, next, 0.15, 0.9);
        if (hit === 'S') noiseHit(c, musicBus!, next, 0.12, 0.5, 'bandpass', 1800);
        if (hit === 'H') noiseHit(c, musicBus!, next, 0.04, 0.25, 'highpass', 7000);
        if (hit === 'T') osc(c, musicBus!, 'sine', 110, 55, next, 0.25, 0.9);
        next += step;
        index++;
      }
    }, SCHEDULER_MS);
    sequencer = { theme, stop: () => clearInterval(timer) };
  }

  function stopSequencer() {
    sequencer?.stop();
    sequencer = null;
  }

  function syncMusic() {
    const c = running();
    const wantCustom = wantsCustomMusic() && !paused;
    if (customEl && (!wantCustom || customEl.src !== customUrl)) {
      customEl.pause();
      customEl = null;
    }
    if (wantCustom && c && !customEl && customUrl) {
      customEl = new Audio(customUrl);
      customEl.loop = true;
      customEl.volume = musicLevel();
      void customEl.play().catch(() => undefined);
    }
    const wantBuiltin =
      !paused && desiredTheme !== null && !wantsCustomMusic() ? desiredTheme : null;
    if (!wantBuiltin) stopSequencer();
    else if (c && sequencer?.theme !== wantBuiltin) startSequencer(wantBuiltin);
  }

  // ---------- sfx ----------
  function playSfx(name: SfxName) {
    const c = running();
    if (!c || !sfxBus || sfxLevel() <= 0) return;
    lastSfxAt = performance.now();
    const now = c.currentTime;
    const bus = sfxBus;
    switch (name) {
      case 'tick':
        osc(c, bus, 'square', 1250, 1250, now, 0.03, 0.18);
        break;
      case 'fateTick':
        osc(c, bus, 'square', 760, 760, now, 0.03, 0.14);
        break;
      case 'ko':
        osc(c, bus, 'sine', 180, 35, now, 0.45, 1);
        noiseHit(c, bus, now, 0.35, 0.8, 'lowpass', 1500);
        osc(c, bus, 'square', 440, 110, now, 0.3, 0.2);
        break;
      case 'blocked':
        osc(c, bus, 'square', 900, 900, now, 0.08, 0.3);
        osc(c, bus, 'square', 1350, 1350, now + 0.06, 0.12, 0.25);
        break;
      case 'shield':
        [880, 1175, 1568].forEach((f, i) =>
          osc(c, bus, 'triangle', f, f, now + i * 0.06, 0.25, 0.35),
        );
        break;
      case 'wasted':
        osc(c, bus, 'square', 330, 220, now, 0.25, 0.25);
        break;
      case 'vs':
        osc(c, bus, 'sawtooth', 220, 880, now, 0.35, 0.3);
        noiseHit(c, bus, now + 0.3, 0.2, 0.6, 'highpass', 3000);
        break;
      case 'clash':
        noiseHit(c, bus, now, 0.18, 0.9, 'bandpass', 2500);
        osc(c, bus, 'sine', 200, 60, now, 0.2, 0.8);
        break;
      case 'draw':
        osc(c, bus, 'triangle', 520, 520, now, 0.1, 0.3);
        osc(c, bus, 'triangle', 520, 520, now + 0.14, 0.1, 0.3);
        break;
      case 'score':
        osc(c, bus, 'square', 988, 1319, now, 0.12, 0.3);
        break;
      case 'qualify':
        [784, 988, 1175, 1568].forEach((f, i) =>
          osc(c, bus, 'square', f, f, now + i * 0.08, 0.16, 0.25),
        );
        break;
      case 'suddenDeath':
        [440, 415, 392, 370].forEach((f, i) =>
          osc(c, bus, 'sawtooth', f, f, now + i * 0.15, 0.2, 0.3),
        );
        break;
      case 'coin':
        osc(c, bus, 'square', 988, 988, now, 0.07, 0.3);
        osc(c, bus, 'square', 1319, 1319, now + 0.07, 0.35, 0.3);
        break;
      case 'fight':
        noiseHit(c, bus, now, 0.3, 0.9, 'lowpass', 900);
        osc(c, bus, 'sawtooth', 110, 55, now, 0.5, 0.6);
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          osc(c, bus, 'square', f, f, now + i * 0.12, i === 5 ? 0.6 : 0.14, 0.3),
        );
        break;
    }
  }

  function duck() {
    const c = running();
    if (!c || !musicBus) return;
    const level = musicLevel() * 0.35;
    musicBus.gain.setTargetAtTime(level * 0.35, c.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(level, c.currentTime + 0.35, 0.1);
  }

  return {
    webAudio: !!Ctor,
    speech: chanter.available,
    unlock() {
      if (!Ctor) return;
      try {
        if (!ctx) {
          ctx = new Ctor();
          ensureGraph(ctx);
        }
        if (ctx.state === 'suspended') {
          void ctx
            .resume()
            .then(syncMusic)
            .catch(() => undefined);
        } else {
          syncMusic();
        }
      } catch {
        ctx = null;
      }
    },
    apply(next, url) {
      settings = next;
      customUrl = url;
      applyLevels();
      syncMusic();
    },
    setMusic(theme) {
      desiredTheme = theme;
      syncMusic();
    },
    setPaused(value) {
      paused = value;
      if (value) {
        chanter.cancel();
        if (pendingAnnounce) clearTimeout(pendingAnnounce);
        pendingAnnounce = null;
      }
      syncMusic();
    },
    sfx: playSfx,
    chant(word) {
      chanter.speak(word, settings?.voiceURI ?? null, voiceLevel());
      const c = running();
      if (c && sfxBus && sfxLevel() > 0) {
        if (word === 'YO') {
          osc(c, sfxBus, 'sine', 160, 40, c.currentTime, 0.35, 1);
          noiseHit(c, sfxBus, c.currentTime, 0.2, 0.6, 'bandpass', 2000);
        } else {
          osc(
            c,
            sfxBus,
            'sine',
            word === 'MOT' ? 120 : word === 'HAI' ? 140 : 165,
            50,
            c.currentTime,
            0.2,
            0.9,
          );
        }
      }
      duck();
    },
    announce(text) {
      if (settings && !settings.announcer) return;
      if (pendingAnnounce) clearTimeout(pendingAnnounce);
      const speak = () => {
        pendingAnnounce = null;
        chanter.announce(text, voiceLevel());
        duck();
      };
      const wait = announceDelayMs(lastSfxAt, performance.now());
      if (wait > 0) pendingAnnounce = setTimeout(speak, wait);
      else speak();
    },
    listVoices: () => chanter.listVoices(),
    onVoicesChanged: (listener) => chanter.onVoicesChanged(listener),
    dispose() {
      if (pendingAnnounce) clearTimeout(pendingAnnounce);
      stopSequencer();
      customEl?.pause();
      customEl = null;
      chanter.cancel();
      void ctx?.close().catch(() => undefined);
      ctx = null;
      master = null;
    },
  };
}
