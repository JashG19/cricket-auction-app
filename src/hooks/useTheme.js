import { useState, useEffect } from "react";

const THEME_KEY = "auction_theme";

export const useTheme = () => {
  // Initialize from localStorage or system preference
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored !== null) {
      return stored === "dark";
    }
    // Fall back to system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      // Only auto-switch if user hasn't set a preference
      if (localStorage.getItem(THEME_KEY) === null) {
        setIsDark(e.matches);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);
  const setTheme = (dark) => setIsDark(dark);

  return { isDark, toggleTheme, setTheme };
};

export default useTheme;
