/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Note } from "./types";
import { generateSingleHtmlApp, splitFrontmatter, replacePlaintextInMarkdown } from "./utils";
import { getAllNotes, putNote, deleteNote, clearNotes, saveVaultHandle, getVaultHandle, clearVaultHandle } from "./db";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import GraphView from "./components/GraphView";
import RightSidebar from "./components/RightSidebar";
import SettingsDialog, { AppSettings } from "./components/SettingsDialog";
import ReviewModal from "./components/ReviewModal";
import { extractFlashcards, getDueCards, updateFlashcardInContent, Flashcard } from "./flashcards";
import TimelineView from "./components/TimelineView";
import HelpDialog from "./components/HelpDialog";
import { Map, FileText, Settings, Download, BookOpen, PanelRight, Edit3, Columns, Eye, X, Zap, Sun, Moon, Type, ArrowLeft, ArrowRight, Brain, Clock, HelpCircle } from "lucide-react";

// Default placeholder notes to guide the user
const DEFAULT_NOTES: Note[] = [
  {
    id: "welcome",
    title: "Welcome Note",
    content: `# Welcome to Lite Obsidian!\n\nThis is a beautiful, highly responsive, and lightweight analog of **Obsidian** built to organize your thoughts, knowledge, and notes.\n\n## 🚀 Key Features\n1. **Markdown Editing**: Full support for styled headers, code blocks, lists, and quotes.\n2. **Wikilinks \`[[Link]]\`**: Link notes instantly. Type \`[[Obsidian HTA Concept]]\` to see a connection in action!\n3. **Graph View (Map)**: A force-directed visual canvas representation of all notes and connections.\n4. **Standalone Exporter**: Build and export the entire workspace with your current notes as a **single, fully-functional HTML / HTA file**.\n\n## 🔗 Try out Wikilinks\nClick this link to explore how HTA apps run: [[Obsidian HTA Concept]] or start brainstorming with [[Mindmap & Brainstorming]].\nIf you click a link pointing to a note that doesn't exist yet (like [[My Personal Log]]), the engine will automatically offer to create it for you!\n\n## 🗺️ Interactive Graph\nClick on the **Graph Map** tab in the main workspace header to see these notes animate, attract each other, and hover/click to explore!`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "hta-concept",
    title: "Obsidian HTA Concept",
    content: `# Obsidian HTML & HTA Concept\n\nThe user requested a single self-contained HTML file that can be converted into a Windows **.hta** (HTML Application).\n\n## 💡 What is an HTA file?\nAn **HTA** is a Windows file extension for HTML pages that run with system-level access outside the browser sandbox. \n- You can simply rename the exported file from \`obsidian_vault.html\` to \`obsidian_vault.hta\`.\n- Double-clicking it on Windows opens it in a standalone window, looking and acting like a native desktop application!\n\n## 💾 Saving Notes Inside HTML/HTA\nWhen you edit notes inside the exported file:\n- It automatically persists changes inside your browser's \`localStorage\` so your work is safe across opens!\n- It contains its own **Export HTA/HTML** button inside. This means you can download a *new* updated standalone file containing your latest changes baked right into the source code!\n\n*Return to the [[Welcome Note]] or see [[Mindmap & Brainstorming]].*`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "brainstorm",
    title: "Mindmap & Brainstorming",
    content: `# Mindmap & Brainstorming\n\nUse Lite Obsidian to brainstorm interconnected projects. By linking concepts together, you build a "second brain" visual network.\n\n## 📝 Connected Projects\n- **[[My Projects]]**: Tracking active development cycles.\n- **[[Daily Habits]]**: Mindful productivity checklist.\n\nAs you create links, check the **Graph Map** panel to watch the nodes form a neural-like database map of your knowledge.\n\n---\n*Created during your session. Link back to [[Welcome Note]].*`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "my-projects",
    title: "My Projects",
    content: `# My Projects\n\nHere you can organize active tasks and goals.\n\n## 🛠️ Lite Obsidian Sandbox\n- [x] Integrate force-directed physics canvas for note relations.\n- [x] Configure self-contained single-file HTML exporter template.\n- [ ] Write my first note from scratch!\n\n*Related notes:*\n- Check [[Welcome Note]]\n- Or read about [[Obsidian HTA Concept]]`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "Templates/Meeting Protocol.md",
    title: "Meeting Protocol",
    content: `# Meeting Protocol\n\n**Date**: [[YYYY-MM-DD]]\n**Client**: \n**Attorney**: \n\n## Summary of Discussion\n- \n\n## Action Items\n- [ ] \n- [ ] \n\n## Next Meeting\n- \n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: "Templates"
  },
  {
    id: "Templates/IRAC Analysis.md",
    title: "IRAC Analysis",
    content: `# IRAC Analysis: [Case Name]\n\n## 🔍 Issue\nWhat is the legal question that, when answered, determines the result of the case?\n\n## 📜 Rule\nWhat is the rule of law that applies to the issue?\n\n## ⚖️ Application / Analysis\nHow does the rule of law apply to the specific facts of this case?\n\n## 🎯 Conclusion\nWhat is the outcome?\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: "Templates"
  },
  {
    id: "Templates/Lawsuit Template.md",
    title: "Lawsuit Template",
    content: `# Lawsuit Draft\n\n**Court**: \n**Plaintiff**: \n**Defendant**: \n**Case No**: \n\n## I. Statement of Facts\n\n\n## II. Legal Grounds\n\n\n## III. Claims / Prayer for Relief\n1. \n2. \n\n**Date**: [[YYYY-MM-DD]]\n**Signature**: ______________\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: "Templates"
  }
];

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string>("");
  const [openNoteIds, setOpenNoteIds] = useState<string[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [typewriterMode, setTypewriterMode] = useState<boolean>(false);
  const [appMode, setAppMode] = useState<"edit" | "preview" | "split" | "graph" | "dynamic" | "timeline">("split");
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
  const [vaultHandle, setVaultHandle] = useState<any>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({ font: "inter", hideYaml: false });
  const [focusQueue, setFocusQueue] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem("lite_obsidian_focus_queue");
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { console.error(e); }
    }
    return [];
  });
  const [sidebarInitialTab, setSidebarInitialTab] = useState<"links" | "tags" | "context" | "focus" | "graph">("links");
  const [reviewLog, setReviewLog] = useState<string[]>(() => {
    const saved = localStorage.getItem("lite_obsidian_review_log");
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { console.error(e); }
    }
    return [];
  });
  
  const [isZenMode, setIsZenMode] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        setIsZenMode(prev => !prev);
      } else if (e.key === 'Escape' && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode]);

  useEffect(() => {
    localStorage.setItem("lite_obsidian_focus_queue", JSON.stringify(focusQueue));
  }, [focusQueue]);

  useEffect(() => {
    localStorage.setItem("lite_obsidian_review_log", JSON.stringify(reviewLog));
  }, [reviewLog]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const getDirHandleByPath = async (rootHandle: any, pathStr: string | undefined) => {
    if (!pathStr) return rootHandle;
    const parts = pathStr.split('/');
    let currentHandle = rootHandle;
    for (const part of parts) {
      if (!part) continue;
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    return currentHandle;
  };

  const getFilesRecursively = async (dirHandle: any, currentPath: string = ""): Promise<{notes: Note[], folders: string[]}> => {
    let notesResult: Note[] = [];
    let foldersResult: string[] = [];
    
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        try {
          const file = await entry.getFile();
          const content = await file.text();
          const statDate = new Date(file.lastModified).toISOString();
          notesResult.push({
            id: currentPath ? `${currentPath}/${entry.name}` : entry.name,
            title: entry.name.replace('.md', ''),
            content: content,
            createdAt: statDate,
            updatedAt: statDate,
            path: currentPath
          });
        } catch (e) {
          console.error("Error reading file", entry.name, e);
        }
      } else if (entry.kind === 'directory') {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        foldersResult.push(subPath);
        const subData = await getFilesRecursively(entry, subPath);
        notesResult.push(...subData.notes);
        foldersResult.push(...subData.folders);
      }
    }
    return {notes: notesResult, folders: foldersResult};
  };

  const openVault = async () => {
    // @ts-ignore
    if (!window.showDirectoryPicker) {
      alert("Импорт локальной папки (Open Vault) требует безопасного соединения (HTTPS) или запуска на localhost. \n\nВы можете использовать приложение прямо в браузере (заметки автоматически сохраняются в локальную базу данных IndexedDB вашего браузера), либо настроить домен с SSL (HTTPS) на вашем сервере.");
      return;
    }
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setVaultHandle(handle);
      await saveVaultHandle(handle);
      const {notes: loadedNotes, folders: loadedFolders} = await getFilesRecursively(handle);
      
      setFolders(loadedFolders);

      if (loadedNotes.length > 0) {
        setNotes(loadedNotes);
        setCurrentNoteId(loadedNotes[0].id);
        await clearNotes();
        for (const n of loadedNotes) await putNote(n);
      } else {
        setNotes([]);
        setCurrentNoteId("");
      }
    } catch (err) {
      console.error("Failed to open vault:", err);
    }
  };

  // Navigation History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sync current note to history
  useEffect(() => {
    if (currentNoteId && history[historyIndex] !== currentNoteId) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(currentNoteId);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    }
  }, [currentNoteId, history, historyIndex]);

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const noteId = history[newIndex];
      setCurrentNoteId(noteId);
      setOpenNoteIds(prev => prev.includes(noteId) ? prev : [...prev, noteId]);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const noteId = history[newIndex];
      setCurrentNoteId(noteId);
      setOpenNoteIds(prev => prev.includes(noteId) ? prev : [...prev, noteId]);
    }
  };

  // Load notes and theme on initial load
  useEffect(() => {
    const initData = async () => {
      try {
        // Try to restore saved vault handle
        const savedHandle = await getVaultHandle();
        if (savedHandle) {
          try {
            // @ts-ignore - requestPermission is not in all TS defs
            const perm = await savedHandle.requestPermission({ mode: "readwrite" });
            if (perm === "granted") {
              setVaultHandle(savedHandle);
              const {notes: loadedNotes, folders: loadedFolders} = await getFilesRecursively(savedHandle);
              setFolders(loadedFolders);
              if (loadedNotes.length > 0) {
                setNotes(loadedNotes);
                setCurrentNoteId(loadedNotes[0].id);
                setOpenNoteIds([loadedNotes[0].id]);
                await clearNotes();
                for (const n of loadedNotes) await putNote(n);
              }
              return; // Vault restored successfully, skip default loading
            } else {
              // Permission denied, clear saved handle
              await clearVaultHandle();
            }
          } catch (e) {
            console.warn("Could not restore vault handle:", e);
            await clearVaultHandle();
          }
        }

        const dbNotes = await getAllNotes();
        if (dbNotes.length > 0) {
          setNotes(dbNotes);
          setCurrentNoteId(dbNotes[0].id);
          setOpenNoteIds([dbNotes[0].id]);
        } else {
          const storedNotes = localStorage.getItem("lite_obsidian_react_notes");
          if (storedNotes) {
            try {
              const parsed = JSON.parse(storedNotes);
              if (parsed.length > 0) {
                setNotes(parsed);
                setCurrentNoteId(parsed[0].id);
                setOpenNoteIds([parsed[0].id]);
                for (const note of parsed) await putNote(note);
                localStorage.removeItem("lite_obsidian_react_notes");
                return;
              }
            } catch (e) {
              console.error("Migration parse error", e);
            }
          }
          setNotes(DEFAULT_NOTES);
          if (DEFAULT_NOTES.length > 0) {
            setCurrentNoteId(DEFAULT_NOTES[0].id);
            setOpenNoteIds([DEFAULT_NOTES[0].id]);
            for (const note of DEFAULT_NOTES) await putNote(note);
          }
        }
      } catch (err) {
        console.error("DB init error", err);
      }
    };
    initData();

    // Load app settings
    const savedSettings = localStorage.getItem("lite_obsidian_settings");
    if (savedSettings) {
      try {
        setAppSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }

    // Load theme
    const savedTheme = localStorage.getItem("lite_obsidian_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Apply font setting
  useEffect(() => {
    let fontFamily = '"Inter", ui-sans-serif, system-ui, sans-serif';
    if (appSettings.font === "system") {
      fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (appSettings.font === "serif") {
      fontFamily = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
    } else if (appSettings.font === "mono") {
      fontFamily = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
    }
    
    // Clear any previous global overrides so UI goes back to default (Inter)
    document.documentElement.style.removeProperty('--font-sans');
    
    // Set custom variable for editor
    document.documentElement.style.setProperty('--font-editor', fontFamily);
    
    localStorage.setItem("lite_obsidian_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  // Toggle theme
  const handleToggleTheme = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    if (newVal) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("lite_obsidian_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("lite_obsidian_theme", "light");
    }
  };

  // Select note
  const handleSelectNote = (id: string) => {
    setCurrentNoteId(id);
    setOpenNoteIds(prev => prev.includes(id) ? prev : [...prev, id]);
    if (appMode === "graph") setAppMode("split");
  };

  // Create a new note
  const handleCreateNote = async (folder: string = "", initialTitle: string = "Untitled") => {
    let finalTitle = initialTitle.trim();
    
    if (finalTitle === "Untitled" && notes.some(n => n.title.trim().toLowerCase() === "untitled")) {
      finalTitle = generateUniqueTitle();
    }
    
    // Check if a note with this title already exists
    const existing = notes.find(n => n.title.trim().toLowerCase() === finalTitle.toLowerCase());
    if (existing) {
      alert(`A note named "${finalTitle}" already exists in your vault!`);
      handleSelectNote(existing.id);
      return;
    }

    const filename = `${finalTitle}.md`;
    const newNote: Note = {
      id: folder ? `${folder}/${filename}` : filename,
      title: finalTitle,
      content: `# ${finalTitle}\n\nStart typing here...`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      path: folder
    };

    const updated = [...notes, newNote];
    setNotes(updated);
    putNote(newNote).catch(console.error);

    if (vaultHandle) {
      try {
        const fileHandle = await vaultHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(newNote.content);
        await writable.close();
      } catch (err) {
        console.error("Failed to create file in vault", err);
      }
    }

    setCurrentNoteId(newNote.id);
    setOpenNoteIds(prev => [...prev, newNote.id]);
    if (appMode === "graph") setAppMode("split");
  };

  const generateUniqueTitle = (): string => {
    let index = 1;
    let title = `Untitled ${index}`;
    while (notes.some(n => n.title.toLowerCase() === title.toLowerCase())) {
      index++;
      title = `Untitled ${index}`;
    }
    return title;
  };

  // Delete note
  const handleDeleteNote = async (id: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      const noteToDelete = notes.find(n => n.id === id);
      const filtered = notes.filter(n => n.id !== id);
      setNotes(filtered);
      deleteNote(id).catch(console.error);
      
      if (vaultHandle && noteToDelete) {
        try {
          const dirHandle = await getDirHandleByPath(vaultHandle, noteToDelete.path);
          await dirHandle.removeEntry(`${noteToDelete.title.trim()}.md`);
        } catch (err) {
          console.error("Failed to delete from vault", err);
        }
      }
      
      if (currentNoteId === id) {
        const remainingTabs = openNoteIds.filter(t => t !== id);
        if (remainingTabs.length > 0) {
          setCurrentNoteId(remainingTabs[remainingTabs.length - 1]);
        } else {
          setCurrentNoteId(filtered.length > 0 ? filtered[0].id : "");
        }
      }
      setOpenNoteIds(prev => prev.filter(t => t !== id));
    }
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = openNoteIds.filter(t => t !== id);
    setOpenNoteIds(newTabs);
    if (currentNoteId === id) {
      setCurrentNoteId(newTabs.length > 0 ? newTabs[newTabs.length - 1] : (notes.length > 0 ? notes[0].id : ""));
    }
  };

  // Update note content or title
  const handleUpdateNote = async (id: string, updates: Partial<Note>) => {
    // Prevent duplicate titles on rename
    if (updates.title !== undefined) {
      const newTitle = updates.title.trim();
      if (newTitle) {
        const existing = notes.find(n => n.id !== id && n.title.trim().toLowerCase() === newTitle.toLowerCase());
        if (existing) {
          alert(`A note named "${newTitle}" already exists!`);
          return;
        }
      }
    }

    let updatedNote: Note | null = null;
    let oldNote: Note | null = notes.find(n => n.id === id) || null;
    let filenameChanged = false;

    const updated = notes.map(note => {
      if (note.id === id) {
        updatedNote = {
          ...note,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        // Check if title actually changed
        if (updates.title !== undefined && updates.title.trim() !== note.title.trim() && updates.title.trim() !== "") {
          updatedNote.id = (updatedNote.path ? updatedNote.path + "/" : "") + `${updates.title.trim()}.md`;
          filenameChanged = true;
        }
        return updatedNote;
      }
      return note;
    });

    if (!updatedNote) return;

    setNotes(updated);
    
    // Update active IDs synchronously before async ops to prevent Editor unmount blinking
    if (filenameChanged) {
      if (currentNoteId === id) {
        setCurrentNoteId(updatedNote.id);
      }
      setOpenNoteIds(prev => prev.map(tabId => tabId === id ? updatedNote!.id : tabId));
    }

    if (filenameChanged && oldNote) {
      deleteNote(oldNote.id).catch(console.error);
    }
    putNote(updatedNote).catch(console.error);

    if (vaultHandle && updatedNote && oldNote) {
      try {
        const dirHandle = await getDirHandleByPath(vaultHandle, updatedNote.path);
        
        if (filenameChanged && oldNote.title) {
          const oldFilename = `${oldNote.title.trim()}.md`;
          try {
            await dirHandle.removeEntry(oldFilename);
          } catch(e) {
            console.error("Could not remove old file during rename", e);
          }
        }
        
        const filename = `${updatedNote.title.trim()}.md`;
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(updatedNote.content);
        await writable.close();
      } catch (err) {
        console.error("Failed to save to vault", err);
      }
    }
  };

  const handleOpenDailyNote = () => {
    const today = new Date().toISOString().split('T')[0];
    const existing = notes.find(n => n.title.trim() === today);
    if (existing) {
      handleSelectNote(existing.id);
    } else {
      handleCreateNote("", today);
    }
  };

  const handleOpenRandomNote = () => {
    if (notes.length === 0) return;
    const random = notes[Math.floor(Math.random() * notes.length)];
    handleSelectNote(random.id);
  };

  const handleWikilinkClick = (noteTitle: string) => {
    const found = notes.find(n => n.title.trim().toLowerCase() === noteTitle.trim().toLowerCase());
    if (found) {
      handleSelectNote(found.id);
    } else {
      // Suggest creation of note with that title
      const userConfirmed = confirm(`Note "${noteTitle}" does not exist. Would you like to create it?`);
      if (userConfirmed) {
        handleCreateNote("", noteTitle);
      }
    }
  };

  const handleExtractNote = async (
    parentNoteId: string,
    extractText: string,
    editorMode: string,
    selectionStart?: number,
    selectionEnd?: number
  ) => {
    const parentNote = notes.find(n => n.id === parentNoteId);
    if (!parentNote) return null;
    
    const cleanText = extractText.replace(/[#*`[\]{}]/g, "").trim();
    let excerpt = cleanText.substring(0, 30).trim();
    if (!excerpt) excerpt = "Extract";
    
    let index = 1;
    let title = `Extract: ${excerpt}`;
    while (notes.some(n => n.title.toLowerCase() === title.toLowerCase())) {
      index++;
      title = `Extract: ${excerpt} (${index})`;
    }
    
    const filename = `${title}.md`;
    const todayStr = new Date().toISOString().split("T")[0];
    const newNoteContent = `---\nir_next_read: "${todayStr}"\nir_interval: 1\nir_ease: 2.5\nir_priority: 60\nir_last_offset: 0\n---\n# ${title}\n\nSource: [[${parentNote.title}]]\n\n${extractText}`;
    
    const newNote: Note = {
      id: parentNote.path ? `${parentNote.path}/${filename}` : filename,
      title: title,
      content: newNoteContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      path: parentNote.path
    };
    
    const linkStr = `![[${title}]]`;
    let updatedParentContent = "";
    
    if (editorMode === "dynamic" || editorMode === "edit" || editorMode === "split") {
      if (selectionStart !== undefined && selectionEnd !== undefined && selectionStart !== selectionEnd) {
        const { frontmatter, body } = splitFrontmatter(parentNote.content);
        const hideYamlActive = parentNote.content !== body;
        const startsWithFm = parentNote.content.startsWith("---");
        
        if (startsWithFm && hideYamlActive) {
          const newBody = body.substring(0, selectionStart) + linkStr + body.substring(selectionEnd);
          updatedParentContent = frontmatter + newBody;
        } else {
          updatedParentContent = parentNote.content.substring(0, selectionStart) + linkStr + parentNote.content.substring(selectionEnd);
        }
      } else {
        const { frontmatter, body } = splitFrontmatter(parentNote.content);
        const newBody = replacePlaintextInMarkdown(body, extractText, linkStr);
        updatedParentContent = frontmatter ? frontmatter + newBody : newBody;
      }
    } else {
      const { frontmatter, body } = splitFrontmatter(parentNote.content);
      const newBody = replacePlaintextInMarkdown(body, extractText, linkStr);
      updatedParentContent = frontmatter ? frontmatter + newBody : newBody;
    }
    
    const updatedParentNote: Note = {
      ...parentNote,
      content: updatedParentContent,
      updatedAt: new Date().toISOString()
    };
    
    setNotes(prev => {
      const replaced = prev.map(n => n.id === parentNoteId ? updatedParentNote : n);
      return [...replaced, newNote];
    });
    
    putNote(newNote).catch(console.error);
    putNote(updatedParentNote).catch(console.error);
    
    return newNote;
  };

  // Export current list of notes as a single HTA/HTML file
  const handleExportHtml = () => {
    const singleHtmlContent = generateSingleHtmlApp(notes);
    const blob = new Blob([singleHtmlContent], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "obsidian_standalone.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReviewCard = async (card: Flashcard, grade: "hard" | "good" | "easy") => {
    const note = notes.find(n => n.id === card.noteId);
    if (!note) return;

    const newContent = updateFlashcardInContent(note.content, card, grade);
    handleUpdateNote(note.id, { content: newContent });

    if (grade === "hard") {
      setFocusQueue(prev => {
        if (prev.some(p => p.question === card.question && p.noteId === card.noteId)) return prev;
        return [...prev, card];
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    setReviewLog(prev => [...prev, todayStr]);
  };

  const dueCards = getDueCards(notes);

  const currentNote = notes.find(n => n.id === currentNoteId);
  const wordCount = currentNote ? (currentNote.content || "").trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = currentNote ? (currentNote.content || "").length : 0;

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 transition-colors duration-200 ${typewriterMode ? 'typewriter-mode' : 'font-sans'} ${isZenMode ? 'zen-mode' : ''}`}>
      
      {/* Top Application Bar */}
      {!isZenMode && (
      <div className="relative h-10 shrink-0 flex items-center px-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 select-none">
        <div className="flex-1 flex items-center space-x-1">
          <button
            onClick={handleToggleTheme}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setTypewriterMode(!typewriterMode)}
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
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Help & Documentation"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsReviewOpen(true)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer relative"
            title="Review Flashcards"
          >
            <Brain className="w-4 h-4" />
            {dueCards.length > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 flex bg-slate-200/60 dark:bg-zinc-800 p-0.5 rounded z-10">
            <button
              onClick={() => setAppMode("edit")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                appMode === "edit"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
              title="Markdown Source Editor"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Source</span>
            </button>
            <button
              onClick={() => setAppMode("dynamic")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                appMode === "dynamic"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
              title="Dynamic Reading Mode"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Dynamic</span>
            </button>
            <button
              onClick={() => setAppMode("preview")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                appMode === "preview"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
              title="Formatted Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Preview</span>
            </button>
            <button
              onClick={() => setAppMode("split")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                appMode === "split"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
              title="Side-by-side split screen"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              onClick={() => setAppMode("graph")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                appMode === "graph"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
              title="Interactive graph map"
            >
              <Map className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Graph Map</span>
            </button>
            <button
              onClick={() => setAppMode("timeline")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                appMode === "timeline"
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
              title="Timeline History"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Timeline</span>
            </button>
          </div>
        <div className="flex-1 flex items-center justify-end gap-4">
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono uppercase tracking-wider">
            Connected: Local Session
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800"></div>
          <button
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
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
      )}

      <div className="flex flex-1 overflow-hidden w-full h-full">
        {/* SIDEBAR */}
        {!isZenMode && (
        <Sidebar
          notes={notes}
          folders={folders}
          currentNoteId={currentNoteId}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onExportHtml={handleExportHtml}
          darkMode={darkMode}
          onToggleTheme={handleToggleTheme}
          onOpenVault={openVault}
          vaultName={vaultHandle?.name}
          onOpenDailyNote={handleOpenDailyNote}
          onOpenRandomNote={handleOpenRandomNote}
        />
        )}

        {/* WORKSPACE AREA */}
        <div className="flex-1 flex flex-col overflow-hidden h-full bg-white dark:bg-zinc-900">
          
          {/* TABS BAR */}
          {!isZenMode && openNoteIds.length > 0 && appMode !== "graph" && appMode !== "timeline" && (
            <div className="h-10 flex items-end bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-zinc-800 shrink-0 px-2">
              <div className="flex items-center self-center mr-3 space-x-1 shrink-0">
                <button
                  onClick={handleGoBack}
                  disabled={historyIndex <= 0}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Go Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleGoForward}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Go Forward"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex overflow-x-auto select-none gap-1 scrollbar-hide -mb-[1px] w-full">
                {openNoteIds.map((id, index) => {
                  const n = notes.find(n => n.id === id);
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
                        onClick={() => handleSelectNote(id)}
                      className={`group flex items-center justify-between space-x-2 px-3 py-1.5 min-w-[120px] max-w-[200px] rounded-t-lg border-t border-l border-r border-b cursor-pointer text-xs font-medium transition-all ${
                        isActive 
                          ? "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 border-b-white dark:border-b-zinc-900 text-slate-800 dark:text-zinc-200" 
                          : "bg-transparent border-transparent border-b-transparent text-slate-500 dark:text-zinc-500 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                    <span className="truncate">{n.title}</span>
                    <button
                      onClick={(e) => handleCloseTab(e, id)}
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
          )}

          {/* WORKSPACE TAB RENDERING */}
          <div className="flex-1 overflow-hidden relative">
            {appMode === "graph" ? (
              <GraphView
                notes={notes}
                currentNoteId={currentNoteId}
                onSelectNote={handleSelectNote}
              />
            ) : appMode === "timeline" ? (
              <TimelineView
                notes={notes}
                onSelectNote={handleSelectNote}
              />
            ) : currentNote ? (
              <Editor
                note={currentNote}
                notes={notes}
                mode={appMode}
                settings={appSettings}
                isZenMode={isZenMode}
                onUpdateNote={handleUpdateNote}
                onSelectNote={handleSelectNote}
                onWikilinkClick={handleWikilinkClick}
                onExtractNote={handleExtractNote}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-4 p-8 text-center bg-slate-50 dark:bg-zinc-950">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded text-indigo-600 dark:text-indigo-400 shadow-sm animate-pulse">
                  <FileText className="w-10 h-10" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">No active note selected</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                    Select an existing note from the sidebar or click the "New Note" button to start mapping your second brain.
                  </p>
                </div>
                <button
                  onClick={() => handleCreateNote()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded shadow-sm transition-all cursor-pointer"
                >
                  Create a Note
                </button>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT SIDEBAR */}
        {!isZenMode && isRightSidebarOpen && (
          <RightSidebar
            currentNote={currentNote}
            notes={notes}
            focusQueue={focusQueue}
            reviewLog={reviewLog}
            onClearReviewLog={() => setReviewLog([])}
            onRemoveFromQueue={(index) => setFocusQueue(prev => prev.filter((_, idx) => idx !== index))}
            onClearFocusQueue={() => setFocusQueue([])}
            initialTab={sidebarInitialTab}
            onClose={() => setIsRightSidebarOpen(false)}
            onSelectNote={handleSelectNote}
            onUpdateNote={handleUpdateNote}
          />
        )}
      </div>

      {/* Status Bar */}
      {!isZenMode && (
      <div className="h-6 shrink-0 bg-slate-100 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between px-3 text-[10px] text-slate-500 dark:text-zinc-400 font-medium select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${vaultHandle ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
            {vaultHandle ? 'CONNECTED: FOLDER VAULT' : 'CONNECTED: LOCAL-CACHE'}
          </div>
          <div className="opacity-50">UTF-8</div>
        </div>
        <div className="flex items-center gap-4">
          <div>{wordCount} WORDS</div>
          <div>{charCount} CHARACTERS</div>
          <div className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Markdown</div>
        </div>
      </div>
      )}

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSettingsChange={setAppSettings}
      />

      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => {
          setIsReviewOpen(false);
          if (focusQueue.length > 0) {
            setSidebarInitialTab("focus");
            setIsRightSidebarOpen(true);
          }
        }}
        dueCards={dueCards}
        onReviewCard={handleReviewCard}
        onNavigateToNote={handleSelectNote}
      />

      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
