import { useSyncExternalStore } from 'react';

/** Minimal hash router: `#/learn/basics` -> ['learn', 'basics']. */
function read(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

let current = read();
const listeners = new Set<() => void>();

window.addEventListener('hashchange', () => {
  current = read();
  listeners.forEach((l) => l());
});

export function useRoute(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export function navigate(path: string) {
  const target = `#/${path.replace(/^\/+/, '')}`;
  if (window.location.hash !== target) window.location.hash = target;
}
