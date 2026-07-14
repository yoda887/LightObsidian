import { useState, useMemo, useEffect } from "react";
import { Note } from "../../../shared/types/types";
import { Link, Hash, X, Sparkles, RotateCcw, Check, FileText, Network, BarChart2, Award, BookOpen, Brain } from "lucide-react";
import { Flashcard, FlashcardService } from "../../../core/flashcards/FlashcardService";
import { MarkdownService } from "../../../core/markdown/MarkdownService";

interface RightSidebarProps {
  currentNote?: Note;
  notes: Note[];
  focusQueue: Flashcard[];
  reviewLog?: string[];
  onClearReviewLog?: () => void;
  onRemoveFromQueue: (index: number) => void;
  onClearFocusQueue: () => void;
  initialTab?: "links" | "tags" | "context" | "focus" | "graph" | "stats" | "skills" | "reading";
  onClose: () => void;
  onSelectNote: (id: string, options?: { startReading?: boolean }) => void;
  onUpdateNote?: (id: string, updates: Partial<Note>) => void;
}

export default function RightSidebar({ 
  currentNote, 
  notes, 
  focusQueue,
  reviewLog = [],
  onClearReviewLog,
  onRemoveFromQueue,
  onClearFocusQueue,
  initialTab,
  onClose, 
  onSelectNote,
  onUpdateNote
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"links" | "tags" | "context" | "focus" | "graph" | "stats" | "skills" | "reading">(initialTab || "links");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const isLearningTab = ["focus", "stats", "skills", "reading"].includes(activeTab);

  const setMainTab = (tab: "node" | "learning") => {
    if (tab === "node" && isLearningTab) setActiveTab("links");
    if (tab === "learning" && !isLearningTab) setActiveTab("reading");
  };

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

    // Extract incoming links (backlinks)
    const inLinks = MarkdownService.backlinks(currentNote.id, currentNote.title, notes);
    const currentTitleLower = currentNote.title.toLowerCase();

    // Extract unlinked mentions: other notes that contain currentNote.title as plain text,
    // and are NOT already in inLinks.
    const unlinkedMentions = notes.filter(n => {
      if (n.id === currentNote.id) return false;
      if (inLinks.some(linkNote => linkNote.id === n.id)) return false;
      return n.content.toLowerCase().includes(currentTitleLower);
    });

    // Extract tags from all notes: #word
    const tagRegex = /(?<=^|\s)#([\p{L}\p{N}_\-\/]+)/gu;
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

  const localGraphData = useMemo(() => {
    if (!currentNote) return { nodes: [], links: [] };

    // Unique connected note objects (either incoming or outgoing)
    const connectedNotesMap = new Map<string, Note>();
    
    // 1. Add incoming links (backlinks)
    incomingLinks.forEach(n => connectedNotesMap.set(n.id, n));
    
    // 2. Add outgoing links
    notes.forEach(n => {
      if (n.id === currentNote.id) return;
      const isOutgoing = outgoingLinks.some(title => title.toLowerCase() === n.title.toLowerCase());
      if (isOutgoing) {
        connectedNotesMap.set(n.id, n);
      }
    });

    const connectedNodes = Array.from(connectedNotesMap.values());
    
    const centerX = 112;
    const centerY = 112;
    const radius = 64;
    const angleStep = connectedNodes.length > 0 ? (2 * Math.PI) / connectedNodes.length : 0;

    const nodes = [
      { id: currentNote.id, title: currentNote.title, x: centerX, y: centerY, isCenter: true },
      ...connectedNodes.map((n, i) => {
        const angle = i * angleStep;
        return {
          id: n.id,
          title: n.title,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          isCenter: false
        };
      })
    ];

    const links = connectedNodes.map(n => ({
      sourceId: currentNote.id,
      targetId: n.id
    }));

    return { nodes, links };
  }, [currentNote, notes, incomingLinks, outgoingLinks]);

  // ----------------------------------------------------
  // STUDY STATS CALCULATIONS
  // ----------------------------------------------------
  const stats = useMemo(() => {
    return FlashcardService.statistics(notes, reviewLog || []);
  }, [notes, reviewLog]);

  // ----------------------------------------------------
  // SKILLS / XP CALCULATIONS
  // ----------------------------------------------------
  const skills = useMemo(() => {
    const tagRegex = /(?<=^|\s)#([\p{L}\p{N}_\-\/]+)/gu;
    const allCards = FlashcardService.extractFlashcards(notes);
    
    const tagXP: Record<string, number> = {};
    const noteTags: Record<string, string[]> = {};
    
    notes.forEach(n => {
      const tags = new Set<string>();
      let match;
      while ((match = tagRegex.exec(n.content)) !== null) {
        tags.add(match[1].toLowerCase().trim());
      }
      noteTags[n.id] = Array.from(tags);
    });

    allCards.forEach(c => {
      const xp = Math.floor((c.interval || 0) * (c.ease || 2.5) * 10);
      if (xp > 0) {
        const tags = noteTags[c.noteId] || [];
        tags.forEach(t => {
          tagXP[t] = (tagXP[t] || 0) + xp;
        });
      }
    });
    
    const calculateLevelInfo = (xp: number) => {
      let level = 1;
      while (xp >= Math.pow(level, 2) * 100) {
        level++;
      }
      const currentLevelBaseXP = Math.pow(level - 1, 2) * 100;
      const nextLevelBaseXP = Math.pow(level, 2) * 100;
      const progressInLevel = xp - currentLevelBaseXP;
      const requiredForNext = nextLevelBaseXP - currentLevelBaseXP;
      const percentage = Math.min(100, Math.floor((progressInLevel / requiredForNext) * 100));
      return { level, xp, percentage, currentLevelBaseXP, nextLevelBaseXP };
    };

    return Object.keys(tagXP).map(tag => ({
      tag,
      ...calculateLevelInfo(tagXP[tag])
    })).sort((a, b) => b.xp - a.xp);
  }, [notes]);

  const readingQueue = useMemo(() => {
    const queue: { note: Note; nextRead: string; interval: number; ease: number; priority: number }[] = [];
    const todayStr = new Date().toISOString().split("T")[0];
    
    notes.forEach(n => {
      const { frontmatter } = MarkdownService.splitFrontmatter(n.content);
      if (frontmatter) {
        const metadata = MarkdownService.parseYamlMetadata(frontmatter);
        if (metadata.ir_next_read) {
          const nextReadVal = String(metadata.ir_next_read).trim();
          if (nextReadVal <= todayStr) {
            queue.push({
              note: n,
              nextRead: nextReadVal,
              interval: parseInt(String(metadata.ir_interval)) || 1,
              ease: parseFloat(String(metadata.ir_ease)) || 2.5,
              priority: parseInt(String(metadata.ir_priority)) || 50
            });
          }
        }
      }
    });
    
    return queue.sort((a, b) => b.priority - a.priority || a.nextRead.localeCompare(b.nextRead));
  }, [notes]);

  const isCurrentNoteInReadingList = useMemo(() => {
    if (!currentNote) return false;
    const { frontmatter } = MarkdownService.splitFrontmatter(currentNote.content);
    const metadata = MarkdownService.parseYamlMetadata(frontmatter);
    return !!metadata.ir_next_read;
  }, [currentNote]);

  const handleAddToReadingList = () => {
    if (!currentNote || !onUpdateNote) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const newContent = MarkdownService.updateYamlMetadata(currentNote.content, {
      ir_next_read: todayStr,
      ir_interval: 1,
      ir_ease: 2.5,
      ir_priority: 50,
      ir_last_offset: 0
    });
    onUpdateNote(currentNote.id, { content: newContent });
  };

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
      {/* Main Tabs (Node vs Learning) */}
      <div className="h-10 flex border-b border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-900">
        <button
          onClick={() => setMainTab('node')}
          className={`flex-1 flex items-center justify-center gap-2 h-full transition-colors font-semibold text-xs tracking-wide cursor-pointer ${
            !isLearningTab 
              ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-950 border-b-2 border-indigo-600 dark:border-indigo-400' 
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 bg-transparent border-b-2 border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          Note
        </button>
        <button
          onClick={() => setMainTab('learning')}
          className={`flex-1 flex items-center justify-center gap-2 h-full transition-colors font-semibold text-xs tracking-wide cursor-pointer ${
            isLearningTab 
              ? 'text-rose-600 dark:text-rose-400 bg-white dark:bg-zinc-950 border-b-2 border-rose-600 dark:border-rose-400' 
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 bg-transparent border-b-2 border-transparent'
          }`}
        >
          <Brain className="w-4 h-4" />
          Learning
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 shrink-0 h-10 bg-white dark:bg-zinc-950">
        {!isLearningTab ? (
          <>
            <button
              onClick={() => setActiveTab('links')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'links' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Links (Backlinks & Outgoing)"
            >
              <Link className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'graph' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Local Graph View (Локальный граф)"
            >
              <Network className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'context' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Context & Suggestions"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'tags' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Tags Explorer"
            >
              <Hash className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('reading')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'reading' 
                  ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Reading Queue (Очередь чтения)"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('focus')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'focus' 
                  ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
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
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'stats' 
                  ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Study Statistics & Heatmap (Статистика)"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`flex-1 flex items-center justify-center h-full transition-colors cursor-pointer ${
                activeTab === 'skills' 
                  ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-600 dark:border-rose-400' 
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 border-b-2 border-transparent'
              }`}
              title="Skill Tree (Дерево навыков)"
            >
              <Award className="w-4 h-4" />
            </button>
          </>
        )}
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

        {activeTab === "skills" && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              Skill Tree
            </h3>
            {skills.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs">
                No skills discovered yet. Add tags and flashcards to level up!
              </div>
            ) : (
              <div className="space-y-3">
                {skills.map((skill, idx) => (
                  <div key={idx} className="p-3 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">#{skill.tag}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                        Lvl {skill.level}
                      </span>
                    </div>
                    
                    {/* XP Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden flex items-center">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${skill.percentage}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                      <span>{skill.xp} XP</span>
                      <span>Next: {skill.nextLevelBaseXP} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reading" && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              Reading Queue ({readingQueue.length})
            </h3>
            
            {currentNote && onUpdateNote && (
              <div className="mb-4">
                {isCurrentNoteInReadingList ? (
                  <div className="p-3 border border-indigo-100 dark:border-indigo-900/50 rounded-lg bg-indigo-50/30 dark:bg-indigo-950/10 text-center">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Active in Reading Queue</span>
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleAddToReadingList}
                    className="w-full py-2 px-3 border border-indigo-500 hover:bg-indigo-500 hover:text-white text-indigo-500 dark:text-indigo-400 dark:border-indigo-500/50 dark:hover:bg-indigo-500 dark:hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Add current note to Queue</span>
                  </button>
                )}
              </div>
            )}
            
            {readingQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs">
                No articles due for reading. Add notes to get started!
              </div>
            ) : (
              <div className="space-y-2">
                {readingQueue.map((item, idx) => (
                  <div key={idx} className="p-3 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <button
                        onClick={() => onSelectNote(item.note.id)}
                        className="text-left font-semibold text-slate-800 dark:text-zinc-200 text-xs hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer truncate flex-1"
                      >
                        {item.note.title}
                      </button>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded">
                        P{item.priority}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Interval: {item.interval}d</span>
                      <span>Ease: {item.ease.toFixed(1)}</span>
                    </div>
                    <button
                      onClick={() => onSelectNote(item.note.id, { startReading: true })}
                      className="w-full mt-1 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-md text-xs font-semibold cursor-pointer transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Start Reading</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                Study Progress
              </h3>
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Current Streak</span>
                  <span className="text-sm font-bold text-amber-500 flex items-center gap-1">
                    🔥 {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500 dark:text-zinc-400">Total Cards</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{stats.totalCards}</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Distribution</span>
                    <span>{stats.totalCards > 0 ? '100%' : '0%'}</span>
                  </div>
                  
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                    {stats.totalCards > 0 ? (
                      <>
                        <div 
                          style={{ width: `${(stats.newCards / stats.totalCards) * 100}%` }}
                          className="bg-indigo-500 h-full"
                          title={`New: ${stats.newCards} cards`}
                        />
                        <div 
                          style={{ width: `${(stats.learningCards / stats.totalCards) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Learning: ${stats.learningCards} cards`}
                        />
                        <div 
                          style={{ width: `${(stats.matureCards / stats.totalCards) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Mature: ${stats.matureCards} cards`}
                        />
                      </>
                    ) : (
                      <div className="w-full bg-slate-200 dark:bg-zinc-800 h-full" />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-indigo-500 shrink-0" />
                      <span className="text-slate-500 dark:text-zinc-400 truncate">New ({stats.newCards})</span>
                    </div>
                    <div className="flex items-center gap-1 justify-center">
                      <span className="w-2 h-2 rounded bg-amber-500 shrink-0" />
                      <span className="text-slate-500 dark:text-zinc-400 truncate">Learn ({stats.learningCards})</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <span className="w-2 h-2 rounded bg-emerald-500 shrink-0" />
                      <span className="text-slate-500 dark:text-zinc-400 truncate">Mature ({stats.matureCards})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                Activity Heatmap
              </h3>
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-col items-center">
                <div className="w-full flex justify-between text-[8px] font-bold text-slate-400 dark:text-zinc-500 mb-2 uppercase">
                  <span>12 Weeks Ago</span>
                  <span>Today</span>
                </div>
                
                <div className="grid grid-flow-col gap-1 select-none">
                  {stats.heatmapGrid.map((week, wIdx) => (
                    <div key={`week-${wIdx}`} className="grid grid-rows-7 gap-1">
                      {week.map((day, dIdx) => {
                        let colorClass = "bg-slate-100 dark:bg-zinc-800";
                        if (day.count > 0 && day.count <= 2) {
                          colorClass = "bg-indigo-200 dark:bg-indigo-950";
                        } else if (day.count > 2 && day.count <= 6) {
                          colorClass = "bg-indigo-400 dark:bg-indigo-800";
                        } else if (day.count > 6) {
                          colorClass = "bg-indigo-600 dark:bg-indigo-500";
                        }
                        return (
                          <div
                            key={`day-${dIdx}`}
                            className={`w-3.5 h-3.5 rounded-sm transition-colors duration-150 ${colorClass}`}
                            title={`${day.dateStr}: ${day.count} ${day.count === 1 ? 'review' : 'reviews'}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="w-full flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-[9px] text-slate-400">
                  <span>Less</span>
                  <div className="flex gap-1 items-center">
                    <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-zinc-800" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-200 dark:bg-indigo-950" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-400 dark:bg-indigo-800" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-600 dark:bg-indigo-500" />
                  </div>
                  <span>More</span>
                </div>

                {onClearReviewLog && (reviewLog || []).length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to clear your study stats?")) {
                        onClearReviewLog();
                      }
                    }}
                    className="mt-4 text-[9px] text-slate-400 hover:text-red-500 font-semibold uppercase tracking-wider bg-transparent border-none cursor-pointer hover:underline"
                  >
                    Clear History
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab !== "focus" && activeTab !== "stats" && !currentNote && (
          <div className="text-xs text-center text-slate-400 italic mt-10">No note selected</div>
        )}

        {currentNote && activeTab === "graph" && (
          <div className="space-y-4">
            <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
              Local Graph
            </div>
            
            {localGraphData.nodes.length <= 1 ? (
              <div className="text-center py-12 text-slate-400 dark:text-zinc-600 text-xs italic">
                No connections for this note.
              </div>
            ) : (
              <div className="w-full flex justify-center bg-slate-100/30 dark:bg-zinc-950/20 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 select-none relative overflow-hidden">
                <svg
                  width="224"
                  height="224"
                  viewBox="0 0 224 224"
                  className="overflow-visible"
                >
                  {/* Links */}
                  {localGraphData.links.map((link, idx) => {
                    const sourceNode = localGraphData.nodes.find(n => n.id === link.sourceId);
                    const targetNode = localGraphData.nodes.find(n => n.id === link.targetId);
                    if (!sourceNode || !targetNode) return null;
                    return (
                      <line
                        key={`link-${idx}`}
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-zinc-800"
                        strokeWidth="1.5"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {localGraphData.nodes.map((node) => {
                    const isHovered = hoveredNodeId === node.id;
                    return (
                      <g
                        key={node.id}
                        onClick={() => onSelectNote(node.id)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className="cursor-pointer"
                      >
                        {node.isCenter && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isHovered ? "13" : "11"}
                            style={{ transition: "r 150ms ease-in-out" }}
                            className="fill-indigo-500/20 dark:fill-indigo-400/10 animate-pulse"
                          />
                        )}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isHovered ? (node.isCenter ? "8" : "7") : (node.isCenter ? "6" : "5")}
                          style={{ transition: "fill 150ms ease-in-out, r 150ms ease-in-out" }}
                          className={`stroke-white dark:stroke-zinc-900 stroke-2 ${
                            node.isCenter
                              ? "fill-indigo-500 dark:fill-indigo-400"
                              : isHovered
                              ? "fill-indigo-500 dark:fill-indigo-400"
                              : "fill-slate-400 dark:fill-zinc-600"
                          }`}
                        />
                        <text
                          x={node.x}
                          y={node.y + 14}
                          textAnchor="middle"
                          className={`text-[9px] font-medium pointer-events-none select-none transition-colors duration-150 ${
                            node.isCenter
                              ? "fill-slate-800 dark:fill-zinc-200 font-bold"
                              : isHovered
                              ? "fill-indigo-600 dark:fill-indigo-400 font-semibold"
                              : "fill-slate-500 dark:fill-zinc-400"
                          }`}
                        >
                          {node.title.length > 12 ? `${node.title.substring(0, 10)}...` : node.title}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
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
