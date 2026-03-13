type StorageKind = 'local' | 'session';

type SafeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const createSafeStorage = (kind: StorageKind): SafeStorage => {
  const memory = new Map<string, string>();

  const getNative = (): Storage | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return kind === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };

  const getItem = (key: string): string | null => {
    if (memory.has(key)) {
      return memory.get(key) ?? null;
    }

    const nativeStorage = getNative();
    if (!nativeStorage) {
      return null;
    }

    try {
      const value = nativeStorage.getItem(key);
      if (value !== null) {
        memory.set(key, value);
      }
      return value;
    } catch {
      return null;
    }
  };

  const setItem = (key: string, value: string) => {
    memory.set(key, value);
    const nativeStorage = getNative();
    if (!nativeStorage) {
      return;
    }
    try {
      nativeStorage.setItem(key, value);
    } catch {
      // Ignore storage failures (Safari private mode, quota, etc.)
    }
  };

  const removeItem = (key: string) => {
    memory.delete(key);
    const nativeStorage = getNative();
    if (!nativeStorage) {
      return;
    }
    try {
      nativeStorage.removeItem(key);
    } catch {
      // Ignore storage failures
    }
  };

  const clear = () => {
    memory.clear();
    const nativeStorage = getNative();
    if (!nativeStorage) {
      return;
    }
    try {
      nativeStorage.clear();
    } catch {
      // Ignore storage failures
    }
  };

  return { getItem, setItem, removeItem, clear };
};

export const safeLocalStorage = createSafeStorage('local');
export const safeSessionStorage = createSafeStorage('session');
