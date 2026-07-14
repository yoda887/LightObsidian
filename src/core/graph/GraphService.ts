import { Note, GraphNode, GraphLink } from "../../shared/types/types";
import { extractWikilinks } from "../markdown/MarkdownService";

export const GraphService = {
  calculateLinks(notes: Note[]): GraphLink[] {
    const links: GraphLink[] = [];
    notes.forEach(note => {
      const outgoing = extractWikilinks(note.content);
      outgoing.forEach(link => {
        const targetNote = notes.find(n => n.title.trim().toLowerCase() === link.target.toLowerCase());
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
      
      const angle = (idx / Math.max(1, notes.length)) * Math.PI * 2;
      const radius = Math.min(canvasWidth, canvasHeight) * 0.25;
      return {
        id: note.id,
        title: note.title,
        x: canvasWidth / 2 + Math.cos(angle) * radius,
        y: canvasHeight / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        isCurrent: note.id === currentNoteId,
      };
    });

    const links = this.calculateLinks(notes);

    return { nodes, links };
  },

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
    }
  ): void {
    const { repelForce, k, centerGravity, width, height } = options;

    // 1. Calculate repulsion forces (Coulomb's law)
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.hypot(dx, dy) || 1;
        
        if (dist < 250) {
          const force = repelForce / (dist * dist);
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

    // 2. Calculate spring attraction forces (Hooke's law)
    links.forEach(link => {
      const sNode = nodes.find(n => n.id === link.source);
      const tNode = nodes.find(n => n.id === link.target);
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
      }
    });
  }
};
