/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Note } from "../types";
import { parseMarkdownToHtml, splitFrontmatter, parseYamlMetadata, updateYamlMetadata } from "../utils";
import { insertFlashcardTemplate } from "../flashcards";
import { CustomWYSIWYG, CustomWYSIWYGRef } from "./CustomWYSIWYG";
import TemplateModal from "./TemplateModal";
import { AppSettings } from "./SettingsDialog";
import {
  Heading1,
  Bold,
  Italic,
  Code,
  Link,
  Link2,
  Quote,
  Eye,
  Edit3,
  Columns,
  Clock,
  ChevronRight,
  ChevronDown,
  FileText,
  Tag,
  Frame,
  Brain,
  Settings,
  BookOpen,
  Sliders,
  CheckSquare,
  Hash,
  Type,
  List,
  CheckCircle2,
} from "lucide-react";

interface EditorProps {
  note: Note;
  notes: Note[];
  mode: "edit" | "preview" | "split" | "dynamic";
  settings: AppSettings;
  isZenMode?: boolean;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onSelectNote: (id: string, options?: { startReading?: boolean }) => void;
  shouldRestoreScroll?: boolean;
  restoreScrollKey?: number;
  sessionOffset?: number;
  onSaveSessionOffset?: (noteId: string, offset: number) => void;
  onWikilinkClick?: (noteTitle: string) => void;
  onExtractNote?: (
    parentNoteId: string,
    extractText: string,
    editorMode: string,
    options: {
      customTitle: string;
      asEmbed: boolean;
      nearestHeading: string | null;
    },
    selectionStart?: number,
    selectionEnd?: number
  ) => Promise<Note | null>;
}

