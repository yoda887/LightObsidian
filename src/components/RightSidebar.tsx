import { useState, useMemo, useEffect } from "react";
import { Note } from "../types";
import { Link, Hash, X, Sparkles, RotateCcw, Check, FileText } from "lucide-react";
import { Flashcard } from "../flashcards";

interface RightSidebarProps {
  currentNote?: Note;
  notes: Note[];
  focusQueue: Flashcard[];
  onRemoveFromQueue: (index: number) => void;
  onClearFocusQueue: () => void;
  initialTab?: "links" | "tags" | "context" | "focus";
  onClose: () => void;
  onSelectNote: (id: string) => void;
}

export default function RightSidebar({ 
  currentNote, 
  notes, 
  focusQueue,
  onRemoveFromQueue,
  onClearFocusQueue,
  initialTab,
  onClose, 
  onSelectNote 
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"links" | "tags" | "context" | "focus">(initialTab || "links");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Sync tab with initialTab prop when it changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const { outgoingLinks, incomingLinks, unlinkedMentions, suggestedLinks, secondLevelLinks, tags } = useMemo(() => {
    if (!currentNote) return { outgoingLinks: [], incomingLinks: [], unlinkedMentions: [], suggestedLinks: [], secondLevelLinks: [], tags: [] };

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

    // Extract suggested links (current note mentions other note titles)
    const suggestedLinks = notes.filter(n => {
      if (n.id === currentNote.id) return false;
      const nTitleLower = n.title.toLowerCase();
      const hasOutLink = Array.from(outLinks).some(link => link.toLowerCase() === nTitleLower);
      if (hasOutLink) return false;
      return currentNote.content.toLowerCase().includes(nTitleLower);
    });

    // Extract second-level connections (notes that share an outgoing link)
    const secondLevelLinks = notes.filter(n => {
      if (n.id === currentNote.id) return false;
      if (inLinks.some(i => i.id === n.id)) return false;
      const hasOutLink = Array.from(outLinks).some(link => link.toLowerCase() === n.title.toLowerCase());
      if (hasOutLink) return false;

      const nOutLinks = Array.from(n.content.matchAll(/\[\[(.*?)\]\]/g)).map(m => m[1].trim().toLowerCase());
      return nOutLinks.some(link => {
        return Array.from(outLinks).some(o => o.toLowerCase() === link);
      });
    });

    return {
      outgoingLinks: Array.from(outLinks),
      incomingLinks: inLinks,
      unlinkedMentions: unlinkedMentions,
      suggestedLinks,
      secondLevelLinks,
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
      <div className="flex border-b border-slate-200 dark:border-zinc-800 shrink-0 h-10">
        <button
          onClick={() => setActiveTab("links")}
          className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === "links" 
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent"
          }`}
          title="Links (Backlinks & Outgoing)"
        >
          <Link className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab("context")}
          className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === "context" 
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent"
          }`}
          title="Context & Suggestions"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === "tags" 
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent"
          }`}
          title="Tags Explorer"
        >
          <Hash className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTab("focus")}
          className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === "focus" 
              ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" 
              : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent"
          }`}
          title="Focus Queue (Работа над ошибками)"
        >
          <div className="relative">
            <RotateCcw className="w-4 h-4" />
            {focusQueue.length > 0 && (
              <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "focus" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Focus Queue ({focusQueue.length})
              </h3>
              {focusQueue.length > 0 && (
                <button
                  onClick={onClearFocusQueue}
                  className="text-[10px] text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline font-semibold bg-transparent border-none cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {focusQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs">
                No cards in the focus queue. Great job!
              </div>
            ) : (
              <div className="space-y-2">
                {focusQueue.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 shadow-sm relative flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <button
                      onClick={() => onSelectNote(c.noteId)}
                      className="text-left w-full bg-transparent border-none p-0 cursor-pointer flex flex-col gap-1 text-xs"
                    >
                      <div className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                        {c.noteTitle}
                      </div>
                      <div className="text-slate-800 dark:text-zinc-200 font-medium line-clamp-2 leading-relaxed">
                        Q: {c.question}
                      </div>
                      <div className="text-slate-405 dark:text-zinc-500 italic truncate text-[10px]">
                        A: {c.answer}
                      </div>
                    </button>
                    <div className="flex justify-end border-t border-slate-100 dark:border-zinc-800/50 pt-1.5 mt-1">
                      <button
                        onClick={() => onRemoveFromQueue(i)}
                        className="text-[10px] text-emerald-600 hover:text-emerald-500 font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:underline"
                      >
                        <Check className="w-3 h-3" />
                        <span>Resolve</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab !== "focus" && !currentNote && (
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

        {currentNote && activeTab === "context" && (
          <div className="space-y-6">
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Suggested Links</div>
              {suggestedLinks.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-zinc-600 italic">No suggestions</div>
              ) : (
                <ul className="space-y-1">
                  {suggestedLinks.map(n => (
                    <li key={n.id}>
                      <button 
                        onClick={() => handleLinkClick(n.title)}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer truncate w-full text-left"
                      >
                        {n.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">2nd-Level Connections</div>
              {secondLevelLinks.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-zinc-600 italic">No common links found</div>
              ) : (
                <ul className="space-y-1">
                  {secondLevelLinks.map(n => (
                    <li key={n.id}>
                      <button 
                        onClick={() => handleLinkClick(n.title)}
                        className="text-xs text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer truncate w-full text-left"
                      >
                        {n.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
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
