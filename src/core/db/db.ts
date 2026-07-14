/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Note } from "../../shared/types/types";

const DB_NAME = "LightObsidianReactDB";
const STORE_NAME = "notes";
const VAULT_STORE = "vault";
const DB_VERSION = 2;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function saveVaultHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    const store = tx.objectStore(VAULT_STORE);
    const request = store.put(handle, "vaultHandle");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getVaultHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readonly");
    const store = tx.objectStore(VAULT_STORE);
    const request = store.get("vaultHandle");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearVaultHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    const store = tx.objectStore(VAULT_STORE);
    const request = store.delete("vaultHandle");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function putNote(note: Note): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(note);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteNote(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearNotes(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
