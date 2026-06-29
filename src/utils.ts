/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Note } from "./types";
import { marked } from "marked";

export interface ExtractedLink {
  target: string;
  type?: string;
}

/**
 * Extracts wikilinks [[Note Title]] or [[type::Note Title]] from note content.
 */
export function extractWikilinks(content: string): ExtractedLink[] {
  const regex = /\[\[(?:([^\]|:]+)::)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: ExtractedLink[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({
      type: match[1] ? match[1].trim() : undefined,
      target: match[2].trim(),
    });
  }
  
  // Deduplicate by target + type
  const unique = new Map<string, ExtractedLink>();
  for (const link of links) {
    unique.set(`${link.type || ''}::${link.target}`, link);
  }
  return Array.from(unique.values());
}

/**
 * Safely parses Markdown and converts Wikilinks into interactive HTML anchors.
 * Supports recursive transclusion of notes via ![[Note Title]].
 */
export async function parseMarkdownToHtml(content: string, notes: Note[] = [], depth = 0): Promise<string> {
  if (depth > 3) return `<div class="p-2 border border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs my-2">Error: Transclusion depth limit reached.</div>`;

  // Strip YAML frontmatter before parsing markdown
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
  content = content.replace(frontmatterRegex, "");

  // Handle transclusions: ![[Note Title]]
  const transclusions = Array.from(content.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g));
  for (const match of transclusions) {
    const cleanTarget = match[1].trim();
    const targetNote = notes.find(n => n.title.trim().toLowerCase() === cleanTarget.toLowerCase());
    
    let embedHtml = "";
    if (targetNote) {
      let childContent = targetNote.content;
      if (cleanTarget.startsWith("Extract:")) {
        childContent = childContent.replace(/^#\s+Extract:[^\r\n]*(?:\r?\n)*/m, "");
        childContent = childContent.replace(/^Source:\s+\[\[[^\]]*\]\](?:\r?\n)*/m, "");
      }
      const parsedChild = await parseMarkdownToHtml(childContent, notes, depth + 1);
      embedHtml = `<div class="transclusion border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-slate-50 dark:bg-zinc-900 rounded-r shadow-sm"><div class="text-[10px] font-bold text-indigo-500 mb-2 uppercase tracking-widest">${cleanTarget}</div><div class="embed-content">${parsedChild}</div></div>`;
    } else {
      embedHtml = `<div class="transclusion border-l-4 border-slate-300 dark:border-zinc-700 pl-4 py-2 my-4 text-slate-500 dark:text-zinc-500 text-sm italic bg-slate-50 dark:bg-zinc-900 rounded-r">Note "${cleanTarget}" not found.</div>`;
    }
    content = content.replace(match[0], embedHtml);
  }

  // Parse standard Markdown
  let parsed = await marked.parse(content, { breaks: true, gfm: true });
  
  // Replace Flashcards (Question :: Answer)
  parsed = parsed.replace(/<p>(.+?)\s+::\s+(.+?)<\/p>/g, (match, q, a) => {
    return `<p>${q} <span class="text-indigo-400 dark:text-indigo-600 font-bold mx-1">::</span> <span class="group relative inline-flex min-w-[2rem] bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-sm border-b-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap">${a}</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">...</span></span></p>`;
  });

  // Replace Cloze Deletions
  parsed = parsed.replace(/\{\{(.*?)\}\}/g, '<span class="group relative inline-flex min-w-[2rem] bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-sm border-b-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap">$1</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">...</span></span>');

  
  // Replace tags: #word with special statuses
  const tagRegex = /(^|\s|>)(#[\p{L}\p{N}_\-]+)/gu;
  parsed = parsed.replace(tagRegex, (_, prefix, tag) => {
    const t = tag.toLowerCase();
    if (t === '#seed') {
      return `${prefix}<span class="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-bold mx-0.5 inline-flex items-center gap-1 shadow-sm border border-emerald-200 dark:border-emerald-800/50">🌱 Seed</span>`;
    } else if (t === '#incubator') {
      return `${prefix}<span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md text-xs font-bold mx-0.5 inline-flex items-center gap-1 shadow-sm border border-amber-200 dark:border-amber-800/50">🐣 Incubator</span>`;
    } else if (t === '#evergreen') {
      return `${prefix}<span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-md text-xs font-bold mx-0.5 inline-flex items-center gap-1 shadow-sm border border-green-200 dark:border-green-800/50">🌲 Evergreen</span>`;
    }
    return `${prefix}<span class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md text-xs font-medium mx-0.5 inline-block">${tag}</span>`;
  });

  // Replace [[type::Note Title]] or [[Note Title|Custom Label]]
  const wikilinkRegex = /\[\[(?:([^\]|:]+)::)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  return parsed.replace(wikilinkRegex, (_, typeMatch, target, label) => {
    const cleanTarget = target.trim();
    const displayLabel = label ? label.trim() : cleanTarget;
    const typeBadge = typeMatch ? `<span class="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-1 py-0.5 rounded mr-1 border border-rose-200 dark:border-rose-800/50 align-middle">${typeMatch.trim()}</span>` : "";
    return `${typeBadge}<span data-note="${encodeURIComponent(cleanTarget)}" class="wikilink cursor-pointer text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 hover:underline font-semibold border-b border-dashed border-violet-400 transition-colors">${displayLabel}</span>`;
  });
}

/**
 * Splits raw note content into its frontmatter and body.
 */
export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?\r?\n)---(?:\r?\n|$)/;
  const match = content.match(frontmatterRegex);
  if (match) {
    return {
      frontmatter: match[0],
      body: content.substring(match[0].length),
    };
  }
  return { frontmatter: "", body: content };
}

