/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { Note } from "../types";
import { parseMarkdownToHtml } from "../utils";
import { CustomWYSIWYG, CustomWYSIWYGRef } from "./CustomWYSIWYG";
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
  FileText,
} from "lucide-react";

interface EditorProps {
  note: Note;
  notes: Note[];
  mode: "edit" | "preview" | "split" | "dynamic";
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onSelectNote: (id: string) => void;
  onWikilinkClick: (title: string) => void;
}

export default function Editor({
  note,
  notes,
  mode,
  onUpdateNote,
  onSelectNote,
  onWikilinkClick,
}: EditorProps) {
  const [htmlContent, setHtmlContent] = useState("");
  const [localTitle, setLocalTitle] = useState(note.title);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wysiwygRef = useRef<CustomWYSIWYGRef | null>(null);

  // Sync local title when note changes
  useEffect(() => {
    setLocalTitle(note.title);
  }, [note.id, note.title]);

  const handleTitleBlur = () => {
    if (localTitle.trim() !== note.title.trim()) {
      onUpdateNote(note.id, { title: localTitle });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Parse markdown asynchronously when note content changes
  useEffect(() => {
    let active = true;
    const render = async () => {
      const html = await parseMarkdownToHtml(note.content || "");
      if (active) {
        setHtmlContent(html);
      }
    };
    render();
    return () => {
      active = false;
    };
  }, [note.content]);

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
    onUpdateNote(note.id, { content: newContent });

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-50 dark:bg-zinc-950">
      
      {/* Workspace Toolbar */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
        
        {/* Editor controls / formatting helpers */}
        <div 
          className="flex items-center space-x-1.5 overflow-x-auto py-1"
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
            title="Insert Wikilink to another note"
          >
            <Link2 className="w-4 h-4" />
            <span>[[]]</span>
          </button>
        </div>


      </div>

      {/* Editor Content Canvas */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* EDIT PANE */}
        {(mode === "edit" || mode === "split") && (
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
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
            
            {/* Note content textarea */}
            <textarea
              ref={textareaRef}
              value={note.content}
              onChange={(e) => onUpdateNote(note.id, { content: e.target.value })}
              placeholder="Start writing... Type [[Other Note]] to create/link notes."
              className="flex-1 w-full bg-transparent border-none outline-none resize-none focus:ring-0 text-sm leading-relaxed overflow-y-auto text-slate-800 dark:text-zinc-200 placeholder-slate-300 dark:placeholder-zinc-700"
              style={{ fontFamily: 'var(--font-editor, inherit)' }}
            />
          </div>
        )}

        {/* PREVIEW PANE */}
        {(mode === "preview" || mode === "split") && (
          <div 
            className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-zinc-950/20"
            onClick={handlePreviewClick}
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
            
            {/* Custom WYSIWYG Editor */}
            <div className="flex-1 overflow-hidden">
              <CustomWYSIWYG 
                ref={wysiwygRef}
                key={note.createdAt} 
                content={note.content} 
                notes={notes}
                onChange={(newContent) => onUpdateNote(note.id, { content: newContent })} 
                onWikilinkClick={onWikilinkClick}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
