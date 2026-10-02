import { useState, useEffect, useMemo } from "react";
import { Note } from "../../../shared/types/types";
import { FlashcardService, Flashcard } from "../../../core/flashcards/FlashcardService";

interface UseReviewOptions {
  notes: Note[];
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
}

export function useReview({ notes, onUpdateNote }: UseReviewOptions) {
  const [focusQueue, setFocusQueue] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem("lite_obsidian_focus_queue");
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { console.error(e); }
    }
    return [];
  });

  const [reviewLog, setReviewLog] = useState<string[]>(() => {
    const saved = localStorage.getItem("lite_obsidian_review_log");
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { console.error(e); }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("lite_obsidian_focus_queue", JSON.stringify(focusQueue));
  }, [focusQueue]);

  useEffect(() => {
    localStorage.setItem("lite_obsidian_review_log", JSON.stringify(reviewLog));
  }, [reviewLog]);

  // Scans every note with a pile of regexes, so it must not run on each
  // render of the provider (i.e. on every keystroke in the editor).
  const dueCards = useMemo(() => FlashcardService.getDueCards(notes), [notes]);

  const handleReviewCard = async (card: Flashcard, grade: "hard" | "good" | "easy") => {
    const note = notes.find(n => n.id === card.noteId);
    if (!note) return;

    const newContent = FlashcardService.updateFlashcardInContent(note.content, card, grade);
    onUpdateNote(note.id, { content: newContent });

    if (grade === "hard") {
      setFocusQueue(prev => {
        if (prev.some(p => p.question === card.question && p.noteId === card.noteId)) return prev;
        return [...prev, card];
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    setReviewLog(prev => [...prev, todayStr]);
  };

  const removeFromQueue = (index: number) => {
    setFocusQueue(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearFocusQueue = () => setFocusQueue([]);
  const clearReviewLog = () => setReviewLog([]);

  return {
    focusQueue,
    reviewLog,
    dueCards,
    handleReviewCard,
    removeFromQueue,
    clearFocusQueue,
    clearReviewLog,
  };
}
