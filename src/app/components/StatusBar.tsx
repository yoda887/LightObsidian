import React from "react";

interface StatusBarProps {
  vaultHandle: any;
  isVaultSaving: boolean;
  isVaultLoading: boolean;
  wordCount: number;
  charCount: number;
}

export default function StatusBar({
  vaultHandle,
  isVaultSaving,
  isVaultLoading,
  wordCount,
  charCount,
}: StatusBarProps) {
  return (
    <div className="h-6 shrink-0 bg-slate-100 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between px-3 text-[10px] text-slate-500 dark:text-zinc-400 font-medium select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${vaultHandle ? 'bg-emerald-500' : 'bg-amber-500'} ${(isVaultSaving || isVaultLoading) ? 'animate-ping' : 'animate-pulse'}`}></div>
          {vaultHandle ? (
             isVaultSaving ? 'ЗАПИСЬ НА ДИСК...' :
             isVaultLoading ? 'ЧТЕНИЕ ДАННЫХ...' :
             'CONNECTED: FOLDER VAULT'
          ) : 'CONNECTED: LOCAL-CACHE'}
        </div>
        <div className="opacity-50">UTF-8</div>
      </div>
      <div className="flex items-center gap-4">
        <div>{wordCount} WORDS</div>
        <div>{charCount} CHARACTERS</div>
        <div className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Markdown</div>
      </div>
    </div>
  );
}
