const memory = new Map<string, string>();

export const kvStore = {
  async getItem(key: string) {
    if (typeof window === 'undefined') return memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string) {
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
  async deleteItem(key: string) {
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

