import React, { useMemo } from "react";
import { Note } from "../../../shared/types/types";
import { Clock } from "lucide-react";

interface TimelineViewProps {
  notes: Note[];
  onSelectNote: (id: string, options?: { startReading?: boolean }) => void;
}

export default function TimelineView({ notes, onSelectNote }: TimelineViewProps) {
  // Sort notes by updated date (or created date if not present), newest first
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [notes]);

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center space-x-3 mb-8">
          <Clock className="w-6 h-6 text-indigo-500" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Timeline</h2>
        </div>

        <div className="relative border-l border-slate-200 dark:border-zinc-800 ml-3">
          {sortedNotes.map((note) => {
            const dateObj = new Date(note.updatedAt || note.createdAt || Date.now());
            const dateStr = dateObj.toLocaleDateString(undefined, { 
              year: 'numeric', month: 'short', day: 'numeric' 
            });
            const timeStr = dateObj.toLocaleTimeString(undefined, {
              hour: '2-digit', minute: '2-digit'
            });

            return (
              <div key={note.id} className="mb-8 pl-6 relative group">
                <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[6.5px] top-1.5 ring-4 ring-slate-50 dark:ring-zinc-950 group-hover:scale-125 transition-transform" />
                
                <div 
                  onClick={() => onSelectNote(note.id)}
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                >
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                    {dateStr} <span className="text-slate-400 dark:text-zinc-500 font-normal ml-1">{timeStr}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{note.title || "Untitled"}</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-3">
                    {note.content.replace(/[#*`>![\]]/g, '').slice(0, 200)}
                  </p>
                </div>
              </div>
            );
          })}

          {sortedNotes.length === 0 && (
            <div className="text-slate-500 dark:text-zinc-400 italic pl-6">No notes found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
