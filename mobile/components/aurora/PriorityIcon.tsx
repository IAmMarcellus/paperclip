/** Small priority glyph coloured by theme/status-colors priorityColor. */
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, TriangleAlert } from "lucide-react-native";

import { priorityColor, priorityColorDefault } from "@/theme";

const ICON = {
  critical: TriangleAlert,
  high: ChevronsUp,
  medium: ChevronUp,
  low: ChevronsDown,
} as const;

export function PriorityIcon({ priority, size = 15 }: { priority?: string | null; size?: number }) {
  const Icon = (priority && ICON[priority as keyof typeof ICON]) || ChevronDown;
  const color = (priority && priorityColor[priority]) || priorityColorDefault;
  return <Icon size={size} color={color} />;
}
