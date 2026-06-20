import { cn } from "@/lib/utils";

export interface DailySpendBarDatum {
  label?: string;
  value: number;
}

export interface DailySpendBarProps {
  data: DailySpendBarDatum[];
  className?: string;
  height?: number;
  /** Highlight the final bar with the signature gradient (the "today" column). */
  highlightLast?: boolean;
}

/** Daily-spend bar chart: muted bars, last column painted with the teal→indigo gradient. */
export function DailySpendBar({ data, className, height = 200, highlightLast = true }: DailySpendBarProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex items-end gap-1.5", className)} style={{ height }}>
      {data.map((d, i) => {
        const isLast = highlightLast && i === data.length - 1;
        const h = Math.max(2, (d.value / max) * 100);
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={cn(
                "w-full rounded-md",
                isLast
                  ? "bg-[image:var(--accent-gradient)] shadow-[var(--glow-teal)]"
                  : "bg-white/[0.06] hover:bg-white/[0.1]",
              )}
              style={{ height: `${h}%` }}
            />
            {d.label ? <span className="font-mono text-[10px] text-muted-foreground">{d.label}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
