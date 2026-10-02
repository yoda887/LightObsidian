/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from "react";
import Sidebar from "../../features/vault/components/Sidebar";
import Editor from "../../features/editor/components/Editor";
import RightSidebar from "../../features/notes/components/RightSidebar";
import RenameLinksModal from "../../features/vault/components/RenameLinksModal";
import TopBar from "./TopBar";
import TabBar from "./TabBar";
import StatusBar from "./StatusBar";
import { FileText } from "lucide-react";

// Screens and dialogs that are only reached by clicking something are loaded
// on first use instead of being part of the first download.
const GraphView = lazy(() => import("../../features/graph/components/GraphView"));
const TimelineView = lazy(() => import("../../features/timeline/components/TimelineView"));
const SettingsDialog = lazy(() => import("../../features/settings/components/SettingsDialog"));
const ReviewModal = lazy(() => import("../../features/review/components/ReviewModal"));
const HelpDialog = lazy(() => import("../../features/settings/components/HelpDialog"));

/**
 * True from the first time `open` is true onwards. The dialogs are rendered
 * with an isOpen flag and keep their state while closed, so once one has been
 * opened it stays mounted exactly as before; it just is not loaded (or
 * mounted) until the first time it is wanted.
 */
function useOpenedOnce(open: boolean): boolean {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  return seen;
}

import {
  useSettingsContext,
  useDialogsContext,
  useNotesContext,
  useLayoutContext,
  useWorkspaceContext,
  useReviewContext,
} from "../providers/AppProviders";

