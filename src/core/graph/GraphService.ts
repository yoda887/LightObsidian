import { Note, GraphNode, GraphLink } from "../../shared/types/types";
import { wikilinksOf } from "../index/NoteIndex";

// Above this many notes the initial layout switches from a ring to a spiral.
const LARGE_GRAPH = 60;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Nodes further apart than this do not repel each other.
const REPEL_CUTOFF = 250;
// Repulsion is 1/d^2, so two nearly-overlapping nodes got a kick of thousands
// of px/tick and never calmed down. Below this distance the force magnitude
// stops growing (the direction stays exact). Layouts that already settle are
// unaffected: nodes rest far apart from each other.
const MIN_REPEL_DISTANCE = 10;
// Packs a (cellX, cellY) pair into one number; cellY stays well inside +-2^19.
const CELL_STRIDE = 1 << 20;

/**
 * Exact repulsion. Only nodes closer than REPEL_CUTOFF interact, so bucket
 * nodes into a grid of that cell size and compare each node with its 3x3
 * neighbourhood instead of with every other node.
 */
export function repelGrid(nodes: GraphNode[], repelForce: number, selectedNode: GraphNode | null, isDragging: boolean): void {
  // 1. Repulsion (Coulomb's law). Only nodes closer than REPEL_CUTOFF
  // interact, so bucket nodes into a grid of that cell size and compare each
  // node with its 3x3 neighbourhood instead of with every other node.
  const grid = new Map<number, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const key = Math.floor(nodes[i].x / REPEL_CUTOFF) * CELL_STRIDE + Math.floor(nodes[i].y / REPEL_CUTOFF);
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }

  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    const cx = Math.floor(n1.x / REPEL_CUTOFF);
    const cy = Math.floor(n1.y / REPEL_CUTOFF);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = grid.get((cx + ox) * CELL_STRIDE + (cy + oy));
        if (!bucket) continue;

        for (const j of bucket) {
          if (j <= i) continue; // each pair once
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.hypot(dx, dy) || 1;

          if (dist < REPEL_CUTOFF) {
            const softened = Math.max(dist, MIN_REPEL_DISTANCE);
            const force = repelForce / (softened * softened);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!isDragging || selectedNode !== n1) {
              n1.vx = (n1.vx || 0) - fx;
              n1.vy = (n1.vy || 0) - fy;
            }
            if (!isDragging || selectedNode !== n2) {
              n2.vx = (n2.vx || 0) + fx;
              n2.vy = (n2.vy || 0) + fy;
            }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Approximate repulsion for big graphs (Barnes-Hut)
//
// In a dense layout hundreds of nodes sit within REPEL_CUTOFF of each other, so
// even the grid compares every node with a few hundred neighbours. A quadtree
// lets a distant cluster stand in for all its nodes at once. The cutoff stays
// exact: a cluster entirely beyond it is skipped, one that straddles it is
// opened up, and only clusters wholly inside it are approximated.
// ---------------------------------------------------------------------------

// Above this many nodes the tree is used; smaller graphs keep exact forces.
const TREE_THRESHOLD = 800;
// A cluster of size s at distance d is approximated when s / d < THETA.
const TREE_THETA = 0.7;
const LEAF_SIZE = 8;
const MAX_TREE_DEPTH = 24;

let treeCap = 0;
let cellX = new Float64Array(0), cellY = new Float64Array(0), cellHalf = new Float64Array(0);
let cellMass = new Float64Array(0), cellComX = new Float64Array(0), cellComY = new Float64Array(0);
let cellLo = new Int32Array(0), cellHi = new Int32Array(0), cellKids = new Int32Array(0);
let order = new Int32Array(0), scratch = new Int32Array(0);
const stack = new Int32Array(4 * (MAX_TREE_DEPTH + 2));

function ensureTreeCapacity(n: number) {
  if (n <= treeCap) return;
  treeCap = Math.max(n, treeCap * 2);
  const cells = 4 * treeCap + 16;
  cellX = new Float64Array(cells); cellY = new Float64Array(cells); cellHalf = new Float64Array(cells);
  cellMass = new Float64Array(cells); cellComX = new Float64Array(cells); cellComY = new Float64Array(cells);
  cellLo = new Int32Array(cells); cellHi = new Int32Array(cells); cellKids = new Int32Array(cells * 4);
  order = new Int32Array(treeCap); scratch = new Int32Array(treeCap);
}

/** Builds the tree over order[lo..hi) and returns the id of its root cell. */
function buildCell(nodes: GraphNode[], lo: number, hi: number, cx: number, cy: number, half: number, depth: number, cells: { n: number }): number {
  const id = cells.n++;
  cellX[id] = cx; cellY[id] = cy; cellHalf[id] = half;
  let sx = 0, sy = 0;
  for (let k = lo; k < hi; k++) { const nd = nodes[order[k]]; sx += nd.x; sy += nd.y; }
  const mass = hi - lo;
  cellMass[id] = mass; cellComX[id] = sx / mass; cellComY[id] = sy / mass;
  cellKids[id * 4] = cellKids[id * 4 + 1] = cellKids[id * 4 + 2] = cellKids[id * 4 + 3] = -1;

  if (mass <= LEAF_SIZE || depth >= MAX_TREE_DEPTH) {
    cellLo[id] = lo; cellHi[id] = hi; // leaf: its nodes are order[lo..hi)
    return id;
  }
  cellLo[id] = 0; cellHi[id] = -1; // internal

  // Partition order[lo..hi) by quadrant (counting sort through `scratch`).
  const counts = [0, 0, 0, 0];
  for (let k = lo; k < hi; k++) {
    const nd = nodes[order[k]];
    counts[(nd.x >= cx ? 1 : 0) + (nd.y >= cy ? 2 : 0)]++;
  }
  const starts = [lo, lo + counts[0], lo + counts[0] + counts[1], lo + counts[0] + counts[1] + counts[2]];
  const fill = starts.slice();
  for (let k = lo; k < hi; k++) {
    const nd = nodes[order[k]];
    scratch[fill[(nd.x >= cx ? 1 : 0) + (nd.y >= cy ? 2 : 0)]++] = order[k];
  }
  for (let k = lo; k < hi; k++) order[k] = scratch[k];

  const q = half / 2;
  for (let quad = 0; quad < 4; quad++) {
    if (counts[quad] === 0) continue;
    cellKids[id * 4 + quad] = buildCell(
      nodes, starts[quad], starts[quad] + counts[quad],
      cx + (quad & 1 ? q : -q), cy + (quad & 2 ? q : -q), q, depth + 1, cells
    );
  }
  return id;
}

export function repelTree(nodes: GraphNode[], repelForce: number, selectedNode: GraphNode | null, isDragging: boolean): void {
  const n = nodes.length;
  if (n < 2) return;
  ensureTreeCapacity(n);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    order[i] = i;
    const nd = nodes[i];
    if (nd.x < minX) minX = nd.x; if (nd.x > maxX) maxX = nd.x;
    if (nd.y < minY) minY = nd.y; if (nd.y > maxY) maxY = nd.y;
  }
  const half = Math.max(maxX - minX, maxY - minY, 1) / 2 + 1e-6;
  const cells = { n: 0 };
  const root = buildCell(nodes, 0, n, (minX + maxX) / 2, (minY + maxY) / 2, half, 0, cells);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (isDragging && selectedNode === node) continue; // a dragged node is not pushed around
    const x = node.x, y = node.y;
    let fx = 0, fy = 0;

    let top = 0;
    stack[top++] = root;
    while (top > 0) {
      const c = stack[--top];

      // Distance from the node to the nearest and farthest point of the cell.
      const ax = Math.abs(x - cellX[c]), ay = Math.abs(y - cellY[c]), h = cellHalf[c];
      const nearX = Math.max(ax - h, 0), nearY = Math.max(ay - h, 0);
      if (nearX * nearX + nearY * nearY >= REPEL_CUTOFF * REPEL_CUTOFF) continue; // wholly out of range

      const isLeaf = cellHi[c] >= 0;
      if (!isLeaf) {
        const dx = cellComX[c] - x, dy = cellComY[c] - y;
        const dist = Math.hypot(dx, dy) || 1;
        if ((2 * h) / dist < TREE_THETA) {
          // Far enough to treat as one mass. Whether it is within range is
          // decided by its centre: near the cutoff each node's push is tiny
          // (600/250^2 ~ 0.01), so a cluster straddling the edge is not
          // worth opening down to single nodes.
          if (dist < REPEL_CUTOFF) {
            const softened = Math.max(dist, MIN_REPEL_DISTANCE);
            const force = (cellMass[c] * repelForce) / (softened * softened);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
          continue;
        }
      }

      if (isLeaf) {
        for (let k = cellLo[c]; k < cellHi[c]; k++) {
          const j = order[k];
          if (j === i) continue;
          const dx = nodes[j].x - x, dy = nodes[j].y - y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < REPEL_CUTOFF) {
            const softened = Math.max(dist, MIN_REPEL_DISTANCE);
            const force = repelForce / (softened * softened);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
        }
      } else {
        for (let quad = 0; quad < 4; quad++) {
          const kid = cellKids[c * 4 + quad];
          if (kid >= 0) stack[top++] = kid;
        }
      }
    }

    // Pairs push each other away: this node moves opposite to the net pull.
    node.vx = (node.vx || 0) - fx;
    node.vy = (node.vy || 0) - fy;
  }
}

