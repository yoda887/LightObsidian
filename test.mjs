import { readFileSync } from 'fs';
import { marked } from 'marked';

async function test() {
  let content = "Test [[Link]] \n\n![[Link]] \n\n#hello";
  
  content = content.replace(/\^([a-zA-Z0-9\-]+)$/gm, '<a id="$1" class="block-anchor"></a>');

  const transclusions = Array.from(content.matchAll(/!\[\[([^\]#|]+)(?:#\^([^\]|]+))?(?:\|([^\]]+))?\]\]/g));
  console.log("Transclusions:", transclusions);
  
  let parsed = await marked.parse(content, { breaks: true, gfm: true });
  console.log("Parsed:", parsed);
}

test().catch(console.error);
