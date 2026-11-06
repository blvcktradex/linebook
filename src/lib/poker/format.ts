import type { ActionDef } from "../solutions/types.ts";

export function bb(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}bb`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Solver-style percent: 54.7% when it isn't a whole number, otherwise 55%. */
export function pct1(n: number): string {
  const value = Math.round(n * 1000) / 10;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export function actionColor(action: Pick<ActionDef, "type" | "sizePotPct">): string {
  if (action.type === "fold") return "var(--color-fold)";
  if (action.type === "check") return "var(--color-check)";
  if (action.type === "call") return "var(--color-call)";
  if (action.type === "raise") return "var(--color-raise)";
  if ((action.sizePotPct ?? 0) >= 100) return "var(--color-raise)";
  if ((action.sizePotPct ?? 0) >= 60) return "var(--color-bet)";
  return "var(--color-bet-sm)";
}

export function historyColor(action: string): string {
  const label = action.toLowerCase();
  if (label.includes("fold")) return "var(--color-fold)";
  if (label.includes("check")) return "var(--color-check)";
  if (label.includes("call")) return "var(--color-call)";
  if (label.includes("raise") || label.includes("all")) return "var(--color-raise)";
  if (label.includes("75") || label.includes("100") || label.includes("125") || label.includes("150")) return "var(--color-bet)";
  if (label.includes("bet") || label.includes("jam")) return "var(--color-bet-sm)";
  return "var(--color-surface-2)";
}

export function strategyFill(actions: ActionDef[], freq: number[]): string {
  let cursor = 0;
  const stops: string[] = [];
  actions.forEach((action, index) => {
    const share = (freq[index] ?? 0) * 100;
    const next = cursor + share;
    if (share > 0) stops.push(`${actionColor(action)} ${cursor}% ${next}%`);
    cursor = next;
  });
  if (!stops.length) return "var(--color-cell)";
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function dominantAction(actions: ActionDef[], freq: number[]): ActionDef {
  let best = 0;
  for (let i = 1; i < freq.length; i++) if ((freq[i] ?? 0) > (freq[best] ?? 0)) best = i;
  return actions[best] ?? actions[0];
}
