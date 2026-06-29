import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Note } from '../types';

export interface CustomWYSIWYGRef {
  insertMarkdown: (before: string, after?: string) => void;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  replaceSelection: (replacement: string) => void;
}

interface CustomWYSIWYGProps {
  content: string;
  notes: Note[];
  onChange: (markdown: string) => void;
  onWikilinkClick: (title: string) => void;
  isZenMode?: boolean;
}

interface AutocompleteState {
  active: boolean;
  query: string;
  x: number;
  y: number;
  selectedIndex: number;
}

const highlightMarkdown = (text: string, activeLineIndex: number = -1, isZenMode: boolean = false) => {
  // Escape HTML
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Split by newline to process line by line
  const lines = html.split('\n');
  const highlightedLines = lines.map((line, index) => {
    const zenClass = isZenMode ? (index === activeLineIndex ? ' zen-active' : ' zen-inactive') : '';
    
    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      return `<span class="md-line md-header md-h${level}${zenClass}"><span class="md-token">${headerMatch[1]} </span>${headerMatch[2]}</span>`;
    }

    // Blockquotes
    const quoteMatch = line.match(/^>\s+(.*)$/);
    if (quoteMatch) {
      return `<span class="md-line md-quote${zenClass}"><span class="md-token">&gt; </span>${quoteMatch[1]}</span>`;
    }

    // List items
    const listMatch = line.match(/^-\s+(.*)$/);
    if (listMatch) {
      return `<span class="md-line md-list${zenClass}"><span class="md-token">- </span>${listMatch[1]}</span>`;
    }

    // Inline formatting
    let processed = line;
    
    // Flashcard Q :: A
    processed = processed.replace(/(\s+::\s+)(.*)$/, (match, sep, answer) => {
      return `<span class="text-indigo-400 dark:text-indigo-600 font-bold mx-1">${sep}</span><span class="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 rounded border-b-2 border-amber-500">${answer}</span>`;
    });
    
    // Tags
    processed = processed.replace(/(?<=^|\s)(#[\p{L}\p{N}_\-\/]+)/gu, '<span class="text-indigo-500 dark:text-indigo-400 font-medium cursor-pointer hover:underline">$1</span>');

    // Cloze Deletions
    processed = processed.replace(/\{\{(.*?)\}\}/g, '<span class="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 rounded border-b-2 border-amber-500"><span class="md-token opacity-50">{{</span>$1<span class="md-token opacity-50">}}</span></span>');

    processed = processed.replace(/\*\*(.*?)\*\*/g, '<span class="md-bold"><span class="md-token">**</span>$1<span class="md-token">**</span></span>');
    processed = processed.replace(/\*(.*?)\*/g, '<span class="md-italic"><span class="md-token">*</span>$1<span class="md-token">*</span></span>');
    processed = processed.replace(/`(.*?)`/g, '<span class="md-code"><span class="md-token">`</span>$1<span class="md-token">`</span></span>');
    processed = processed.replace(/(!?)\[\[(.*?)\]\]/g, (match, excl, content) => {
      const target = content.split('|')[0].trim();
      const safeTarget = target.replace(/"/g, '&quot;');
      if (excl === '!') {
        return `<span class="md-embed text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded border border-indigo-200 dark:border-indigo-800"><span class="md-token">![[</span>${content}<span class="md-token">]]</span></span>`;
      } else {
        return `<span class="md-wikilink cursor-pointer hover:underline" data-note="${safeTarget}"><span class="md-token">[[</span>${content}<span class="md-token">]]</span></span>`;
      }
    });
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-extlink cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"><span class="md-token">[</span>$1<span class="md-token">](</span><span class="md-token opacity-50 text-xs">$2</span><span class="md-token">)</span></a>');

    return `<span class="md-line${zenClass}">${processed}</span>`;
  });

  // Rejoin with newline characters and append <br/> to fix the trailing newline visual bug in contentEditable
  return highlightedLines.join('\n') + '<br/>';
};

export const CustomWYSIWYG = forwardRef<CustomWYSIWYGRef, CustomWYSIWYGProps>(
  ({ content, notes, onChange, onWikilinkClick, isZenMode }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isComposing = useRef(false);
    const previousContent = useRef(content);
    const [activeLineIndex, setActiveLineIndex] = useState(-1);
  
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    active: false,
    query: '',
    x: 0,
    y: 0,
    selectedIndex: 0,
  });

  const prevIsZenMode = useRef(isZenMode);

  // Initialize content
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.textContent !== content || prevIsZenMode.current !== isZenMode) {
        // Save caret if we are just toggling zen mode so we don't lose it
        const caret = prevIsZenMode.current !== isZenMode ? getCaretOffset() : null;
        
        editorRef.current.innerHTML = highlightMarkdown(content, activeLineIndex, isZenMode);
        previousContent.current = content;
        prevIsZenMode.current = isZenMode;
        
        if (caret !== null) {
          setCaretOffset(caret);
          updateActiveLine(caret);
        }
      }
    }
  }, [content, isZenMode]);

  useImperativeHandle(ref, () => ({
    insertMarkdown: (before: string, after: string = "") => {
      const el = editorRef.current;
      if (!el) return;
      
      const sel = window.getSelection();
      let start = 0;
      let end = 0;
      let selectedText = "";
      
      const currentText = el.textContent || "";
      
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (el.contains(range.commonAncestorContainer)) {
          try {
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(el);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            start = preSelectionRange.toString().length;
            selectedText = sel.toString();
            end = start + selectedText.length;
          } catch(e) {
            start = currentText.length;
            end = start;
          }
        } else {
          start = currentText.length;
          end = start;
        }
      } else {
        start = currentText.length;
        end = start;
      }
      
      const replacement = before + selectedText + after;
      const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
      
      previousContent.current = newText;
      onChange(newText);
      
      if (el) {
        const tempCaret = start + before.length + selectedText.length;
        const textBefore = newText.substring(0, tempCaret);
        const lineIdx = isZenMode ? textBefore.split('\n').length - 1 : -1;
        el.innerHTML = highlightMarkdown(newText, lineIdx, isZenMode || false);
        setCaretOffset(tempCaret);
        if (isZenMode) setActiveLineIndex(lineIdx);
        setTimeout(() => el.focus(), 0);
      }
    },
    getCaretOffset: () => getCaretOffset(),
    setCaretOffset: (offset: number) => setCaretOffset(offset),
    replaceSelection: (replacement: string) => {
      const el = editorRef.current;
      if (!el) return;
      
      const sel = window.getSelection();
      let start = 0;
      let end = 0;
      const currentText = el.textContent || "";
      
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (el.contains(range.commonAncestorContainer)) {
          try {
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(el);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            start = preSelectionRange.toString().length;
            end = start + sel.toString().length;
          } catch(e) {
            start = currentText.length;
            end = start;
          }
        }
      }
      
      const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
      previousContent.current = newText;
      onChange(newText);
      
      const tempCaret = start + replacement.length;
      const textBefore = newText.substring(0, tempCaret);
      const lineIdx = isZenMode ? textBefore.split('\n').length - 1 : -1;
      el.innerHTML = highlightMarkdown(newText, lineIdx, isZenMode || false);
      setCaretOffset(tempCaret);
      if (isZenMode) setActiveLineIndex(lineIdx);
    }
  }));

  const getCaretOffset = (): number => {
    const el = editorRef.current;
    if (!el) return 0;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  const setCaretOffset = (offset: number) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;
    
    let charIndex = 0;
    let nodeToFocus: Node | null = null;
    let nodeOffset = 0;
    
    const nodeStack: Node[] = [el];
    let node: Node | undefined;
    let foundStart = false;

    while (!foundStart && (node = nodeStack.pop())) {
      if (node.nodeType === 3) {
        const nextCharIndex = charIndex + (node.textContent?.length || 0);
        if (!foundStart && offset >= charIndex && offset <= nextCharIndex) {
          nodeToFocus = node;
          nodeOffset = offset - charIndex;
          foundStart = true;
        }
        charIndex = nextCharIndex;
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }
    
    if (nodeToFocus) {
      const range = document.createRange();
      range.setStart(nodeToFocus, nodeOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const getCaretCoordinates = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { x: 0, y: 0 };
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);
    const rect = range.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  };

  const handleInput = () => {
    if (isComposing.current) return;
    if (!editorRef.current) return;

    const caretOffset = getCaretOffset();
    const newText = editorRef.current.textContent || "";
    
    if (newText !== previousContent.current) {
      previousContent.current = newText;
      onChange(newText);
      
      // Update HTML to reflect new highlighting
      const textBefore = newText.substring(0, caretOffset);
      const lineIdx = isZenMode ? textBefore.split('\n').length - 1 : -1;
      editorRef.current.innerHTML = highlightMarkdown(newText, lineIdx, isZenMode || false);
      
      // Restore caret
      setCaretOffset(caretOffset);
      if (isZenMode) setActiveLineIndex(lineIdx);
    }

    // Autocomplete Logic
    const textBeforeCaret = newText.substring(0, caretOffset);
    const match = textBeforeCaret.match(/\[\[([^\]]*)$/);
    if (match) {
      const coords = getCaretCoordinates();
      setAutocomplete(prev => ({
        active: true,
        query: match[1],
        x: coords.x > 0 ? coords.x : prev.x,
        y: coords.y > 0 ? coords.y : prev.y + 20, // rough guess if x=0
        selectedIndex: prev.active ? prev.selectedIndex : 0
      }));
      setAutocomplete(prev => ({ ...prev, active: false }));
    }

    updateActiveLine(caretOffset);
  };

  const updateActiveLine = (offset?: number) => {
    if (!isZenMode) return;
    const caretOffset = offset !== undefined ? offset : getCaretOffset();
    const newText = editorRef.current?.textContent || "";
    const textBeforeCaret = newText.substring(0, caretOffset);
    const lineIndex = textBeforeCaret.split('\n').length - 1;
    
    if (lineIndex !== activeLineIndex) {
      setActiveLineIndex(lineIndex);
      if (editorRef.current) {
        const lines = editorRef.current.querySelectorAll(':scope > span.md-line');
        lines.forEach((el, idx) => {
          if (idx === lineIndex) {
            el.classList.add('zen-active');
            el.classList.remove('zen-inactive');
          } else {
            el.classList.remove('zen-active');
            el.classList.add('zen-inactive');
          }
        });
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    updateActiveLine();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const caretOffset = getCaretOffset();
    const currentText = editorRef.current?.textContent || "";

    // Intercept keys if autocomplete is active
    if (autocomplete.active) {
      const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(autocomplete.query.toLowerCase()));
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete(prev => ({ ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, filteredNotes.length - 1) }));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete(prev => ({ ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) }));
        return;
      } else if (e.key === 'Enter' && filteredNotes.length > 0) {
        e.preventDefault();
        const selectedTitle = filteredNotes[autocomplete.selectedIndex].title;
        const textBeforeCaret = currentText.substring(0, caretOffset);
        const match = textBeforeCaret.match(/\[\[([^\]]*)$/);
        
        if (match) {
          const queryLength = match[1].length;
          const startOffset = caretOffset - queryLength;
          let remainingAfter = currentText.substring(caretOffset);
          if (remainingAfter.startsWith("]]")) remainingAfter = remainingAfter.substring(2);
          
          const newText = currentText.substring(0, startOffset) + selectedTitle + ']] ' + remainingAfter;
          const newCaretOffset = startOffset + selectedTitle.length + 3; // "]] "
          
          previousContent.current = newText;
          onChange(newText);
          if (editorRef.current) {
            editorRef.current.innerHTML = highlightMarkdown(newText);
            setCaretOffset(newCaretOffset);
          }
          setAutocomplete(prev => ({ ...prev, active: false }));
        }
        return;
      } else if (e.key === 'Escape') {
        setAutocomplete(prev => ({ ...prev, active: false }));
      }
    }

    // Auto-close brackets [[ -> [[]]
    if (e.key === '[') {
      if (currentText.charAt(caretOffset - 1) === '[') {
        e.preventDefault();
        const newText = currentText.substring(0, caretOffset) + '[]]' + currentText.substring(caretOffset);
        previousContent.current = newText;
        onChange(newText);
        if (editorRef.current) {
          editorRef.current.innerHTML = highlightMarkdown(newText);
          setCaretOffset(caretOffset + 1); // Move inside [[|]]
        }
        // Open autocomplete immediately
        setTimeout(() => {
          const coords = getCaretCoordinates();
          setAutocomplete(prev => ({
            active: true,
            query: '',
            x: coords.x > 0 ? coords.x : prev.x,
            y: coords.y > 0 ? coords.y : prev.y + 20,
            selectedIndex: 0
          }));
        }, 10);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      
      const caretOffset = getCaretOffset();
      const currentText = editorRef.current?.textContent || "";
      
      // Manually splice \n into the text at caret position
      const newText = currentText.substring(0, caretOffset) + '\n' + currentText.substring(caretOffset);
      
      previousContent.current = newText;
      onChange(newText);
      
      if (editorRef.current) {
        const tempCaret = caretOffset + 1;
        const textBefore = newText.substring(0, tempCaret);
        const lineIdx = isZenMode ? textBefore.split('\n').length - 1 : -1;
        editorRef.current.innerHTML = highlightMarkdown(newText, lineIdx, isZenMode || false);
        setCaretOffset(tempCaret);
        if (isZenMode) setActiveLineIndex(lineIdx);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const caretOffset = getCaretOffset();
      const currentText = editorRef.current?.textContent || "";
      const newText = currentText.substring(0, caretOffset) + '  ' + currentText.substring(caretOffset);
      
      previousContent.current = newText;
      onChange(newText);
      
      if (editorRef.current) {
        const tempCaret = caretOffset + 2;
        const textBefore = newText.substring(0, tempCaret);
        const lineIdx = isZenMode ? textBefore.split('\n').length - 1 : -1;
        editorRef.current.innerHTML = highlightMarkdown(newText, lineIdx, isZenMode || false);
        setCaretOffset(tempCaret);
        if (isZenMode) setActiveLineIndex(lineIdx);
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wikilinkEl = target.closest("[data-note]");
    if (wikilinkEl) {
      // Typically editors require Ctrl/Cmd click to follow links so they can be edited normally.
      // But we will allow following it if Ctrl/Cmd is pressed, OR just straight click for now.
      if (e.ctrlKey || e.metaKey || true) {
        const noteTitle = wikilinkEl.getAttribute("data-note");
        if (noteTitle) {
          onWikilinkClick(noteTitle);
        }
      }
    }

    const extLinkEl = target.closest(".md-extlink") as HTMLAnchorElement;
    if (extLinkEl && (e.ctrlKey || e.metaKey || true)) {
      e.preventDefault();
      window.open(extLinkEl.href, '_blank', 'noopener,noreferrer');
    }
    
    updateActiveLine();
  };

  // Render Autocomplete Dropdown
  const renderAutocomplete = () => {
    if (!autocomplete.active) return null;
    const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(autocomplete.query.toLowerCase()));
    
    if (filteredNotes.length === 0) return null;

    return (
      <div 
        className="fixed z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl w-64 max-h-64 overflow-y-auto flex flex-col py-1"
        style={{ left: autocomplete.x, top: autocomplete.y + 5 }}
      >
        <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          Link to note
        </div>
        {filteredNotes.map((note, index) => (
          <div
            key={note.id}
            className={`px-3 py-2 cursor-pointer text-sm truncate transition-colors ${
              index === autocomplete.selectedIndex
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
            }`}
            onMouseDown={(e) => {
              // Prevent losing focus from editor
              e.preventDefault();
              const currentText = editorRef.current?.textContent || "";
              const caretOffset = getCaretOffset();
              const textBeforeCaret = currentText.substring(0, caretOffset);
              const match = textBeforeCaret.match(/\[\[([^\]]*)$/);
              
              if (match) {
                const queryLength = match[1].length;
                const startOffset = caretOffset - queryLength;
                let remainingAfter = currentText.substring(caretOffset);
                if (remainingAfter.startsWith("]]")) remainingAfter = remainingAfter.substring(2);
                
                const newText = currentText.substring(0, startOffset) + note.title + ']] ' + remainingAfter;
                const newCaretOffset = startOffset + note.title.length + 3;
                
                previousContent.current = newText;
                onChange(newText);
                 if (editorRef.current) {
                   const textBefore = newText.substring(0, newCaretOffset);
                   const lineIdx = isZenMode ? textBefore.split('\n').length - 1 : -1;
                   editorRef.current.innerHTML = highlightMarkdown(newText, lineIdx, isZenMode || false);
                   setCaretOffset(newCaretOffset);
                   if (isZenMode) setActiveLineIndex(lineIdx);
                 }
                setAutocomplete(prev => ({ ...prev, active: false }));
              }
            }}
          >
            {note.title}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleClick}
        onCompositionStart={() => (isComposing.current = true)}
        onCompositionEnd={() => {
          isComposing.current = false;
          handleInput();
        }}
        className="custom-wysiwyg w-full h-full px-4 sm:px-6 pb-4 sm:pb-6 pt-0 overflow-y-auto outline-none whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-zinc-200"
        style={{ fontFamily: 'var(--font-editor, inherit)' }}
        spellCheck={false}
      />
      {renderAutocomplete()}
    </>
  );
});
