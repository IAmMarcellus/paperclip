import { createContext, useContext, useEffect, type ReactNode } from "react";

// Aurora is a dark-only design. The light theme has been retired, but the
// `useTheme()` API (theme / setTheme / toggleTheme) is kept so existing
// consumers keep compiling — `setTheme`/`toggleTheme` are intentional no-ops
// and `theme` is always "dark".
type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const DARK_THEME_COLOR = "#08080a";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyDark() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.setAttribute("content", DARK_THEME_COLOR);
  }
}

const noop = () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Force dark on mount (the inline bootstrap in index.html already set it
  // before first paint; this re-asserts it after hydration).
  useEffect(() => {
    applyDark();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark", setTheme: noop, toggleTheme: noop }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
