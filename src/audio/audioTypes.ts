import { createContext } from 'react';

export const SFX = {
  reveal:    '/audio/reveal-ding.wav',
  strike:    '/audio/strike-sting.wav',
  matchEnd:  '/audio/match-end.wav',
  champion:  '/audio/champion-fanfare.wav',
  fmTick:    '/audio/fm-tick.wav',
  fmTimeUp:  '/audio/fm-time-up.wav',
} as const;

export type SfxName = keyof typeof SFX;

export type AudioCtxValue = {
  unlocked: boolean;
  unlock: () => void;
  play: (name: SfxName) => void;
};

export const AudioCtx = createContext<AudioCtxValue | null>(null);
