import React from 'react';
import { X, Link, CheckSquare, Square } from 'lucide-react';

interface RenameLinksModalProps {
  isOpen: boolean;
  oldTitle: string;
  newTitle: string;
  linkedNotesCount: number;
  onConfirm: (updateLinks: boolean, keepAsAlias: boolean) => void;
  onCancel: () => void;
}

export default function RenameLinksModal({ isOpen, oldTitle, newTitle, linkedNotesCount, onConfirm, onCancel }: RenameLinksModalProps) {
  const [updateLinks, setUpdateLinks] = React.useState(true);
  const [keepAsAlias, setKeepAsAlias] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 font-semibold">
            <Link className="w-4 h-4 text-indigo-500" />
            Update Links?
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4 text-sm text-slate-600 dark:text-zinc-400">
          <p>
            You are renaming <strong>"{oldTitle}"</strong> to <strong>"{newTitle}"</strong>.
          </p>
          <p>
            There are <strong>{linkedNotesCount}</strong> notes that link to this file. Would you like to update them automatically?
          </p>
          
          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
              <input type="radio" className="mt-0.5" checked={updateLinks} onChange={() => setUpdateLinks(true)} />
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">Update Links</div>
                <div className="text-xs text-slate-500 mt-1">
                  Change occurrences of <code>[[{oldTitle}]]</code> to <code>[[{newTitle}]]</code>.
                </div>
              </div>
            </label>
            
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
              <input type="radio" className="mt-0.5" checked={!updateLinks} onChange={() => { setUpdateLinks(false); setKeepAsAlias(false); }} />
              <div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">Don't Update</div>
                <div className="text-xs text-slate-500 mt-1">Leave existing links unchanged (they will become broken).</div>
              </div>
            </label>
          </div>

          {updateLinks && (
            <label className="flex items-center gap-2 mt-4 ml-1 cursor-pointer group select-none">
              <div onClick={() => setKeepAsAlias(!keepAsAlias)} className="text-indigo-500">
                {keepAsAlias ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              </div>
              <span onClick={() => setKeepAsAlias(!keepAsAlias)} className="font-medium text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Keep original name as alias
              </span>
            </label>
          )}
          {updateLinks && keepAsAlias && (
            <p className="text-xs text-slate-500 dark:text-zinc-500 italic ml-8">
              e.g. <code>[[{newTitle}|{oldTitle}]]</code>
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel Rename
          </button>
          <button 
            onClick={() => onConfirm(updateLinks, keepAsAlias)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg shadow-sm transition-all active:scale-95"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
