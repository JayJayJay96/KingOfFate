import type { ChantWord } from '../animation/finaleTimeline';

/**
 * PLACEHOLDER finale audio, synthesized with Web Audio (no recorded or licensed assets):
 * drum hits for the chant, a low drone as "dramatic music", and a short victory jingle.
 * Phase 5 replaces this with the real chant recording and music. Every method is a safe no-op
 * when audio is unavailable or not yet unlocked by a host click.
 */
export interface FinaleAudio {
  readonly available: boolean;
  /** Must be called from a user gesture (click/key) to satisfy browser autoplay rules. */
  unlock(): void;
  setEnabled(enabled: boolean): void;
  chant(word: ChantWord): void;
  startMusic(): void;
  stopMusic(): void;
  victory(): void;
}

const SILENT: FinaleAudio = {
  available: false,
  unlock() {},
  setEnabled() {},
  chant() {},
  startMusic() {},
  stopMusic() {},
  victory() {},
};

const MASTER_VOLUME = 0.5;

export function createFinaleAudio(): FinaleAudio {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return SILENT;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = true;
  let music: { stop: () => void } | null = null;

  const ready = (): AudioContext | null => (ctx && ctx.state === 'running' ? ctx : null);

  function tone(
    from: number,
    to: number,
    seconds: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    const c = ready();
    if (!c || !master) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  return {
    available: true,
    unlock() {
      try {
        if (!ctx) {
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = enabled ? MASTER_VOLUME : 0;
          master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      } catch {
        ctx = null;
      }
    },
    setEnabled(next) {
      enabled = next;
      if (ctx && master)
        master.gain.setTargetAtTime(next ? MASTER_VOLUME : 0, ctx.currentTime, 0.02);
    },
    chant(word) {
      if (word === 'YO') {
        tone(140, 45, 0.35, 'sine', 1);
        tone(660, 1320, 0.22, 'square', 0.18);
      } else {
        tone(word === 'MOT' ? 120 : word === 'HAI' ? 150 : 180, 55, 0.2, 'sine', 0.9);
      }
    },
    startMusic() {
      const c = ready();
      if (!c || !master || music) return;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      const gain = c.createGain();
      gain.gain.value = 0.07;
      const oscs = [55, 55.4, 82.4].map((freq) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.connect(filter);
        o.start();
        return o;
      });
      filter.connect(gain).connect(master);
      music = {
        stop: () => {
          for (const o of oscs) o.stop();
          gain.disconnect();
        },
      };
    },
    stopMusic() {
      music?.stop();
      music = null;
    },
    victory() {
      [523, 659, 784, 1047].forEach((freq, i) =>
        tone(freq, freq, 0.28, 'triangle', 0.35, i * 0.13),
      );
    },
  };
}