export default function Editor({
  note,
  notes,
  mode,
  settings,
  onUpdateNote,
  onSelectNote,
  onWikilinkClick,
  isZenMode,
  onExtractNote,
  shouldRestoreScroll,
  restoreScrollKey,
  sessionOffset,
  onSaveSessionOffset,
}: EditorProps) {
  const renderStringWithLinks = (text: string) => {
    const parts = [];
    let lastIndex = 0;
    const regex = /(!?)\[\[(.*?)(?:\|(.*?))?\]\]|https?:\/\/[^\s]+/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matchedStr = match[0];
      if (matchedStr.startsWith("http://") || matchedStr.startsWith("https://")) {
        parts.push(
          <a
            key={match.index}
            href={matchedStr}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {matchedStr}
          </a>
        );
      } else {
        const target = match[2].trim();
        const alias = match[3] ? match[3].trim() : target;
        parts.push(
          <span
            key={match.index}
            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onWikilinkClick(target);
            }}
          >
            {alias}
          </span>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const renderPropertyValue = (key: string, val: any) => {
    if (Array.isArray(val)) {
      const isTags = key === "tags" || key === "tag";
      if (isTags) {
        return (
          <div className="flex flex-wrap gap-1">
            {val.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/30"
              >
                #{item}
              </span>
            ))}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {val.map((item, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/50">
              {renderStringWithLinks(String(item))}
            </span>
          ))}
        </div>
      );
    }

    if (typeof val === "boolean" || val === "true" || val === "false") {
      const boolVal = val === true || val === "true";
      return (
        <input
          type="checkbox"
          checked={boolVal}
          readOnly
          className="w-3.5 h-3.5 text-indigo-600 border-slate-300 dark:border-zinc-700 rounded focus:ring-indigo-500 pointer-events-none"
        />
      );
    }

    return (
      <span className="font-sans">
        {renderStringWithLinks(String(val))}
      </span>
    );
  };

  const [htmlContent, setHtmlContent] = useState("");
  const [localTitle, setLocalTitle] = useState(note.title);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wysiwygRef = useRef<CustomWYSIWYGRef | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isYamlCollapsed, setIsYamlCollapsed] = useState(settings.hideYaml ?? false);
  const [showCardDropdown, setShowCardDropdown] = useState(false);
  const [scheduledMessage, setScheduledMessage] = useState<string | null>(null);
  const [showEarlyReview, setShowEarlyReview] = useState(false);

  // Reset scheduled message and early review state when note changes
  useEffect(() => {
    setScheduledMessage(null);
    setShowEarlyReview(false);
  }, [note.id]);

  // Sync collapsed state when setting changes
  useEffect(() => {
    setIsYamlCollapsed(settings.hideYaml ?? false);
  }, [settings.hideYaml]);

  // Derive templates from notes
  const templates = notes.filter(n => n.path === "Templates" || n.id.startsWith("Templates/"));

  // Sync local title when note changes
  useEffect(() => {
    setLocalTitle(note.title);
  }, [note.id, note.title]);

  const handleTitleBlur = () => {
    let finalTitle = localTitle.trim();
    if (!finalTitle) {
      finalTitle = note.title.trim() || "Untitled";
      setLocalTitle(finalTitle);
    }
    if (finalTitle !== note.title.trim()) {
      onUpdateNote(note.id, { title: finalTitle });
    }
  };

  const irMetadata = useMemo(() => {
    const { frontmatter } = splitFrontmatter(note.content);
    if (!frontmatter) return null;
    const metadata = parseYamlMetadata(frontmatter);
    if (metadata.ir_next_read) {
      const nextReadVal = String(metadata.ir_next_read).trim();
      const todayStr = new Date().toISOString().split("T")[0];
      return {
        nextRead: nextReadVal,
        interval: parseInt(String(metadata.ir_interval)) || 1,
        ease: parseFloat(String(metadata.ir_ease)) || 2.5,
        priority: parseInt(String(metadata.ir_priority)) || 50,
        lastOffset: parseInt(String(metadata.ir_last_offset)) || 0,
        isDue: nextReadVal <= todayStr
      };
    }
    return null;
  }, [note.content]);

  const handleScheduleReading = (grade: "hard" | "good" | "easy" | "done") => {
    if (!irMetadata) return;
    
    if (grade === "done") {
      const newContent = updateYamlMetadata(note.content, {
        ir_next_read: null,
        ir_interval: null,
        ir_ease: null,
        ir_priority: null,
        ir_last_offset: null
      });
      onUpdateNote(note.id, { content: newContent });
      setScheduledMessage("Finished reading");
      return;
    }
    
    let newInterval = 1;
    let newEase = irMetadata.ease;
    
    if (grade === "hard") {
      newInterval = 1;
      newEase = Math.max(1.3, irMetadata.ease - 0.2);
    } else if (grade === "good") {
      newInterval = Math.max(2, Math.round(irMetadata.interval * irMetadata.ease));
    } else if (grade === "easy") {
      newInterval = Math.max(3, Math.round(irMetadata.interval * irMetadata.ease * 1.5));
      newEase = irMetadata.ease + 0.15;
    }
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);
    const nextReadStr = nextDate.toISOString().split("T")[0];
    
    const newContent = updateYamlMetadata(note.content, {
      ir_next_read: nextReadStr,
      ir_interval: newInterval,
      ir_ease: newEase,
      ir_last_offset: lastOffsetRef.current
    });
    
    onUpdateNote(note.id, { content: newContent });
    setScheduledMessage(`Scheduled for ${nextReadStr} (+${newInterval}d)`);
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string, start?: number, end?: number } | null>(null);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    let text = window.getSelection()?.toString().trim();
    if (!text && textareaRef.current) {
       text = textareaRef.current.value.substring(textareaRef.current.selectionStart, textareaRef.current.selectionEnd).trim();
    }
    if (!text) return;

    let start: number | undefined;
    let end: number | undefined;

    if ((mode === "edit" || mode === "split") && textareaRef.current) {
      if (textareaRef.current.selectionStart !== textareaRef.current.selectionEnd) {
        start = textareaRef.current.selectionStart;
        end = textareaRef.current.selectionEnd;
      }
    } else if (mode === "dynamic" && wysiwygRef.current) {
      const range = wysiwygRef.current.getSelectionRange();
      if (range) {
        start = range.start;
        end = range.end;
      }
    }

    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, text, start, end });
  };

  const handleExtractSelection = async (contextData?: { text: string, start?: number, end?: number }) => {
    const textToExtract = contextData ? contextData.text : selectedText;
    if (!textToExtract || !onExtractNote) return;
    
    let start: number | undefined = contextData?.start;
    let end: number | undefined = contextData?.end;
    
    if (!contextData) {
      if ((mode === "edit" || mode === "split") && textareaRef.current && textareaRef.current.selectionStart !== textareaRef.current.selectionEnd) {
        start = textareaRef.current.selectionStart;
        end = textareaRef.current.selectionEnd;
      } else if (mode === "dynamic" && wysiwygRef.current) {
        const range = wysiwygRef.current.getSelectionRange();
        if (range) {
          start = range.start;
          end = range.end;
        }
      }
    }
    
    // 1. Calculate default title
    const cleanText = textToExtract.replace(/[#*`[\]{}:]/g, "").trim();
    let excerpt = cleanText.substring(0, 30).trim();
    if (!excerpt) excerpt = "Extract";
    const defaultTitle = excerpt;
    
    // 2. Prompt for title
    const userInput = window.prompt("Enter a title for this extract (or leave as default):", defaultTitle);
    if (userInput === null) return; // User cancelled
    const customTitle = (userInput.trim() || defaultTitle).replace(/:/g, "");
    
    // 3. Confirm Embed vs Link
    const asEmbed = window.confirm("Insert as an Embedded note?\n\n[OK] = Embed (![[...]])\n[Cancel] = Link ([[...]])");
    
    // 4. Find nearest heading for context
    let nearestHeading: string | null = null;
    let textBefore = "";
    if (start !== undefined && textareaRef.current) {
      textBefore = textareaRef.current.value.substring(0, start);
    } else {
      const matchIndex = note.content.indexOf(textToExtract);
      if (matchIndex !== -1) {
        textBefore = note.content.substring(0, matchIndex);
      }
    }
    if (textBefore) {
      const headings = textBefore.match(/^#{1,6}\s+(.+)$/gm);
      if (headings && headings.length > 0) {
        nearestHeading = headings[headings.length - 1].replace(/^#{1,6}\s+/, "").trim();
      }
    }
    
    const options = {
      customTitle,
      asEmbed,
      nearestHeading
    };
    
    const newNote = await onExtractNote(note.id, textToExtract, mode, options, start, end);
    if (!newNote) return;
    
    window.getSelection()?.removeAllRanges();
    setSelectionCoords(null);
    setSelectedText("");
  };

  const lastOffsetRef = useRef(0);
  const hasRestoredScrollRef = useRef(false);

  const handleEditorCaretChange = () => {
    let offset = 0;
    if (mode === "dynamic" && wysiwygRef.current) {
      offset = wysiwygRef.current.getCaretOffset();
    } else if (textareaRef.current) {
      offset = textareaRef.current.selectionStart;
    }
    lastOffsetRef.current = offset;
  };

  const handleScroll = (scrollTop: number, scrollHeight: number, clientHeight: number) => {
    const textLen = note.content.length;
    if (textLen > 0 && scrollHeight > clientHeight) {
      const visibleCenter = scrollTop + clientHeight / 2;
      const percentage = visibleCenter / scrollHeight;
      lastOffsetRef.current = Math.min(textLen, Math.max(0, Math.round(textLen * percentage)));
    }
  };

  useEffect(() => {
    hasRestoredScrollRef.current = false;
  }, [note.id]);

  useEffect(() => {
    if (shouldRestoreScroll) {
      hasRestoredScrollRef.current = false;
    }
  }, [restoreScrollKey]);

  useEffect(() => {
    const targetOffset = shouldRestoreScroll 
      ? (irMetadata ? irMetadata.lastOffset : 0) 
      : (sessionOffset || 0);

    lastOffsetRef.current = targetOffset;
    
    let timer: NodeJS.Timeout;
    if (targetOffset > 0 && !hasRestoredScrollRef.current) {
      hasRestoredScrollRef.current = true;
      timer = setTimeout(() => {
        if (mode === "dynamic" && wysiwygRef.current) {
          wysiwygRef.current.setCaretOffset(targetOffset);
          wysiwygRef.current.scrollToOffset(targetOffset);
        } else {
          if (textareaRef.current) {
            const tx = textareaRef.current;
            tx.focus();
            tx.selectionStart = targetOffset;
            tx.selectionEnd = targetOffset;
            
            const textLen = tx.value.length;
            if (textLen > 0) {
              const percentage = targetOffset / textLen;
              tx.scrollTop = (tx.scrollHeight * percentage) - (tx.clientHeight / 2);
            }
          }
          if (previewContainerRef.current) {
            const el = previewContainerRef.current;
            const textLen = note.content.length;
            if (textLen > 0) {
              const percentage = targetOffset / textLen;
              el.scrollTop = (el.scrollHeight * percentage) - (el.clientHeight / 2);
            }
          }
        }
      }, 0);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
      if (lastOffsetRef.current > 0 && !shouldRestoreScroll) {
        onSaveSessionOffset?.(note.id, lastOffsetRef.current);
      }
    };
  }, [note.id, shouldRestoreScroll, mode, sessionOffset, restoreScrollKey]);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Parse markdown asynchronously when note content changes
  useEffect(() => {
    let active = true;
    parseMarkdownToHtml(note.content, notes).then(html => {
      if (active) {
        setHtmlContent(html);
      }
    });
    return () => { active = false; };
  }, [note.content, notes]);

  // Insert markdown helper buttons
  const insertMarkdown = (before: string, after: string = "") => {
    if (mode === "dynamic") {
      wysiwygRef.current?.insertMarkdown(before, after);
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end);
    const replacement = before + selectedText + after;

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    if (settings.hideYaml) {
      handleBodyChange(newContent);
    } else {
      onUpdateNote(note.id, { content: newContent });
    }

    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 50);
  };


  // Intercept click events in preview container to handle dynamic wikilinks
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wikilinkEl = target.closest("[data-note]");
    if (wikilinkEl) {
      const noteTitleEncoded = wikilinkEl.getAttribute("data-note");
      if (noteTitleEncoded) {
        const noteTitle = decodeURIComponent(noteTitleEncoded);
        onWikilinkClick(noteTitle);
      }
      return;
    }
  };

  const insertTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
    insertMarkdown(timestamp, "");
  };

  const handleInsertFlashcard = () => {
    const updatedContent = insertFlashcardTemplate(note.content);
    onUpdateNote(note.id, { content: updatedContent });
  };

  const { frontmatter, body } = splitFrontmatter(note.content);
  const yamlInner = frontmatter
    ? frontmatter.replace(/^---\r?\n/, "").replace(/\r?\n---(?:\r?\n|$)/, "")
    : "";

  const handleBodyChange = (newBody: string) => {
    const newContent = frontmatter ? frontmatter + newBody : newBody;
    onUpdateNote(note.id, { content: newContent });
  };

  const handleYamlChange = (newYaml: string) => {
    const trimmedYaml = newYaml.trim();
    const newFrontmatter = trimmedYaml ? `---\n${trimmedYaml}\n---\n` : "";
    const newContent = newFrontmatter + body;
    onUpdateNote(note.id, { content: newContent });
  };

  // ----------------------------------------------------
  // TAG AUTOCOMPLETE ENGINE
  // ----------------------------------------------------
  const allUniqueTags = useMemo(() => {
    const tagRegex = /(?<=^|\s)#([\p{L}\p{N}_\-\/]+)/gu;
    const tags = new Set<string>();
    notes.forEach(n => {
      let match;
      while ((match = tagRegex.exec(n.content)) !== null) {
        tags.add(match[1].trim());
      }
    });
    return Array.from(tags);
  }, [notes]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCoords, setSuggestionCoords] = useState({ top: 0, left: 0 });
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [triggerIndex, setTriggerIndex] = useState(-1);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;

    const textBeforeCursor = val.substring(0, pos);
    const lastWordMatch = textBeforeCursor.match(/#[\p{L}\p{N}_\-\/]*$/u);

    if (lastWordMatch && lastWordMatch.index !== undefined) {
      const query = lastWordMatch[0].substring(1);
      const filtered = allUniqueTags.filter(tag =>
        tag.toLowerCase().startsWith(query.toLowerCase())
      );

      if (filtered.length > 0) {
        setFilteredTags(filtered);
        setShowSuggestions(true);
        setTriggerIndex(lastWordMatch.index);
        setActiveSuggestionIdx(0);

        if (textareaRef.current) {
          const coords = getCaretCoordinates(textareaRef.current, lastWordMatch.index);
          setSuggestionCoords(coords);
        }
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredTags.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIdx(prev => (prev + 1) % filteredTags.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIdx(prev => (prev - 1 + filteredTags.length) % filteredTags.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      insertTag(filteredTags[activeSuggestionIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.value;
    const start = triggerIndex;
    const end = textarea.selectionStart;

    const inserted = `#${tag} `;
    const newBody = text.substring(0, start) + inserted + text.substring(end);

    if (settings.hideYaml) {
      handleBodyChange(newBody);
    } else {
      onUpdateNote(note.id, { content: newBody });
    }

    setShowSuggestions(false);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + inserted.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // ----------------------------------------------------
  // HIGHLIGHT TO CARD
  // ----------------------------------------------------
  const [selectedText, setSelectedText] = useState("");
  const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number } | null>(null);

  const handlePreviewMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;
    
    const text = selection.toString().trim();
    if (!text) {
      setSelectionCoords(null);
      setSelectedText("");
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectionCoords({
        top: rect.top - 40,
        left: rect.left + rect.width / 2
      });
      setSelectedText(text);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewMouseDown = () => {
    setSelectionCoords(null);
    setSelectedText("");
  };

  const handleCreateCardFromSelection = () => {
    if (!selectedText) return;
    const cardTemplate = `\n\n${selectedText} :: [Ответ]`;
    const newContent = note.content + cardTemplate;
    onUpdateNote(note.id, { content: newContent });
    
    window.getSelection()?.removeAllRanges();
    setSelectionCoords(null);
    setSelectedText("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-50 dark:bg-zinc-950">
      
      {/* Workspace Toolbar */}
      {!isZenMode && (
      <div className="min-h-[40px] bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0 shadow-sm">
        
        {/* Editor controls / formatting helpers */}
        <div 
          className="flex items-center gap-1.5 flex-wrap py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={() => insertMarkdown("## ")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Heading"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("**", "**")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Bold text"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("*", "*")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Italic text"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("> ")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("`", "`")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Inline code"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertMarkdown("[", "](https://)")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="External Link"
          >
            <Link className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
          <button
            onClick={() => insertMarkdown("[[", "]]")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer flex items-center space-x-1 font-mono text-xs font-semibold"
            title="Insert Wikilink"
          >
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">[[]]</span>
          </button>
          <button
            onClick={() => insertMarkdown("![[", "]]")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer flex items-center space-x-1 font-mono text-xs font-semibold"
            title="Embed Note (Transclusion)"
          >
            <Frame className="w-4 h-4" />
            <span className="hidden sm:inline">![[]]</span>
          </button>
          <button
            onClick={() => insertMarkdown("#", "")}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center space-x-1 font-mono text-xs font-semibold"
            title="Insert Tag"
          >
            <Tag className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
          <button
            onClick={insertTimestamp}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center space-x-1 font-mono text-xs font-semibold"
            title="Insert Timestamp"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Time</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowCardDropdown(!showCardDropdown)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer flex items-center space-x-1 font-mono text-xs font-semibold"
              title="Flashcard Options"
            >
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">Card</span>
              <ChevronDown className="w-3 h-3 text-indigo-400 dark:text-indigo-500" />
            </button>
            
            {showCardDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowCardDropdown(false)} 
                />
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl py-1 z-20 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      handleInsertFlashcard();
                      setShowCardDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Однострочная (::)</span>
                  </button>
                  <button
                    onClick={() => {
                      insertMarkdown("\n\nВопрос ::: Ответ");
                      setShowCardDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Двусторонняя (:::)</span>
                  </button>
                  <button
                    onClick={() => {
                      insertMarkdown("\n\nВопрос\n?\nОтвет\n\n");
                      setShowCardDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Многострочная (?)</span>
                  </button>
                  <button
                    onClick={() => {
                      insertMarkdown("{{", "}}");
                      setShowCardDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100 dark:border-zinc-800"
                  >
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Пропуск {"{{...}}"}</span>
                  </button>
                  <button
                    onClick={() => {
                      insertMarkdown("==", "==");
                      setShowCardDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Пропуск (==...==)</span>
                  </button>
                  <button
                    onClick={() => {
                      insertMarkdown("\n\n:::test\nВопрос\n- [ ] Неверно\n- [x] Верно\n:::\n\n");
                      setShowCardDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100 dark:border-zinc-800"
                  >
                    <Brain className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Тест (MCQ)</span>
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700 mx-1" />
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer flex items-center space-x-1 font-mono text-xs font-semibold"
            title="Insert Template"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Template</span>
          </button>
        </div>
      </div>
      )}

      {/* Editor Content Canvas */}
      <div className="flex-1 flex overflow-hidden" onContextMenu={handleEditorContextMenu}>
        
        {/* EDIT PANE */}
        {(mode === "edit" || mode === "split") && (
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {/* Note Title Input */}
            <input
              type="text"
              value={localTitle}
              onChange={(e) => {
                const val = e.target.value.replace(/[<>:"/\\|?*]/g, '');
                setLocalTitle(val);
              }}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Note Title"
              className="w-full bg-transparent text-2xl font-bold border-none outline-none focus:ring-0 mb-4 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-zinc-700"
            />
            
            {/* Collapsible YAML block (only if hideYaml is active) */}
            {settings.hideYaml && (
              <div className="mb-4 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-zinc-950/40 shadow-sm transition-all duration-200 shrink-0">
                <div 
                  onClick={() => setIsYamlCollapsed(!isYamlCollapsed)}
                  className="flex items-center justify-between px-4 py-2 bg-slate-100/50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-500" />
                    <span>YAML Frontmatter {frontmatter ? `(${yamlInner.split('\n').filter(Boolean).length} keys)` : "(empty)"}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">{isYamlCollapsed ? "Show" : "Hide"}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isYamlCollapsed ? "" : "rotate-90"}`} />
                  </div>
                </div>
                {!isYamlCollapsed && (
                  <div className="p-3 bg-white dark:bg-zinc-900">
                    <textarea
                      value={yamlInner}
                      onChange={(e) => handleYamlChange(e.target.value)}
                      placeholder="tags: [study, dev]&#10;author: John Doe&#10;status: active"
                      rows={4}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded p-2 text-xs font-mono text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-y"
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Note content textarea */}
            <textarea
              ref={textareaRef}
              value={settings.hideYaml ? body : note.content}
              onChange={(e) => {
                const val = e.target.value;
                if (settings.hideYaml) {
                  handleBodyChange(val);
                } else {
                  onUpdateNote(note.id, { content: val });
                }
                handleTextareaChange(e);
              }}
              onKeyDown={handleTextareaKeyDown}
              onKeyUp={handleEditorCaretChange}
              onClick={handleEditorCaretChange}
              onScroll={(e) => {
                const el = e.currentTarget;
                handleScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
              }}
              placeholder="Start writing... Type [[Other Note]] to create/link notes."
              className="flex-1 w-full bg-transparent border-none outline-none resize-none focus:ring-0 text-sm leading-relaxed overflow-y-auto text-slate-800 dark:text-zinc-200 placeholder-slate-300 dark:placeholder-zinc-700"
              style={{ fontFamily: 'var(--font-editor, inherit)' }}
            />
          </div>
        )}

        {/* PREVIEW PANE */}
        {(mode === "preview" || mode === "split") && (
          <div 
            ref={previewContainerRef}
            className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-zinc-950/20"
            onClick={handlePreviewClick}
            onMouseDown={handlePreviewMouseDown}
            onMouseUp={handlePreviewMouseUp}
            onScroll={(e) => {
              const el = e.currentTarget;
              handleScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
            }}
          >
            {/* Note Title Input */}
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              placeholder="Note Title"
              className="w-full bg-transparent text-2xl font-bold border-none outline-none focus:ring-0 mb-4 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-zinc-700"
            />

            {/* Note Metadata Block (Obsidian Properties Style) */}
            {frontmatter && Object.keys(parseYamlMetadata(frontmatter)).length > 0 && (
              <div className="metadata-properties mb-4 shrink-0">
                <div
                  onClick={() => setIsYamlCollapsed(!isYamlCollapsed)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3 cursor-pointer select-none hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isYamlCollapsed ? "" : "rotate-90"}`} />
                  <span>Properties</span>
                  <span className="text-[9px] font-normal text-slate-300 dark:text-zinc-600 ml-1">({Object.keys(parseYamlMetadata(frontmatter)).length})</span>
                </div>
                {!isYamlCollapsed && (
                <div className="divide-y divide-slate-100/50 dark:divide-zinc-800/20 animate-in slide-in-from-top-1 fade-in duration-200">
                  {Object.entries(parseYamlMetadata(frontmatter)).map(([key, val]) => {
                    let IconComponent = Type;
                    if (key === "tags" || key === "tag") IconComponent = Tag;
                    else if (key === "aliases" || key === "alias" || Array.isArray(val)) IconComponent = List;
                    else if (key.includes("date") || key.includes("time") || key.includes("created") || key.includes("read")) IconComponent = Clock;
                    else if (typeof val === "boolean" || val === "true" || val === "false") IconComponent = CheckSquare;
                    else if (typeof val === "number" || (!isNaN(Number(val)) && val !== "")) IconComponent = Hash;
                    
                    return (
                      <div key={key} className="flex items-center min-h-[32px] px-1 py-1 gap-2">
                        {/* Изменено w-20 на w-32 для более широкой колонки названий */}
                        <div className="w-32 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500 shrink-0">
                          <IconComponent className="w-3.5 h-3.5 text-slate-400/80" />
                          <span className="truncate" title={key}>{key}</span>
                        </div>
                        <div className="flex-1 text-xs text-slate-700 dark:text-zinc-300 flex items-center">
                          {renderPropertyValue(key, val)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* Markdown rendered output with custom event interceptor */}
            <div
              className="markdown-body text-slate-800 dark:text-zinc-200 flex-1 prose dark:prose-invert max-w-none pb-12"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}

        {/* CUSTOM WYSIWYG PANE (Dynamic Mode) */}
        {mode === "dynamic" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
            {/* Note Title Input */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-6 shrink-0">
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                placeholder="Note Title"
                className="w-full bg-transparent text-2xl font-bold border-none outline-none focus:ring-0 mb-4 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-zinc-700"
              />
            </div>
            
            {/* Collapsible YAML block (only if hideYaml is active) */}
            {settings.hideYaml && (
              <div className="mx-4 sm:mx-6 mb-4 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-zinc-950/40 shadow-sm transition-all duration-200 shrink-0">
                <div 
                  onClick={() => setIsYamlCollapsed(!isYamlCollapsed)}
                  className="flex items-center justify-between px-4 py-2 bg-slate-100/50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-500" />
                    <span>YAML Frontmatter {frontmatter ? `(${yamlInner.split('\n').filter(Boolean).length} keys)` : "(empty)"}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">{isYamlCollapsed ? "Show" : "Hide"}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isYamlCollapsed ? "" : "rotate-90"}`} />
                  </div>
                </div>
                {!isYamlCollapsed && (
                  <div className="p-3 bg-white dark:bg-zinc-900">
                    <textarea
                      value={yamlInner}
                      onChange={(e) => handleYamlChange(e.target.value)}
                      placeholder="tags: [study, dev]&#10;author: John Doe&#10;status: active"
                      rows={4}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded p-2 text-xs font-mono text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-y"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Custom WYSIWYG Editor */}
            <div className="flex-1 overflow-hidden" onKeyUp={handleEditorCaretChange} onClick={handleEditorCaretChange}>
              <CustomWYSIWYG 
                ref={wysiwygRef}
                key={note.createdAt} 
                content={settings.hideYaml ? body : note.content} 
                notes={notes}
                isZenMode={isZenMode}
                onScroll={handleScroll}
                onChange={(newContent) => {
                  if (settings.hideYaml) {
                    handleBodyChange(newContent);
                  } else {
                    onUpdateNote(note.id, { content: newContent });
                  }
                }} 
                onWikilinkClick={onWikilinkClick}
              />
            </div>
          </div>
        )}

      </div>

      <TemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={templates}
        onSelectTemplate={(content) => insertMarkdown(content)}
      />

      {showSuggestions && filteredTags.length > 0 && (
        <div 
          style={{ 
            top: `${suggestionCoords.top + 20}px`, 
            left: `${suggestionCoords.left}px` 
          }}
          className="fixed z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl max-h-40 overflow-y-auto w-44 p-1 flex flex-col gap-0.5"
        >
          {filteredTags.map((tag, idx) => (
             <button
               key={tag}
               onClick={() => insertTag(tag)}
               className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                 idx === activeSuggestionIdx 
                   ? "bg-indigo-600 text-white font-medium" 
                   : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
               }`}
             >
               #{tag}
             </button>
          ))}
        </div>
      )}

      {selectionCoords && selectedText && (
        <div 
          style={{ 
            top: `${selectionCoords.top}px`, 
            left: `${selectionCoords.left}px`,
            transform: 'translateX(-50%)'
          }}
          className="fixed z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1 bg-indigo-600 border border-indigo-500 rounded-lg shadow-lg overflow-hidden p-1">
            <button
              onClick={handleCreateCardFromSelection}
              className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-indigo-700 text-white font-medium text-xs rounded cursor-pointer transition-colors"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Сделать карточкой</span>
            </button>
            <div className="w-px h-4 bg-indigo-500/50 self-center" />
            <button
              onClick={handleExtractSelection}
              className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-indigo-700 text-white font-medium text-xs rounded cursor-pointer transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Экстракт</span>
            </button>
          </div>
        </div>
      )}

      {(irMetadata || scheduledMessage) && (
        <div className="bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 p-3 px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-500 rounded text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Reading Session</div>
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                {scheduledMessage ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Completed</span>
                ) : (
                  <>{!irMetadata?.isDue && <span className="text-slate-500 dark:text-zinc-500 mr-2">Scheduled: {irMetadata?.nextRead}</span>}Interval: {irMetadata?.interval}d | Ease: {irMetadata?.ease.toFixed(1)}</>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {scheduledMessage ? (
              <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-md border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {scheduledMessage}
              </div>
            ) : (!irMetadata?.isDue && !showEarlyReview) ? (
              <button
                onClick={() => setShowEarlyReview(true)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-md cursor-pointer transition-colors"
                title="Perform early review"
              >
                Review Early
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleScheduleReading("hard")}
                  className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-md border border-red-200 dark:border-red-800/50 cursor-pointer transition-colors"
                  title="Read again soon (1 day)"
                >
                  Soon (Hard)
                </button>
                <button
                  onClick={() => handleScheduleReading("good")}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-md border border-indigo-200 dark:border-indigo-800/50 cursor-pointer transition-colors"
                  title={`Next reading in ${Math.max(2, Math.round((irMetadata?.interval || 1) * (irMetadata?.ease || 2.5)))} days`}
                >
                  Later (Good)
                </button>
                <button
                  onClick={() => handleScheduleReading("easy")}
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-md border border-emerald-200 dark:border-emerald-800/50 cursor-pointer transition-colors"
                  title={`Next reading in ${Math.max(3, Math.round((irMetadata?.interval || 1) * (irMetadata?.ease || 2.5) * 1.5))} days`}
                >
                  Easy
                </button>
                <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />
                <button
                  onClick={() => handleScheduleReading("done")}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-md cursor-pointer transition-colors"
                  title="Remove from Reading Queue"
                >
                  Finish (Done)
                </button>
              </>
            )}
          </div>
        </div>
      )}
    {/* Custom Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md shadow-lg py-1 text-sm font-medium"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors flex items-center gap-2"
            onClick={() => {
              handleExtractSelection(contextMenu);
              setContextMenu(null);
            }}
          >
            <span className="text-xs">✂️</span> Extract Note
          </button>
        </div>
      )}
    </div>
  );
}

// Projection helper to calculate text caret screen position
function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  const div = document.createElement("div");
  const style = window.getComputedStyle(element);
  
  const properties = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant",
    "lineHeight", "letterSpacing", "textAlign", "textTransform", "textIndent",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderWidth", "borderStyle", "boxSizing", "width"
  ];
  
  properties.forEach(prop => {
    div.style[prop as any] = style[prop as any];
  });
  
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  
  const text = element.value.substring(0, position);
  div.textContent = text;
  
  const span = document.createElement("span");
  span.textContent = element.value.substring(position, position + 1) || ".";
  div.appendChild(span);
  
  document.body.appendChild(div);
  const { offsetTop, offsetLeft } = span;
  const rect = element.getBoundingClientRect();
  document.body.removeChild(div);
  
  return {
    top: rect.top + offsetTop - element.scrollTop,
    left: rect.left + offsetLeft - element.scrollLeft
  };
}
