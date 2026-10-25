import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Consent for optional trackers. Only audience measurement is optional;
 * everything else stored by the app is strictly necessary.
 */
interface ConsentState {
  /** null until the visitor has made a choice. */
  analytics: boolean | null;
  decidedAt: number | null;
  setAnalytics: (value: boolean) => void;
  reopen: () => void;
}

export const useConsent = create<ConsentState>()(
  persist(
    (set) => ({
      analytics: null,
      decidedAt: null,
      setAnalytics: (value) => set({ analytics: value, decidedAt: Date.now() }),
      reopen: () => set({ analytics: null, decidedAt: null }),
    }),
    { name: 'arena.consent', version: 1 },
  ),
);
