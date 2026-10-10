import type { ChantWord } from '../animation/finaleTimeline';

/** The chant is spoken by the browser's own text-to-speech ("AI voice"): no audio files. */
export interface VoiceInfo {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
}

/** "1, 2, Juice!" (owner decision 2026-10-10), spoken in English. */
const CHANT_TEXT: Readonly<Record<ChantWord, string>> = {
  ONE: 'One',
  TWO: 'Two',
  JUICE: 'Juice!',
};

export function chantText(word: ChantWord): string {
  return CHANT_TEXT[word];
}

const prefersNatural = (v: VoiceInfo) => /natural|online|neural/i.test(v.name);

/** The host's chosen voice if still available; otherwise English (natural first), then any. */
export function pickVoice(
  voices: readonly VoiceInfo[],
  preferredURI: string | null,
): VoiceInfo | null {
  if (preferredURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  return pickAnnouncerVoice(voices) ?? voices[0] ?? null;
}

/** The announcer always speaks English (UI language), natural/online voices first. */
export function pickAnnouncerVoice(voices: readonly VoiceInfo[]): VoiceInfo | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return english.find(prefersNatural) ?? english[0] ?? null;
}

export interface Chanter {
  readonly available: boolean;
  listVoices(): VoiceInfo[];
  onVoicesChanged(listener: () => void): () => void;
  speak(word: ChantWord, preferredURI: string | null, volume: number): void;
  /** Announcer line in an English voice; silent when no English voice is installed. */
  announce(text: string, volume: number): void;
  cancel(): void;
}

export function createChanter(
  synth: SpeechSynthesis | undefined = globalThis.speechSynthesis,
): Chanter {
  const Utterance = globalThis.SpeechSynthesisUtterance;
  if (!synth || !Utterance) {
    return {
      available: false,
      listVoices: () => [],
      onVoicesChanged: () => () => undefined,
      speak() {},
      announce() {},
      cancel() {},
    };
  }
  const voices = () => synth.getVoices();
  return {
    available: true,
    listVoices: () => voices().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })),
    onVoicesChanged(listener) {
      synth.addEventListener('voiceschanged', listener);
      return () => synth.removeEventListener('voiceschanged', listener);
    },
    speak(word, preferredURI, volume) {
      if (volume <= 0) return;
      const all = voices();
      const info = pickVoice(
        all.map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })),
        preferredURI,
      );
      const utterance = new Utterance(chantText(word));
      const voice = all.find((v) => v.voiceURI === info?.voiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 1.2;
      utterance.pitch = word === 'JUICE' ? 1.15 : 1;
      utterance.volume = Math.min(1, Math.max(0, volume));
      synth.cancel(); // never let words queue up behind the beat
      synth.speak(utterance);
    },
    announce(text, volume) {
      if (volume <= 0) return;
      const all = voices();
      const info = pickAnnouncerVoice(
        all.map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })),
      );
      const voice = all.find((v) => v.voiceURI === info?.voiceURI);
      if (!voice) return;
      const utterance = new Utterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 1.05;
      utterance.pitch = 0.7; // deep arcade announcer
      utterance.volume = Math.min(1, Math.max(0, volume));
      synth.cancel();
      synth.speak(utterance);
    },
    cancel() {
      synth.cancel();
    },
  };
}
