import { Note } from "../../shared/types/types";
import { ExtractedLink, extractWikilinks } from "../markdown/MarkdownService";

/**
 * Per-note derived data (links, tags, title mentions), computed once per
 * version of a note.
 *
 * The side panel and the editor need vault-wide answers (backlinks, tags, ...)
 * and used to rebuild them by scanning every note on every keystroke, even
 * though a keystroke changes exactly one note. Note objects are never mutated
 * (an edit produces a new object and the rest keep their identity), so the
 * extraction for a note can be cached against the object itself. A WeakMap
 * lets the entry go away with the note. If a note were ever replaced by an
 * equal copy the only cost is one recomputation, never a stale answer.
 *
 * The vault-wide aggregations below then only walk cached results.
 */

const TAG_REGEX = /(?<=^|\s)#([\p{L}\p{N}_\-\/]+)/gu;
const BRACKET_REGEX = /\[\[(.*?)\]\]/g;

const wikilinksCache = new WeakMap<Note, ExtractedLink[]>();
const linkTargetsCache = new WeakMap<Note, Set<string>>();
const bracketTargetsCache = new WeakMap<Note, string[]>();
const tagsCache = new WeakMap<Note, string[]>();
const tagsLowerCache = new WeakMap<Note, string[]>();
const mentionsCache = new WeakMap<Note, Map<string, boolean>>();

/** Typed wikilinks in the note, de-duplicated (see extractWikilinks). */
export function wikilinksOf(note: Note): ExtractedLink[] {
  let links = wikilinksCache.get(note);
  if (!links) {
    links = extractWikilinks(note.content);
    wikilinksCache.set(note, links);
  }
  return links;
}

/** Lower-cased targets of the note's wikilinks, for backlink lookups. */
export function linkTargetsOf(note: Note): Set<string> {
  let targets = linkTargetsCache.get(note);
  if (!targets) {
    targets = new Set(wikilinksOf(note).map(l => l.target.toLowerCase()));
    linkTargetsCache.set(note, targets);
  }
  return targets;
}

/**
 * Lower-cased, trimmed text of every [[...]] in the note, exactly as written
 * (aliases and anchors included), in order of appearance.
 */
export function bracketTargetsOf(note: Note): string[] {
  let targets = bracketTargetsCache.get(note);
  if (!targets) {
    targets = Array.from(note.content.matchAll(BRACKET_REGEX)).map(m => m[1].trim().toLowerCase());
    bracketTargetsCache.set(note, targets);
  }
  return targets;
}

/** Unique #tags in the note, case preserved, in order of first appearance. */
export function tagsOf(note: Note): string[] {
  let tags = tagsCache.get(note);
  if (!tags) {
    const found = new Set<string>();
    for (const match of note.content.matchAll(TAG_REGEX)) found.add(match[1].trim());
    tags = Array.from(found);
    tagsCache.set(note, tags);
  }
  return tags;
}

/** Like tagsOf, but lower-cased before de-duplicating. */
export function tagsLowerOf(note: Note): string[] {
  let tags = tagsLowerCache.get(note);
  if (!tags) {
    tags = Array.from(new Set(tagsOf(note).map(t => t.toLowerCase())));
    tagsLowerCache.set(note, tags);
  }
  return tags;
}

/**
 * Does the note's text contain `titleLower` (case-insensitive)? Remembered per
 * (note, title): while the user types in the current note its title does not
 * change, so every other note answers from the cache.
 */
export function mentionsTitle(note: Note, titleLower: string): boolean {
  let byTitle = mentionsCache.get(note);
  if (!byTitle) {
    byTitle = new Map();
    mentionsCache.set(note, byTitle);
  }
  let hit = byTitle.get(titleLower);
  if (hit === undefined) {
    hit = note.content.toLowerCase().includes(titleLower);
    byTitle.set(titleLower, hit);
  }
  return hit;
}

/** Every distinct #tag across the vault, in note order. */
export function allTags(notes: Note[]): string[] {
  const tags = new Set<string>();
  for (const note of notes) {
    for (const tag of tagsOf(note)) tags.add(tag);
  }
  return Array.from(tags);
}

/** Notes (other than `noteId`) that link to a note titled `title`. */
export function backlinksOf(noteId: string, title: string, notes: Note[]): Note[] {
  const titleLower = title.toLowerCase();
  return notes.filter(n => n.id !== noteId && linkTargetsOf(n).has(titleLower));
}

export const NoteIndex = {
  wikilinksOf,
  linkTargetsOf,
  bracketTargetsOf,
  tagsOf,
  tagsLowerOf,
  mentionsTitle,
  allTags,
  backlinksOf,
};
