import { createContext } from 'react';
import type { StageId } from '../../game/config/stages';

/** Stage of the match on screen (null outside a match). Drawn behind the preview and finale. */
export const StageContext = createContext<StageId | null>(null);
