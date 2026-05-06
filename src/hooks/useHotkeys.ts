import { useEffect } from 'react';

type Binding = { combo: string; handler: () => void; description: string };

export function useHotkeys(bindings: Binding[]) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't intercept hotkeys when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const combo = [
        e.metaKey || e.ctrlKey ? 'mod' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase(),
      ].filter(Boolean).join('+');
      const match = bindings.find(b => b.combo === combo);
      if (match) {
        e.preventDefault();
        match.handler();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindings]);
}
