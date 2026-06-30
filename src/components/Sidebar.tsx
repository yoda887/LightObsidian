/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Note } from "../types";
//import { Search, Plus, Trash2, BookOpen, Download, ChevronRight, ChevronDown, FileEdit, FolderPlus, Calendar, Dices, ArrowDownAZ, ArrowDownZA, Clock } from "lucide-react";
import { Search, Plus, Trash2, BookOpen, Download, ChevronRight, ChevronDown, FileEdit, FolderPlus, Calendar, Dices, ArrowDownAZ, ArrowDownZA, Clock, AlertTriangle } from "lucide-react";

interface SidebarProps {
  notes: Note[];
  folders?: string[];
  currentNoteId: string;
  onSelectNote: (id: string) => void;
  onCreateNote: (title?: string) => void;
  onDeleteNote: (id: string) => void;
  onExportHtml: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenVault?: () => void;
  vaultName?: string;
  onOpenDailyNote: () => void;
  onOpenRandomNote: () => void;
  vaultName?: string;
  isVaultPending?: boolean;
  onRestoreVaultAccess?: () => void;
  onOpenDailyNote: () => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  note?: Note;
}

const buildFileTree = (notes: Note[], folders: string[] = [], searchQuery: string, sortOrder: string): TreeNode[] => {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  const ensureFolder = (folderPath: string) => {
    const parts = folderPath.split('/');
    let currentList = root;
    let currentPath = "";

    parts.forEach(part => {
      if (!part) return;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!folderMap.has(currentPath)) {
        const newFolder: TreeNode = {
          name: part,
          path: currentPath,
          isFolder: true,
          children: []
        };
        folderMap.set(currentPath, newFolder);
        currentList.push(newFolder);
      }
      currentList = folderMap.get(currentPath)!.children;
    });
    return currentList;
  };

  // 1. Add all known empty folders
  folders.forEach(f => ensureFolder(f));

  // 2. Add files
  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  filteredNotes.forEach(note => {
    let currentList = root;
    if (note.path) {
      currentList = ensureFolder(note.path);
    }
    currentList.push({
      name: note.title || "Untitled Note",
      path: note.id,
      isFolder: false,
      children: [],
      note: note
    });
  });

  const filterTree = (nodes: TreeNode[]): TreeNode[] => {
    if (!searchQuery) return nodes;
    return nodes.filter(node => {
      if (!node.isFolder) return true;
      const children = filterTree(node.children);
      node.children = children;
      return children.length > 0 || node.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder === b.isFolder) {
        if (sortOrder === "name_asc") {
          return a.name.localeCompare(b.name);
        } else if (sortOrder === "name_desc") {
          return b.name.localeCompare(a.name);
        } else if (sortOrder === "created_desc") {
          const aTime = a.note ? new Date(a.note.createdAt).getTime() : 0;
          const bTime = b.note ? new Date(b.note.createdAt).getTime() : 0;
          return bTime - aTime;
        } else if (sortOrder === "modified_desc") {
          const aTime = a.note ? new Date(a.note.updatedAt).getTime() : 0;
          const bTime = b.note ? new Date(b.note.updatedAt).getTime() : 0;
          return bTime - aTime;
        }
        return a.name.localeCompare(b.name);
      }
      return a.isFolder ? -1 : 1;
    });
    nodes.forEach(n => {
      if (n.isFolder) sortTree(n.children);
    });
  };

  const filteredTree = filterTree(root);
  sortTree(filteredTree);
  return filteredTree;
};

