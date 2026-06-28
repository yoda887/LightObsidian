import { Note } from "./types";

export interface Flashcard {
  noteId: string;
  noteTitle: string;
  question: string;
  answer: string;
  fullMatch: string;      // The exact text matched in the markdown (or YAML indicator)
  nextReview: number;     // Timestamp
  interval: number;       // In days
  ease: number;           // Multiplier
}

// Regex to find traditional: Question :: Answer \n <!--SR:2024-01-01,1,2.5-->
const CARD_REGEX = /^(.+?)\s*::\s*(.+?)(?:\n<!--SR:([^,]+),([^,]+),([^>]+)-->)?$/gm;

// Helper to parse YAML cards from note content
export function extractYamlCards(note: Note): Flashcard[] {
  const cards: Flashcard[] = [];
  const fmMatch = note.content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!fmMatch) return cards;

  const fmText = fmMatch[1];
  const lines = fmText.split(/\r?\n/);
  let inCards = false;
  let currentCard: { question?: string; answer?: string; nextReviewStr?: string; interval?: number; ease?: number } | null = null;

  const parseYamlLine = (line: string, obj: any) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return;
    const key = line.substring(0, colonIdx).trim();
    let val = line.substring(colonIdx + 1).trim();
    
    // strip leading/trailing quotes (single or double)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    // unescape quotes
    val = val.replace(/\\"/g, '"').replace(/\\'/g, "'");

    if (key === "question" || key === "answer") {
      obj[key] = val;
    } else if (key === "nextReview") {
      obj.nextReviewStr = val;
    } else if (key === "interval") {
      obj.interval = parseFloat(val) || 0;
    } else if (key === "ease") {
      obj.ease = parseFloat(val) || 2.5;
    }
  };

  const finalizeYamlCard = (c: any): Flashcard => {
    const nextReview = c.nextReviewStr ? new Date(c.nextReviewStr).getTime() : 0;
    return {
      noteId: note.id,
      noteTitle: note.title,
      question: c.question || "",
      answer: c.answer || "",
      fullMatch: `YAML_CARD:${c.question || ""}`,
      nextReview: isNaN(nextReview) ? 0 : nextReview,
      interval: c.interval || 0,
      ease: c.ease || 2.5
    };
  };

  for (let line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === "cards:") {
      inCards = true;
      continue;
    }
    
    if (inCards) {
      // If we hit another root-level key, stop reading cards
      if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("-") && !line.startsWith("\t") && trimmed.endsWith(":")) {
        inCards = false;
        continue;
      }

      if (trimmed.startsWith("-")) {
        if (currentCard && currentCard.question && currentCard.answer) {
          cards.push(finalizeYamlCard(currentCard));
        }
        currentCard = {};
        const rest = trimmed.substring(1).trim();
        parseYamlLine(rest, currentCard);
      } else if (currentCard && trimmed !== "") {
        parseYamlLine(trimmed, currentCard);
      }
    }
  }

  if (currentCard && currentCard.question && currentCard.answer) {
    cards.push(finalizeYamlCard(currentCard));
  }

  return cards;
}