/**
 * Parses raw frontmatter content into a key-value object.
 */
export function parseYamlMetadata(yamlText: string): Record<string, string | string[]> {
  const metadata: Record<string, string | string[]> = {};
  const cleanYaml = yamlText.replace(/^---\r?\n/, "").replace(/\r?\n---(?:\r?\n|$)/, "");
  const lines = cleanYaml.split(/\r?\n/);
  let currentKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Check if this is a continuation list item (starts with "- ")
    if (/^\s+- /.test(line) && currentKey) {
      const itemValue = trimmed.substring(2).trim().replace(/^["']|["']$/g, "");
      const existing = metadata[currentKey];
      if (Array.isArray(existing)) {
        existing.push(itemValue);
      } else {
        metadata[currentKey] = [itemValue];
      }
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > -1) {
      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: tags: [study, dev]
        const arrayVals = value.substring(1, value.length - 1)
          .split(',')
          .map(v => v.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        metadata[key] = arrayVals;
        currentKey = key;
      } else if (value === "") {
        // Empty value — could be followed by indented list items
        metadata[key] = "";
        currentKey = key;
      } else {
        value = value.replace(/^["']|["']$/g, "");
        metadata[key] = value;
        currentKey = key;
      }
    }
  }

  // Clean up: convert empty strings that became arrays back
  for (const key of Object.keys(metadata)) {
    if (metadata[key] === "") {
      // Check if next processing turned it into array — if still empty string, keep it
    }
  }

  return metadata;
}

/**
 * Safely updates simple metadata keys in raw markdown YAML frontmatter,
 * leaving arrays/lists like cards: or other lines verbatim.
 */
export function updateYamlMetadata(content: string, updates: Record<string, any>): string {
  const { frontmatter, body } = splitFrontmatter(content);
  if (!frontmatter) {
    const fmLines = ["---"];
    Object.entries(updates).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        fmLines.push(`${k}: ${v}`);
      }
    });
    fmLines.push("---");
    return fmLines.join("\n") + "\n" + body;
  }

  const cleanYaml = frontmatter.replace(/^---\r?\n/, "").replace(/\r?\n---(?:\r?\n|$)/, "");
  const lines = cleanYaml.split(/\r?\n/);
  const newLines: string[] = [];
  const keysToUpdate = { ...updates };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      if (key in keysToUpdate) {
        const val = keysToUpdate[key];
        if (val !== undefined && val !== null) {
          newLines.push(`${key}: ${val}`);
        }
        delete keysToUpdate[key];
        i++;
        continue;
      }
    }
    newLines.push(line);
    i++;
  }

  // Append remaining new keys
  Object.entries(keysToUpdate).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      newLines.push(`${k}: ${v}`);
    }
  });

  return `---\n${newLines.join("\n")}\n---\n${body}`;
}

/**
 * Fuzzy replacement helper mapping plain text selections to markdown.
 */
export function replacePlaintextInMarkdown(markdown: string, plainText: string, replacement: string): string {
  const target = plainText.trim();
  if (!target) return markdown;

  // 1. Check literal match
  const literalIdx = markdown.indexOf(target);
  if (literalIdx > -1) {
    return markdown.substring(0, literalIdx) + replacement + markdown.substring(literalIdx + target.length);
  }

  // 2. Fuzzy match across markdown tags using word-joining regex
  const words = target.split(/\s+/).map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  if (words.length === 0) return markdown;
  
  const regexStr = words.join('(?:\\s*|[*_`[\\]{}!\\s]+)*');
  try {
    const regex = new RegExp(regexStr, 'i');
    const match = markdown.match(regex);
    if (match && match.index !== undefined) {
      return markdown.substring(0, match.index) + replacement + markdown.substring(match.index + match[0].length);
    }
  } catch (e) {
    console.error("Fuzzy replacement failed", e);
  }
  
  return markdown.replace(target, replacement);
}

/**
 * Generates a fully self-contained HTML file which includes the Obsidian Lite editor,
 * beautiful styling via Tailwind CSS CDN, Lucide Icons, interactive Canvas Graph View,
 * and pre-packaged notes, with the ability to function as a Windows .hta application.
 */
export function generateSingleHtmlApp(notes: Note[]): string {
  const notesJson = JSON.stringify(notes, null, 2);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Lite Obsidian - Personal Knowledge Base</title>
  <!-- HTA Configuration tags for Windows compatibility -->
  <hta:application id="oHTA"
     applicationname="LiteObsidian"
     border="thin"
     borderstyle="normal"
     caption="yes"
     maximizebutton="yes"
     minimizebutton="yes"
     showintaskbar="yes"
     singleinstance="yes"
     sysmenu="yes"
     version="1.0"
     windowstate="normal" />
  
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'Fira Code', 'monospace']
          }
        }
      }
    }
  </script>
  
  <!-- Lucide Icons (UMD version) -->
  <script src="https://unpkg.com/lucide@latest"></script>
  
  <!-- Marked.js for Markdown parsing -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <style>
    /* Custom Scrollbars */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(156, 163, 175, 0.3);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(156, 163, 175, 0.5);
    }
    
    /* Markdown Previews */
    .markdown-body h1 { @apply text-2xl font-bold mt-6 mb-3 border-b border-gray-200 dark:border-gray-800 pb-1; }
    .markdown-body h2 { @apply text-xl font-bold mt-5 mb-2; }
    .markdown-body h3 { @apply text-lg font-semibold mt-4 mb-2; }
    .markdown-body p { @apply my-2 leading-relaxed; }
    .markdown-body ul { @apply list-disc list-inside my-2 pl-4; }
    .markdown-body ol { @apply list-decimal list-inside my-2 pl-4; }
    .markdown-body code { @apply font-mono text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-rose-500 dark:text-rose-400; }
    .markdown-body pre { @apply bg-gray-900 text-gray-100 p-3 rounded my-3 overflow-x-auto font-mono text-sm; }
    .markdown-body blockquote { @apply border-l-4 border-violet-500 pl-4 py-1 my-3 bg-violet-50 dark:bg-violet-950/20 rounded-r italic text-gray-700 dark:text-gray-300; }
  </style>
