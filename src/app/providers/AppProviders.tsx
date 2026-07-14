/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from "react";
import { useSettings } from "../../features/settings/hooks/useSettings";
import { useDialogs } from "../../features/dialogs/hooks/useDialogs";
import { useWorkspace } from "../../features/vault/hooks/useWorkspace";
import { useNotes } from "../../features/notes/hooks/useNotes";
import { useLayout } from "../../features/vault/hooks/useLayout";
import { useReview } from "../../features/review/hooks/useReview";

const SettingsContext = createContext<ReturnType<typeof useSettings> | null>(null);
const DialogsContext = createContext<ReturnType<typeof useDialogs> | null>(null);
const NotesContext = createContext<ReturnType<typeof useNotes> | null>(null);
const LayoutContext = createContext<ReturnType<typeof useLayout> | null>(null);
const WorkspaceContext = createContext<ReturnType<typeof useWorkspace> | null>(null);
const ReviewContext = createContext<ReturnType<typeof useReview> | null>(null);

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettingsContext must be used within AppProviders");
  return context;
}

export function useDialogsContext() {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("useDialogsContext must be used within AppProviders");
  return context;
}

export function useNotesContext() {
  const context = useContext(NotesContext);
  if (!context) throw new Error("useNotesContext must be used within AppProviders");
  return context;
}

export function useLayoutContext() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error("useLayoutContext must be used within AppProviders");
  return context;
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspaceContext must be used within AppProviders");
  return context;
}

export function useReviewContext() {
  const context = useContext(ReviewContext);
  if (!context) throw new Error("useReviewContext must be used within AppProviders");
  return context;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const onNoteSelectedRef = React.useRef<any>(null);

  const settings = useSettings();
  const dialogs = useDialogs();

  const vaultHandleRef = React.useRef<any>(null);
  const setIsVaultSavingRef = React.useRef<(val: boolean) => void>(() => {});

  const notes = useNotes({
    vaultHandleRef,
    setIsVaultSavingRef,
    setPendingRename: dialogs.setPendingRename,
    onNoteSelected: (id, options) => onNoteSelectedRef.current?.(id, options),
  });

  const layout = useLayout({
    currentNoteId: notes.currentNoteId,
    setCurrentNoteId: notes.setCurrentNoteId,
    setOpenNoteIds: notes.setOpenNoteIds,
  });

  onNoteSelectedRef.current = (id: string, options?: { startReading?: boolean; anchor?: string | null }) => {
    layout.setActiveAnchor(options?.anchor || null);
    if (layout.appMode === "graph") layout.setAppMode("split");
    if (options?.startReading) {
      layout.setRestoreScrollNoteId(id);
      layout.setRestoreScrollKey(prev => prev + 1);
    } else {
      layout.setRestoreScrollNoteId(null);
    }
  };

  const workspace = useWorkspace({
    notesRef: notes.notesRef,
    currentNoteId: notes.currentNoteId,
    setNotes: notes.setNotes,
    setCurrentNoteId: notes.setCurrentNoteId,
    setOpenNoteIds: notes.setOpenNoteIds,
    pendingDeletionsRef: notes.pendingDeletionsRef,
    pendingWritesRef: notes.pendingWritesRef,
  });

  React.useEffect(() => {
    vaultHandleRef.current = workspace.vaultHandle;
  }, [workspace.vaultHandle]);

  React.useEffect(() => {
    setIsVaultSavingRef.current = workspace.setIsVaultSaving;
  }, [workspace.setIsVaultSaving]);

  const review = useReview({ notes: notes.notes, onUpdateNote: notes.saveNote });

  return (
    <SettingsContext.Provider value={settings}>
      <DialogsContext.Provider value={dialogs}>
        <NotesContext.Provider value={notes}>
          <LayoutContext.Provider value={layout}>
            <WorkspaceContext.Provider value={workspace}>
              <ReviewContext.Provider value={review}>
                {children}
              </ReviewContext.Provider>
            </WorkspaceContext.Provider>
          </LayoutContext.Provider>
        </NotesContext.Provider>
      </DialogsContext.Provider>
    </SettingsContext.Provider>
  );
}
