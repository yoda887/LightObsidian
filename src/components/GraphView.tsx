/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Note, GraphNode, GraphLink } from "../types";
import { extractWikilinks } from "../utils";

interface GraphViewProps {
  notes: Note[];
  currentNoteId: string;
  onSelectNote: (id: string) => void;
}

export default function GraphView({ notes, currentNoteId, onSelectNote }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Physics states kept in refs for fast tick updates without triggering React re-renders
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const selectedNodeRef = useRef<GraphNode | null>(null);
  const isDraggingNodeRef = useRef(false);
  const panRef = useRef(pan);
  
  // Sync pan reference
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Initialize nodes and links
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create / Update nodes while preserving coordinates of existing nodes if possible
    const existingMap = new Map<string, GraphNode>(nodesRef.current.map(n => [n.id, n]));
    
    const newNodes = notes.map((note, idx) => {
      const existing = existingMap.get(note.id);
      if (existing) {
        existing.title = note.title;
        existing.isCurrent = note.id === currentNoteId;
        return existing;
      }
      
      const angle = (idx / Math.max(1, notes.length)) * Math.PI * 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.25;
      return {
        id: note.id,
        title: note.title,
        x: canvas.width / 2 + Math.cos(angle) * radius,
        y: canvas.height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        isCurrent: note.id === currentNoteId,
      };
    });

    // Build connections based on wikilinks
    const newLinks: GraphLink[] = [];
    notes.forEach(note => {
      const outgoing = extractWikilinks(note.content);
      outgoing.forEach(link => {
        const targetNote = notes.find(n => n.title.trim().toLowerCase() === link.target.toLowerCase());
        if (targetNote && targetNote.id !== note.id) {
          newLinks.push({
            source: note.id,
            target: targetNote.id,
            type: link.type
          });
        }
      });
    });

    nodesRef.current = newNodes;
    linksRef.current = newLinks;
  }, [notes, currentNoteId]);

  // Handle Resize of canvas to fill parent container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Physics simulation tick
  useEffect(() => {
    let animationFrameId: number;
    const k = 0.04; // Spring stiffness
    const repelForce = 600; // Repulsion constant
    const centerGravity = 0.012; // Force pulling nodes to absolute center
    
    const simulate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || nodes.length === 0) {
        animationFrameId = requestAnimationFrame(simulate);
        return;
      }

      // 1. Calculate repulsion forces between all nodes (Coulomb-like force)
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
            
            if (!isDraggingNodeRef.current || selectedNodeRef.current !== n1) {
              n1.vx = (n1.vx || 0) - fx;
              n1.vy = (n1.vy || 0) - fy;
            }
            if (!isDraggingNodeRef.current || selectedNodeRef.current !== n2) {
              n2.vx = (n2.vx || 0) + fx;
              n2.vy = (n2.vy || 0) + fy;
            }
          }
        }
      }

      // 2. Calculate spring attraction forces along links (Hooke's law)
      links.forEach(link => {
        const sNode = nodes.find(n => n.id === link.source);
        const tNode = nodes.find(n => n.id === link.target);
        if (sNode && tNode) {
          const dx = tNode.x - sNode.x;
          const dy = tNode.y - sNode.y;
          const dist = Math.hypot(dx, dy) || 1;
          
          // Optimal distance for links: 120px
          const force = (dist - 130) * k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!isDraggingNodeRef.current || selectedNodeRef.current !== sNode) {
            sNode.vx = (sNode.vx || 0) + fx;
            sNode.vy = (sNode.vy || 0) + fy;
          }
          if (!isDraggingNodeRef.current || selectedNodeRef.current !== tNode) {
            tNode.vx = (tNode.vx || 0) - fx;
            tNode.vy = (tNode.vy || 0) - fy;
          }
        }
      });

      // 3. Render Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);

      // Draw links
      links.forEach(link => {
        const sNode = nodes.find(n => n.id === link.source);
        const tNode = nodes.find(n => n.id === link.target);
        if (sNode && tNode) {
          ctx.beginPath();
          if (link.type) {
            ctx.strokeStyle = "rgba(225, 29, 72, 0.6)"; // rose-600
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = "rgba(99, 102, 241, 0.25)"; // indigo-500
            ctx.setLineDash([]);
            ctx.lineWidth = 1.8;
          }
          ctx.moveTo(sNode.x, sNode.y);
          ctx.lineTo(tNode.x, tNode.y);
          ctx.stroke();

          // Draw type label if present
          if (link.type) {
            const midX = (sNode.x + tNode.x) / 2;
            const midY = (sNode.y + tNode.y) / 2;
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // Draw background for text
            const textWidth = ctx.measureText(link.type).width;
            ctx.fillStyle = "rgba(255, 241, 242, 0.9)"; // rose-50
            ctx.fillRect(midX - textWidth / 2 - 2, midY - 6, textWidth + 4, 12);
            
            ctx.fillStyle = "rgba(225, 29, 72, 1)"; // rose-600
            ctx.fillText(link.type.toUpperCase(), midX, midY);
          }
        }
      });
      ctx.setLineDash([]); // reset dash

      // Update positions and Draw Nodes
      nodes.forEach(node => {
        if (!isDraggingNodeRef.current || selectedNodeRef.current !== node) {
          // Apply air resistance / damping
          node.vx = (node.vx || 0) * 0.85;
          node.vy = (node.vy || 0) * 0.85;

          // Weak gravity pull to screen center
          const centerDistX = (canvas.width / 2) - node.x;
          const centerDistY = (canvas.height / 2) - node.y;
          node.vx += centerDistX * centerGravity;
          node.vy += centerDistY * centerGravity;

          node.x += node.vx;
          node.y += node.vy;
        }

        // Draw node sphere
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.isCurrent ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = node.isCurrent ? "#4f46e5" : "#a1a1aa";
        ctx.fill();

        // Draw pulsing outer glow for current node
        if (node.isCurrent) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(79, 70, 229, 0.35)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Text label
        ctx.font = "500 11px Inter, sans-serif";
        ctx.fillStyle = "currentColor"; // respects Tailwind light/dark text color
        ctx.textAlign = "center";
        
        // Use document theme mode to decide text color inside Canvas rendering context
        const isDark = document.documentElement.classList.contains("dark");
        ctx.fillStyle = isDark ? "#e4e4e7" : "#18181b";
        ctx.fillText(node.title || "Untitled", node.x, node.y - 14);
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(simulate);
    };

    animationFrameId = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Mouse interaction triggers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - pan.x;
    const y = e.clientY - rect.top - pan.y;

    // Check if clicked near a node (within radius of 20px)
    let clickedNode: GraphNode | null = null;
    for (const node of nodesRef.current) {
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist < 20) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      selectedNodeRef.current = clickedNode;
      isDraggingNodeRef.current = true;
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingNodeRef.current && selectedNodeRef.current) {
      const rect = canvas.getBoundingClientRect();
      selectedNodeRef.current.x = e.clientX - rect.left - pan.x;
      selectedNodeRef.current.y = e.clientY - rect.top - pan.y;
      selectedNodeRef.current.vx = 0;
      selectedNodeRef.current.vy = 0;
    } else if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isDraggingNodeRef.current && selectedNodeRef.current) {
      onSelectNote(selectedNodeRef.current.id);
    }
    isDraggingNodeRef.current = false;
    selectedNodeRef.current = null;
    setIsDraggingCanvas(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-50 dark:bg-zinc-950/30 flex items-center justify-center">
      <canvas
        id="graph-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full block cursor-grab active:cursor-grabbing text-slate-800 dark:text-zinc-200`}
      />
      
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 shadow-sm text-xs space-y-1 z-10 pointer-events-none select-none">
        <p className="font-semibold text-slate-800 dark:text-zinc-200">Interactive Map Guide:</p>
        <p className="text-slate-500 dark:text-zinc-400">• Drag nodes to arrange connections</p>
        <p className="text-slate-500 dark:text-zinc-400">• Drag empty canvas to pan around</p>
        <p className="text-slate-500 dark:text-zinc-400">• Click nodes to select & open corresponding note</p>
      </div>
    </div>
  );
}
