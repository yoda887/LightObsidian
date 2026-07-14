import React from 'react';
import { Note } from '../../../shared/types/types';
import { FileText, X } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Note[];
  onSelectTemplate: (content: string) => void;
}

export default function TemplateModal({ isOpen, onClose, templates, onSelectTemplate }: TemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Insert Template
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-zinc-500 italic">
              No templates found. Create notes in a "Templates" folder to see them here.
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelectTemplate(template.content);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group"
                >
                  <div className="font-medium text-slate-800 dark:text-zinc-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                    {template.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-500 mt-1 truncate">
                    {template.content.slice(0, 80).replace(/\n/g, ' ')}...
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
