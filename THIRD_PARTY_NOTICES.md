# Third-party notices

## Bundled assets

| Asset | Source | License | Use |
|---|---|---|---|
| Press Start 2P font | `@fontsource/press-start-2p` (npm), © 2012 The Press Start 2P Project Authors (cody@zone38.net), Reserved Font Name "Press Start 2P" | SIL Open Font License 1.1 (`node_modules/@fontsource/press-start-2p/LICENSE`) | Headings and big labels |

## Original to this project (no third-party rights)

- All pixel art (fighter sprites, Fate icons, rock/paper/scissors hands, crown) is drawn in code in `src/components/sprites/`.
- Both music loops are original compositions written in `src/audio/chiptune.ts` and synthesized at runtime with Web Audio. They do not transcribe any existing game music.
- All sound effects are synthesized at runtime in `src/audio/soundEngine.ts`.
- The "Một Hai Ba Yo" chant is spoken at runtime by the browser's built-in text-to-speech; no voice recording is bundled.

## Not bundled

- **Custom match music** chosen by the host is stored only in that browser's IndexedDB (`kof-assets`). It is never part of the repository, the build, or the deployed site. The host is responsible for having the right to play it.
- Copyrighted game music (e.g. from *The King of Fighters*) is intentionally **not** included.
