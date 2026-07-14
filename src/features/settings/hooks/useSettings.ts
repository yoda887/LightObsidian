import { useState, useEffect, useCallback } from "react";
import { AppSettings } from "../components/SettingsDialog";

export function useSettings() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [typewriterMode, setTypewriterMode] = useState<boolean>(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({ font: "inter", hideYaml: false });

  // Load app settings and theme on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("lite_obsidian_settings");
    if (savedSettings) {
      try {
        setAppSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }

    const savedTheme = localStorage.getItem("lite_obsidian_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Update theme class when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Apply font setting
  useEffect(() => {
    let fontFamily = '"Inter", ui-sans-serif, system-ui, sans-serif';
    if (appSettings.font === "system") {
      fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (appSettings.font === "serif") {
      fontFamily = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
    } else if (appSettings.font === "mono") {
      fontFamily = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
    }
    
    // Clear any previous global overrides so UI goes back to default (Inter)
    document.documentElement.style.removeProperty('--font-sans');
    
    // Set custom variable for editor
    document.documentElement.style.setProperty('--font-editor', fontFamily);
    
    localStorage.setItem("lite_obsidian_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  // Toggle theme helper
  const handleToggleTheme = useCallback(() => {
    setDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("lite_obsidian_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("lite_obsidian_theme", "light");
      }
      return newVal;
    });
  }, []);

  return {
    darkMode,
    setDarkMode,
    typewriterMode,
    setTypewriterMode,
    appSettings,
    setAppSettings,
    handleToggleTheme,
  };
}
