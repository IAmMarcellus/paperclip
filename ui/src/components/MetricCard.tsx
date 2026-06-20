import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <div className={`glass h-full rounded-xl px-4 py-4 sm:px-5 sm:py-5 transition-[border-color,box-shadow]${isClickable ? " hover:border-teal/30 hover:shadow-[var(--glow-teal)] cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {description && (
        <div className="mt-1 text-xs text-muted-foreground/70 hidden sm:block">{description}</div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit h-full" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div className="h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
