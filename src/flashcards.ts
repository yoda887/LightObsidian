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
  type?: "standard" | "cloze" | "mcq" | "reversed" | "multiline";
  options?: string[];
  isReverseDirection?: boolean;
}

// Regex to find traditional: Question :: Answer or Question ::: Answer \n <!--SR:2024-01-01,1,2.5!2024-01-01,1,2.5-->
const CARD_REGEX = /^(.+?)[ \t]*(:::|::)[ \t]*(.+?)(?:\r?\n<!--SR:([^>]+)-->)?$/gm;

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

    const fmMatch = note.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fmLength = fmMatch ? fmMatch[0].length : 0;

    let cleanContent = note.content;

    // 2. Extract MCQ Test blocks (:::test ... :::) first
    const testRegex = /^:::test\r?\n([\s\S]*?)\r?\n:::$/gm;
    let testMatch;
    while ((testMatch = testRegex.exec(note.content)) !== null) {
      if (testMatch.index < fmLength) continue;

      const fullMatch = testMatch[0];
      const innerContent = testMatch[1];
      const testLines = innerContent.split(/\r?\n/);
      
      const options: string[] = [];
      let answer = "";
      const questionLines: string[] = [];
      
      let nextReview = 0;
      let interval = 0;
      let ease = 2.5;

      for (let i = 0; i < testLines.length; i++) {
        const line = testLines[i];
        const trimmed = line.trim();
        
        // Check for SR comment at the very end of the block
        if (i === testLines.length - 1 && trimmed.startsWith("<!--SR:")) {
          const srMatch = trimmed.match(/^<!--SR:([^,]+),([^,]+),([^>]+)-->$/);
          if (srMatch) {
            nextReview = new Date(srMatch[1]).getTime();
            interval = parseFloat(srMatch[2]);
            ease = parseFloat(srMatch[3]);
          }
          continue;
        }

        const optionMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
        if (optionMatch) {
          const isCorrect = optionMatch[1].toLowerCase() === "x";
          const optionText = optionMatch[2];
          options.push(optionText);
          if (isCorrect) {
            answer = optionText;
          }
        } else {
          questionLines.push(line);
        }
      }

      cards.push({
        noteId: note.id,
        noteTitle: note.title,
        question: questionLines.join("\n").trim(),
        answer,
        fullMatch,
        nextReview,
        interval,
        ease,
        type: "mcq",
        options
      });

      // Blank out matched block in cleanContent to prevent traditional/cloze parsing
      cleanContent = cleanContent.replace(fullMatch, " ".repeat(fullMatch.length));
    }

    // 3. Extract traditional cards from cleanContent
    const regex = new RegExp(CARD_REGEX.source, CARD_REGEX.flags);
    let match;
    while ((match = regex.exec(cleanContent)) !== null) {
      if (match.index < fmLength) {
        continue;
      }

      const fullMatch = match[0];
      const question = match[1].trim();
      const separator = match[2];
      const answer = match[3].trim();
      
      let nextReview = 0;
      let interval = 0;
      let ease = 2.5;
      let nextReviewRev = 0;
      let intervalRev = 0;
      let easeRev = 2.5;

      if (match[4]) {
        const srParts = match[4].split('!');
        const fwd = srParts[0]?.split(',') || [];
        if (fwd.length === 3) {
          nextReview = new Date(fwd[0]).getTime();
          interval = parseFloat(fwd[1]);
          ease = parseFloat(fwd[2]);
        }
        
        const rev = srParts[1]?.split(',') || [];
        if (rev.length === 3) {
          nextReviewRev = new Date(rev[0]).getTime();
          intervalRev = parseFloat(rev[1]);
          easeRev = parseFloat(rev[2]);
        }
      }

      cards.push({
        noteId: note.id,
        noteTitle: note.title,
        question,
        answer,
        fullMatch,
        nextReview,
        interval,
        ease,
        type: separator === ':::' ? 'reversed' : 'standard'
      });
      
      if (separator === ':::') {
        cards.push({
          noteId: note.id,
          noteTitle: note.title,
          question: answer,
          answer: question,
          fullMatch,
          nextReview: nextReviewRev,
          interval: intervalRev,
          ease: easeRev,
          type: 'reversed',
          isReverseDirection: true
        });
      }
    }

    // 3.5. Extract Multi-line cards (? and ??)
    const blocks = cleanContent.substring(fmLength).split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const mlMatch = block.match(/\r?\n(\?\?|\?)\r?\n/);
      if (mlMatch) {
        const separator = mlMatch[1];
        const parts = block.split(/\r?\n(?:\?\?|\?)\r?\n/);
        if (parts.length === 2) {
          const question = parts[0].trim();
          let answerRaw = parts[1].trim();
          let nextReview = 0;
          let interval = 0;
          let ease = 2.5;
          let nextReviewRev = 0;
          let intervalRev = 0;
          let easeRev = 2.5;

          const srMatch = answerRaw.match(/\r?\n<!--SR:([^>]+)-->$/);
          if (srMatch) {
            const srParts = srMatch[1].split('!');
            const fwd = srParts[0]?.split(',') || [];
            if (fwd.length === 3) {
              nextReview = new Date(fwd[0]).getTime();
              interval = parseFloat(fwd[1]);
              ease = parseFloat(fwd[2]);
            }
            
            const rev = srParts[1]?.split(',') || [];
            if (rev.length === 3) {
              nextReviewRev = new Date(rev[0]).getTime();
              intervalRev = parseFloat(rev[1]);
              easeRev = parseFloat(rev[2]);
            }
            answerRaw = answerRaw.replace(/\r?\n<!--SR:([^>]+)-->$/, '').trim();
          }

          cards.push({
            noteId: note.id,
            noteTitle: note.title,
            question,
            answer: answerRaw,
            fullMatch: block,
            nextReview,
            interval,
            ease,
            type: separator === '??' ? 'reversed' : 'multiline'
          });

          if (separator === '??') {
            cards.push({
              noteId: note.id,
              noteTitle: note.title,
              question: answerRaw,
              answer: question,
              fullMatch: block,
              nextReview: nextReviewRev,
              interval: intervalRev,
              ease: easeRev,
              type: 'reversed',
              isReverseDirection: true
            });
          }
        }
      }
    }

    // 4. Extract cloze deletions line-by-line from cleanContent
    const lines = cleanContent.substring(fmLength).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("::") || line === "?") continue;

      const hasCloze = /\{\{[^{}]+\}\}|==[^=]+==/.test(line);
      if (!hasCloze) continue;

      let nextReview = 0;
      let interval = 0;
      let ease = 2.5;
      let srLine = "";

      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("<!--SR:")) {
        const srMatch = lines[i + 1].trim().match(/^<!--SR:([^,]+),([^,]+),([^>]+)-->$/);
        if (srMatch) {
          nextReview = new Date(srMatch[1]).getTime();
          interval = parseFloat(srMatch[2]);
          ease = parseFloat(srMatch[3]);
          srLine = lines[i + 1];
        }
      }

      const question = line.replace(/\{\{[^{}]+\}\}|==[^=]+==/g, "[...]");
      const answer = line.replace(/\{\{([^{}]+)\}\}/g, "**$1**").replace(/==([^=]+)==/g, "**$1**");
      const fullMatch = srLine ? `${line}\n${srLine}` : line;

      cards.push({
        noteId: note.id,
        noteTitle: note.title,
        question,
        answer,
        fullMatch,
        nextReview,
        interval,
        ease,
        type: "cloze"
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
  } else if (card.type === "mcq") {
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const srComment = `<!--SR:${nextDateStr},${newInterval},${newEase.toFixed(1)}-->`;
    // Safely remove any existing SR comment right before the closing :::
    let cleanMatch = card.fullMatch.replace(/\r?\n\s*<!--SR:[^>]+-->\s*\r?\n:::/, "\n:::");
    // If the SR comment was added but there was no newline before it, the previous regex might miss it if it was \n<!--SR...-->\n:::
    // Actually the above regex is good. Let's make sure it handles optional whitespaces.
    
    // Inject new SR comment right before the closing :::
    const newCardStr = cleanMatch.replace(/\r?\n:::$/, `\n${srComment}\n:::`);
    return content.replace(card.fullMatch, newCardStr);
  } else {
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const newSched = `${nextDateStr},${newInterval},${newEase.toFixed(1)}`;

    if (card.type === "reversed") {
      let existingSr = "";
      const srMatch = card.fullMatch.match(/<!--SR:([^>]+)-->$/);
      if (srMatch) existingSr = srMatch[1];
      
      let fwd = "", rev = "";
      if (existingSr) {
        const parts = existingSr.split('!');
        fwd = parts[0] || "";
        rev = parts[1] || "";
      }
      
      if (card.isReverseDirection) {
        rev = newSched;
        if (!fwd) fwd = `${nextDateStr},1,2.5`;
      } else {
        fwd = newSched;
        if (!rev) rev = `${nextDateStr},1,2.5`;
      }
      
      const newSrComment = `<!--SR:${fwd}!${rev}-->`;
      const cleanMatch = card.fullMatch.replace(/\r?\n<!--SR:[^>]+-->$/, '');
      const newCardStr = `${cleanMatch}\n${newSrComment}`;
      return content.replace(card.fullMatch, newCardStr);
    } else {
      const newSrComment = `<!--SR:${newSched}-->`;
      const cleanMatch = card.fullMatch.replace(/\r?\n<!--SR:[^>]+-->$/, '');
      const newCardStr = `${cleanMatch}\n${newSrComment}`;
      return content.replace(card.fullMatch, newCardStr);
    }
  }
}

// Appends a traditional inline card template to the note content
export function insertFlashcardTemplate(content: string): string {
  const template = "\n\nQuestion :: Answer";
  return content + template;
}
