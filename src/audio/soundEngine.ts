import type { ChantWord } from '../animation/finaleTimeline';
import type { StageId } from '../game/config/stages';
import type { AudioSettings } from './audioSettings';
import { noteToFrequency, stepSeconds, STEPS_PER_LOOP, THEMES, type MusicTheme } from './chiptune';
import { FANFARES, FANFARE_STEPS } from './fanfares';
import { createChanter, type VoiceInfo } from './voice';
import {
  ANNOUNCE_CLIP,
  CHANT_CLIP,
  parseManifest,
  VOICE_BASE,
  type VoiceClipId,
} from './voiceClips';

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
  | 'fight'
  | 'count';

/**
 * All sound in the app. Music and effects are synthesized at runtime (Web Audio); voices come from
 * recorded clips in `public/voice/` when present, otherwise the browser's speech. Every method is
 * a safe no-op when audio is unavailable or the browser has not been unlocked by a gesture yet.
 */
export interface SoundEngine {
  readonly webAudio: boolean;
  readonly speech: boolean;
  unlock(): void;
  apply(settings: AudioSettings, customMusicUrl: string | null): void;
  /** Desired background loop; starts as soon as audio is unlocked. */
  setMusic(theme: MusicTheme | null): void;
  setPaused(paused: boolean): void;
  /** Built-in music tempo multiplier (finale rising pace); 1 = normal. */
  setMusicRate(rate: number): void;
  /**
   * Layered music intensity (finale "music that builds"): 0 drums + bass, 1 + lead,
   * 2 + arpeggio and extra hats, 3 everything one semitone up. null = play every layer.
   */
  setMusicIntensity(level: number | null): void;
  /** Silences the music for `ms`, then brings it back ("last point" held breath). */
  musicDrop(ms: number): void;
  sfx(name: SfxName): void;
  /** Victory jingle for the stage (falls back to the generic victory sting). */
  fanfare(stage: StageId | null): void;
  chant(word: ChantWord): void;
  /** Arcade announcer line; a recorded clip if there is one, else the English voice. */
  announce(text: string): void;
  /** Recorded voice clips that are loaded and ready. */
  loadedClips(): readonly VoiceClipId[];
  onClipsChanged(listener: () => void): () => void;
  listVoices(): VoiceInfo[];
  onVoicesChanged(listener: () => void): () => void;
  dispose(): void;
}

