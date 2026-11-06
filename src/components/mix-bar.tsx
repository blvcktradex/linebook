import { translateAction } from "@/lib/i18n";
import { useI18n } from "@/lib/locale";
import { actionColor, pct, pct1 } from "@/lib/poker/format";
import type { ActionDef } from "@/lib/solutions/types";
import { cn } from "@/lib/utils";

export function MixBar({
  actions,
  freq,
  tall = false,
}: {
  actions: ActionDef[];
  freq: number[];
  tall?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={tall ? "flex h-2 overflow-hidden bg-surface-2" : "flex h-1.5 overflow-hidden bg-surface-2"}>
      {actions.map((action, index) => {
        const share = freq[index] ?? 0;
        if (share <= 0) return null;
        return (
          <div
            key={action.id}
            style={{ width: `${share * 100}%`, background: actionColor(action) }}
            title={`${translateAction(action.label, t)} ${pct(share)}`}
          />
        );
      })}
    </div>
  );
}

export function ActionTiles({
  actions,
  freq,
  onSelect,
}: {
  actions: ActionDef[];
  freq: number[];
  onSelect?: (actionId: string) => void;
}) {
  const { t } = useI18n();
  const view = actions.map((action, index) => ({ action, index })).reverse();
  const spanLast = view.length % 2 === 1;
  return (
    <div className="grid grid-cols-2 gap-px bg-bg">
      {view.map(({ action, index }, order) => {
        const share = freq[index] ?? 0;
        const continues = Boolean(onSelect && action.nextNodeId);
        const className = cn(
          "flex min-h-14 flex-col items-start justify-center px-2.5 py-2 text-left text-on-action",
          spanLast && order === view.length - 1 && "col-span-2",
        );
        const body = (
          <>
            <span className="text-xs leading-none">{translateAction(action.label, t)}</span>
            <span className="mt-1 font-mono text-xl leading-none font-semibold tabular-nums">{pct1(share)}</span>
          </>
        );
        if (!continues) {
          return (
            <div key={action.id} className={className} style={{ background: actionColor(action) }}>
              {body}
            </div>
          );
        }
        return (
          <button
            key={action.id}
            type="button"
            className={className}
            style={{ background: actionColor(action) }}
            onClick={() => onSelect?.(action.id)}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

export function MixLegend({ actions, freq }: { actions: ActionDef[]; freq: number[] }) {
  return (
    <ul className="flex flex-col">
      {actions.map((action, index) => (
        <li key={action.id} className="grid grid-cols-[0.5rem_1fr_auto] items-center gap-2 border-b border-border py-1.5 text-sm last:border-b-0">
          <span className="size-2" style={{ background: actionColor(action) }} />
          <span>{action.label}</span>
          <span className="font-mono text-xs tabular-nums text-muted">{pct(freq[index] ?? 0)}</span>
        </li>
      ))}
    </ul>
  );
}