export default function AppLayout() {
  const settings = useSettingsContext();
  const dialogs = useDialogsContext();
  const notesHook = useNotesContext();
  const layout = useLayoutContext();
  const workspace = useWorkspaceContext();
  const review = useReviewContext();
  const {
    darkMode,
    typewriterMode,
    setTypewriterMode,
    appSettings,
    setAppSettings,
    handleToggleTheme,
  } = settings;

  const {
    isSettingsOpen,
    setIsSettingsOpen,
    isHelpOpen,
    setIsHelpOpen,
    isReviewOpen,
    setIsReviewOpen,
    pendingRename,
    setPendingRename,
  } = dialogs;

  const {
    notes,
    notesById,
    currentNoteId,
    selectedNote,
    openNoteIds,
    selectNote: handleSelectNote,
    createNote: handleCreateNote,
    deleteNote: handleDeleteNote,
    handleCloseTab,
    saveNote: handleUpdateNote,
    executeRename,
    extractNote: handleExtractNote,
    openDailyNote: handleOpenDailyNote,
    openRandomNote: handleOpenRandomNote,
    handleWikilinkClick,
    exportHtml: handleExportHtml,
  } = notesHook;

  const {
    appMode,
    setAppMode,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    isZenMode,
    setIsZenMode,
    restoreScrollNoteId,
    restoreScrollKey,
    activeAnchor,
    setActiveAnchor,
    sessionOffsets,
    setSessionOffsets,
    history,
    historyIndex,
    handleGoBack,
    handleGoForward,
  } = layout;

  const {
    vaultHandle,
    vaultPendingHandle,
    folders,
    syncStatus,
    syncProgressText,
    isVaultLoading,
    isVaultSaving,
    performSync,
    openVault,
    handleRestoreVaultAccess,
  } = workspace;

  const {
    focusQueue,
    reviewLog,
    dueCards,
    handleReviewCard,
    removeFromQueue,
    clearFocusQueue,
    clearReviewLog,
  } = review;

  const settingsEverOpened = useOpenedOnce(isSettingsOpen);
  const reviewEverOpened = useOpenedOnce(isReviewOpen);
  const helpEverOpened = useOpenedOnce(isHelpOpen);

  const [sidebarInitialTab, setSidebarInitialTab] = useState<"links" | "tags" | "context" | "focus" | "graph">("links");

  const handleSaveSessionOffset = (noteId: string, offset: number) => {
    setSessionOffsets(prev => ({ ...prev, [noteId]: offset }));
  };

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
  }, [isZenMode, setIsZenMode]);

  const currentNote = selectedNote || undefined;
  const wordCount = currentNote ? (currentNote.content || "").trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = currentNote ? (currentNote.content || "").length : 0;

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 transition-colors duration-200 ${typewriterMode ? 'typewriter-mode' : 'font-sans'} ${isZenMode ? 'zen-mode' : ''}`}>
      
      {/* Top Application Bar */}
      {!isZenMode && (
        <TopBar
          darkMode={darkMode}
          typewriterMode={typewriterMode}
          appMode={appMode}
          isRightSidebarOpen={isRightSidebarOpen}
          dueCardsCount={dueCards.length}
          onToggleTheme={handleToggleTheme}
          onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          onOpenReview={() => setIsReviewOpen(true)}
          onSetAppMode={setAppMode}
          onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        />
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
          vaultName={vaultHandle?.name || vaultPendingHandle?.name}
          isVaultPending={!!vaultPendingHandle}
          isVaultLoading={isVaultLoading}
          onRestoreVaultAccess={handleRestoreVaultAccess}
          onOpenDailyNote={handleOpenDailyNote}
          onOpenRandomNote={handleOpenRandomNote}
          syncStatus={syncStatus}
          syncProgressText={syncProgressText}
          onSyncVault={() => performSync()}
        />
        )}

        {/* WORKSPACE AREA */}
        <div className="flex-1 flex flex-col overflow-hidden h-full bg-white dark:bg-zinc-900">
          
          {/* TABS BAR */}
          {!isZenMode && openNoteIds.length > 0 && appMode !== "graph" && appMode !== "timeline" && (
            <TabBar
              openNoteIds={openNoteIds}
              currentNoteId={currentNoteId}
              notesById={notesById}
              historyIndex={historyIndex}
              historyLength={history.length}
              onSelectNote={handleSelectNote}
              onCloseTab={handleCloseTab}
              onGoBack={handleGoBack}
              onGoForward={handleGoForward}
            />
          )}

          {/* WORKSPACE TAB RENDERING */}
          <div className="flex-1 overflow-hidden relative">
            {appMode === "graph" ? (
              <Suspense fallback={null}>
                <GraphView
                  notes={notes}
                  currentNoteId={currentNoteId}
                  onSelectNote={handleSelectNote}
                />
              </Suspense>
            ) : appMode === "timeline" ? (
              <Suspense fallback={null}>
                <TimelineView
                  notes={notes}
                  onSelectNote={handleSelectNote}
                />
              </Suspense>
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
                shouldRestoreScroll={restoreScrollNoteId === currentNoteId}
                restoreScrollKey={restoreScrollKey}
                sessionOffset={sessionOffsets[currentNote.id] || 0}
                onSaveSessionOffset={handleSaveSessionOffset}
                activeAnchor={activeAnchor}
                onClearActiveAnchor={() => setActiveAnchor(null)}
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
            onClearReviewLog={clearReviewLog}
            onRemoveFromQueue={removeFromQueue}
            onClearFocusQueue={clearFocusQueue}
            initialTab={sidebarInitialTab}
            onClose={() => setIsRightSidebarOpen(false)}
            onSelectNote={handleSelectNote}
            onUpdateNote={handleUpdateNote}
          />
        )}
      </div>

      {/* Status Bar */}
      {!isZenMode && (
        <StatusBar
          vaultHandle={vaultHandle}
          isVaultSaving={isVaultSaving}
          isVaultLoading={isVaultLoading}
          wordCount={wordCount}
          charCount={charCount}
        />
      )}

      <Suspense fallback={null}>
        {settingsEverOpened && (
          <SettingsDialog
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={appSettings}
            onSettingsChange={setAppSettings}
          />
        )}

        {reviewEverOpened && (
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
        )}

        {helpEverOpened && (
          <HelpDialog
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
          />
        )}
      </Suspense>

      <RenameLinksModal
        isOpen={!!pendingRename}
        oldTitle={pendingRename?.oldNote.title || ""}
        newTitle={pendingRename?.updatedNote.title || ""}
        linkedNotesCount={pendingRename?.linkingNotes.length || 0}
        onConfirm={(updateLinks, keepAsAlias) => {
          if (pendingRename) {
            executeRename(pendingRename, updateLinks, keepAsAlias);
          }
        }}
        onCancel={() => {
          setPendingRename(null);
        }}
      />
    </div>
  );
}
