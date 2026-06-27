import { useState, useMemo } from "react";
import { Note } from "../types";
import { Link, Hash, X } from "lucide-react";

interface RightSidebarProps {
  currentNote?: Note;
  notes: Note[];
  onClose: () => void;
  onSelectNote: (id: string) => void;
}

export default function RightSidebar({ currentNote, notes, onClose, onSelectNote }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"links" | "tags">("links");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { outgoingLinks, incomingLinks, unlinkedMentions, tags } = useMemo(() => {
    if (!currentNote) return { outgoingLinks: [], incomingLinks: [], unlinkedMentions: [], tags: [] };

    // Extract outgoing links: text inside [[ ]]
    const linkRegex = /\[\[(.*?)\]\]/g;
    const outLinks = new Set<string>();
    let match;
    while ((match = linkRegex.exec(currentNote.content)) !== null) {
      if (match[1].trim()) outLinks.add(match[1].trim());
    }

    // Extract incoming links: other notes that contain [[currentNote.title]]
    // Also support links by note id if someone typed that, but standard is title
    const currentTitleLower = currentNote.title.toLowerCase();
    const inLinks = notes.filter(n => {
      if (n.id === currentNote.id) return false; // don't self-link here
      const nLinks = Array.from(n.content.matchAll(/\[\[(.*?)\]\]/g)).map(m => m[1].trim().toLowerCase());
      return nLinks.includes(currentTitleLower);
    });

    // Extract unlinked mentions: other notes that contain currentNote.title as plain text,
    // and are NOT already in inLinks.
    const unlinkedMentions = notes.filter(n => {
      if (n.id === currentNote.id) return false;
      if (inLinks.some(linkNote => linkNote.id === n.id)) return false;
      return n.content.toLowerCase().includes(currentTitleLower);
    });

    // Extract tags from all notes: #word
    const tagRegex = /(?<=^|\s)#([\p{L}\p{N}_\-]+)/gu;
    const allTags = new Set<string>();
    notes.forEach(n => {
      let tMatch;
      while ((tMatch = tagRegex.exec(n.content)) !== null) {
        allTags.add(tMatch[1].trim());
      }
    });

    return {
      outgoingLinks: Array.from(outLinks),
      incomingLinks: inLinks,
      unlinkedMentions: unlinkedMentions,
      tags: Array.from(allTags)
    };
  }, [currentNote, notes]);

  const handleLinkClick = (title: string) => {
    // Find note by title
    const found = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
    if (found) {
      onSelectNote(found.id);
    } else {
      alert(`Note "${title}" does not exist yet.`);
    }
  };

  return (
    <aside className="w-64 bg-slate-50 dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-900">
        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest pl-1">
          Info Panel
        </span>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
          title="Close panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 shrink-0">
        <button
          onClick={() => setActiveTab("links")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
            activeTab === "links" 
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent"
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>Links</span>
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
            activeTab === "tags" 
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent"
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Tags</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!currentNote && (
          <div className="text-xs text-center text-slate-400 italic mt-10">No note selected</div>
        )}

        {currentNote && activeTab === "links" && (
          <>
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Backlinks</div>
              {incomingLinks.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-zinc-600 italic">No incoming links</div>
              ) : (
                <ul className="space-y-1">
                  {incomingLinks.map(n => (
                    <li key={n.id}>
                      <button 
                        onClick={() => onSelectNote(n.id)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer truncate w-full text-left"
                      >
                        {n.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Unlinked Mentions</div>
              {unlinkedMentions.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-zinc-600 italic mb-4">No unlinked mentions</div>
              ) : (
                <ul className="space-y-1 mb-4">
                  {unlinkedMentions.map(n => (
                    <li key={n.id}>
                      <button 
                        onClick={() => onSelectNote(n.id)}
                        className="text-xs text-amber-600 dark:text-amber-500 hover:underline cursor-pointer truncate w-full text-left"
                        title="Click to open note"
                      >
                        {n.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Outgoing Links</div>
              {outgoingLinks.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-zinc-600 italic">No outgoing links</div>
              ) : (
                <ul className="space-y-1">
                  {outgoingLinks.map(title => (
                    <li key={title}>
                      <button 
                        onClick={() => handleLinkClick(title)}
                        className="text-xs text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer truncate w-full text-left"
                      >
                        {title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {currentNote && activeTab === "tags" && (
          <div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Tags</div>
            {tags.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-zinc-600 italic">No tags found</div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <button 
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`px-2 py-0.5 rounded-full text-xs transition-colors cursor-pointer ${
                        selectedTag === tag 
                          ? "bg-indigo-600 text-white dark:bg-indigo-500" 
                          : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-700"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
                
                {selectedTag && (
                  <div className="mt-4 border-t border-slate-200 dark:border-zinc-800 pt-4">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Notes with #{selectedTag}</div>
                    <ul className="space-y-1">
                      {notes.filter(n => n.content.includes(`#${selectedTag}`)).map(n => (
                        <li key={n.id}>
                          <button 
                            onClick={() => onSelectNote(n.id)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer truncate w-full text-left"
                          >
                            {n.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
