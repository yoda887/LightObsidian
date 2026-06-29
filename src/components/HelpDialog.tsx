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
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Typed Link:</span><code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">[[Supports:Another Note]]</code></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Embed/Transclusion (displays the content of another note inside this one):</span><code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">![[Note to Embed]]</code></div>
              </div>
              <p className="text-xs text-slate-500">If the linked note doesn't exist yet, clicking the link in Preview mode will prompt you to create it!</p>
            </div>
          </section>

          {/* Flashcards & Tests */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-slate-400" />
              Flashcards & Tests
            </h3>
            <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-4">
              <div>
                <strong className="text-slate-800 dark:text-zinc-200 block mb-1">1. Standard Flashcards (Вопрос-Ответ)</strong>
                <p className="mb-2">Create standard question-answer pairs using the double-colon syntax.</p>
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                  <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">What is the capital of France? :: Paris</code>
                </div>
              </div>

              <div>
                <strong className="text-slate-800 dark:text-zinc-200 block mb-1">2. Cloze Deletions (Заполнение пропусков)</strong>
                <p className="mb-2">Hide specific words in a sentence by wrapping them in double curly braces. During review, you'll be asked to recall the hidden word.</p>
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                  <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400">The capital of France is {"{{Paris}}"}.</code>
                </div>
              </div>
              
              <div>
                <strong className="text-slate-800 dark:text-zinc-200 block mb-1">3. Multiple Choice Tests (Тесты)</strong>
                <p className="mb-2">Create interactive tests by wrapping a question and a checklist inside a <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">:::test</code> block. Mark the correct answer with an <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">[x]</code>.</p>
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800">
                  <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block">:::test</code>
                  <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block">What is incremental reading?</code>
                  <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block">- [ ] Reading faster</code>
                  <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block">- [x] Spaced repetition for text</code>
                  <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block">:::</code>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-6">Click the Brain icon in the top right to start reviewing due cards and tests. They are automatically scheduled based on how well you remember them.</p>
            </div>
          </section>

          {/* Incremental Reading */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Book className="w-4 h-4 text-slate-400" />
              Incremental Reading
            </h3>
            <div className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
              <p>Process large articles, books, or notes in scheduled, bite-sized intervals to maximize retention and prevent cognitive overload.</p>
              <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block mb-0.5">1. Reading Queue</strong>
                  <span>Add any note to the queue via the **Reading List** tab in the right sidebar. Due notes are sorted by priority.</span>
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block mb-0.5">2. Rescheduling Panel</strong>
                  <span>Grade the complexity and priority of your reading sessions (Soon, Good, Easy, Done) to schedule next review.</span>
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block mb-0.5">3. Caret Memory</strong>
                  <span>The editor automatically remembers your exact cursor position and restores it next time you open the note from the queue.</span>
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block mb-0.5">4. Extracts</strong>
                  <span>Select any text and click **Extract** in the tooltip to split off a sub-article. It replaces the text with a transclusion link <code className="font-mono text-indigo-600 dark:text-indigo-400">![[Extract: ...]]</code> and schedules the extract as a new item.</span>
                </div>
                
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <strong className="text-slate-800 dark:text-zinc-200 block mb-1 text-[11px] uppercase tracking-wider">How to Grade Readings</strong>
                  <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-zinc-400">
                    <li><strong>Soon (Hard):</strong> Complex text, distracted reading, or urgent info. Schedules review for tomorrow.</li>
                    <li><strong>Later (Good):</strong> Standard reading. You understand it and want to read the next chunk in due course.</li>
                    <li><strong>Easy:</strong> Simple, already known, or low priority text. Pushes review far into the future.</li>
                    <li><strong>Finish (Done):</strong> Read complete, fully processed, or converted to active recall cards. Removes from queue.</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <strong className="text-slate-800 dark:text-zinc-200 block mb-1 text-[11px] uppercase tracking-wider">Core Workflow Loop</strong>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-500 dark:text-zinc-400">
                    <li>Read a long note in 5-10 minute bursts.</li>
                    <li>Highlight key concepts and click <strong>Extract</strong> to split them off.</li>
                    <li>Reschedule the main note (Good or Easy) to clear your queue.</li>
                    <li>Later, open the Extract note and add clozes (<code className="font-mono text-[10px]">{"{{cloze}}"}</code>) or flashcards (<code className="font-mono text-[10px]">Q :: A</code>) to commit it to active memory.</li>
                  </ol>
                </div>
              </div>
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
