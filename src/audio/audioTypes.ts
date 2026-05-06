import { createContext } from 'react';

export const SFX = {
  reveal:    '/audio/reveal-ding.mp3',
  strike:    '/audio/strike-sting.mp3',
  matchEnd:  '/audio/match-end.mp3',
  champion:  '/audio/champion-fanfare.mp3',
  fmTick:    '/audio/fm-tick.mp3',
  fmTimeUp:  '/audio/fm-time-up.mp3',
} as const;

export type SfxName = keyof typeof SFX;

export type AudioCtxValue = {
  unlocked: boolean;
  unlock: () => void;
  play: (name: SfxName) => void;
};

export const AudioCtx = createContext<AudioCtxValue | null>(null);
