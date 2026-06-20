import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Aurora's uppercase JetBrains-Mono micro-label ("HAPPY PROCESSES", "DAILY SPEND · 14D"). */
export function SectionLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
