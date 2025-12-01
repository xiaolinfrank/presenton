/**
 * IndexedDB storage for image generation sessions
 * - No login required
 * - Browser-based isolation (each browser has its own database)
 * - Users cannot see each other's data
 * - Supports large data (images as base64)
 */

const DB_NAME = 'presenton_image_generation';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: GeneratedImage[];
  referenceImageCount?: number;
  referenceImageBase64s?: string[];
  timestamp: string;
  isLoading?: boolean;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  createdAt: string;
  isLoading?: boolean;
  error?: string;
}

export interface ImageGenerationConfig {
  model: string;
  count: number;
  aspectRatio: string;
  resolution: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  config: ImageGenerationConfig;
  createdAt: string;
  updatedAt: string;
}

class ImageSessionStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sessions store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async getAllSessions(): Promise<ChatSession[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('updatedAt');
        const request = index.getAll();

        request.onsuccess = () => {
          // Sort by updatedAt descending (most recent first)
          const sessions = request.result as ChatSession[];
          sessions.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          resolve(sessions);
        };

        request.onerror = () => {
          console.error('Failed to get sessions:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  async getSession(id: string): Promise<ChatSession | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          console.error('Failed to get session:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(session);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to save session:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  async saveSessions(sessions: ChatSession[]): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Clear existing sessions and add new ones
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          let completed = 0;
          const total = sessions.length;

          if (total === 0) {
            resolve();
            return;
          }

          sessions.forEach(session => {
            const addRequest = store.put(session);
            addRequest.onsuccess = () => {
              completed++;
              if (completed === total) {
                resolve();
              }
            };
            addRequest.onerror = () => {
              console.error('Failed to save session:', addRequest.error);
            };
          });
        };

        clearRequest.onerror = () => {
          console.error('Failed to clear sessions:', clearRequest.error);
          reject(clearRequest.error);
        };
      });
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to delete session:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to clear sessions:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  }
}

// Singleton instance
export const imageSessionStorage = new ImageSessionStorage();
