import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SpotScore {
  hands: number;
  matches: number;
}

interface ProgressState {
  hands: number;
  matches: number;
  streak: number;
  bestStreak: number;
  bySpot: Record<string, SpotScore>;
  record: (spotId: string, matched: boolean) => void;
  reset: () => void;
}

const empty = {
  hands: 0,
  matches: 0,
  streak: 0,
  bestStreak: 0,
  bySpot: {} as Record<string, SpotScore>,
};

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      ...empty,
      record: (spotId, matched) =>
        set((state) => {
          const prev = state.bySpot[spotId] ?? { hands: 0, matches: 0 };
          const streak = matched ? state.streak + 1 : 0;
          return {
            hands: state.hands + 1,
            matches: state.matches + (matched ? 1 : 0),
            streak,
            bestStreak: Math.max(state.bestStreak, streak),
            bySpot: {
              ...state.bySpot,
              [spotId]: {
                hands: prev.hands + 1,
                matches: prev.matches + (matched ? 1 : 0),
              },
            },
          };
        }),
      reset: () => set(empty),
    }),
    { name: "linebook-progress-v1", skipHydration: true },
  ),
);

export function useHydrateProgress(): void {
  useEffect(() => {
    void useProgress.persist.rehydrate();
  }, []);
}
