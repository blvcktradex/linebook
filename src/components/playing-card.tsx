import { SUIT_SYMBOL, pipClass } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

const sizeClass = {
  xs: "h-7 w-5 text-grid",
  sm: "h-10 w-7 text-xs",
  md: "h-14 w-10 text-sm",
  lg: "h-20 w-14 text-lg",
} as const;

export function PlayingCard({ card, size = "md" }: { card: string; size?: keyof typeof sizeClass }) {
  const rank = card[0];
  const suit = card[1];
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-sm border border-card-edge bg-card px-0.5 py-0.5 font-mono font-semibold leading-none",
        sizeClass[size],
        pipClass(suit),
      )}
    >
      <span>{rank}</span>
      <span className="self-end">{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: keyof typeof sizeClass }) {
  return (
    <div className={cn("rounded-sm border border-border bg-surface-2 p-0.5", sizeClass[size])}>
      <div className="h-full w-full rounded-sm border border-accent/40 bg-accent/15" />
    </div>
  );
}

export function Board({ cards, size = "md" }: { cards: string[]; size?: keyof typeof sizeClass }) {
  return (
    <div className="flex gap-0.5">
      {cards.map((card) => (
        <PlayingCard key={card} card={card} size={size} />
      ))}
    </div>
  );
}
