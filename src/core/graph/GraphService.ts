import { Note, GraphNode, GraphLink } from "../../shared/types/types";
import { extractWikilinks } from "../markdown/MarkdownService";

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
      const outgoing = extractWikilinks(note.content);
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
