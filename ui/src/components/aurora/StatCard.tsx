import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Render the value in teal — used for the primary / "today" metric. */
  accent?: boolean;
  className?: string;
}

/** Aurora stat tile: uppercase mono label + big number + optional sub-label. */
export function StatCard({ label, value, hint, icon, accent, className }: StatCardProps) {
  return (
    <div className={cn("glass rounded-xl px-5 py-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <SectionLabel>{label}</SectionLabel>
        {icon ? <span className="text-muted-foreground/60 [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          accent ? "text-teal" : "text-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 font-mono text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
