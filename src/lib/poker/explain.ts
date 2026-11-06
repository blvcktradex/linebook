import { prettyCombo } from "./cards.ts";
import { primaryLabel } from "./classify.ts";
import type { ActionDef, ComboLine } from "../solutions/types.ts";

export function explainCombo(combo: ComboLine, actions: ActionDef[]): string {
  const ranked = actions
    .map((action, index) => ({ action, freq: combo.freq[index] ?? 0, ev: combo.evs[index] ?? 0 }))
    .sort((a, b) => b.freq - a.freq);
  const shown = ranked.filter((row) => row.freq >= 0.08);
  const mix = (shown.length ? shown : ranked.slice(0, 1))
    .map((row) => `${row.action.label} ${Math.round(row.freq * 100)}%`)
    .join(" · ");
  let bestEv = 0;
  for (let i = 1; i < combo.evs.length; i++) if (combo.evs[i] > combo.evs[bestEv]) bestEv = i;
  const equity = `${Math.round(combo.equity * 100)}%`;
  return `${prettyCombo(combo.cards)} is ${primaryLabel(combo.primary)} with ${equity} equity against the opposing range. The study mix is ${mix}. Highest study EV is ${actions[bestEv]?.label ?? "this mix"} (${combo.evs[bestEv]?.toFixed(2)}bb).`;
}

export function explainRange(freq: number[], actions: ActionDef[], note: string): string {
  const parts = actions.map((action, index) => `${action.label} ${Math.round((freq[index] ?? 0) * 100)}%`);
  return `${note} Across the range: ${parts.join(" · ")}.`;
}