// Helper to update YAML cards in note content
export function updateYamlCardsInContent(
  content: string,
  targetQuestion: string,
  newCardData: { question: string; answer: string; nextReview: number; interval: number; ease: number }
): string {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  
  let frontmatterText = "";
  let bodyText = content;
  
  if (fmMatch) {
    frontmatterText = fmMatch[1];
    bodyText = content.substring(fmMatch[0].length);
  }
  
  const lines = frontmatterText.split(/\r?\n/);
  const otherFrontmatterLines: string[] = [];
  let inCards = false;
  const existingCards: any[] = [];
  
  let currentCard: any = null;

  const parseYamlLine = (line: string, obj: any) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return;
    const key = line.substring(0, colonIdx).trim();
    let val = line.substring(colonIdx + 1).trim();
    
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    val = val.replace(/\\"/g, '"').replace(/\\'/g, "'");

    if (key === "question" || key === "answer") {
      obj[key] = val;
    } else if (key === "nextReview") {
      obj.nextReviewStr = val;
    } else if (key === "interval") {
      obj.interval = parseFloat(val) || 0;
    } else if (key === "ease") {
      obj.ease = parseFloat(val) || 2.5;
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed === "cards:") {
      inCards = true;
      continue;
    }
    if (inCards) {
      if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("-") && !line.startsWith("\t") && trimmed.endsWith(":")) {
        inCards = false;
        if (trimmed !== "") {
          otherFrontmatterLines.push(line);
        }
      } else {
        if (trimmed.startsWith("-")) {
          if (currentCard) existingCards.push(currentCard);
          currentCard = {};
          parseYamlLine(trimmed.substring(1).trim(), currentCard);
        } else if (currentCard && trimmed !== "") {
          parseYamlLine(trimmed, currentCard);
        }
      }
    } else {
      if (line !== "") {
        otherFrontmatterLines.push(line);
      }
    }
  }
  if (currentCard) {
    existingCards.push(currentCard);
  }
  
  const dateStr = new Date(newCardData.nextReview).toISOString().split('T')[0];
  const newCardObj = {
    question: newCardData.question,
    answer: newCardData.answer,
    nextReviewStr: dateStr,
    interval: newCardData.interval,
    ease: newCardData.ease
  };
  
  let updated = false;
  const updatedCards = existingCards.map(c => {
    if (c.question === targetQuestion) {
      updated = true;
      return newCardObj;
    }
    return c;
  });
  
  if (!updated) {
    updatedCards.push(newCardObj);
  }
  
  const finalFrontmatterLines: string[] = [];
  for (const line of otherFrontmatterLines) {
    if (line.trim() !== "") {
      finalFrontmatterLines.push(line);
    }
  }
  
  finalFrontmatterLines.push("cards:");
  for (const card of updatedCards) {
    const q = (card.question || "").replace(/"/g, '\\"');
    const a = (card.answer || "").replace(/"/g, '\\"');
    const nr = card.nextReviewStr || (new Date(card.nextReview || Date.now()).toISOString().split('T')[0]);
    finalFrontmatterLines.push(`  - question: "${q}"`);
    finalFrontmatterLines.push(`    answer: "${a}"`);
    finalFrontmatterLines.push(`    nextReview: "${nr}"`);
    finalFrontmatterLines.push(`    interval: ${card.interval}`);
    finalFrontmatterLines.push(`    ease: ${parseFloat(card.ease).toFixed(2)}`);
  }
  
  return `---\n${finalFrontmatterLines.join('\n')}\n---\n${bodyText}`;
}

export function extractFlashcards(notes: Note[]): Flashcard[] {
  const cards: Flashcard[] = [];
  
  for (const note of notes) {
    // 1. Extract YAML cards
    const yamlCards = extractYamlCards(note);
    cards.push(...yamlCards);

    // 2. Extract traditional cards
    const regex = new RegExp(CARD_REGEX.source, CARD_REGEX.flags);
    let match;
    const fmMatch = note.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fmLength = fmMatch ? fmMatch[0].length : 0;

    while ((match = regex.exec(note.content)) !== null) {
      if (match.index < fmLength) {
        continue;
      }

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

  newInterval = Math.min(newInterval, 365);
  return { newInterval, newEase };
}

export function updateFlashcardInContent(content: string, card: Flashcard, grade: "hard" | "good" | "easy"): string {
  const { newInterval, newEase } = calculateNextReview(card.ease, card.interval, grade);
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  const nextReviewTime = nextDate.getTime();

  const isYaml = card.fullMatch.startsWith("YAML_CARD:");

  if (isYaml) {
    return updateYamlCardsInContent(content, card.question, {
      question: card.question,
      answer: card.answer,
      nextReview: nextReviewTime,
      interval: newInterval,
      ease: newEase
    });
  } else {
    let cleanedContent = content.replace(card.fullMatch, "");
    cleanedContent = cleanedContent.replace(/\r?\n\r?\n\r?\n/g, "\n\n");
    
    return updateYamlCardsInContent(cleanedContent, card.question, {
      question: card.question,
      answer: card.answer,
      nextReview: nextReviewTime,
      interval: newInterval,
      ease: newEase
    });
  }
}

// Prepend or add new card in YAML frontmatter format
export function insertFlashcardTemplate(content: string): string {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!fmMatch) {
    return `---\ncards:\n  - question: "Question"\n    answer: "Answer"\n---\n${content}`;
  }

  const fmText = fmMatch[1];
  const bodyText = content.substring(fmMatch[0].length);

  const lines = fmText.split(/\r?\n/);
  const newFmLines: string[] = [];
  let hasCardsKey = false;
  let inserted = false;

  for (let line of lines) {
    newFmLines.push(line);
    if (line.trim() === "cards:") {
      hasCardsKey = true;
      newFmLines.push(`  - question: "Question"`);
      newFmLines.push(`    answer: "Answer"`);
      inserted = true;
    }
  }

  if (!hasCardsKey) {
    newFmLines.push("cards:");
    newFmLines.push(`  - question: "Question"`);
    newFmLines.push(`    answer: "Answer"`);
  } else if (!inserted) {
    newFmLines.push(`  - question: "Question"`);
    newFmLines.push(`    answer: "Answer"`);
  }

  return `---\n${newFmLines.join("\n")}\n---\n${bodyText}`;
}
