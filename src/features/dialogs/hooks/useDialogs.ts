import { useState, useCallback } from "react";
import { Note } from "../../../shared/types/types";

export interface PendingRename {
  updatedNote: Note;
  oldNote: Note;
  filenameChanged: boolean;
  updatedNotesArray: Note[];
  linkingNotes: Note[];
}

export function useDialogs() {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const openReview = useCallback(() => setIsReviewOpen(true), []);
  const closeReview = useCallback(() => setIsReviewOpen(false), []);

  return {
    isSettingsOpen,
    setIsSettingsOpen,
    openSettings,
    closeSettings,
    isHelpOpen,
    setIsHelpOpen,
    openHelp,
    closeHelp,
    isReviewOpen,
    setIsReviewOpen,
    openReview,
    closeReview,
    pendingRename,
    setPendingRename,
  };
}
