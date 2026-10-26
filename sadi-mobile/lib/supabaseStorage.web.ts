type WebStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory = new Map<string, string>();

export const storage: WebStorage = {
  async getItem(key) {
    if (typeof window === 'undefined') return memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async setItem(key, value) {
    if (typeof window === 'undefined') {
      memory.set(key, value);
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  async removeItem(key) {
    if (typeof window === 'undefined') {
      memory.delete(key);
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

