import React from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Note } from "../../shared/types/types";

interface TabBarProps {
  openNoteIds: string[];
  currentNoteId: string;
  notesById: Map<string, Note>;
  historyIndex: number;
  historyLength: number;
  onSelectNote: (id: string) => void;
  onCloseTab: (e: React.MouseEvent, id: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
}

export default function TabBar({
  openNoteIds,
  currentNoteId,
  notesById,
  historyIndex,
  historyLength,
  onSelectNote,
  onCloseTab,
  onGoBack,
  onGoForward,
}: TabBarProps) {
  return (
    <div className="h-10 flex items-end bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 shrink-0 px-2">
      <div className="flex items-center self-center mr-3 space-x-1 shrink-0">
        <button
          onClick={onGoBack}
          disabled={historyIndex <= 0}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Go Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onGoForward}
          disabled={historyIndex >= historyLength - 1}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Go Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex overflow-x-auto select-none gap-1 scrollbar-hide -mb-[1px] w-full">
        {openNoteIds.map((id, index) => {
          const n = notesById.get(id);
          if (!n) return null;
          const isActive = id === currentNoteId;
          const prevIsActive = index > 0 && openNoteIds[index - 1] === currentNoteId;
          const showDivider = index > 0 && !isActive && !prevIsActive;

          return (
            <React.Fragment key={id}>
              {showDivider && (
                <div className="w-px h-4 bg-slate-300 dark:bg-zinc-700 my-auto shrink-0" />
              )}
              <div
                onClick={() => onSelectNote(id)}
                className={`group flex items-center justify-between space-x-2 px-3 py-1.5 min-w-[120px] max-w-[200px] rounded-t-lg border-t border-l border-r border-b cursor-pointer text-xs font-medium transition-all ${
                  isActive 
                    ? "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 border-b-white dark:border-b-zinc-900 text-slate-800 dark:text-zinc-200" 
                    : "bg-transparent border-transparent border-b-transparent text-slate-500 dark:text-zinc-500 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <span className="truncate">{n.title}</span>
                <button
                  onClick={(e) => onCloseTab(e, id)}
                  className={`p-0.5 rounded transition-colors shrink-0 ${
                    isActive 
                      ? "text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200" 
                      : "opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200"
                  }`}
                  title="Close tab"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
