import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { useSound } from '../../audio/soundContext';
import { pickVoice } from '../../audio/voice';
import { VOICE_CLIP_LABELS, VOICE_CLIPS } from '../../audio/voiceClips';
import type { ChantWord } from '../../animation/finaleTimeline';
import { MAX_ASSET_BYTES } from '../../storage/assetStorage';

const VOLUME_LABELS = { music: 'Music', voice: 'Voices', sfx: 'Effects' } as const;
const TEST_WORDS: ChantWord[] = ['ONE', 'TWO', 'JUICE'];

/** Sound settings for the host. Everything stays in this browser. */
export function SoundSettings() {
  const {
    engine,
    settings,
    update,
    toggleMute,
    voices,
    customMusic,
    setCustomMusic,
    removeCustomMusic,
  } = useSound();
  const titleId = useId();
  const fileId = useId();
  const [fileError, setFileError] = useState<string | null>(null);
  // Recorded voice clips load in the background after the first click; show which are ready.
  const [clips, setClips] = useState(() => engine.loadedClips());
  useEffect(() => engine.onClipsChanged(() => setClips(engine.loadedClips())), [engine]);
  const active = pickVoice(voices, settings.voiceURI);

  function testVoice() {
    engine.unlock();
    TEST_WORDS.forEach((word, i) => setTimeout(() => engine.chant(word), i * 600));
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setFileError('Please choose an audio file (mp3, ogg, wav, m4a…).');
      return;
    }
    setFileError(await setCustomMusic(file));
  }

  return (
    <section className="panel sound-settings" aria-labelledby={titleId}>
      <div className="panel__header">
        <h2 id={titleId} className="panel__title">
          Sound
        </h2>
        <button
          type="button"
          className="button button--small"
          aria-pressed={!settings.muted}
          onClick={toggleMute}
        >
          {settings.muted ? 'Off' : 'On'}
        </button>
      </div>

      {(['music', 'voice', 'sfx'] as const).map((layer) => (
        <label key={layer} className="slider">
          <span>{VOLUME_LABELS[layer]}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings[layer] * 100)}
            onChange={(e) => update({ [layer]: Number(e.target.value) / 100 })}
          />
        </label>
      ))}

      <label className="field-label" htmlFor={`${titleId}-voice`}>
        Chant voice
      </label>
      <div className="sound-settings__row">
        <select
          id={`${titleId}-voice`}
          value={settings.voiceURI ?? ''}
          onChange={(e) => update({ voiceURI: e.target.value || null })}
          disabled={!engine.speech}
        >
          <option value="">Automatic{active ? ` (${active.name})` : ''}</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button button--small"
          onClick={testVoice}
          disabled={!engine.speech}
        >
          Test
        </button>
      </div>
      <p className="hint">
        {!engine.speech
          ? 'This browser has no speech voices; the chant plays as drum beats only.'
          : 'The finale chant “1, 2, Juice!” is spoken in this voice.'}
      </p>

      <label className="sound-settings__toggle">
        <input
          type="checkbox"
          checked={settings.announcer}
          disabled={!engine.speech}
          onChange={(e) => update({ announcer: e.target.checked })}
        />{' '}
        Announcer (“K.O.!”, “Round 1… Fight!”, English voice)
      </label>

      <p className="hint" data-testid="voice-clips">
        Recorded voices:{' '}
        {VOICE_CLIPS.map((id, i) => (
          <span key={id}>
            {i > 0 && ' · '}
            {VOICE_CLIP_LABELS[id]} {clips.includes(id) ? '✓' : '(computer voice)'}
          </span>
        ))}
      </p>

      <fieldset className="fieldset sound-settings__music">
        <legend className="field-label">Match music</legend>
        <label>
          <input
            type="radio"
            name="music-source"
            checked={settings.musicSource === 'builtin'}
            onChange={() => update({ musicSource: 'builtin' })}
          />{' '}
          Built-in chiptune (original)
        </label>
        <label>
          <input
            type="radio"
            name="music-source"
            checked={settings.musicSource === 'custom'}
            disabled={!customMusic}
            onChange={() => update({ musicSource: 'custom' })}
          />{' '}
          My music file{customMusic ? `: ${customMusic.name}` : ''}
        </label>
        <div className="sound-settings__row">
          <label htmlFor={fileId} className="button button--small">
            {customMusic ? 'Replace file' : 'Choose file'}
          </label>
          <input id={fileId} className="sr-only" type="file" accept="audio/*" onChange={onFile} />
          {customMusic && (
            <button
              type="button"
              className="button button--small"
              onClick={() => void removeCustomMusic()}
            >
              Remove
            </button>
          )}
        </div>
        {fileError && (
          <p className="warning-list" role="alert">
            {fileError}
          </p>
        )}
        <p className="hint">
          Your file stays in this browser only and is never uploaded or built into the app. Use
          music you are allowed to play. Max {MAX_ASSET_BYTES / 1024 / 1024} MB. The finale always
          uses the built-in dramatic loop.
        </p>
      </fieldset>
    </section>
  );
}
