import { X, Book, Hash, Link as LinkIcon, Brain, Zap } from "lucide-react";

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <Book className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-200">Help & Documentation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          
          {/* Markdown Syntax */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Hash className="w-4 h-4 text-slate-400" />
              Markdown Syntax
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-zinc-400">
              {/* Headings */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Headings</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1"># Heading 1</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">## Heading 2</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">### Heading 3</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">#### Heading 4</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">##### Heading 5</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">###### Heading 6</code>
              </div>

              {/* Text Styling */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Text Styling</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">**Bold Text**</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">*Italic Text*</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">~~Strikethrough~~</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">--- (Horizontal Rule)</code>
              </div>

              {/* Lists */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Lists</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">- Bullet List Item</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">1. Numbered List Item</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">- [ ] Uncompleted Task</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">- [x] Completed Task</code>
              </div>

              {/* Quotes & Code */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Quotes & Code</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">&gt; Blockquote</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">`Inline Code`</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">```js</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">console.log("Code Block");</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">```</code>
              </div>

              {/* Links & Media */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Links & Media</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">[Google](https://google.com)</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">![Alt Text](Image URL)</code>
              </div>

              {/* Tables */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Tables</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">| Header 1 | Header 2 |</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">|----------|----------|</code>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block mb-1">| Cell 1   | Cell 2   |</code>
              </div>
            </div>
          </section>

          {/* Tags & Statuses */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Hash className="w-4 h-4 text-slate-400" />
              Tags & Statuses
            </h3>
            <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
              <p>Use <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">#tagname</code> to organize notes. There are three special status tags with unique styling:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-bold inline-flex items-center gap-1 shadow-sm border border-emerald-200 dark:border-emerald-800/50">🌱 #seed</span>
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md text-xs font-bold inline-flex items-center gap-1 shadow-sm border border-amber-200 dark:border-amber-800/50">🐣 #incubator</span>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-md text-xs font-bold inline-flex items-center gap-1 shadow-sm border border-green-200 dark:border-green-800/50">🌲 #evergreen</span>
              </div>
            </div>
          </section>

          {/* Wikilinks */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-slate-400" />
              Wikilinks & Embeds
            </h3>
            <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
              <p>Connect your notes together by typing their title surrounded by double square brackets.</p>
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800 space-y-1.5">
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Basic Link:</span><code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">[[My Other Note]]</code></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Link with Custom Alias:</span><code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">[[Note Title|Click Here]]</code></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Typed Link (creates a red badge):</span><code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">[[Supports::Another Note]]</code></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Embed/Transclusion (displays the content of another note inside this one):</span><code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">![[Note to Embed]]</code></div>
              </div>
              <p className="text-xs text-slate-500">If the linked note doesn't exist yet, clicking the link in Preview mode will prompt you to create it!</p>
            </div>
          </section>

          {/* Flashcards */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-slate-400" />
              Flashcards & Spaced Repetition
            </h3>
            <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
              <p>Create flashcards directly in your notes using the double-colon syntax. They will be automatically scheduled for review based on how well you remember them.</p>
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">What is the capital of France? :: Paris</code>
              </div>
              <p className="text-xs text-slate-500">Click the Brain icon in the top right to start reviewing due cards.</p>
            </div>
          </section>

          {/* Editor Modes */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-400" />
              Editor Modes
            </h3>
            <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-3">
              <li><strong className="text-slate-800 dark:text-zinc-200">Source:</strong> Raw markdown editor.</li>
              <li><strong className="text-slate-800 dark:text-zinc-200">Dynamic:</strong> Auto-formats markdown as you type for a seamless WYSIWYG-like experience.</li>
              <li><strong className="text-slate-800 dark:text-zinc-200">Preview:</strong> Read-only rendered view of your note.</li>
              <li><strong className="text-slate-800 dark:text-zinc-200">Split:</strong> Source editor and live preview side-by-side.</li>
              <li><strong className="text-slate-800 dark:text-zinc-200">Graph Map:</strong> Visual network representation of how your notes are linked together.</li>
              <li><strong className="text-slate-800 dark:text-zinc-200">Timeline:</strong> A chronological view of your notes.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
