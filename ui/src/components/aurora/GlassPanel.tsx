import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A glass surface: translucent fill + hairline border + blur. `glow` adds the teal accent edge. */
export function GlassPanel({
  className,
  glow,
  ...props
}: ComponentProps<"div"> & { glow?: boolean }) {
  return <div className={cn("glass rounded-xl", glow && "glass-glow", className)} {...props} />;
}