const FileTreeNodeComponent = ({
  node,
  depth,
  currentNoteId,
  onSelectNote,
  onDeleteNote,
  searchActive
}: {
  key?: string;
  node: TreeNode;
  depth: number;
  currentNoteId: string;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  searchActive: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = searchActive ? true : isExpanded;

  if (node.isFolder) {
    return (
      <div className="select-none">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(prev => !prev);
          }}
          className="flex items-center px-2 py-1 rounded text-xs cursor-pointer text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/40"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="mr-1 opacity-50">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span className="font-semibold truncate">{node.name}</span>
        </div>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeNodeComponent
                key={child.isFolder ? `folder-${child.path}` : child.note!.id}
                node={child}
                depth={depth + 1}
                currentNoteId={currentNoteId}
                onSelectNote={onSelectNote}
                onDeleteNote={onDeleteNote}
                searchActive={searchActive}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = node.note!.id === currentNoteId;
  return (
    <div
      onClick={() => onSelectNote(node.note!.id)}
      className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer group transition-all duration-150 ${isActive
          ? "bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium"
          : "hover:bg-slate-100 dark:hover:bg-zinc-800/40 text-slate-600 dark:text-zinc-400"
        }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="truncate flex-1 pr-2 pl-4">{node.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteNote(node.note!.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all cursor-pointer"
        title="Delete note"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default function Sidebar({
  notes,
  folders = [],
  currentNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onExportHtml,
  darkMode,
  onToggleTheme,
  onOpenVault,
  vaultName,
  isVaultPending,
  onRestoreVaultAccess,
  onOpenDailyNote,
  onOpenRandomNote
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"name_asc" | "name_desc" | "created_desc" | "modified_desc">(
    () => (localStorage.getItem("lite_obsidian_sort_order") as any) || "created_desc"
  );

  const treeRoot = buildFileTree(notes, folders, searchQuery, sortOrder);

  const handleSortChange = (newOrder: typeof sortOrder) => {
    setSortOrder(newOrder);
    localStorage.setItem("lite_obsidian_sort_order", newOrder);
    setIsSortOpen(false);
  };

  return (
    <aside className="w-64 bg-slate-50 dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 flex flex-col shrink-0 h-full">
      {/* Search Input Box */}
      <div className={`px-4 border-b border-slate-200 dark:border-zinc-800/80 flex flex-col justify-center ${isSearchOpen ? 'py-2 space-y-2' : 'h-10'}`}>
        {/* Workspace Toolbar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) setSearchQuery("");
            }}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isSearchOpen 
                ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20" 
                : "text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
            }`}
            title="Search Notes"
          >
            <Search className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-0.5 relative">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isSortOpen 
                  ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20" 
                  : "text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
              }`}
              title="Sort Notes"
            >
              {sortOrder === "name_asc" && <ArrowDownAZ className="w-4 h-4" />}
              {sortOrder === "name_desc" && <ArrowDownZA className="w-4 h-4" />}
              {(sortOrder === "created_desc" || sortOrder === "modified_desc") && <Clock className="w-4 h-4" />}
            </button>
            
            {isSortOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md shadow-lg z-50 py-1 text-sm">
                <button
                  onClick={() => handleSortChange("name_asc")}
                  className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-zinc-800 ${sortOrder === "name_asc" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-300"}`}
                >
                  <ArrowDownAZ className="w-4 h-4" /> <span>File name (A to Z)</span>
                </button>
                <button
                  onClick={() => handleSortChange("name_desc")}
                  className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-zinc-800 ${sortOrder === "name_desc" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-300"}`}
                >
                  <ArrowDownZA className="w-4 h-4" /> <span>File name (Z to A)</span>
                </button>
                <button
                  onClick={() => handleSortChange("created_desc")}
                  className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-zinc-800 ${sortOrder === "created_desc" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-300"}`}
                >
                  <Clock className="w-4 h-4" /> <span>Created time (new to old)</span>
                </button>
                <button
                  onClick={() => handleSortChange("modified_desc")}
                  className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-zinc-800 ${sortOrder === "modified_desc" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-300"}`}
                >
                  <Clock className="w-4 h-4" /> <span>Modified time (new to old)</span>
                </button>
              </div>
            )}

            <button
              onClick={() => onCreateNote()}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="New Note"
            >
              <FileEdit className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenDailyNote}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Daily Note"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenRandomNote}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Random Note"
            >
              <Dices className="w-4 h-4" />
            </button>
            <button
              onClick={() => alert("Creating folders will be implemented later!")}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isSearchOpen && (
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded px-3 py-1.5 pl-8 text-xs placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100 transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        )}
      </div>

      {/* Notes List Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {treeRoot.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 dark:text-zinc-500 italic">
            No notes found
          </div>
        ) : (
          treeRoot.map((node) => (
            <FileTreeNodeComponent
              key={node.isFolder ? `folder-${node.path}` : node.note!.id}
              node={node}
              depth={0}
              currentNoteId={currentNoteId}
              onSelectNote={onSelectNote}
              onDeleteNote={onDeleteNote}
              searchActive={searchQuery.length > 0}
            />
          ))
        )}
      </div>

      {/* Vault Footer Panel */}
      <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
        {onOpenVault && (
          <div className="w-full flex items-center justify-between bg-slate-200 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors group">
            <button
              onClick={onOpenVault}
              className="flex-1 flex items-center space-x-2 px-3 py-2 text-slate-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 cursor-pointer text-left truncate rounded-l-lg outline-none"
              title="Open Local Folder (Vault)"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold truncate">
                {vaultName || "Open Vault..."}
              </span>
            </button>
            
            {isVaultPending && onRestoreVaultAccess && (
              <button
                onClick={onRestoreVaultAccess}
                className="px-3 py-2 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 cursor-pointer transition-colors rounded-r-lg"
                title="Восстановить доступ к локальной папке"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
