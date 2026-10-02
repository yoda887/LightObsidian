import React, { useState, useEffect, useCallback } from "react";

export interface UseLayoutParams {
  currentNoteId: string;
  setCurrentNoteId: (id: string) => void;
  setOpenNoteIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useLayout({ currentNoteId, setCurrentNoteId, setOpenNoteIds }: UseLayoutParams) {
  const [appMode, setAppMode] = useState<"edit" | "preview" | "split" | "graph" | "dynamic" | "timeline">("split");
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [restoreScrollNoteId, setRestoreScrollNoteId] = useState<string | null>(null);
  const [restoreScrollKey, setRestoreScrollKey] = useState(0);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [sessionOffsets, setSessionOffsets] = useState<Record<string, number>>({});

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

  // Renaming a note changes its id (the id is the file path), so everything
  // keyed by id has to follow or it points at a note that no longer exists.
  const remapNoteId = useCallback((oldId: string, newId: string) => {
    if (oldId === newId) return;

    setHistory(prev => prev.map(id => (id === oldId ? newId : id)));
    setSessionOffsets(prev => {
      if (!(oldId in prev)) return prev;
      const { [oldId]: offset, ...rest } = prev;
      return { ...rest, [newId]: offset };
    });
    setRestoreScrollNoteId(prev => (prev === oldId ? newId : prev));
  }, []);

  const handleGoBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const noteId = history[newIndex];
      setCurrentNoteId(noteId);
      setOpenNoteIds(prev => prev.includes(noteId) ? prev : [...prev, noteId]);
    }
  }, [history, historyIndex, setCurrentNoteId, setOpenNoteIds]);

  const handleGoForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const noteId = history[newIndex];
      setCurrentNoteId(noteId);
      setOpenNoteIds(prev => prev.includes(noteId) ? prev : [...prev, noteId]);
    }
  }, [history, historyIndex, setCurrentNoteId, setOpenNoteIds]);

  return {
    appMode,
    setAppMode,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    isZenMode,
    setIsZenMode,
    restoreScrollNoteId,
    setRestoreScrollNoteId,
    restoreScrollKey,
    setRestoreScrollKey,
    activeAnchor,
    setActiveAnchor,
    sessionOffsets,
    setSessionOffsets,
    history,
    historyIndex,
    handleGoBack,
    handleGoForward,
    remapNoteId,
  };
}
