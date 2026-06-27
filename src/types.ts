/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  path?: string; // Relative path from the vault root (e.g. "Projects/Active")
}

export interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  isCurrent: boolean;
}

export interface GraphLink {
  source: string; // note id
  target: string; // note id
  type?: string;  // relationship type, e.g. "overrules"
}