</head>
<body class="bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 font-sans h-screen flex flex-col overflow-hidden transition-colors duration-200">

  <!-- Header Banner -->
  <header class="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
    <div class="flex items-center space-x-2">
      <div class="bg-violet-600 p-1.5 rounded-lg text-white">
        <i data-lucide="book-open" class="w-5 h-5"></i>
      </div>
      <div>
        <h1 class="text-base font-semibold tracking-tight">Lite Obsidian</h1>
        <p class="text-xs text-slate-500 dark:text-zinc-400">Standalone Offline Edition (.html/.hta)</p>
      </div>
    </div>
    
    <div class="flex items-center space-x-3">
      <!-- Theme toggle -->
      <button onclick="toggleDarkMode()" class="p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Toggle Theme">
        <i id="theme-icon" data-lucide="moon" class="w-4 h-4"></i>
      </button>
      
      <!-- HTA Exporter -->
      <button onclick="exportSelf()" class="flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer" title="Save notes directly into a new self-contained HTML/HTA file">
        <i data-lucide="download" class="w-4 h-4"></i>
        <span>Export HTA/HTML</span>
      </button>
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden">
    
    <!-- Sidebar -->
    <aside class="w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col shrink-0">
      <!-- Search and Add -->
      <div class="p-3 border-b border-slate-100 dark:border-zinc-800 space-y-2">
        <div class="relative">
          <input type="text" id="search-input" oninput="renderNotesList()" placeholder="Search notes..." class="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-violet-500">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5"></i>
        </div>
        <button onclick="createNewNote()" class="w-full flex items-center justify-center space-x-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>New Note</span>
        </button>
      </div>

      <!-- Notes List -->
      <div id="notes-list" class="flex-1 overflow-y-auto p-2 space-y-1">
        <!-- Dyn list -->
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950">
      
      <!-- Workspace Toolbar / Tabs -->
      <div class="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-1">
          <!-- Editor toggles -->
          <button id="btn-edit-mode" onclick="setMode('edit')" class="px-3 py-1 rounded text-sm font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">Edit</button>
          <button id="btn-preview-mode" onclick="setMode('preview')" class="px-3 py-1 rounded text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800">Preview</button>
          <button id="btn-graph-mode" onclick="setMode('graph')" class="px-3 py-1 rounded text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800">Graph Connection</button>
        </div>
        
        <div class="flex items-center space-x-4">
          <label class="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" id="hide-yaml-checkbox" onchange="toggleHideYaml()" class="rounded border-slate-300 dark:border-zinc-700 text-violet-600 focus:ring-violet-500 bg-transparent">
            <span>Hide YAML</span>
          </label>
          <div id="note-meta" class="text-xs text-slate-400 dark:text-zinc-500">
            <!-- Updated time -->
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 flex overflow-hidden relative">
        
        <!-- Editor view -->
        <div id="editor-view" class="flex-1 flex flex-col p-4 overflow-hidden">
          <input type="text" id="note-title-input" oninput="handleTitleChange()" placeholder="Note Title" class="bg-transparent text-2xl font-bold border-none outline-none focus:ring-0 mb-4 text-slate-950 dark:text-white placeholder-slate-300 dark:placeholder-zinc-700">
          <div id="editor-yaml-container"></div>
          <textarea id="note-content-textarea" oninput="handleContentChange()" placeholder="Start typing... Use [[Note Title]] to link notes." class="flex-1 w-full bg-transparent border-none outline-none resize-none focus:ring-0 font-mono text-sm leading-relaxed overflow-y-auto text-slate-800 dark:text-zinc-200 placeholder-slate-300 dark:placeholder-zinc-700"></textarea>
        </div>

        <!-- Preview view -->
        <div id="preview-view" class="flex-1 hidden p-6 overflow-y-auto">
          <h2 id="preview-title" class="text-3xl font-bold mb-6 text-slate-950 dark:text-white pb-2 border-b border-slate-100 dark:border-zinc-800"></h2>
          <div id="preview-yaml-container"></div>
          <div id="preview-html" class="markdown-body text-slate-800 dark:text-zinc-200"></div>
          
          <!-- Backlinks block -->
          <div class="mt-12 pt-6 border-t border-slate-200 dark:border-zinc-800">
            <h3 class="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <i data-lucide="link" class="w-3.5 h-3.5"></i>
              <span>Backlinks (Linked here)</span>
            </h3>
            <div id="backlinks-list" class="space-y-1.5">
              <!-- backlinks -->
            </div>
          </div>
        </div>

        <!-- Graph view -->
        <div id="graph-view" class="flex-1 hidden relative overflow-hidden bg-slate-100 dark:bg-zinc-900/40">
          <canvas id="graph-canvas" class="w-full h-full block cursor-grab active:cursor-grabbing"></canvas>
          <div class="absolute bottom-3 left-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm text-xs space-y-1">
            <p class="font-semibold text-slate-700 dark:text-zinc-300">Graph Guide:</p>
            <p>• Click node to open note</p>
            <p>• Drag canvas to pan</p>
            <p>• Nodes repel each other</p>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    // Embedded initial data
    const EMBEDDED_NOTES = ${notesJson};

    // App state
    let notes = [];
    let currentNoteId = "";
    let currentMode = "edit"; // edit, preview, graph
    let isDarkMode = false;
    let hideYaml = false;
    let isYamlCollapsed = false;
    
    // Graph canvas panning/zooming
    let panX = 0;
    let panY = 0;
    let isDraggingCanvas = false;
    let dragStartX = 0;
    let dragStartY = 0;
    
    // Physics Node representation
    let graphNodes = [];
    let graphLinks = [];
    let selectedGraphNode = null;
    let isDraggingNode = false;

    // Load state
    function init() {
      // Check localStorage first
      const stored = localStorage.getItem("lite_obsidian_notes");
      if (stored) {
        try {
          notes = JSON.parse(stored);
        } catch(e) {
          notes = EMBEDDED_NOTES;
        }
      } else {
        notes = EMBEDDED_NOTES;
      }

      if (notes.length === 0) {
        notes = [{
          id: "welcome",
          title: "Welcome Note",
          content: "# Welcome to Lite Obsidian\\n\\nThis is your lightweight knowledge base analogue of Obsidian. \\n\\n## Key Features:\\n- **Markdown Support**: Style your text easily.\\n- **Wikilinks**: Type '[[Another Note]]' to link notes. Click the link to instantly jump or create that note!\\n- **Backlinks**: See which notes refer to the current one at the bottom of the Preview tab.\\n- **Connection Graph**: Switch to the Graph Connection tab to visualize your knowledge database!\\n- **Standalone Exporter**: Click 'Export HTA/HTML' to download a new compiled file with your latest changes inside it. You can rename it to '.hta' for instant Windows app conversion!\\n\\nTry clicking this link to make a new note: [[My Ideas]]",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }];
        saveNotes();
      }

      // Default current note
      currentNoteId = notes[0].id;

      // Dark Mode setup
      if (localStorage.getItem("theme") === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        isDarkMode = true;
        document.documentElement.classList.add("dark");
      } else {
        isDarkMode = false;
        document.documentElement.classList.remove("dark");
      }

      updateThemeButton();
      
      // YAML setup
      hideYaml = localStorage.getItem("hide_yaml") === "true";
      isYamlCollapsed = hideYaml;
      document.getElementById("hide-yaml-checkbox").checked = hideYaml;
      
      // Render
      renderNotesList();
      selectNote(currentNoteId);
      
      // Setup icons
      lucide.createIcons();

      // Setup window event list for backlink routing
      document.addEventListener("click", function(e) {
        if (e.target && e.target.classList.contains("wikilink")) {
          const targetTitle = decodeURIComponent(e.target.getAttribute("data-note"));
          navigateToNoteByTitle(targetTitle);
        }
      });

      // Graph setup loop
      setupGraphInteraction();
      requestAnimationFrame(physicsLoop);
    }

    // Save Notes helper
    function saveNotes() {
      localStorage.setItem("lite_obsidian_notes", JSON.stringify(notes));
    }

    // Toggle Dark Mode
    function toggleDarkMode() {
      isDarkMode = !isDarkMode;
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      updateThemeButton();
    }

    function updateThemeButton() {
      const btn = document.getElementById("theme-icon");
      if (isDarkMode) {
        btn.setAttribute("data-lucide", "sun");
      } else {
        btn.setAttribute("data-lucide", "moon");
      }
      lucide.createIcons();
    }

    // Render Notes List in sidebar
    function renderNotesList() {
      const search = document.getElementById("search-input").value.toLowerCase();
      const listEl = document.getElementById("notes-list");
      listEl.innerHTML = "";

      const filtered = notes.filter(n => 
        n.title.toLowerCase().includes(search) || 
        n.content.toLowerCase().includes(search)
      );

      filtered.forEach(note => {
        const isActive = note.id === currentNoteId;
        const item = document.createElement("div");
        item.className = "flex items-center justify-between p-2 rounded-md text-sm cursor-pointer group transition-colors " +
          (isActive 
            ? "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 font-medium" 
            : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300");
        item.onclick = () => selectNote(note.id);

        const titleSpan = document.createElement("span");
        titleSpan.className = "truncate flex-1";
        titleSpan.innerText = note.title || "Untitled Note";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded transition-opacity cursor-pointer";
        deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          deleteNote(note.id);
        };

        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);
        listEl.appendChild(item);
      });

      lucide.createIcons();
    }

    // Create New Note
    function createNewNote(titleText) {
      const title = (titleText || "").trim() || generateUniqueTitle();
      const newNote = {
        id: "note_" + Date.now(),
        title: title,
        content: "# " + title + "\\n\\nStart writing something here...",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      notes.push(newNote);
      saveNotes();
      currentNoteId = newNote.id;
      renderNotesList();
      selectNote(newNote.id);
      setMode("edit");
    }

    function generateUniqueTitle() {
      let base = "Untitled";
      let index = 1;
      while (notes.some(n => n.title.toLowerCase() === (base + " " + index).toLowerCase())) {
        index++;
      }
      return base + " " + index;
    }

    // Delete Note
    function deleteNote(id) {
      if (confirm("Are you sure you want to delete this note?")) {
        notes = notes.filter(n => n.id !== id);
        saveNotes();
        if (currentNoteId === id) {
          currentNoteId = notes.length > 0 ? notes[0].id : "";
        }
        renderNotesList();
        if (currentNoteId) {
          selectNote(currentNoteId);
        } else {
          clearWorkspace();
        }
      }
    }

    function toggleHideYaml() {
      hideYaml = document.getElementById("hide-yaml-checkbox").checked;
      localStorage.setItem("hide_yaml", hideYaml ? "true" : "false");
      isYamlCollapsed = hideYaml;
      const note = notes.find(n => n.id === currentNoteId);
      if (note) {
        selectNote(currentNoteId);
      }
    }

    function toggleYamlCollapseUI() {
      isYamlCollapsed = !isYamlCollapsed;
      const note = notes.find(n => n.id === currentNoteId);
      if (note) {
        renderCollapsibleYamlEditorForNote(note);
        renderMarkdownPreview(note);
      }
    }

    function renderCollapsibleYamlEditorForNote(note) {
      const container = document.getElementById("editor-yaml-container");
      if (!hideYaml) {
        container.innerHTML = "";
        return;
      }

      const frontmatterRegex = /^---\\r?\\n([\\s\\S]*?\\r?\\n)---(?:\\r?\\n|$)/;
      const match = (note.content || "").match(frontmatterRegex);
      const frontmatter = match ? match[0] : "";
      const yamlInner = frontmatter
        ? frontmatter.replace(/^---\\r?\\n/, "").replace(/\\r?\\n---(?:\\r?\\n|$)/, "")
        : "";
      
      const keyCount = yamlInner ? yamlInner.split('\n').filter(Boolean).length : 0;
      const keyCountText = yamlInner ? "(" + keyCount + " keys)" : "(empty)";

      container.innerHTML = 
        '<div class="mb-4 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-zinc-950/40 shadow-sm transition-all duration-200 shrink-0">' +
          '<div onclick="toggleYamlCollapseUI()" class="flex items-center justify-between px-4 py-2 bg-slate-100/50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800/80 transition-colors">' +
            '<span class="flex items-center gap-1.5">' +
              '<i data-lucide="settings" class="w-3.5 h-3.5 text-indigo-500"></i>' +
              '<span>YAML Frontmatter <span id="yaml-key-count" class="text-slate-400 font-normal">' + keyCountText + '</span></span>' +
            '</span>' +
            '<div class="flex items-center gap-1">' +
              '<span class="text-[10px] text-slate-400">' + (isYamlCollapsed ? "Show" : "Hide") + '</span>' +
              '<i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200 ' + (isYamlCollapsed ? "" : "transform rotate-90") + '"></i>' +
            '</div>' +
          '</div>' +
          '<div id="yaml-editor-body" class="' + (isYamlCollapsed ? 'hidden' : 'p-3 bg-white dark:bg-zinc-900') + '">' +
            '<textarea oninput="handleYamlEditorChange(this.value)" placeholder="tags: [study, dev]&#10;author: John Doe&#10;status: active" rows="4" class="w-full bg-slate-50/50 dark:bg-zinc-950/30 border border-slate-200 dark:border-zinc-800 rounded p-2 text-xs font-mono text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 resize-y">' + yamlInner + '</textarea>' +
          '</div>' +
        '</div>';
      if (window.lucide) window.lucide.createIcons();
    }

    function handleYamlEditorChange(newYaml) {
      const note = notes.find(n => n.id === currentNoteId);
      if (note) {
        const frontmatterRegex = /^---\\r?\\n([\\s\\S]*?\\r?\\n)---(?:\\r?\\n|$)/;
        const match = (note.content || "").match(frontmatterRegex);
        const currentFrontmatter = match ? match[0] : "";
        const body = (note.content || "").substring(currentFrontmatter.length);
        
        const trimmedYaml = newYaml.trim();
        const newFrontmatter = trimmedYaml ? "---\\n" + trimmedYaml + "\\n---\\n" : "";
        note.content = newFrontmatter + body;
        note.updatedAt = new Date().toISOString();
        saveNotes();
        renderMarkdownPreview(note);
        
        const keyCount = trimmedYaml ? trimmedYaml.split('\n').filter(Boolean).length : 0;
        document.getElementById("yaml-key-count").innerText = trimmedYaml ? "(" + keyCount + " keys)" : "(empty)";
      }
    }

    function parseYamlMetadata(yamlText) {
      const metadata = {};
      const cleanYaml = yamlText.replace(/^---\\r?\\n/, "").replace(/\\r?\\n---(?:\\r?\\n|$)/, "");
      const lines = cleanYaml.split(/\\r?\\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > -1) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value = trimmed.substring(colonIndex + 1).trim();
          if (value.startsWith('[') && value.endsWith(']')) {
            const arrayVals = value.substring(1, value.length - 1)
              .split(',')
              .map(v => v.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean);
            metadata[key] = arrayVals;
          } else {
            value = value.replace(/^["']|["']$/g, "");
            metadata[key] = value;
          }
        }
      }
      return metadata;
    }

    function clearWorkspace() {
      currentNoteId = "";
      document.getElementById("note-title-input").value = "";
      document.getElementById("note-content-textarea").value = "";
      document.getElementById("preview-title").innerText = "";
      document.getElementById("preview-html").innerHTML = "";
      document.getElementById("note-meta").innerText = "";
      document.getElementById("editor-yaml-container").innerHTML = "";
      document.getElementById("preview-yaml-container").innerHTML = "";
    }

    // Select Note to load in editor/preview
    function selectNote(id) {
      if (!id) return;
      currentNoteId = id;
      const note = notes.find(n => n.id === id);
      if (!note) return;

      // Update inputs
      document.getElementById("note-title-input").value = note.title;

      // Split frontmatter and body
      const frontmatterRegex = /^---\\r?\\n([\\s\\S]*?\\r?\\n)---(?:\\r?\\n|$)/;
      const match = (note.content || "").match(frontmatterRegex);
      let frontmatter = "";
      let body = note.content || "";
      if (match) {
        frontmatter = match[0];
        body = (note.content || "").substring(frontmatter.length);
      }

      if (hideYaml) {
        document.getElementById("note-content-textarea").value = body;
        renderCollapsibleYamlEditorForNote(note);
      } else {
        document.getElementById("note-content-textarea").value = note.content;
        document.getElementById("editor-yaml-container").innerHTML = "";
      }

      // Update metadata display
      const updatedDate = new Date(note.updatedAt).toLocaleString();
      document.getElementById("note-meta").innerText = "Last updated: " + updatedDate;

      // Render Markdown preview
      renderMarkdownPreview(note);

      // Refresh list active state
      renderNotesList();

      if (currentMode === "graph") {
        initGraphData();
      }
    }

    // Handle typing title
    function handleTitleChange() {
      const val = document.getElementById("note-title-input").value;
      const note = notes.find(n => n.id === currentNoteId);
      if (note) {
        note.title = val;
        note.updatedAt = new Date().toISOString();
        saveNotes();
        
        // Dynamic title updating in list
        const searchInput = document.getElementById("search-input").value;
        if (!searchInput) {
          // Quick refresh list title
          renderNotesList();
        }
      }
    }

    // Handle typing content
    function handleContentChange() {
      const val = document.getElementById("note-content-textarea").value;
      const note = notes.find(n => n.id === currentNoteId);
      if (note) {
        if (hideYaml) {
          const frontmatterRegex = /^---\\r?\\n([\\s\\S]*?\\r?\\n)---(?:\\r?\\n|$)/;
          const match = (note.content || "").match(frontmatterRegex);
          const currentFrontmatter = match ? match[0] : "";
          note.content = currentFrontmatter + val;
        } else {
          note.content = val;
        }
        note.updatedAt = new Date().toISOString();
        saveNotes();
        renderMarkdownPreview(note);
      }
    }

    // Parse Markdown to HTML + build backlinks
    function renderMarkdownPreview(note) {
      // Title
      document.getElementById("preview-title").innerText = note.title || "Untitled Note";

      // Note Metadata Block
      const previewYamlContainer = document.getElementById("preview-yaml-container");
      const frontmatterRegex = /^---\\r?\\n([\\s\\S]*?\\r?\\n)---(?:\\r?\\n|$)/;
      const match = (note.content || "").match(frontmatterRegex);
      const frontmatter = match ? match[0] : "";
      
      if (frontmatter) {
        const metadata = parseYamlMetadata(frontmatter);
        const keys = Object.keys(metadata);
        if (keys.length > 0) {
          let rowsHtml = "";
          for (const key of keys) {
            const val = metadata[key];
            let valHtml = "";
            if (Array.isArray(val)) {
              valHtml = '<div class="flex flex-wrap gap-1">';
              for (const tag of val) {
                valHtml += '<span class="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded text-[10px] font-medium text-indigo-600 dark:text-indigo-400">' + tag + '</span>';
              }
              valHtml += '</div>';
            } else {
              valHtml = '<span class="font-mono bg-slate-50 dark:bg-zinc-950 px-1 py-0.5 rounded border border-slate-100 dark:border-zinc-800 text-[11px]">' + val + '</span>';
            }

            rowsHtml += 
              '<div class="grid grid-cols-3 gap-2 text-xs border-b border-slate-100 dark:border-zinc-850 pb-2 last:border-0 last:pb-0">' +
                '<span class="font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">' + key + '</span>' +
                '<span class="col-span-2 text-slate-800 dark:text-zinc-200">' + valHtml + '</span>' +
              '</div>';
          }

          previewYamlContainer.innerHTML = 
            '<div class="mb-6 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm transition-all duration-200 shrink-0">' +
              '<div onclick="toggleYamlCollapseUI()" class="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900/80 transition-colors">' +
                '<span class="flex items-center gap-1.5">' +
                  '<i data-lucide="settings" class="w-3.5 h-3.5 text-indigo-500"></i>' +
                  '<span>Note Metadata (' + keys.length + ' keys)</span>' +
                '</span>' +
                '<div class="flex items-center gap-1">' +
                  '<span class="text-[10px] text-slate-400">' + (isYamlCollapsed ? "Show" : "Hide") + '</span>' +
                  '<i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200 ' + (isYamlCollapsed ? "" : "transform rotate-90") + '"></i>' +
                '</div>' +
              '</div>' +
              '<div class="' + (isYamlCollapsed ? 'hidden' : 'p-4 space-y-3 bg-white dark:bg-zinc-900') + '">' +
                rowsHtml +
              '</div>' +
            '</div>';
        } else {
          previewYamlContainer.innerHTML = "";
        }
      } else {
        previewYamlContainer.innerHTML = "";
      }

      // HTML Render
      const cleanContent = (note.content || "").replace(frontmatterRegex, "");
      let rawHtml = marked.parse(cleanContent, { breaks: true, gfm: true });
      
      // Parse Flashcards
      rawHtml = rawHtml.replace(/<p>(.+?)\\s+::\\s+(.+?)<\\/p>/g, function(match, q, a) {
        return '<p>' + q + ' <span class="text-indigo-400 dark:text-indigo-600 font-bold mx-1">::</span> <span class="group relative inline-flex min-w-[2rem] bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-sm border-b-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap">' + a + '</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">...</span></span></p>';
      });

      // Parse Cloze Deletions
      rawHtml = rawHtml.replace(/\\{\\{(.*?)\\}\\}/g, '<span class="group relative inline-flex min-w-[2rem] bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-sm border-b-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap">$1</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">...</span></span>');
      
      // Parse [[Wikilinks]]
      const wikilinkRegex = /\\\\\\[\\\\\\[([^\\\\\\]|]+)(?:\\\\|[^\\\\\\]]+)?\\\\\\]\\\\\\]/g;
      const linkedHtml = rawHtml.replace(wikilinkRegex, (_, target, label) => {
        const cleanTarget = target.trim();
        const displayLabel = label ? label.trim() : cleanTarget;
        return '<span data-note="' + encodeURIComponent(cleanTarget) + '" class="wikilink cursor-pointer text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 hover:underline font-semibold border-b border-dashed border-violet-400 transition-colors">' + displayLabel + '</span>';
      });

      document.getElementById("preview-html").innerHTML = linkedHtml;

      // Process Backlinks for this note
      renderBacklinks(note.title);

      if (window.lucide) window.lucide.createIcons();
    }

    // Render Backlinks List
    function renderBacklinks(noteTitle) {
      const backlinksEl = document.getElementById("backlinks-list");
      backlinksEl.innerHTML = "";

      if (!noteTitle) return;

      const linkingNotes = notes.filter(n => {
        if (n.id === currentNoteId) return false;
        // Simple scan for wikilink format referencing this title
        const regex = new RegExp("\\\\\\\\\\[\\\\\\\\\\\\[\\\\\\\\s*" + escapeRegExp(noteTitle) + "\\\\\\\\s*(?:\\\\\\\\|.*?)?\\\\\\\\\\\\]\\\\\\\\\\\\]", "i");
        return regex.test(n.content);
      });

      if (linkingNotes.length === 0) {
        backlinksEl.innerHTML = '<p class="text-xs text-slate-400 dark:text-zinc-500 italic">No notes link to this one yet.</p>';
        return;
      }

      linkingNotes.forEach(lnk => {
        const row = document.createElement("button");
        row.className = "flex items-center space-x-1.5 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 px-2 py-1 rounded transition-colors cursor-pointer text-left w-full";
        row.innerHTML = '<i data-lucide="file-text" class="w-3.5 h-3.5"></i> <span class="font-medium">' + lnk.title + '</span>';
        row.onclick = () => selectNote(lnk.id);
        backlinksEl.appendChild(row);
      });

      lucide.createIcons();
    }

    function escapeRegExp(string) {
      return string.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    }

    // Navigate to a note by its title
    function navigateToNoteByTitle(title) {
      const found = notes.find(n => n.title.trim().toLowerCase() === title.trim().toLowerCase());
      if (found) {
        selectNote(found.id);
      } else {
        // Create it automatically
        if (confirm("Note \\"" + title + "\\" does not exist. Would you like to create it?")) {
          createNewNote(title);
        }
      }
    }

    // Navigation mode settings
    function setMode(mode) {
      currentMode = mode;
      
      const editBtn = document.getElementById("btn-edit-mode");
      const previewBtn = document.getElementById("btn-preview-mode");
      const graphBtn = document.getElementById("btn-graph-mode");

      const editView = document.getElementById("editor-view");
      const previewView = document.getElementById("preview-view");
      const graphView = document.getElementById("graph-view");

      // Active button states
      const activeBtnCls = "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-medium";
      const inactiveBtnCls = "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800";

      [editBtn, previewBtn, graphBtn].forEach(b => b.className = "px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer " + inactiveBtnCls);
      
      editView.classList.add("hidden");
      previewView.classList.add("hidden");
      graphView.classList.add("hidden");

      if (mode === "edit") {
        editBtn.className = "px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer " + activeBtnCls;
        editView.classList.remove("hidden");
      } else if (mode === "preview") {
        previewBtn.className = "px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer " + activeBtnCls;
        previewView.classList.remove("hidden");
        // Ensure preview markdown gets updated
        const note = notes.find(n => n.id === currentNoteId);
        if (note) renderMarkdownPreview(note);
      } else if (mode === "graph") {
        graphBtn.className = "px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer " + activeBtnCls;
        graphView.classList.remove("hidden");
        
        // Recalculate dimensions & render
        resizeCanvas();
        initGraphData();
      }
    }

    // Exporter
    function exportSelf() {
      const currentNotesString = JSON.stringify(notes, null, 2);
      
      // Fetch current source code
      let source = document.documentElement.outerHTML;
      
      // We need to replace EMBEDDED_NOTES assignment in the file
      const updatedSource = "<!" + "DOCTYPE html>\\n" + source.replace(/const EMBEDDED_NOTES = [\\s\\S]*?\\n\\s*\\/\\/ App state/g, "const EMBEDDED_NOTES = " + currentNotesString + ";\\n\\n    // App state");
      
      const blob = new Blob([updatedSource], { type: "text/html" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "obsidian_standalone.html";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }


    /* --- PHYSICS GRAPH WORK --- */
    
    function initGraphData() {
      const canvas = document.getElementById("graph-canvas");
      
      // Setup nodes based on notes
      graphNodes = notes.map((note, idx) => {
        // reuse location if already exists
        const existing = graphNodes.find(n => n.id === note.id);
        if (existing) {
          existing.title = note.title;
          existing.isCurrent = note.id === currentNoteId;
          return existing;
        }
        
        // Spaced placement or circular distribution
        const angle = (idx / Math.max(1, notes.length)) * Math.PI * 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.25;
        return {
          id: note.id,
          title: note.title,
          x: canvas.width / 2 + Math.cos(angle) * radius,
          y: canvas.height / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          isCurrent: note.id === currentNoteId
        };
      });

      // Parse links based on content
      graphLinks = [];
      notes.forEach(note => {
        // Extract links
        const regex = /\\\\\\[\\\\\\[([^\\\\\\]|]+)(?:\\\\|[^\\\\\\]]+)?\\\\\\]\\\\\\]/g;
        let match;
        while ((match = regex.exec(note.content)) !== null) {
          const targetTitle = match[1].trim().toLowerCase();
          const targetNote = notes.find(n => n.title.trim().toLowerCase() === targetTitle);
          if (targetNote) {
            graphLinks.push({
              source: note.id,
              target: targetNote.id
            });
          }
        }
      });
    }

    function resizeCanvas() {
      const canvas = document.getElementById("graph-canvas");
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    function setupGraphInteraction() {
      const canvas = document.getElementById("graph-canvas");
      window.addEventListener("resize", () => {
        if (currentMode === "graph") {
          resizeCanvas();
        }
      });

      canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - panX;
        const y = e.clientY - rect.top - panY;

        // Check node intersection
        let clickedNode = null;
        for (const node of graphNodes) {
          const dist = Math.hypot(node.x - x, node.y - y);
          if (dist < 18) { // node hit area
            clickedNode = node;
            break;
          }
        }

        if (clickedNode) {
          selectedGraphNode = clickedNode;
          isDraggingNode = true;
        } else {
          isDraggingCanvas = true;
          dragStartX = e.clientX - panX;
          dragStartY = e.clientY - panY;
        }
      });

      canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        
        if (isDraggingNode && selectedGraphNode) {
          selectedGraphNode.x = e.clientX - rect.left - panX;
          selectedGraphNode.y = e.clientY - rect.top - panY;
          selectedGraphNode.vx = 0;
          selectedGraphNode.vy = 0;
        } else if (isDraggingCanvas) {
          panX = e.clientX - dragStartX;
          panY = e.clientY - dragStartY;
        }
      });

      canvas.addEventListener("mouseup", () => {
        if (isDraggingNode && selectedGraphNode) {
          selectNote(selectedGraphNode.id);
        }
        isDraggingNode = false;
        selectedGraphNode = null;
        isDraggingCanvas = false;
      });

      canvas.addEventListener("mouseleave", () => {
        isDraggingNode = false;
        selectedGraphNode = null;
        isDraggingCanvas = false;
      });
    }

    // Force-directed simulation loop
    function physicsLoop() {
      if (currentMode === "graph" && graphNodes.length > 0) {
        const canvas = document.getElementById("graph-canvas");
        const k = 0.04; // Hooke's gravity hook
        const repelForce = 500; // Repel factor
        const centerGravity = 0.01; // Gravity to screen center

        // 1. Repel nodes
        for (let i = 0; i < graphNodes.length; i++) {
          const n1 = graphNodes[i];
          for (let j = i + 1; j < graphNodes.length; j++) {
            const n2 = graphNodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.hypot(dx, dy) || 1;
            
            if (dist < 220) {
              const force = repelForce / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              if (!isDraggingNode || selectedGraphNode !== n1) {
                n1.vx -= fx;
                n1.vy -= fy;
              }
              if (!isDraggingNode || selectedGraphNode !== n2) {
                n2.vx += fx;
                n2.vy += fy;
              }
            }
          }
        }

        // 2. Attract connected links
        graphLinks.forEach(link => {
          const sNode = graphNodes.find(n => n.id === link.source);
          const tNode = graphNodes.find(n => n.id === link.target);
          if (sNode && tNode) {
            const dx = tNode.x - sNode.x;
            const dy = tNode.y - sNode.y;
            const dist = Math.hypot(dx, dy) || 1;
            
            // Link rest distance approx 120px
            const force = (dist - 125) * k;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!isDraggingNode || selectedGraphNode !== sNode) {
              sNode.vx += fx;
              sNode.vy += fy;
            }
            if (!isDraggingNode || selectedGraphNode !== tNode) {
              tNode.vx -= fx;
              tNode.vy -= fy;
            }
          }
        });

        // 3. Move and Render nodes
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(panX, panY);

        // Render Links
        ctx.strokeStyle = isDarkMode ? "rgba(139, 92, 246, 0.25)" : "rgba(109, 40, 217, 0.15)";
        ctx.lineWidth = 1.8;
        graphLinks.forEach(link => {
          const sNode = graphNodes.find(n => n.id === link.source);
          const tNode = graphNodes.find(n => n.id === link.target);
          if (sNode && tNode) {
            ctx.beginPath();
            ctx.moveTo(sNode.x, sNode.y);
            ctx.lineTo(tNode.x, tNode.y);
            ctx.stroke();
          }
        });

        // Update Position and Render Nodes
        graphNodes.forEach(node => {
          if (!isDraggingNode || selectedGraphNode !== node) {
            // Apply air friction
            node.vx *= 0.85;
            node.vy *= 0.85;

            // Gravity attraction to canvas center
            const centerDistX = (canvas.width / 2) - node.x;
            const centerDistY = (canvas.height / 2) - node.y;
            node.vx += centerDistX * centerGravity;
            node.vy += centerDistY * centerGravity;

            node.x += node.vx;
            node.y += node.vy;
          }

          // Node styling
          const isCurrent = node.id === currentNoteId;
          
          ctx.beginPath();
          ctx.arc(node.x, node.y, isCurrent ? 8 : 6, 0, Math.PI * 2);
          ctx.fillStyle = isCurrent 
            ? "#8b5cf6" // Violet core
            : (isDarkMode ? "#a1a1aa" : "#4b5563"); // Zinc
          ctx.fill();

          // Outer pulse ring for active node
          if (isCurrent) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(139, 92, 246, 0.35)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Node Text label
          ctx.font = "500 11px Inter, sans-serif";
          ctx.fillStyle = isDarkMode ? "#f4f4f5" : "#18181b";
          ctx.textAlign = "center";
          ctx.fillText(node.title || "Untitled", node.x, node.y - 14);
        });

        ctx.restore();
      }

      requestAnimationFrame(physicsLoop);
    }

    // Start App!
    window.addEventListener("DOMContentLoaded", init);
  </script>
</body>
</html>`;
}
