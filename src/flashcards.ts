import { Note } from "./types";

export interface Flashcard {
  noteId: string;
  noteTitle: string;
  question: string;
  answer: string;
  fullMatch: string;      // The exact text matched in the markdown
  nextReview: number;     // Timestamp
  interval: number;       // In days
  ease: number;           // Multiplier
}

// Regex to find: Question :: Answer \n <!--SR:2024-01-01,1,2.5-->
const CARD_REGEX = /^(.+?)\s*::\s*(.+?)(?:\n<!--SR:([^,]+),([^,]+),([^>]+)-->)?$/gm;

export function extractFlashcards(notes: Note[]): Flashcard[] {
  const cards: Flashcard[] = [];
  
  for (const note of notes) {
    // We need to reset lastIndex because it's global
    const regex = new RegExp(CARD_REGEX.source, CARD_REGEX.flags);
    let match;
    while ((match = regex.exec(note.content)) !== null) {
      const fullMatch = match[0];
      const question = match[1].trim();
      const answer = match[2].trim();
      
      let nextReview = 0;
      let interval = 0;
      let ease = 2.5;

      if (match[3] && match[4] && match[5]) {
        nextReview = new Date(match[3]).getTime();
        interval = parseFloat(match[4]);
        ease = parseFloat(match[5]);
      }

      cards.push({
        noteId: note.id,
        noteTitle: note.title,
        question,
        answer,
        fullMatch,
        nextReview,
        interval,
        ease
      });
    }
  }
  
  return cards;
}

export function getDueCards(notes: Note[]): Flashcard[] {
  const allCards = extractFlashcards(notes);
  const now = Date.now();
  // Sort: Overdue first, then by interval
  return allCards
    .filter(c => c.nextReview <= now)
    .sort((a, b) => a.nextReview - b.nextReview);
}

// SM-2 Algorithm
export function calculateNextReview(ease: number, interval: number, grade: "hard" | "good" | "easy"): { newInterval: number, newEase: number } {
  let newInterval = interval;
  let newEase = ease;

  if (grade === "hard") {
    newEase = Math.max(1.3, ease - 0.2);
    newInterval = Math.max(1, Math.round(interval * 0.5));
  } else if (grade === "good") {
    if (interval === 0) newInterval = 1;
    else if (interval === 1) newInterval = 3;
    else newInterval = Math.round(interval * ease);
  } else if (grade === "easy") {
    newEase += 0.15;
    if (interval === 0) newInterval = 2;
    else if (interval === 1) newInterval = 4;
    else newInterval = Math.round(interval * ease * 1.3);
  }

  // Cap interval to 365 days max
  newInterval = Math.min(newInterval, 365);
  return { newInterval, newEase };
}

export function updateFlashcardInContent(content: string, card: Flashcard, grade: "hard" | "good" | "easy"): string {
  const { newInterval, newEase } = calculateNextReview(card.ease, card.interval, grade);
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  const dateStr = nextDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const newBlock = `${card.question} :: ${card.answer}\n<!--SR:${dateStr},${newInterval},${newEase.toFixed(2)}-->`;
  
  return content.replace(card.fullMatch, newBlock);
}
