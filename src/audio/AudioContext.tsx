import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

const SFX = {
  reveal:    '/audio/reveal-ding.mp3',
  strike:    '/audio/strike-sting.mp3',
  matchEnd:  '/audio/match-end.mp3',
  champion:  '/audio/champion-fanfare.mp3',
  fmTick:    '/audio/fm-tick.mp3',
  fmTimeUp:  '/audio/fm-time-up.mp3',
};
export type SfxName = keyof typeof SFX;

type AudioCtx = {
  unlocked: boolean;
  unlock: () => void;
  play: (name: SfxName) => void;
};
const Ctx = createContext<AudioCtx | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const cache = useRef<Record<string, HTMLAudioElement>>({});

  const unlock = useCallback(() => {
    Object.entries(SFX).forEach(([k, path]) => {
      const a = new Audio(path);
      a.volume = 0.7;
      cache.current[k] = a;
      // Touch each clip to satisfy browser autoplay policy; ignore errors
      // (placeholder 0-byte files will 404 or fail silently)
      a.play().then(() => a.pause()).catch(() => {});
    });
    setUnlocked(true);
  }, []);

  const play = useCallback((name: SfxName) => {
    if (!unlocked) return;
    const a = cache.current[name];
    if (!a) return;
    a.currentTime = 0;
    // Fail gracefully — placeholder files may 404 or be empty
    a.play().catch(() => {});
  }, [unlocked]);

  return <Ctx.Provider value={{ unlocked, unlock, play }}>{children}</Ctx.Provider>;
}

export function useSfx() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSfx must be used within AudioProvider');
  return v;
}