const LOOKAHEAD_S = 0.15;
const SCHEDULER_MS = 30;
/** A new chant word quickly fades the previous one so fast beats never smear. */
const CHANT_FADE_S = 0.04;
const SEMITONE = 2 ** (1 / 12);

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
  let voiceBus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let desiredTheme: MusicTheme | null = null;
  let paused = false;
  let sequencer: { theme: MusicTheme; stop: () => void } | null = null;
  let customEl: HTMLAudioElement | null = null;
  let musicRate = 1;
  let musicIntensity: number | null = null;
  /** Audio-clock time until which the music is dropped out (ducking waits). */
  let dropUntil = 0;
  let dropTimer: ReturnType<typeof setTimeout> | null = null;
  const clips = new Map<VoiceClipId, AudioBuffer>();
  const clipListeners = new Set<() => void>();
  let clipsRequested = false;
  let lastChant: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

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
    voiceBus = c.createGain();
    voiceBus.connect(master);
    noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyLevels();
  }

  function applyLevels() {
    const c = ctx;
    if (c && musicBus && sfxBus && voiceBus) {
      musicBus.gain.setTargetAtTime(musicLevel() * 0.35, c.currentTime, 0.03);
      sfxBus.gain.setTargetAtTime(sfxLevel() * 0.6, c.currentTime, 0.03);
      voiceBus.gain.setTargetAtTime(voiceLevel(), c.currentTime, 0.03);
    }
    if (customEl) customEl.volume = musicLevel();
  }

  // ---------- recorded voice clips ----------
  async function loadClips(c: AudioContext) {
    if (clipsRequested) return;
    clipsRequested = true;
    const base = `${import.meta.env.BASE_URL}${VOICE_BASE}`;
    let ids: VoiceClipId[] = [];
    try {
      const res = await fetch(`${base}manifest.json`);
      if (res.ok) ids = parseManifest(await res.json());
    } catch {
      return;
    }
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`${base}${id}.mp3`);
          if (!res.ok) return;
          clips.set(id, await c.decodeAudioData(await res.arrayBuffer()));
        } catch {
          // A broken clip simply falls back to the browser voice.
        }
      }),
    );
    clipListeners.forEach((l) => l());
  }

  /** Plays a clip now on the voice bus; true when it played. */
  function playClip(id: VoiceClipId, isChant: boolean): boolean {
    const c = running();
    const buffer = clips.get(id);
    if (!c || !voiceBus || !buffer) return false;
    if (voiceLevel() <= 0) return true; // muted voices: nothing to say, but no TTS fallback either
    if (isChant && lastChant) {
      const { src, gain } = lastChant;
      gain.gain.setTargetAtTime(0, c.currentTime, CHANT_FADE_S / 3);
      src.stop(c.currentTime + CHANT_FADE_S);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    src.connect(gain).connect(voiceBus);
    src.start();
    if (isChant) lastChant = { src, gain };
    return true;
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
    src.loop = seconds > 0.5;
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

  function drum(c: AudioContext, bus: AudioNode, hit: string, at: number) {
    if (hit === 'K') osc(c, bus, 'sine', 150, 40, at, 0.15, 0.9);
    else if (hit === 'S') noiseHit(c, bus, at, 0.12, 0.5, 'bandpass', 1800);
    else if (hit === 'H') noiseHit(c, bus, at, 0.04, 0.25, 'highpass', 7000);
    else if (hit === 'T') osc(c, bus, 'sine', 110, 55, at, 0.25, 0.9);
    else if (hit === 'G') {
      // Gong: low, long, slightly detuned partials with a soft noise wash.
      osc(c, bus, 'sine', 98, 92, at, 1.8, 0.7);
      osc(c, bus, 'sine', 147, 140, at, 1.4, 0.35);
      noiseHit(c, bus, at, 1.2, 0.18, 'lowpass', 900);
    } else if (hit === 'C') noiseHit(c, bus, at, 1.0, 0.35, 'highpass', 5000);
  }

  // ---------- built-in music ----------
  function startSequencer(theme: MusicTheme) {
    const c = running();
    if (!c || !musicBus) return;
    stopSequencer();
    const t = THEMES[theme];
    let next = c.currentTime + 0.05;
    let index = 0;
    const timer = setInterval(() => {
      while (next < c.currentTime + LOOKAHEAD_S) {
        // Read every step so tempo and intensity changes apply at the next note.
        const step = stepSeconds(t) / musicRate;
        const level = t.layered && musicIntensity !== null ? musicIntensity : 3;
        const pitch = t.layered && musicIntensity !== null && level >= 3 ? SEMITONE : 1;
        const i = index % STEPS_PER_LOOP;
        const lead = level >= 1 ? t.lead[i] : null;
        const bass = t.bass[i];
        const arp = level >= 2 ? t.arp?.[i] : null;
        const hit = t.drums[i];
        const extra = level >= 2 ? t.drumsExtra?.[i] : null;
        if (lead) {
          const f = noteToFrequency(lead) * pitch;
          osc(c, musicBus!, 'square', f, f, next, step * 1.8, 0.16);
        }
        if (arp) {
          const f = noteToFrequency(arp) * pitch;
          osc(c, musicBus!, 'square', f, f, next, step * 0.9, 0.07);
        }
        if (bass) {
          const f = noteToFrequency(bass) * pitch;
          osc(c, musicBus!, 'triangle', f, f, next, step * 0.95, 0.5);
        }
        if (hit) drum(c, musicBus!, hit, next);
        if (extra) drum(c, musicBus!, extra, next);
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
      case 'count':
        // Rock-paper-scissors count beat: a short drum thump.
        osc(c, bus, 'sine', 150, 50, now, 0.2, 0.9);
        noiseHit(c, bus, now, 0.06, 0.25, 'highpass', 3000);
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

  function playFanfare(stage: StageId | null) {
    const c = running();
    if (!stage || !c || !sfxBus || sfxLevel() <= 0) {
      playSfx('victory');
      return;
    }
    const f = FANFARES[stage];
    const step = 60 / f.bpm / 4;
    const start = c.currentTime + 0.05;
    const lastLead = f.lead.reduce<number>((last, n, i) => (n ? i : last), -1);
    for (let i = 0; i < FANFARE_STEPS; i++) {
      const at = start + i * step;
      const lead = f.lead[i];
      const bass = f.bass[i];
      const hit = f.drums[i];
      if (lead) {
        const hz = noteToFrequency(lead);
        const dur = i === lastLead ? f.ringSteps * step : step * 1.8;
        osc(c, sfxBus, f.wave, hz, hz, at, dur, 0.22);
        // A soft fifth under the final note makes it ring like a chord.
        if (i === lastLead) osc(c, sfxBus, 'triangle', hz / 1.5, hz / 1.5, at, dur, 0.12);
      }
      if (bass) {
        const hz = noteToFrequency(bass);
        osc(c, sfxBus, 'triangle', hz, hz, at, step * 1.6, 0.45);
      }
      if (hit) drum(c, sfxBus, hit, at);
    }
  }

  function duck() {
    const c = running();
    if (!c || !musicBus || c.currentTime < dropUntil) return;
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
          void loadClips(ctx);
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
      if (value) chanter.cancel();
      syncMusic();
    },
    setMusicRate(rate) {
      musicRate = Math.min(2, Math.max(0.5, rate));
    },
    setMusicIntensity(level) {
      musicIntensity = level === null ? null : Math.min(3, Math.max(0, Math.round(level)));
    },
    musicDrop(ms) {
      const seconds = Math.max(0, ms) / 1000;
      const c = running();
      if (c && musicBus) {
        const now = c.currentTime;
        const gain = musicBus.gain;
        if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
        else gain.cancelScheduledValues(now);
        gain.setTargetAtTime(0.0001, now, 0.03);
        gain.setTargetAtTime(musicLevel() * 0.35, now + seconds, 0.04);
        dropUntil = now + seconds;
      }
      if (customEl) {
        const el = customEl;
        el.volume = 0;
        if (dropTimer) clearTimeout(dropTimer);
        dropTimer = setTimeout(() => {
          el.volume = musicLevel();
          dropTimer = null;
        }, ms);
      }
    },
    sfx: playSfx,
    fanfare: playFanfare,
    chant(word) {
      if (!playClip(CHANT_CLIP[word], true)) {
        chanter.speak(word, settings?.voiceURI ?? null, voiceLevel());
      }
      const c = running();
      if (c && sfxBus && sfxLevel() > 0) {
        if (word === 'JUICE') {
          osc(c, sfxBus, 'sine', 160, 40, c.currentTime, 0.35, 1);
          noiseHit(c, sfxBus, c.currentTime, 0.2, 0.6, 'bandpass', 2000);
        } else {
          osc(c, sfxBus, 'sine', word === 'ONE' ? 120 : 145, 50, c.currentTime, 0.2, 0.9);
        }
      }
      duck();
    },
    announce(text) {
      if (settings && !settings.announcer) return;
      const clip = ANNOUNCE_CLIP[text];
      if (!clip || !playClip(clip, false)) chanter.announce(text, voiceLevel());
      duck();
    },
    loadedClips: () => [...clips.keys()],
    onClipsChanged(listener) {
      clipListeners.add(listener);
      return () => clipListeners.delete(listener);
    },
    listVoices: () => chanter.listVoices(),
    onVoicesChanged: (listener) => chanter.onVoicesChanged(listener),
    dispose() {
      stopSequencer();
      customEl?.pause();
      customEl = null;
      chanter.cancel();
      clipListeners.clear();
      void ctx?.close().catch(() => undefined);
      ctx = null;
      master = null;
    },
  };
}
