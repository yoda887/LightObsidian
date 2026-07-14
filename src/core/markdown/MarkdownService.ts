import { Note } from "../../shared/types/types";
import { marked } from "marked";

export interface ExtractedLink {
  target: string;
  type?: string;
}

export function extractWikilinks(content: string): ExtractedLink[] {
  const regex = /\[\[(?:([^\]|:]+):)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: ExtractedLink[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({
      type: match[1] ? match[1].trim() : undefined,
      target: match[2].trim(),
    });
  }
  
  // Deduplicate by target + type
  const unique = new Map<string, ExtractedLink>();
  for (const link of links) {
    unique.set(`${link.type || ''}::${link.target}`, link);
  }
  return Array.from(unique.values());
}

export async function transclude(content: string, notes: Note[] = [], depth = 0): Promise<string> {
  if (depth > 3) return `<div class="p-2 border border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs my-2">Error: Transclusion depth limit reached.</div>`;

  const transclusions = Array.from(content.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g));
  let result = content;
  for (const match of transclusions) {
    const cleanTarget = match[1].trim();
    const hashIdx = cleanTarget.indexOf("#");
    let noteTitle = cleanTarget;
    let anchor: string | null = null;
    if (hashIdx > -1) {
      noteTitle = cleanTarget.substring(0, hashIdx).trim();
      anchor = cleanTarget.substring(hashIdx).trim();
    }

    const targetNote = notes.find(n => n.title.trim().toLowerCase() === noteTitle.toLowerCase());
    
    let embedHtml = "";
    if (targetNote) {
      let childContent = targetNote.content;
      
      const childFrontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
      childContent = childContent.replace(childFrontmatterRegex, "");

      if (noteTitle.startsWith("Extract:")) {
        childContent = childContent.replace(/^#\s+Extract:[^\r\n]*(?:\r?\n)*/m, "");
        childContent = childContent.replace(/^Source:\s+\[\[[^\]]*\]\](?:\r?\n)*/m, "");
      }

      if (anchor) {
        if (anchor.startsWith("#^")) {
          const blockId = anchor.substring(1).trim();
          const paragraphs = childContent.split(/\r?\n\r?\n/);
          let foundParagraph = "";
          for (const p of paragraphs) {
            if (p.trim().includes(blockId)) {
              foundParagraph = p.replace(new RegExp(`\\s*${escapeRegExp(blockId)}\\s*$`), "").trim();
              break;
            }
          }
          if (foundParagraph) {
            childContent = foundParagraph;
          } else {
            childContent = `<span class="text-rose-500 font-semibold italic">Block ${blockId} not found in note "${noteTitle}"</span>`;
          }
        } else {
          const headerText = anchor.substring(1).trim().toLowerCase();
          const lines = childContent.split(/\r?\n/);
          let startIdx = -1;
          let headerLevel = 0;
          
          for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/^(#+)\s+(.+)$/);
            if (match && match[2].trim().toLowerCase() === headerText) {
              startIdx = i;
              headerLevel = match[1].length;
              break;
            }
          }
          
          if (startIdx !== -1) {
            const sectionLines: string[] = [];
            sectionLines.push(lines[startIdx]);
            
            for (let i = startIdx + 1; i < lines.length; i++) {
              const match = lines[i].match(/^(#+)\s+(.+)$/);
              if (match) {
                const nextLevel = match[1].length;
                if (nextLevel <= headerLevel) {
                  break;
                }
              }
              sectionLines.push(lines[i]);
            }
            childContent = sectionLines.join("\n");
          } else {
            childContent = `<span class="text-rose-500 font-semibold italic">Header "${anchor.substring(1)}" not found in note "${noteTitle}"</span>`;
          }
        }
      }

      const parsedChild = await parseMarkdownToHtml(childContent, notes, depth + 1);
      embedHtml = `<div class="transclusion relative border-l-4 border-indigo-500 pl-4 py-2 pr-8 my-4 bg-slate-50 dark:bg-zinc-900 rounded-r shadow-sm group"><div class="absolute top-2 right-2 opacity-50 hover:opacity-100 cursor-pointer text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-opacity p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50" data-note="${encodeURIComponent(cleanTarget)}" title="Open note">🔗</div><div class="embed-content">${parsedChild}</div></div>`;
    } else {
      embedHtml = `<div class="transclusion relative border-l-4 border-slate-300 dark:border-zinc-700 pl-4 py-2 pr-8 my-4 bg-slate-50 dark:bg-zinc-900 rounded-r shadow-sm group"><div class="absolute top-2 right-2 opacity-50 hover:opacity-100 cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-opacity p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800" data-note="${encodeURIComponent(cleanTarget)}" title="Click to create">🔗</div><div class="text-slate-500 dark:text-zinc-500 text-sm italic">Note "${noteTitle}" not found. Click icon to create.</div></div>`;
    }
    result = result.replace(match[0], embedHtml);
  }
  return result;
}

export async function parseMarkdownToHtml(content: string, notes: Note[] = [], depth = 0): Promise<string> {
  if (depth > 3) return `<div class="p-2 border border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-xs my-2">Error: Transclusion depth limit reached.</div>`;

  // Strip YAML frontmatter before parsing markdown
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
  content = content.replace(frontmatterRegex, "");
  content = content.replace(/%%([\s\S]*?)%%/g, '<!--$1-->');

  // Handle transclusions: ![[Note Title]] or ![[Note Title#^block-id]] or ![[Note Title#Heading]]
  content = await transclude(content, notes, depth);

  // Pre-process :::test blocks
  const tests: string[] = [];
  content = content.replace(/^:::test\s*\n([\s\S]*?)\n:::$/gm, (match, inner) => {
    tests.push(inner);
    return `\n\n@@TEST_BLOCK_${tests.length - 1}@@\n\n`;
  });

  // Parse standard Markdown
  let parsed = await marked.parse(content, { breaks: true, gfm: true });

  // Post-process :::test blocks
  for (let i = 0; i < tests.length; i++) {
    const innerHtml = await marked.parse(tests[i], { breaks: true, gfm: true });
    const decoratedHtml = `<div class="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-xl border-2 border-indigo-200 dark:border-indigo-800/50 my-6 shadow-sm"><div class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1"><span class="text-base">📋</span> Quiz / Test</div><div class="test-content space-y-2">${innerHtml}</div></div>`;
    parsed = parsed.replace(`<p>@@TEST_BLOCK_${i}@@</p>`, decoratedHtml).replace(`@@TEST_BLOCK_${i}@@`, decoratedHtml);
  }
  
  // Replace Flashcards (Question :: Answer or Question ::: Answer)
  parsed = parsed.replace(/<p>(.+?)\s+(::|:::)\s+(.+?)<\/p>/g, (match, q, sep, a) => {
    return `<p>${q} <span class="text-indigo-400 dark:text-indigo-600 font-bold mx-1">${sep}</span> <span class="group relative inline-flex min-w-[2rem] bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-sm border-b-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap">${a}</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">...</span></span></p>`;
  });

  // Replace Multi-line Flashcards (?)
  const renderMultiline = (q: string, a: string) => `<div class="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded my-4 border border-indigo-100 dark:border-indigo-800/50"><div class="font-semibold text-slate-800 dark:text-zinc-200 mb-2">${q}</div><div class="group relative inline-flex w-full bg-amber-100 dark:bg-amber-900/40 p-2 rounded border-l-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap w-full">${a}</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-sm font-bold tracking-widest">Наведите для ответа...</span></div></div>`;
  
  parsed = parsed.replace(/<p>([\s\S]+?)<\/p>\s*<p>\?<\/p>\s*<p>([\s\S]+?)<\/p>/g, (match, q, a) => renderMultiline(q, a));
  parsed = parsed.replace(/<p>([\s\S]+?)<br>\?<br>([\s\S]+?)<\/p>/g, (match, q, a) => renderMultiline(q, a));

  // Replace Type-In Deletions ({{type:cloze}})
  parsed = parsed.replace(/\{\{type:(.*?)\}\}/g, (match, text) => {
    return `<span class="group relative inline-flex min-w-[2rem] bg-indigo-100 dark:bg-indigo-900/40 px-1.5 rounded-sm border-b-2 border-indigo-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-indigo-800 dark:text-indigo-300 whitespace-pre-wrap">✏️ ${text}</span><span class="absolute inset-0 flex items-center justify-center text-indigo-600 dark:text-indigo-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">✏️ ...</span></span>`;
  });

  // Replace Cloze Deletions ({{cloze}} and ==cloze==)
  parsed = parsed.replace(/\{\{(.*?)\}\}|==(.*?)==/g, (match, cloze1, cloze2) => {
    const text = cloze1 || cloze2;
    return `<span class="group relative inline-flex min-w-[2rem] bg-amber-100 dark:bg-amber-900/40 px-1.5 rounded-sm border-b-2 border-amber-500 font-medium cursor-help transition-all duration-200"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-amber-800 dark:text-amber-300 whitespace-pre-wrap">${text}</span><span class="absolute inset-0 flex items-center justify-center text-amber-600 dark:text-amber-500 group-hover:opacity-0 transition-opacity duration-200 text-xs font-bold tracking-widest">...</span></span>`;
  });

  // Replace tags: #word with special statuses
  const tagRegex = /(^|\s|>)(#[\p{L}\p{N}_\-\/]+)/gu;
  parsed = parsed.replace(tagRegex, (_, prefix, tag) => {
    const t = tag.toLowerCase();
    if (t === '#seed') {
      return `${prefix}<span class="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-bold mx-0.5 inline-flex items-center gap-1 shadow-sm border border-emerald-200 dark:border-emerald-800/50">🌱 Seed</span>`;
    } else if (t === '#incubator') {
      return `${prefix}<span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md text-xs font-bold mx-0.5 inline-flex items-center gap-1 shadow-sm border border-amber-200 dark:border-amber-800/50">🐣 Incubator</span>`;
    } else if (t === '#evergreen') {
      return `${prefix}<span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-md text-xs font-bold mx-0.5 inline-flex items-center gap-1 shadow-sm border border-green-200 dark:border-green-800/50">🌲 Evergreen</span>`;
    }
    return `${prefix}<span class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-md text-xs font-medium mx-0.5 inline-block">${tag}</span>`;
  });

  // Replace block identifiers (e.g. ^block-id) at the end of HTML block elements
  parsed = parsed.replace(/(\^[\w\-]+)(?=\s*<\/p>|\s*<\/li>|\s*<\/div>|\s*$)/g, '<span class="block-id font-mono text-[10px] text-violet-500 opacity-60 ml-2 select-none font-bold bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-200/50 dark:border-violet-800/30">$1</span>');

  // Replace [[type:Note Title]] or [[Note Title|Custom Label]]
  const wikilinkRegex = /\[\[(?:([^\]|:]+):)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  return parsed.replace(wikilinkRegex, (_, typeMatch, target, label) => {
    const cleanTarget = target.trim();
    const displayLabel = label ? label.trim() : cleanTarget;
    const typeBadge = typeMatch ? `<span class="font-bold text-rose-600 dark:text-rose-400 mr-1">${typeMatch.trim()}:</span>` : "";
    return `${typeBadge}<span data-note="${encodeURIComponent(cleanTarget)}" class="wikilink cursor-pointer text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 hover:underline font-semibold border-b border-dashed border-violet-400 transition-colors">${displayLabel}</span>`;
  });
}

export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
  const match = content.match(frontmatterRegex);
  if (match) {
    return {
      frontmatter: match[1],
      body: content.replace(frontmatterRegex, "")
    };
  }
  return { frontmatter: "", body: content };
}

export function parseYamlMetadata(yamlText: string): Record<string, string | string[]> {
  const lines = yamlText.split("\n");
  const result: Record<string, string | string[]> = {};

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.substring(0, idx).trim().toLowerCase();
    const rawVal = line.substring(idx + 1).trim();

    if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
      const items = rawVal
        .substring(1, rawVal.length - 1)
        .split(",")
        .map(s => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      result[key] = items;
    } else {
      result[key] = rawVal.replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

export function updateYamlMetadata(content: string, updates: Record<string, any>): string {
  const { frontmatter, body } = splitFrontmatter(content);
  if (!frontmatter) {
    const yamlLines = Object.entries(updates).map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}: [${v.join(", ")}]`;
      }
      return `${k}: ${v}`;
    });
    return `---\n${yamlLines.join("\n")}\n---\n${body}`;
  }

  const lines = frontmatter.split("\n");
  const newLines = [...lines];

  Object.entries(updates).forEach(([key, val]) => {
    const keyLower = key.toLowerCase();
    const existingIdx = lines.findIndex(l => {
      const cIdx = l.indexOf(":");
      return cIdx > -1 && l.substring(0, cIdx).trim().toLowerCase() === keyLower;
    });

    const formattedVal = Array.isArray(val) ? `[${val.join(", ")}]` : val;
    const newLine = `${key}: ${formattedVal}`;

    if (existingIdx > -1) {
      newLines[existingIdx] = newLine;
    } else {
      newLines.push(newLine);
    }
  });

  return `---\n${newLines.join("\n")}\n---\n${body}`;
}

export function replacePlaintextInMarkdown(markdown: string, plainText: string, replacement: string): string {
  const target = plainText.trim();
  if (!target) return markdown;

  const literalIdx = markdown.indexOf(target);
  if (literalIdx > -1) {
    return markdown.substring(0, literalIdx) + replacement + markdown.substring(literalIdx + target.length);
  }

  const words = target.split(/\s+/).map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  if (words.length === 0) return markdown;
  
  const regexStr = words.join('(?:\\s*|[*_`[\\]{}!\\s]+)*');
  try {
    const regex = new RegExp(regexStr, 'i');
    const match = markdown.match(regex);
    if (match && match.index !== undefined) {
      return markdown.substring(0, match.index) + replacement + markdown.substring(match.index + match[0].length);
    }
  } catch (e) {
    console.error("Fuzzy replacement failed", e);
  }
  
  return markdown.replace(target, replacement);
}

export function updateLinksInContent(content: string, oldTitle: string, newTitle: string, keepAsAlias: boolean): string {
  const oldTitleLower = oldTitle.trim().toLowerCase();
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  
  return content.replace(wikilinkRegex, (match, targetAndHash, existingAlias) => {
    const hashIdx = targetAndHash.indexOf("#");
    let target = targetAndHash;
    let hash = "";
    if (hashIdx > -1) {
      target = targetAndHash.substring(0, hashIdx);
      hash = targetAndHash.substring(hashIdx);
    }
    
    if (target.trim().toLowerCase() === oldTitleLower) {
      const finalTarget = `${newTitle}${hash}`;
      
      if (existingAlias !== undefined) {
        return `[[${finalTarget}|${existingAlias}]]`;
      }
      
      if (keepAsAlias) {
        return `[[${finalTarget}|${targetAndHash}]]`;
      }
      
      return `[[${finalTarget}]]`;
    }
    return match;
  });
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function render(content: string, notes: Note[] = []): Promise<string> {
  return parseMarkdownToHtml(content, notes);
}

export async function parse(content: string, notes: Note[] = []): Promise<string> {
  return parseMarkdownToHtml(content, notes);
}

export function resolveWikiLinks(content: string): ExtractedLink[] {
  return extractWikilinks(content);
}

export async function transclusion(content: string, notes: Note[] = []): Promise<string> {
  return transclude(content, notes);
}

export function backlinks(noteId: string, noteTitle: string, allNotes: Note[]): Note[] {
  const currentTitleLower = noteTitle.toLowerCase();
  return allNotes.filter(n => {
    if (n.id === noteId) return false;
    const nLinks = extractWikilinks(n.content).map(l => l.target.toLowerCase());
    return nLinks.includes(currentTitleLower);
  });
}

export interface TocHeading {
  text: string;
  level: number;
  id: string;
}

export function toc(content: string): TocHeading[] {
  const { body } = splitFrontmatter(content);
  const regex = /^(#+)\s+(.+)$/gm;
  const headings: TocHeading[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    const text = match[2].trim();
    headings.push({
      level: match[1].length,
      text: text,
      id: text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
    });
  }
  return headings;
}

export const MarkdownService = {
  extractWikilinks,
  parseMarkdownToHtml,
  splitFrontmatter,
  parseYamlMetadata,
  updateYamlMetadata,
  replacePlaintextInMarkdown,
  updateLinksInContent,
  escapeRegExp,
  render,
  parse,
  resolveWikiLinks,
  transclusion,
  backlinks,
  toc
};
