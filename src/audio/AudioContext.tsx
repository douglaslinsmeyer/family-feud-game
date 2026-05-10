import { useRef, useState, useCallback, type ReactNode } from 'react';
import { SFX, AudioCtx, type SfxName } from './audioTypes';

export function AudioProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const cache = useRef<Record<string, HTMLAudioElement>>({});

  const unlock = useCallback(() => {
    Object.entries(SFX).forEach(([k, path]) => {
      const a = new Audio(path);
      a.volume = 0.7;
      cache.current[k] = a;
      // Touch each clip to satisfy browser autoplay policy; ignore errors.
      a.play().then(() => a.pause()).catch(() => {});
    });
    setUnlocked(true);
  }, []);

  const play = useCallback((name: SfxName) => {
    if (!unlocked) return;
    const a = cache.current[name];
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [unlocked]);

  return <AudioCtx.Provider value={{ unlocked, unlock, play }}>{children}</AudioCtx.Provider>;
}
