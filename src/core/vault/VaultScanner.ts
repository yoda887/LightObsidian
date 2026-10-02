import { Note } from "../../shared/types/types";

/**
 * Walks a vault directory and turns every markdown file into a Note stub (or a
 * reused full note when it is unchanged).
 *
 * On a high-latency drive the cost is round trips, not bytes, so the walk is
 * built to keep many of them in flight: each directory is listed once (it used
 * to be listed twice, once to count files and once to read them) and the
 * per-file getFile() calls run through a bounded pool instead of one by one.
 * The resulting order of notes and folders is the same as a sequential walk.
 */

export interface ScanContext {
  /** Notes currently in memory, keyed by id. Win over the cache. */
  existingNotes: Map<string, Note>;
  /** Notes cached in IndexedDB by an earlier sync, keyed by id. */
  cachedNotes: Map<string, Note>;
  currentNoteId: string;
  isPendingDeletion: (id: string) => boolean;
  isPendingWrite: (id: string) => boolean;
  /** Called once the tree is listed, with the number of files to read. */
  onListed?: (total: number) => void;
  /** Called as files are read. Can be called very often; throttle in the UI. */
  onProgress?: (done: number, total: number) => void;
  /** Concurrent directory listings. */
  dirConcurrency?: number;
  /** Concurrent getFile() calls. */
  fileConcurrency?: number;
}

export interface ScanResult {
  notes: Note[];
  folders: string[];
  total: number;
}

type Item =
  | { kind: "file"; id: string; entry: any }
  | { kind: "dir"; path: string; listing: Listing };

interface Listing {
  items: Item[];
}

/** At most `max` calls to the returned function run at once; the rest queue. */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active < max) {
      active++;
    } else {
      // A finishing task hands its slot straight to us, so `active` never
      // dips below the real number of running tasks.
      await new Promise<void>(resolve => waiting.push(resolve));
    }
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

const isHiddenDir = (name: string) => name.startsWith(".") || name === "node_modules";

function countFiles(listing: Listing): number {
  let n = 0;
  for (const item of listing.items) {
    n += item.kind === "file" ? 1 : countFiles(item.listing);
  }
  return n;
}

export async function scanVault(root: any, ctx: ScanContext): Promise<ScanResult> {
  const listDir = createLimiter(ctx.dirConcurrency ?? 4);
  const readFile = createLimiter(ctx.fileConcurrency ?? 16);

  // ---- 1. List the whole tree once. -------------------------------------
  const list = async (dirHandle: any, path: string): Promise<Listing> => {
    // The slot is released as soon as this directory's own entries are in
    // hand, so waiting on children below can never deadlock the pool.
    const entries: any[] = await listDir(async () => {
      const all: any[] = [];
      for await (const entry of dirHandle.values()) all.push(entry);
      return all;
    });

    const items: Item[] = [];
    const children: Array<Promise<void>> = [];
    for (const entry of entries) {
      if (entry.kind === "file" && entry.name.endsWith(".md")) {
        items.push({ kind: "file", id: path ? `${path}/${entry.name}` : entry.name, entry });
      } else if (entry.kind === "directory") {
        if (isHiddenDir(entry.name)) continue;
        const subPath = path ? `${path}/${entry.name}` : entry.name;
        // Placeholder keeps the entry in its listing position; filled in below.
        const item = { kind: "dir", path: subPath, listing: { items: [] } as Listing } as Item & { kind: "dir" };
        items.push(item);
        children.push(list(entry, subPath).then(sub => { item.listing = sub; }));
      }
    }
    await Promise.all(children);
    return { items };
  };

  const tree = await list(root, "");
  const total = countFiles(tree);
  ctx.onListed?.(total);

  // ---- 2. Read file metadata through a bounded pool. --------------------
  let done = 0;

  const visit = (listing: Listing): Promise<ScanResult> => {
    // One slot per entry, in listing order, so output order matches a
    // sequential walk no matter which request finishes first.
    const slots = listing.items.map((item): Promise<ScanResult> => {
      if (item.kind === "dir") {
        return visit(item.listing).then(sub => ({
          notes: sub.notes,
          folders: [item.path, ...sub.folders],
          total: 0,
        }));
      }
      return readFile(() => readNote(item))
        .finally(() => {
          done++;
          ctx.onProgress?.(done, total);
        })
        .then(note => ({
          notes: note ? [note] : [],
          folders: [],
          total: 0,
        }));
    });

    return Promise.all(slots).then(parts => ({
      notes: parts.flatMap(p => p.notes),
      folders: parts.flatMap(p => p.folders),
      total: 0,
    }));
  };

  const readNote = async (item: { id: string; entry: any }): Promise<Note | null> => {
    const { id, entry } = item;

    if (ctx.isPendingDeletion(id)) {
      return null;
    }

    try {
      const file = await entry.getFile();
      const statDate = new Date(file.lastModified).toISOString();
      const slash = id.lastIndexOf("/");
      const path = slash === -1 ? "" : id.substring(0, slash);

      const existing = ctx.existingNotes.get(id);
      const isPendingWrite = ctx.isPendingWrite(id);
      const isCurrentNote = id === ctx.currentNoteId; // being edited right now

      if (existing) {
        const existingTime = new Date(existing.updatedAt).getTime();
        // Pending write, the open note, or a disk file that is not newer:
        // keep the in-memory version.
        if (isPendingWrite || isCurrentNote || existingTime >= file.lastModified || existing.updatedAt === statDate) {
          return { ...existing, isLoaded: true };
        }
      }

      // Notes cached in IndexedDB by an earlier sync. Only an exact match
      // with the file's mtime is trusted: sync stores updatedAt = mtime,
      // while notes from non-vault mode (or edited since) carry another
      // timestamp and must not shadow what is on disk.
      const cached = existing ? undefined : ctx.cachedNotes.get(id);
      if (cached && cached.isLoaded !== false && cached.updatedAt === statDate) {
        return { ...cached, isLoaded: true };
      }

      return {
        id,
        title: entry.name.replace(".md", ""),
        content: "", // Empty stub
        createdAt: (existing ?? cached)?.createdAt ?? statDate,
        updatedAt: statDate,
        path,
        isLoaded: false, // Needs content download
      };
    } catch (e) {
      console.error("Error reading file", entry.name, e);
      return null;
    }
  };

  const result = await visit(tree);
  return { notes: result.notes, folders: result.folders, total };
}
