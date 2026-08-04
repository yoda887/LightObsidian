import React, { useState, useEffect, useCallback } from "react";
import { Note } from "../../../shared/types/types";
import { saveVaultHandle, getVaultHandle, clearVaultHandle } from "../../../core/db/db";
import { NoteRepository } from "../../notes/repositories/NoteRepository";

export interface UseWorkspaceParams {
  notesRef: React.MutableRefObject<Note[]>;
  currentNoteId: string;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  setCurrentNoteId: (id: string) => void;
  setOpenNoteIds: React.Dispatch<React.SetStateAction<string[]>>;
  pendingDeletionsRef: React.MutableRefObject<Set<string>>;
  pendingWritesRef: React.MutableRefObject<Map<string, { note: Note; oldTitle: string | null; oldPath: string | undefined }>>;
}

export function useWorkspace({
  notesRef,
  currentNoteId,
  setNotes,
  setCurrentNoteId,
  setOpenNoteIds,
  pendingDeletionsRef,
  pendingWritesRef,
}: UseWorkspaceParams) {
  const [vaultHandle, setVaultHandle] = useState<any>(null);
  const [vaultPendingHandle, setVaultPendingHandle] = useState<any>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncProgressText, setSyncProgressText] = useState<string>("");
  const [isVaultLoading, setIsVaultLoading] = useState<boolean>(false);
  const [isVaultSaving, setIsVaultSaving] = useState<boolean>(false);
  const [isInitialSynced, setIsInitialSynced] = useState<boolean>(false);

  const countFilesRecursively = async (dirHandle: any): Promise<number> => {
    let count = 0;
    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        count++;
      } else if (entry.kind === 'directory') {
        count += await countFilesRecursively(entry);
      }
    }
    return count;
  };

  const getStructureRecursively = async (
    dirHandle: any,
    currentPath: string = "",
    existingNotesMap: Map<string, Note> = new Map(),
    onFileRead?: (current: number) => void,
    progressCounter: { val: number } = { val: 0 }
  ): Promise<{ notes: Note[]; folders: string[] }> => {
    let notesResult: Note[] = [];
    let foldersResult: string[] = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        const id = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        if (pendingDeletionsRef.current.has(id)) {
          continue;
        }

        progressCounter.val++;
        if (onFileRead) {
          onFileRead(progressCounter.val);
        }

        try {
          const file = await entry.getFile();
          const statDate = new Date(file.lastModified).toISOString();

          const existing = existingNotesMap.get(id);
          const isPendingWrite = pendingWritesRef.current.has(id);
          const isCurrentNote = id === currentNoteId; // Проверяем, редактируется ли заметка прямо сейчас
          
          if (existing) {
            const existingTime = new Date(existing.updatedAt).getTime();
            // Если есть отложенная запись, или это текущая заметка, или файл на диске старее — сохраняем UI-версию
            if (isPendingWrite || isCurrentNote || existingTime >= file.lastModified || existing.updatedAt === statDate) {
              notesResult.push({ ...existing, isLoaded: true });
              continue;
            }
          }

          notesResult.push({
            id,
            title: entry.name.replace('.md', ''),
            content: "", // Empty stub
            createdAt: existing ? existing.createdAt : statDate,
            updatedAt: statDate,
            path: currentPath,
            isLoaded: false // Needs content download
          });
        } catch (e) {
          console.error("Error reading file", entry.name, e);
        }
      } else if (entry.kind === 'directory') {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        foldersResult.push(subPath);
        const subData = await getStructureRecursively(entry, subPath, existingNotesMap, onFileRead, progressCounter);
        notesResult.push(...subData.notes);
        foldersResult.push(...subData.folders);
      }
    }
    return { notes: notesResult, folders: foldersResult };
  };

  const getDirHandleByPath = useCallback(async (rootHandle: any, pathStr: string | undefined) => {
    if (!pathStr) return rootHandle;
    const parts = pathStr.split('/');
    let currentHandle = rootHandle;
    for (const part of parts) {
      if (!part) continue;
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    return currentHandle;
  }, []);

  const downloadContentsInBatches = async (
    targetHandle: any,
    stubNotes: Note[]
  ) => {
    const notesToDownload = stubNotes.filter(n => n.isLoaded === false);
    if (notesToDownload.length === 0) return;

    setSyncStatus("syncing");
    setSyncProgressText(`Загрузка контента: 0/${notesToDownload.length}`);

    const batchSize = 10;
    let completedCount = 0;

    for (let i = 0; i < notesToDownload.length; i += batchSize) {
      const batch = notesToDownload.slice(i, i + batchSize);
      
      const updatedBatchNotes = await Promise.all(batch.map(async (stubNote) => {
        try {
          const dirHandle = await getDirHandleByPath(targetHandle, stubNote.path);
          const fileHandle = await dirHandle.getFileHandle(`${stubNote.title}.md`);
          const file = await fileHandle.getFile();
          const content = await file.text();
          
          const fullNote: Note = {
            ...stubNote,
            content,
            isLoaded: true
          };
          
          await NoteRepository.save(fullNote);
          return fullNote;
        } catch (e) {
          console.error(`Failed to download content for ${stubNote.id}`, e);
          return stubNote;
        }
      }));

      completedCount += batch.length;
      setSyncProgressText(`Загрузка контента: ${completedCount}/${notesToDownload.length}`);

      setNotes(prev => {
        const newNotes = [...prev];
        for (const updatedNote of updatedBatchNotes) {
          if (updatedNote.isLoaded) {
            const index = newNotes.findIndex(n => n.id === updatedNote.id);
            if (index !== -1) {
              newNotes[index] = updatedNote;
            }
          }
        }
        return newNotes;
      });
    }

    setSyncStatus("success");
    setSyncProgressText("Синхронизация успешно завершена");
    setTimeout(() => {
      setSyncStatus("idle");
      setSyncProgressText("");
    }, 3000);
  };

  const performSync = useCallback(async (targetHandle = vaultHandle) => {
    if (!targetHandle) return;
    setSyncStatus("syncing");
    setIsVaultLoading(true);
    setSyncProgressText("Подсчет файлов на диске...");

    try {
      const totalFiles = await countFilesRecursively(targetHandle);

      setSyncProgressText(`Чтение структуры: 0/${totalFiles}`);
      const existingMap = new Map<string, Note>(notesRef.current.map(n => [n.id, n]));
      
      const { notes: stubNotes, folders: loadedFolders } = await getStructureRecursively(
        targetHandle,
        "",
        existingMap,
        (current) => setSyncProgressText(`Чтение структуры: ${current}/${totalFiles}`)
      );

      // We clear the whole repository previously, but now we should only save loaded ones?
      // Wait, let's just save the stubs without content so we don't overwrite good content with empty content.
      // Actually, if we just don't clear NoteRepository, it's safer. Let's just save loaded stubs.
      
      setFolders(loadedFolders);
      setNotes(stubNotes);

      if (stubNotes.length > 0) {
        setOpenNoteIds(prev => {
          const validTabs = prev.filter(tabId => stubNotes.some(n => n.id === tabId));
          if (validTabs.length === 0) {
            return [stubNotes[0].id];
          }
          return validTabs;
        });

        const stillExists = stubNotes.some(n => n.id === currentNoteId);
        if (!currentNoteId || !stillExists) {
          setCurrentNoteId(stubNotes[0].id);
        }
      } else {
        setOpenNoteIds([]);
        setCurrentNoteId("");
      }

      const notesToDownload = stubNotes.filter(n => n.isLoaded === false);
      if (notesToDownload.length > 0) {
        setIsVaultLoading(false); // User can interact with structure while downloading
        downloadContentsInBatches(targetHandle, stubNotes).catch(console.error);
      } else {
        setSyncStatus("success");
        setSyncProgressText("Синхронизация успешно завершена");
        setTimeout(() => {
          setSyncStatus("idle");
          setSyncProgressText("");
        }, 3000);
      }

    } catch (err) {
      console.error("Synchronization failed", err);
      setSyncStatus("error");
      setSyncProgressText("Ошибка синхронизации");
      setTimeout(() => {
        setSyncStatus("idle");
        setSyncProgressText("");
      }, 5000);
    } finally {
      setIsVaultLoading(false);
    }
  }, [vaultHandle, notesRef, currentNoteId, setNotes, setCurrentNoteId, setOpenNoteIds]);

  const openVault = useCallback(async () => {
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
    } catch (err) {
      console.error("Failed to open vault:", err);
    }
  }, []);

  const handleRestoreVaultAccess = useCallback(async () => {
    if (!vaultPendingHandle) return;
    try {
      const perm = await vaultPendingHandle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") {
        setVaultHandle(vaultPendingHandle);
        setVaultPendingHandle(null);
      }
    } catch (err) {
      console.error("Пользователь отменил восстановление доступа", err);
    }
  }, [vaultPendingHandle]);

  // Load vault handle on initial load
  useEffect(() => {
    const initData = async () => {
      try {
        const savedHandle = await getVaultHandle();
        if (savedHandle) {
          try {
            const perm = await (savedHandle as any).queryPermission({ mode: "readwrite" });
            if (perm === "granted") {
              setVaultHandle(savedHandle);
              return;
            } else if (perm === "prompt") {
              setVaultPendingHandle(savedHandle);
            } else {
              await clearVaultHandle();
            }
          } catch (e) {
            console.warn("Could not restore vault handle:", e);
            await clearVaultHandle();
          }
        }
      } catch (err) {
        console.error("DB init error", err);
      }
    };
    initData();
  }, []);

  // Выполняем полную синхронизацию только один раз при первом открытии/восстановлении доступа
  useEffect(() => {
    if (!vaultHandle || isInitialSynced) return;
    performSync(vaultHandle);
    setIsInitialSynced(true);
  }, [vaultHandle, performSync, isInitialSynced]);

  return {
    vaultHandle,
    setVaultHandle,
    vaultPendingHandle,
    setVaultPendingHandle,
    folders,
    setFolders,
    syncStatus,
    syncProgressText,
    isVaultLoading,
    setIsVaultLoading,
    isVaultSaving,
    setIsVaultSaving,
    performSync,
    openVault,
    handleRestoreVaultAccess,
    getDirHandleByPath,
  };
}
