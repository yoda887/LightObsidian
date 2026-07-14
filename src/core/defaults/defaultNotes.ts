import { Note } from "../../shared/types/types";

export const DEFAULT_NOTES: Note[] = [
  {
    id: "welcome",
    title: "Welcome Note",
    content: `# Welcome to Lite Obsidian!\n\nThis is a beautiful, highly responsive, and lightweight analog of **Obsidian** built to organize your thoughts, knowledge, and notes.\n\n## 🚀 Key Features\n1. **Markdown Editing**: Full support for styled headers, code blocks, lists, and quotes.\n2. **Wikilinks \`[[Link]]\`**: Link notes instantly. Type \`[[Obsidian HTA Concept]]\` to see a connection in action!\n3. **Graph View (Map)**: A force-directed visual canvas representation of all notes and connections.\n4. **Standalone Exporter**: Build and export the entire workspace with your current notes as a **single, fully-functional HTML / HTA file**.\n\n## 🔗 Try out Wikilinks\nClick this link to explore how HTA apps run: [[Obsidian HTA Concept]] or start brainstorming with [[Mindmap & Brainstorming]].\nIf you click a link pointing to a note that doesn't exist yet (like [[My Personal Log]]), the engine will automatically offer to create it for you!\n\n## 🗺️ Interactive Graph\nClick on the **Graph Map** tab in the main workspace header to see these notes animate, attract each other, and hover/click to explore!`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "hta-concept",
    title: "Obsidian HTA Concept",
    content: `# Obsidian HTML & HTA Concept\n\nThe user requested a single self-contained HTML file that can be converted into a Windows **.hta** (HTML Application).\n\n## 💡 What is an HTA file?\nAn **HTA** is a Windows file extension for HTML pages that run with system-level access outside the browser sandbox. \n- You can simply rename the exported file from \`obsidian_vault.html\` to \`obsidian_vault.hta\`.\n- Double-clicking it on Windows opens it in a standalone window, looking and acting like a native desktop application!\n\n## 💾 Saving Notes Inside HTML/HTA\nWhen you edit notes inside the exported file:\n- It automatically persists changes inside your browser's \`localStorage\` so your work is safe across opens!\n- It contains its own **Export HTA/HTML** button inside. This means you can download a *new* updated standalone file containing your latest changes baked right into the source code!\n\n*Return to the [[Welcome Note]] or see [[Mindmap & Brainstorming]].*`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "brainstorm",
    title: "Mindmap & Brainstorming",
    content: `# Mindmap & Brainstorming\n\nUse Lite Obsidian to brainstorm interconnected projects. By linking concepts together, you build a "second brain" visual network.\n\n## 📝 Connected Projects\n- **[[My Projects]]**: Tracking active development cycles.\n- **[[Daily Habits]]**: Mindful productivity checklist.\n\nAs you create links, check the **Graph Map** panel to watch the nodes form a neural-like database map of your knowledge.\n\n---\n*Created during your session. Link back to [[Welcome Note]].*`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "my-projects",
    title: "My Projects",
    content: `# My Projects\n\nHere you can organize active tasks and goals.\n\n## 🛠️ Lite Obsidian Sandbox\n- [x] Integrate force-directed physics canvas for note relations.\n- [x] Configure self-contained single-file HTML exporter template.\n- [ ] Write my first note from scratch!\n\n*Related notes:*\n- Check [[Welcome Note]]\n- Or read about [[Obsidian HTA Concept]]`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "Templates/Meeting Protocol.md",
    title: "Meeting Protocol",
    content: `# Meeting Protocol\n\n**Date**: [[YYYY-MM-DD]]\n**Client**: \n**Attorney**: \n\n## Summary of Discussion\n- \n\n## Action Items\n- [ ] \n- [ ] \n\n## Next Meeting\n- \n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: "Templates"
  },
  {
    id: "Templates/IRAC Analysis.md",
    title: "IRAC Analysis",
    content: `# IRAC Analysis: [Case Name]\n\n## 🔍 Issue\nWhat is the legal question that, when answered, determines the result of the case?\n\n## 📜 Rule\nWhat is the rule of law that applies to the issue?\n\n## ⚖️ Application / Analysis\nHow does the rule of law apply to the specific facts of this case?\n\n## 🎯 Conclusion\nWhat is the outcome?\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: "Templates"
  },
  {
    id: "Templates/Lawsuit Template.md",
    title: "Lawsuit Template",
    content: `# Lawsuit Draft\n\n**Court**: \n**Plaintiff**: \n**Defendant**: \n**Case No**: \n\n## I. Statement of Facts\n\n\n## II. Legal Grounds\n\n\n## III. Claims / Prayer for Relief\n1. \n2. \n\n**Date**: [[YYYY-MM-DD]]\n**Signature**: ______________\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: "Templates"
  }
];
