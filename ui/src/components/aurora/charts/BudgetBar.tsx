import { cn } from "@/lib/utils";

export interface BudgetBarProps {
  label: string;
  /** 0..100 */
  percent: number;
  /** Bar colour (CSS colour or var). Defaults to teal; turns amber past 85%. */
  color?: string;
  valueLabel?: string;
  className?: string;
}

/** A labelled horizontal progress/budget bar (track + gradient-ish fill + value). */
export function BudgetBar({ label, percent, color = "var(--teal)", valueLabel, className }: BudgetBarProps) {
  const pct = Math.max(0, Math.min(100, percent));
  const hot = pct >= 85;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-20 shrink-0 truncate text-sm text-foreground/80">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: hot ? "var(--amber)" : color }}
        />
      </div>
      <span
        className={cn(
          "w-12 shrink-0 text-right font-mono text-xs tabular-nums",
          hot ? "text-amber" : "text-muted-foreground",
        )}
      >
        {valueLabel ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
