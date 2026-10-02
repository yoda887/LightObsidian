import React, { useState, useEffect, useCallback } from "react";
import { Note } from "../../../shared/types/types";
import { saveVaultHandle, getVaultHandle, clearVaultHandle } from "../../../core/db/db";
import { NoteRepository } from "../../notes/repositories/NoteRepository";
import { scanVault } from "../../../core/vault/VaultScanner";

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

    // A fixed pool of readers, not batches: a batch waits for its slowest
    // file, which on a high-latency drive leaves most slots idle.
    const CONCURRENCY = 10;
    // Every setNotes re-renders the whole app, so results are applied in
    // bursts instead of once per file (or per ten files).
    const FLUSH_INTERVAL_MS = 400;

    let nextIndex = 0;
    let completedCount = 0;
    let pending = new Map<string, Note>();
    let lastFlush = Date.now();

    const flush = (force: boolean) => {
      if (pending.size === 0) return;
      if (!force && Date.now() - lastFlush < FLUSH_INTERVAL_MS) return;

      const batch = pending;
      pending = new Map();
      lastFlush = Date.now();

      NoteRepository.saveMany([...batch.values()]).catch(console.error);
      setSyncProgressText(`Загрузка контента: ${completedCount}/${notesToDownload.length}`);
      // Only fill in notes that are still stubs, never overwrite an edit.
      setNotes(prev => prev.map(n => (n.isLoaded === false ? batch.get(n.id) ?? n : n)));
    };

    const worker = async () => {
      while (nextIndex < notesToDownload.length) {
        const stubNote = notesToDownload[nextIndex++];
        try {
          const dirHandle = await getDirHandleByPath(targetHandle, stubNote.path);
          const fileHandle = await dirHandle.getFileHandle(`${stubNote.title}.md`);
          const file = await fileHandle.getFile();
          const content = await file.text();
          pending.set(stubNote.id, { ...stubNote, content, isLoaded: true });
        } catch (e) {
          console.error(`Failed to download content for ${stubNote.id}`, e);
        }
        completedCount++;
        flush(false);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, notesToDownload.length) }, worker)
    );
    flush(true);

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
      const existingMap = new Map<string, Note>(notesRef.current.map(n => [n.id, n]));

      // At page load nothing is in memory yet, so every file would look new
      // and be read in full. Consult the copy kept in IndexedDB first.
      let cachedMap = new Map<string, Note>();
      try {
        cachedMap = new Map((await NoteRepository.loadAll()).map(n => [n.id, n] as const));
      } catch (e) {
        console.warn("Could not read cached notes, reading every file from disk", e);
      }

      // Files are read concurrently, so progress can fire hundreds of times a
      // second; every update re-renders the app, so report at most ~10/s.
      let lastReport = 0;
      const { notes: stubNotes, folders: loadedFolders } = await scanVault(targetHandle, {
        existingNotes: existingMap,
        cachedNotes: cachedMap,
        currentNoteId,
        isPendingDeletion: id => pendingDeletionsRef.current.has(id),
        isPendingWrite: id => pendingWritesRef.current.has(id),
        onListed: total => setSyncProgressText(`Чтение структуры: 0/${total}`),
        onProgress: (done, total) => {
          const now = Date.now();
          if (done === total || now - lastReport >= 100) {
            lastReport = now;
            setSyncProgressText(`Чтение структуры: ${done}/${total}`);
          }
        },
      });

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
