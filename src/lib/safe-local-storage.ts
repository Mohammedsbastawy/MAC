
// A server-safe interface for localStorage.
// It checks if 'window' is defined before accessing localStorage,
// preventing crashes during server-side rendering in Next.js.
export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof window !== "undefined") {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.error(`Error getting item "${key}" from localStorage:`, error);
        return null;
      }
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        console.error(`Error setting item "${key}" in localStorage:`, error);
      }
    }
  },
  removeItem(key: string): void {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing item "${key}" from localStorage:`, error);
      }
    }
  },
};
