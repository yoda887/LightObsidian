import React from "react";
import { Map as MapIcon, Settings, Download, BookOpen, PanelRight, Edit3, Columns, Eye, Zap, Sun, Moon, Type, Brain, Clock, HelpCircle } from "lucide-react";

interface TopBarProps {
  darkMode: boolean;
  typewriterMode: boolean;
  appMode: string;
  isRightSidebarOpen: boolean;
  dueCardsCount: number;
  onToggleTheme: () => void;
  onToggleTypewriter: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenReview: () => void;
  onSetAppMode: (mode: string) => void;
  onToggleRightSidebar: () => void;
}

export default function TopBar({
  darkMode,
  typewriterMode,
  appMode,
  isRightSidebarOpen,
  dueCardsCount,
  onToggleTheme,
  onToggleTypewriter,
  onOpenSettings,
  onOpenHelp,
  onOpenReview,
  onSetAppMode,
  onToggleRightSidebar,
}: TopBarProps) {
  const modeButton = (mode: string, icon: React.ReactNode, label: string, title: string) => (
    <button
      onClick={() => onSetAppMode(mode)}
      className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
        appMode === mode
          ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
          : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
      }`}
      title={title}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  return (
    <div className="relative h-10 shrink-0 flex items-center px-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 select-none">
      <div className="flex-1 flex items-center space-x-1">
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
          title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        
        <button
          onClick={onToggleTypewriter}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            typewriterMode 
              ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800"
          }`}
          title={typewriterMode ? "Disable typewriter font" : "Enable typewriter font"}
        >
          <Type className="w-4 h-4" />
        </button>
        
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        
        <button
          onClick={onOpenHelp}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
          title="Help & Documentation"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        
        <div className="w-px h-4 mx-1 bg-slate-200 dark:bg-zinc-800"></div>
        
        <button
          onClick={onOpenReview}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer relative"
          title="Review Flashcards"
        >
          <Brain className="w-4 h-4" />
          {dueCardsCount > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </button>
      </div>
      
      <div className="absolute left-1/2 -translate-x-1/2 flex bg-slate-200/60 dark:bg-zinc-800 p-0.5 rounded z-10">
        {modeButton("edit", <Edit3 className="w-3.5 h-3.5" />, "Source", "Markdown Source Editor")}
        {modeButton("dynamic", <Zap className="w-3.5 h-3.5" />, "Dynamic", "Dynamic Reading Mode")}
        {modeButton("preview", <Eye className="w-3.5 h-3.5" />, "Preview", "Formatted Preview")}
        {modeButton("split", <Columns className="w-3.5 h-3.5" />, "Split", "Side-by-side split screen")}
        <div className="w-px h-4 mx-1 my-auto bg-slate-300 dark:bg-zinc-700"></div>
        {modeButton("graph", <MapIcon className="w-3.5 h-3.5" />, "Graph Map", "Interactive graph map")}
        {modeButton("timeline", <Clock className="w-3.5 h-3.5" />, "Timeline", "Timeline History")}
      </div>

      <div className="flex-1 flex items-center justify-end gap-4">
        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono uppercase tracking-wider">
          Connected: Local Session
        </div>
        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800"></div>
        <button
          onClick={onToggleRightSidebar}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isRightSidebarOpen 
              ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20" 
              : "text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800"
          }`}
          title="Toggle Info Panel"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
