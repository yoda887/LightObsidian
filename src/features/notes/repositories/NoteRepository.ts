import { Note } from "../../../shared/types/types";
import { getAllNotes, putNote, deleteNote, clearNotes } from "../../../core/db/db";

export const NoteRepository = {
  async loadAll(): Promise<Note[]> {
    return getAllNotes();
  },

  async save(note: Note): Promise<void> {
    return putNote(note);
  },

  async delete(id: string): Promise<void> {
    return deleteNote(id);
  },

  async rename(oldId: string, updatedNote: Note): Promise<void> {
    await deleteNote(oldId);
    await putNote(updatedNote);
  },

  async clear(): Promise<void> {
    return clearNotes();
  },

  async search(query: string): Promise<Note[]> {
    const notes = await getAllNotes();
    const lowerQuery = query.toLowerCase();
    return notes.filter(note => 
      note.title.toLowerCase().includes(lowerQuery) || 
      note.content.toLowerCase().includes(lowerQuery)
    );
  }
};
