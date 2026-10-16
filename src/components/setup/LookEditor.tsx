import { useEffect, useId, useRef, useState, type Ref } from 'react';
import {
  ACCENT_COLOURS,
  FACE_EXTRAS,
  HAIR_COLOURS,
  HAIR_STYLES,
  HEADWEAR,
  LOOK_LABELS,
  lookFor,
  neutralLook,
  OUTFIT_COLOURS,
  OUTFITS,
  RACE_SKIN,
  RACES,
  type Race,
  CUSTOM_COLOUR,
  FANTASY_SKIN_TONES,
  NATURAL_SKIN_TONES,
  type FighterLook,
  type Swatch,
} from '../../game/config/looks';
import type { Participant } from '../../game/setup/roster';
import { FighterSprite } from '../sprites/icons';

interface LookEditorProps {
  readonly person: Participant;
  /** null = go back to the neutral look derived from the name. */
  readonly onSave: (look: FighterLook | null) => void;
  readonly onClose: () => void;
}

/** "Change look" picker (owner decision 2026-10-10). Cosmetic only; saved with the roster. */
export function LookEditor({ person, onSave, onClose }: LookEditorProps) {
  const titleId = useId();
  const [look, setLook] = useState<FighterLook>(() => lookFor(person.name, person.look));
  const [custom, setCustom] = useState(!!person.look);
  // Light by default so dark outfits and hair are easy to see (owner request 2026-10-16).
  const [darkPreview, setDarkPreview] = useState(false);
  const firstField = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const change = (patch: Partial<FighterLook>) => {
    setLook((l) => ({ ...l, ...patch }));
    setCustom(true);
  };

  function randomize() {
    // A fresh neutral look (never religious headwear), like a new default.
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    setLook(neutralLook(`${person.name}#${values[0]}`));
    setCustom(true);
  }

  function select<K extends 'hair' | 'headwear' | 'face' | 'outfit'>(
    key: K,
    label: string,
    options: readonly FighterLook[K][],
    ref?: Ref<HTMLSelectElement>,
  ) {
    const labels = LOOK_LABELS[key] as Record<string, string>;
    const id = `${titleId}-${key}`;
    return (
      <div className="look-editor__field">
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          ref={ref}
          value={look[key]}
          onChange={(e) => change({ [key]: e.target.value } as Partial<FighterLook>)}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {labels[o]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function swatches(
    key: 'skin' | 'hairColour' | 'outfitColour' | 'accent',
    label: string,
    list: readonly Swatch[],
  ) {
    return (
      <div className="look-editor__swatches" role="group" aria-label={label}>
        <span className="look-editor__swatch-label">{label}</span>
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            className="look-editor__swatch"
            style={{ background: s.hex }}
            aria-label={`${label}: ${s.label}`}
            aria-pressed={look[key] === s.id}
            title={s.label}
            onClick={() => change({ [key]: s.id } as Partial<FighterLook>)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pause-backdrop" onClick={onClose}>
      <div
        className="panel look-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="panel__title">
          Look: {person.name}
        </h2>
        <div className="look-editor__body">
          <div
            className={`look-editor__preview${darkPreview ? ' look-editor__preview--dark' : ''}`}
            data-testid="look-preview"
          >
            <FighterSprite seed={person.name} look={look} size={160} idle />
            <p className="look-editor__preview-note">
              {custom ? 'Custom look' : 'Default look (from the name)'}
            </p>
            <button
              type="button"
              className="button button--small"
              aria-pressed={darkPreview}
              onClick={() => setDarkPreview((d) => !d)}
            >
              {darkPreview ? 'Light background' : 'Dark background'}
            </button>
          </div>
          <div className="look-editor__fields">
            {select('hair', 'Hair', HAIR_STYLES, firstField)}
            {select('headwear', 'Headwear', HEADWEAR)}
            {select('face', 'Face', FACE_EXTRAS)}
            {select('outfit', 'Outfit', OUTFITS)}
            <div className="look-editor__field">
              <label htmlFor={`${titleId}-race`}>Race</label>
              <select
                id={`${titleId}-race`}
                value={look.race ?? 'human'}
                onChange={(e) => {
                  const race = e.target.value as Race;
                  const skin = RACE_SKIN[race];
                  change({ race, ...(skin ? { skin } : {}) });
                }}
              >
                {RACES.map((r) => (
                  <option key={r} value={r}>
                    {LOOK_LABELS.race[r]}
                  </option>
                ))}
              </select>
            </div>
            {swatches('skin', 'Skin tone', NATURAL_SKIN_TONES)}
            <div className="look-editor__swatches" role="group" aria-label="Fun skin">
              <span className="look-editor__swatch-label">Fun skin (cosplay)</span>
              {FANTASY_SKIN_TONES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="look-editor__swatch"
                  style={{ background: s.hex }}
                  aria-label={`Skin: ${s.label}`}
                  aria-pressed={look.skin === s.id}
                  title={s.label}
                  onClick={() => change({ skin: s.id })}
                />
              ))}
              <label
                className="look-editor__any-colour"
                data-selected={CUSTOM_COLOUR.test(look.skin) ? 'true' : undefined}
              >
                <input
                  type="color"
                  aria-label="Skin: any colour"
                  value={CUSTOM_COLOUR.test(look.skin) ? look.skin : '#6fbf4a'}
                  onChange={(e) => change({ skin: e.target.value.toLowerCase() })}
                />
                Any colour…
              </label>
            </div>
            {swatches('hairColour', 'Hair colour', HAIR_COLOURS)}
            {swatches('outfitColour', 'Outfit colour', OUTFIT_COLOURS)}
            {swatches('accent', 'Accent / headwear colour', ACCENT_COLOURS)}
          </div>
        </div>
        <div className="look-editor__actions">
          <button type="button" className="button button--small" onClick={randomize}>
            Random
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              onSave(null);
              onClose();
            }}
          >
            Use default
          </button>
          <span className="look-editor__spacer" />
          <button type="button" className="button button--small" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              onSave(custom ? look : null);
              onClose();
            }}
          >
            Save look
          </button>
        </div>
      </div>
    </div>
  );
}