export const GraphService = {
  calculateLinks(notes: Note[]): GraphLink[] {
    // Index titles once: a notes.find() per link made this O(notes * links).
    // First note wins on duplicate titles, same as find() did.
    const byTitle = new Map<string, Note>();
    for (const n of notes) {
      const key = n.title.trim().toLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, n);
    }

    const links: GraphLink[] = [];
    notes.forEach(note => {
      const outgoing = wikilinksOf(note);
      outgoing.forEach(link => {
        const targetNote = byTitle.get(link.target.toLowerCase());
        if (targetNote && targetNote.id !== note.id) {
          links.push({
            source: note.id,
            target: targetNote.id,
            type: link.type
          });
        }
      });
    });
    return links;
  },

  findBacklinks(noteId: string, links: GraphLink[]): GraphLink[] {
    return links.filter(link => link.target === noteId);
  },

  findNeighbors(noteId: string, links: GraphLink[]): string[] {
    const neighbors = new Set<string>();
    links.forEach(link => {
      if (link.source === noteId) {
        neighbors.add(link.target);
      } else if (link.target === noteId) {
        neighbors.add(link.source);
      }
    });
    return Array.from(neighbors);
  },

  buildGraph(
    notes: Note[],
    currentNoteId: string,
    canvasWidth: number,
    canvasHeight: number,
    existingNodes: GraphNode[]
  ): { nodes: GraphNode[]; links: GraphLink[] } {
    const existingMap = new Map<string, GraphNode>(existingNodes.map(n => [n.id, n]));
    
    const nodes = notes.map((note, idx) => {
      const existing = existingMap.get(note.id);
      if (existing) {
        existing.title = note.title;
        existing.isCurrent = note.id === currentNoteId;
        return existing;
      }
      
      let x: number;
      let y: number;
      if (notes.length <= LARGE_GRAPH) {
        const angle = (idx / Math.max(1, notes.length)) * Math.PI * 2;
        const radius = Math.min(canvasWidth, canvasHeight) * 0.25;
        x = canvasWidth / 2 + Math.cos(angle) * radius;
        y = canvasHeight / 2 + Math.sin(angle) * radius;
      } else {
        // A ring this big would pack thousands of nodes into the same few
        // repulsion cells. Spread them evenly over a disc that grows with
        // the vault instead (sunflower spiral).
        const radius = Math.sqrt(notes.length) * 30;
        const r = radius * Math.sqrt((idx + 0.5) / notes.length);
        const angle = idx * GOLDEN_ANGLE;
        x = canvasWidth / 2 + Math.cos(angle) * r;
        y = canvasHeight / 2 + Math.sin(angle) * r;
      }
      return {
        id: note.id,
        title: note.title,
        x,
        y,
        vx: 0,
        vy: 0,
        isCurrent: note.id === currentNoteId,
      };
    });

    const links = this.calculateLinks(notes);

    return { nodes, links };
  },

  /**
   * Advances the simulation one tick. Returns the largest per-axis speed after
   * the tick, so callers can tell when the layout has settled.
   */
  computeForces(
    nodes: GraphNode[],
    links: GraphLink[],
    selectedNode: GraphNode | null,
    isDragging: boolean,
    options: {
      repelForce: number;
      k: number;
      centerGravity: number;
      width: number;
      height: number;
      /** id -> node, if the caller already keeps one. Built here otherwise. */
      nodeIndex?: Map<string, GraphNode>;
    }
  ): number {
    const { repelForce, k, centerGravity, width, height } = options;
    const index = options.nodeIndex ?? new Map(nodes.map(n => [n.id, n] as const));

    // 1. Repulsion (Coulomb's law).
    if (nodes.length > TREE_THRESHOLD) repelTree(nodes, repelForce, selectedNode, isDragging);
    else repelGrid(nodes, repelForce, selectedNode, isDragging);

    // 2. Calculate spring attraction forces (Hooke's law)
    links.forEach(link => {
      const sNode = index.get(link.source);
      const tNode = index.get(link.target);
      if (sNode && tNode) {
        const dx = tNode.x - sNode.x;
        const dy = tNode.y - sNode.y;
        const dist = Math.hypot(dx, dy) || 1;
        
        const force = (dist - 130) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!isDragging || selectedNode !== sNode) {
          sNode.vx = (sNode.vx || 0) + fx;
          sNode.vy = (sNode.vy || 0) + fy;
        }
        if (!isDragging || selectedNode !== tNode) {
          tNode.vx = (tNode.vx || 0) - fx;
          tNode.vy = (tNode.vy || 0) - fy;
        }
      }
    });

    // 3. Apply resistance / damping and center gravity
    let maxSpeed = 0;
    nodes.forEach(node => {
      if (!isDragging || selectedNode !== node) {
        node.vx = (node.vx || 0) * 0.85;
        node.vy = (node.vy || 0) * 0.85;

        const centerDistX = (width / 2) - node.x;
        const centerDistY = (height / 2) - node.y;
        node.vx += centerDistX * centerGravity;
        node.vy += centerDistY * centerGravity;

        node.x += node.vx;
        node.y += node.vy;

        maxSpeed = Math.max(maxSpeed, Math.abs(node.vx), Math.abs(node.vy));
      }
    });

    return maxSpeed;
  }
};
