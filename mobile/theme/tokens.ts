/**
 * Aurora design tokens — the single source of truth for the mobile look.
 *
 * Ported 1:1 from the web app's CSS custom properties
 * (vendor/paperclip/ui/src/index.css `:root`) so mobile and web stay visually
 * identical. Dark-only, like the web.
 */

export const colors = {
  // Surfaces
  background: "#08080a",
  screen: "#0a0c0d",
  card: "#131418",
  popover: "#14161a",
  secondary: "#1b1d22",
  muted: "#181a1e",
  accentSurface: "#18211f",
  sidebar: "#0b0c0e",

  // Text
  foreground: "#e8eae9",
  foregroundSoft: "#cfe9e2",
  mutedForeground: "#9aa39f",
  dimForeground: "#7e857f",

  // Aurora accents
  teal: "#5eead4",
  emerald: "#34d399",
  indigo: "#818cf8",
  amber: "#fbbf24",
  rose: "#fb7185",
  sky: "#7dd3fc",

  // Semantic
  primary: "#5eead4",
  primaryForeground: "#06201c",
  destructive: "#f43f5e",
  destructiveForeground: "#ffffff",
  ring: "#5eead4",

  // Hairlines / inputs (rgba so they read as glass edges)
  border: "rgba(255, 255, 255, 0.08)",
  borderSoft: "rgba(255, 255, 255, 0.06)",
  borderAccent: "rgba(94, 234, 212, 0.3)",
  input: "rgba(255, 255, 255, 0.1)",
  white05: "rgba(255, 255, 255, 0.05)",
  white08: "rgba(255, 255, 255, 0.08)",
  white10: "rgba(255, 255, 255, 0.1)",

  // Status (heartbeat) colors — see theme/status-colors.ts for status→color maps
  statusWorking: "#5eead4",
  statusOnline: "#34d399",
  statusIdle: "#6b7280",
  statusError: "#fb7185",

  transparent: "transparent",
} as const;

/** Two-stop gradients (use with expo-linear-gradient `colors`). */
export const gradients = {
  /** Signature accent: teal → indigo. Web uses 135deg. */
  accent: ["#5eead4", "#818cf8"] as const,
  /** Glass fill overlaid on blur surfaces (top → bottom). */
  glassFill: ["rgba(255,255,255,0.045)", "rgba(255,255,255,0.014)"] as const,
  /** Error agent capsule. */
  error: ["#fda4af", "#9f1239"] as const,
} as const;

/** Standard 135deg diagonal start/end for `LinearGradient`. */
export const diag = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
/** Horizontal left→right (progress bars). */
export const horiz = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as const;
/** Vertical top→bottom (capsules, glass fill). */
export const vert = { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } } as const;

export const radii = {
  sm: 8,
  md: 10,
  base: 12,
  lg: 14,
  xl: 18,
  "2xl": 20,
  pill: 999,
} as const;

/** 4-pt spacing scale. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

/** Soft glows used on active/teal elements. */
export const glow = {
  teal: "rgba(94, 234, 212, 0.55)",
  indigo: "rgba(129, 140, 248, 0.5)",
  amber: "#fbbf24",
} as const;

/**
 * Reusable RN shadow presets (iOS shadow* + Android elevation). Glows are
 * approximated with colored shadows since RN has no box-shadow blur spread.
 */
export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  glowTeal: {
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export type Colors = typeof colors;
