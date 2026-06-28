import { X } from "lucide-react";

export interface AppSettings {
  font: "inter" | "system" | "serif" | "mono";
  hideYaml?: boolean;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
}

export default function SettingsDialog({ isOpen, onClose, settings, onSettingsChange }: SettingsDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Font Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
              Application Font
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onSettingsChange({ ...settings, font: "inter" })}
                className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${
                  settings.font === "inter"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
                style={{ fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' }}
              >
                <div className="font-semibold mb-0.5">Inter (Modern)</div>
                <div className="text-xs opacity-75">The default sleek and modern look.</div>
              </button>

              <button
                onClick={() => onSettingsChange({ ...settings, font: "system" })}
                className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${
                  settings.font === "system"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
                style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
              >
                <div className="font-semibold mb-0.5">System (Classic)</div>
                <div className="text-xs opacity-75">Native OS font (Segoe UI / San Francisco). Compact and simple.</div>
              </button>

              <button
                onClick={() => onSettingsChange({ ...settings, font: "serif" })}
                className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${
                  settings.font === "serif"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
                style={{ fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' }}
              >
                <div className="font-semibold mb-0.5">Serif (Reading)</div>
                <div className="text-xs opacity-75">Elegant serif font for a book-like writing experience.</div>
              </button>

              <button
                onClick={() => onSettingsChange({ ...settings, font: "mono" })}
                className={`text-left px-4 py-3 rounded-md border text-sm transition-colors ${
                  settings.font === "mono"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
                style={{ fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' }}
              >
                <div className="font-semibold mb-0.5">Mono (Code)</div>
                <div className="text-xs opacity-75">Monospace font for a technical look.</div>
              </button>
            </div>
          </div>

          {/* Hide YAML Frontmatter Option */}
          <div className="flex items-center justify-between p-4 border rounded-md border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-950/20 shadow-sm">
            <div className="pr-4">
              <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Hide YAML Frontmatter</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Collapse and hide YAML metadata at the top of the editor and preview panes.</div>
            </div>
            <button
              type="button"
              onClick={() => onSettingsChange({ ...settings, hideYaml: !settings.hideYaml })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.hideYaml ? "bg-indigo-600" : "bg-slate-200 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.hideYaml ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
