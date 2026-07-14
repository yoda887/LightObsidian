import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Note } from "../../../shared/types/types";
import { NoteRepository } from "../repositories/NoteRepository";
import { PendingRename } from "../../dialogs/hooks/useDialogs";
import { MarkdownService } from "../../../core/markdown/MarkdownService";
import { getVaultHandle } from "../../../core/db/db";
import { DEFAULT_NOTES } from "../../../core/defaults/defaultNotes";
import { ExportService } from "../../../core/export/ExportService";

export interface UseNotesParams {
  vaultHandleRef: React.MutableRefObject<any>;
  setIsVaultSavingRef: React.MutableRefObject<(val: boolean) => void>;
  setPendingRename: React.Dispatch<React.SetStateAction<PendingRename | null>>;
  onNoteSelected?: (id: string, options?: { startReading?: boolean; anchor?: string | null }) => void;
}

export function useNotes({
  vaultHandleRef,
  setIsVaultSavingRef,
  setPendingRename,
  onNoteSelected,
}: UseNotesParams) {
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef(notes);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const [currentNoteId, setCurrentNoteId] = useState<string>("");
  const [openNoteIds, setOpenNoteIds] = useState<string[]>([]);

  const notesById = useMemo(() => {
    const map = new Map<string, Note>();
    for (const n of notes) map.set(n.id, n);
    return map;
  }, [notes]);

  const notesByTitle = useMemo(() => {
    const map = new Map<string, Note>();
    for (const n of notes) map.set(n.title.trim().toLowerCase(), n);
    return map;
  }, [notes]);

  const saveTimeoutRef = useRef<any>(null);
  const pendingWritesRef = useRef<Map<string, { note: Note; oldTitle: string | null; oldPath: string | undefined }>>(new Map());
  const pendingDeletionsRef = useRef<Set<string>>(new Set());

  const isFlushingRef = useRef(false);
  const flushQueuedRef = useRef(false);

  const isSavingIndicatorActiveRef = useRef(false);
  const showSavingIndicatorTimeoutRef = useRef<any>(null);
  const hideSavingIndicatorTimeoutRef = useRef<any>(null);

  const setVaultSavingIndicator = useCallback((active: boolean) => {
    const setIsVaultSaving = setIsVaultSavingRef.current;
    if (active) {
      if (hideSavingIndicatorTimeoutRef.current) {
        clearTimeout(hideSavingIndicatorTimeoutRef.current);
        hideSavingIndicatorTimeoutRef.current = null;
      }
      if (!isSavingIndicatorActiveRef.current && !showSavingIndicatorTimeoutRef.current) {
        showSavingIndicatorTimeoutRef.current = setTimeout(() => {
          setIsVaultSaving(true);
          isSavingIndicatorActiveRef.current = true;
          showSavingIndicatorTimeoutRef.current = null;
        }, 3005);
      }
    } else {
      if (showSavingIndicatorTimeoutRef.current) {
        clearTimeout(showSavingIndicatorTimeoutRef.current);
        showSavingIndicatorTimeoutRef.current = null;
      }
      if (isSavingIndicatorActiveRef.current && !hideSavingIndicatorTimeoutRef.current) {
        hideSavingIndicatorTimeoutRef.current = setTimeout(() => {
          setIsVaultSaving(false);
          isSavingIndicatorActiveRef.current = false;
          hideSavingIndicatorTimeoutRef.current = null;
        }, 800);
      }
    }
  }, [setIsVaultSavingRef]);

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

  const flushVaultWrites = useCallback(async (immediate = false) => {
    const vaultHandle = vaultHandleRef.current;
    if (!vaultHandle) return;

    if (isFlushingRef.current) {
      flushQueuedRef.current = true;
      return;
    }

    isFlushingRef.current = true;
    setVaultSavingIndicator(true);

    try {
      const writes = Array.from(pendingWritesRef.current.entries()) as Array<[string, { note: Note; oldTitle: string | null; oldPath: string | undefined }]>;

      if (immediate) {
        await Promise.all(writes.map(async ([id, data]) => {
          const { note, oldTitle, oldPath } = data;
          try {
            if (oldTitle && oldTitle !== note.title.trim()) {
              const oldFilename = `${oldTitle}.md`;
              const oldId = (oldPath ? oldPath + "/" : "") + oldFilename;
              try {
                const oldDirHandle = await getDirHandleByPath(vaultHandle, oldPath);
                await oldDirHandle.removeEntry(oldFilename);
              } catch (e) {
                console.error("Could not remove old file during rename", e);
              } finally {
                pendingDeletionsRef.current.delete(oldId);
              }
            }

            const dirHandle = await getDirHandleByPath(vaultHandle, note.path);
            const filename = `${note.title.trim()}.md`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(note.content);
            await writable.close();

            if (pendingWritesRef.current.get(id) === data) {
              pendingWritesRef.current.delete(id);
            }
          } catch (err) {
            console.error("Failed to save to vault (immediate)", err);
          }
        }));
      } else {
        for (const [id, data] of writes) {
          await new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(() => resolve(null));
            } else {
              setTimeout(resolve, 50);
            }
          });

          const { note, oldTitle, oldPath } = data;
          try {
            if (oldTitle && oldTitle !== note.title.trim()) {
              const oldFilename = `${oldTitle}.md`;
              const oldId = (oldPath ? oldPath + "/" : "") + oldFilename;
              try {
                const oldDirHandle = await getDirHandleByPath(vaultHandle, oldPath);
                await oldDirHandle.removeEntry(oldFilename);
              } catch (e) {
                console.error("Could not remove old file during rename", e);
              } finally {
                pendingDeletionsRef.current.delete(oldId);
              }
            }

            const dirHandle = await getDirHandleByPath(vaultHandle, note.path);
            const filename = `${note.title.trim()}.md`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            
            await writable.write(note.content);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            await writable.close();

            if (pendingWritesRef.current.get(id) === data) {
              pendingWritesRef.current.delete(id);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
            console.error("Failed to save to vault", err);
          }
        }
      }
    } finally {
      isFlushingRef.current = false;
      setVaultSavingIndicator(false);

      if (flushQueuedRef.current) {
        flushQueuedRef.current = false;
        flushVaultWrites(immediate);
      }
    }
  }, [vaultHandleRef, setVaultSavingIndicator]);

  const selectNote = useCallback((id: string, options?: { startReading?: boolean; anchor?: string | null }) => {
    if (pendingWritesRef.current.size > 0) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      flushVaultWrites(true);
    }

    setCurrentNoteId(id);
    setOpenNoteIds(prev => prev.includes(id) ? prev : [...prev, id]);
    if (onNoteSelected) {
      onNoteSelected(id, options);
    }
  }, [onNoteSelected, flushVaultWrites]);

  const generateUniqueTitle = useCallback((): string => {
    let index = 1;
    let title = `Untitled ${index}`;
    while (notesByTitle.has(title.toLowerCase())) {
      index++;
      title = `Untitled ${index}`;
    }
    return title;
  }, [notesByTitle]);

  const createNote = useCallback(async (folder: string = "", initialTitle: string = "Untitled") => {
    const vaultHandle = vaultHandleRef.current;
    let finalTitle = initialTitle.replace(/[<>:"/\\|?*]/g, '').trim();
    if (!finalTitle) finalTitle = "Untitled";

    if (finalTitle === "Untitled" && notesByTitle.has("untitled")) {
      finalTitle = generateUniqueTitle();
    }

    const existing = notesByTitle.get(finalTitle.toLowerCase());
    if (existing) {
      alert(`A note named "${finalTitle}" already exists in your vault!`);
      selectNote(existing.id);
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

    setNotes(prev => [...prev, newNote]);
    setCurrentNoteId(newNote.id);
    setOpenNoteIds(prev => prev.includes(newNote.id) ? prev : [...prev, newNote.id]);
    if (onNoteSelected) {
      onNoteSelected(newNote.id);
    }

    NoteRepository.save(newNote).catch(console.error);

    if (vaultHandle) {
      setVaultSavingIndicator(true);
      try {
        const fileHandle = await vaultHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(newNote.content);
        await writable.close();
      } catch (err) {
        console.error("Failed to create file in vault", err);
      } finally {
        setVaultSavingIndicator(false);
      }
    }
  }, [vaultHandleRef, notesByTitle, generateUniqueTitle, selectNote, onNoteSelected, setVaultSavingIndicator]);

  const deleteNote = useCallback(async (id: string) => {
    const vaultHandle = vaultHandleRef.current;
    if (confirm("Are you sure you want to delete this note?")) {
      const noteToDelete = notesById.get(id);
      
      setNotes(prev => {
        const filtered = prev.filter(n => n.id !== id);
        if (currentNoteId === id) {
          const remainingTabs = openNoteIds.filter(t => t !== id);
          if (remainingTabs.length > 0) {
            setCurrentNoteId(remainingTabs[remainingTabs.length - 1]);
          } else {
            setCurrentNoteId(filtered.length > 0 ? filtered[0].id : "");
          }
        }
        return filtered;
      });
      setOpenNoteIds(prev => prev.filter(t => t !== id));

      NoteRepository.delete(id).catch(console.error);

      if (vaultHandle && noteToDelete) {
        setVaultSavingIndicator(true);
        try {
          const dirHandle = await getDirHandleByPath(vaultHandle, noteToDelete.path);
          await dirHandle.removeEntry(`${noteToDelete.title.trim()}.md`);
        } catch (err) {
          console.error("Failed to delete from vault", err);
        } finally {
          setVaultSavingIndicator(false);
        }
      }
    }
  }, [vaultHandleRef, notesById, currentNoteId, openNoteIds, setVaultSavingIndicator]);

  const handleCloseTab = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    setOpenNoteIds(prev => {
      const newTabs = prev.filter(t => t !== id);
      if (currentNoteId === id) {
        setCurrentNoteId(newTabs.length > 0 ? newTabs[newTabs.length - 1] : (notesRef.current.length > 0 ? notesRef.current[0].id : ""));
      }
      return newTabs;
    });

    if (pendingWritesRef.current.size > 0) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      flushVaultWrites(true);
    }
  }, [currentNoteId, flushVaultWrites]);

  const executeRename = useCallback((pending: PendingRename, updateLinks: boolean, keepAsAlias: boolean) => {
    const vaultHandle = vaultHandleRef.current;
    let finalNotesArray = pending.updatedNotesArray;

    if (updateLinks && pending.linkingNotes.length > 0) {
      const oldTitle = pending.oldNote.title.trim();
      const newTitle = pending.updatedNote.title.trim();
      
      finalNotesArray = finalNotesArray.map(n => {
        if (pending.linkingNotes.some(ln => ln.id === n.id)) {
          const newContent = MarkdownService.updateLinksInContent(n.content, oldTitle, newTitle, keepAsAlias);
          const modifiedNote = { ...n, content: newContent, updatedAt: new Date().toISOString() };
          NoteRepository.save(modifiedNote).catch(console.error);
          return modifiedNote;
        }
        return n;
      });
    }

    setNotes(finalNotesArray);

    if (pending.filenameChanged) {
      if (currentNoteId === pending.updatedNote.id || currentNoteId === pending.oldNote.id) {
        setCurrentNoteId(pending.updatedNote.id);
      }
      setOpenNoteIds(prev => prev.map(tabId => tabId === pending.oldNote.id ? pending.updatedNote.id : tabId));
    }

    if (pending.filenameChanged) {
      NoteRepository.delete(pending.oldNote.id).catch(console.error);
    }
    NoteRepository.save(pending.updatedNote).catch(console.error);

    if (vaultHandle) {
      let originalTitle: string | null = pending.filenameChanged ? pending.oldNote.title.trim() : null;
      let originalPath = pending.oldNote.path;

      if (pendingWritesRef.current.has(pending.oldNote.id)) {
        const prevPending = pendingWritesRef.current.get(pending.oldNote.id)!;
        originalTitle = prevPending.oldTitle || originalTitle;
        originalPath = prevPending.oldPath !== undefined ? prevPending.oldPath : originalPath;
        pendingWritesRef.current.delete(pending.oldNote.id);
      }

      pendingWritesRef.current.set(pending.updatedNote.id, {
        note: pending.updatedNote,
        oldTitle: originalTitle,
        oldPath: originalTitle ? originalPath : undefined
      });

      if (originalTitle) {
        const oldFileId = (originalPath ? originalPath + "/" : "") + `${originalTitle}.md`;
        pendingDeletionsRef.current.add(oldFileId);
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (pending.filenameChanged) {
        flushVaultWrites(true);
      } else {
        saveTimeoutRef.current = setTimeout(() => flushVaultWrites(), 10000);
      }
    }
    
    setPendingRename(null);
  }, [vaultHandleRef, currentNoteId, flushVaultWrites, setPendingRename]);

  const saveNote = useCallback(async (id: string, updates: Partial<Note>) => {
    if (updates.title !== undefined) {
      const newTitle = updates.title.replace(/[<>:"/\\|?*]/g, '').trim();
      if (!newTitle) {
        delete updates.title;
      } else {
        updates.title = newTitle;
        const existing = notesByTitle.get(newTitle.toLowerCase());
        if (existing && existing.id !== id) {
          alert(`A note named "${newTitle}" already exists!`);
          return;
        }
      }
    }

    let updatedNote: Note | null = null;
    const oldNote = notesById.get(id) || null;
    let filenameChanged = false;

    const updated = notesRef.current.map(note => {
      if (note.id === id) {
        updatedNote = {
          ...note,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        if (updates.title !== undefined && updates.title.trim() !== note.title.trim() && updates.title.trim() !== "") {
          updatedNote.id = (updatedNote.path ? updatedNote.path + "/" : "") + `${updates.title.trim()}.md`;
          filenameChanged = true;
        }
        return updatedNote;
      }
      return note;
    });

    if (!updatedNote || !oldNote) return;

    if (filenameChanged) {
      const oldTitleRaw = oldNote.title.trim();
      const regex = new RegExp(`\\[\\[${MarkdownService.escapeRegExp(oldTitleRaw)}(?:#[^\\]|]+)?(?:\\|[^\\]]+)?\\]\\]`, "i");
      const linkingNotes = notesRef.current.filter(n => {
        if (n.id === id) return false;
        return regex.test(n.content);
      });

      if (linkingNotes.length > 0) {
        setPendingRename({
          updatedNote: updatedNote!,
          oldNote: oldNote,
          filenameChanged,
          updatedNotesArray: updated,
          linkingNotes
        });
        return;
      }
    }

    executeRename({
      updatedNote: updatedNote!,
      oldNote: oldNote,
      filenameChanged,
      updatedNotesArray: updated,
      linkingNotes: []
    }, false, false);
  }, [notesById, notesByTitle, executeRename, setPendingRename]);

  const selectedNote = useMemo(() => {
    return notesById.get(currentNoteId) || null;
  }, [currentNoteId, notesById]);

  const extractNote = useCallback(async (
    parentNoteId: string,
    extractText: string,
    editorMode: string,
    options: {
      customTitle: string;
      asEmbed?: boolean;
      insertType?: "embed" | "link" | "block";
      nearestHeading: string | null;
    },
    selectionStart?: number,
    selectionEnd?: number
  ): Promise<Note | null> => {
    const parentNote = notesById.get(parentNoteId);
    if (!parentNote) return null;

    let title = options.customTitle;
    let index = 1;
    while (notesByTitle.has(title.toLowerCase())) {
      index++;
      title = `${options.customTitle} (${index})`;
    }

    const filename = `${title}.md`;
    const todayStr = new Date().toISOString().split("T")[0];
    
    const insertType = options.insertType || (options.asEmbed ? "embed" : "link");
    
    let sourceLink = `[[${parentNote.title}]]`;
    if (insertType !== "block" && options.nearestHeading) {
      sourceLink = `[[${parentNote.title}#${options.nearestHeading}]]`;
    }
    
    const blockId = `ext-${Math.random().toString(36).substring(2, 8)}`;
    
    const newContentBody = insertType === "block" 
      ? `![[${parentNote.title}#^${blockId}]]`
      : extractText;
      
    const newNoteContent = `---\nir_next_read: "${todayStr}"\nir_interval: 1\nir_ease: 2.5\nir_priority: 60\nir_last_offset: 0\nir_source: "${sourceLink}"\n---\n${newContentBody}`;

    const newNote: Note = {
      id: parentNote.path ? `${parentNote.path}/${filename}` : filename,
      title: title,
      content: newNoteContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      path: parentNote.path
    };

    let replacementText = "";
    if (insertType === "embed") {
      replacementText = `![[${title}]]`;
    } else if (insertType === "link") {
      replacementText = `[[${title}]]`;
    } else if (insertType === "block") {
      replacementText = `${extractText}\n%%[[${title}]]%%^${blockId}`;
    }

    let updatedParentContent = "";

    if (editorMode === "dynamic" || editorMode === "edit" || editorMode === "split") {
      if (selectionStart !== undefined && selectionEnd !== undefined && selectionStart !== selectionEnd) {
        const { frontmatter, body } = MarkdownService.splitFrontmatter(parentNote.content);
        const hideYamlActive = parentNote.content !== body;
        const startsWithFm = parentNote.content.startsWith("---");

        if (startsWithFm && hideYamlActive) {
          const newBody = body.substring(0, selectionStart) + replacementText + body.substring(selectionEnd);
          updatedParentContent = frontmatter + newBody;
        } else {
          updatedParentContent = parentNote.content.substring(0, selectionStart) + replacementText + parentNote.content.substring(selectionEnd);
        }
      } else {
        const { frontmatter, body } = MarkdownService.splitFrontmatter(parentNote.content);
        const newBody = MarkdownService.replacePlaintextInMarkdown(body, extractText, replacementText);
        updatedParentContent = frontmatter ? frontmatter + newBody : newBody;
      }
    } else {
      const { frontmatter, body } = MarkdownService.splitFrontmatter(parentNote.content);
      const newBody = MarkdownService.replacePlaintextInMarkdown(body, extractText, replacementText);
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

    NoteRepository.save(newNote).catch(console.error);
    NoteRepository.save(updatedParentNote).catch(console.error);

    return newNote;
  }, [notesById, notesByTitle]);

  const openDailyNote = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const existing = notesByTitle.get(today.toLowerCase());
    if (existing) {
      selectNote(existing.id);
    } else {
      createNote("", today);
    }
  }, [notesByTitle, selectNote, createNote]);

  const openRandomNote = useCallback(() => {
    if (notes.length === 0) return;
    const random = notes[Math.floor(Math.random() * notes.length)];
    selectNote(random.id);
  }, [notes, selectNote]);

  const handleWikilinkClick = useCallback((noteTitle: string) => {
    let lookupTitle = noteTitle.trim();
    let anchor: string | undefined = undefined;
    const hashIdx = lookupTitle.indexOf("#");
    if (hashIdx > -1) {
      anchor = lookupTitle.substring(hashIdx).trim();
      lookupTitle = lookupTitle.substring(0, hashIdx).trim();
    }
    const found = notesByTitle.get(lookupTitle.toLowerCase());
    if (found) {
      selectNote(found.id, { anchor });
    } else {
      const userConfirmed = confirm(`Note "${lookupTitle}" does not exist. Would you like to create it?`);
      if (userConfirmed) {
        createNote("", lookupTitle);
      }
    }
  }, [notesByTitle, selectNote, createNote]);

  const exportHtml = useCallback(() => {
    const singleHtmlContent = ExportService.generateSingleHtmlApp(notes);
    const blob = new Blob([singleHtmlContent], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "obsidian_standalone.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [notes]);

  // Load notes on initial load
  useEffect(() => {
    const initData = async () => {
      try {
        const savedHandle = await getVaultHandle();
        if (savedHandle) {
          try {
            const perm = await (savedHandle as any).queryPermission({ mode: "readwrite" });
            if (perm === "granted") {
              // Will be synced automatically by useWorkspace
              return; 
            }
          } catch (e) {
            console.warn("Could not query vault handle permission:", e);
          }
        }

        const dbNotes = await NoteRepository.loadAll();
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
                for (const note of parsed) await NoteRepository.save(note);
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
            for (const note of DEFAULT_NOTES) await NoteRepository.save(note);
          }
        }
      } catch (err) {
        console.error("DB init error", err);
      }
    };
    initData();
  }, []);

  // Autosave pending changes on beforeunload / visibility change
  useEffect(() => {
    const handleBeforeUnloadOrHide = () => {
      if (pendingWritesRef.current.size > 0) {
        flushVaultWrites(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnloadOrHide);
    window.addEventListener("pagehide", handleBeforeUnloadOrHide);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && pendingWritesRef.current.size > 0) {
        flushVaultWrites(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnloadOrHide);
      window.removeEventListener("pagehide", handleBeforeUnloadOrHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushVaultWrites]);

  return {
    notes,
    setNotes,
    notesRef,
    notesById,
    notesByTitle,
    currentNoteId,
    setCurrentNoteId,
    selectedNote,
    openNoteIds,
    setOpenNoteIds,
    pendingDeletionsRef,
    pendingWritesRef,
    selectNote,
    createNote,
    deleteNote,
    handleCloseTab,
    saveNote,
    renameNote: saveNote,
    executeRename,
    flushVaultWrites,
    extractNote,
    openDailyNote,
    openRandomNote,
    handleWikilinkClick,
    exportHtml,
  };
}
