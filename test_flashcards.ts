import { extractFlashcards } from "./src/core/flashcards/FlashcardService";

const notes = [{
  id: "test",
  title: "Test Note",
  content: `---
tags: []
---
Question ::: Answer
<!--SR:2024-01-01,1,250!2024-01-05,4,270-->

Multi line Q
?
Multi line A
line 2
<!--SR:2024-01-01,1,250-->

Test
`
}];

const cards = extractFlashcards(notes as any);
console.log(JSON.stringify(cards, null, 2));
