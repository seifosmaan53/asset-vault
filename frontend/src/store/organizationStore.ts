import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const ORGANIZATION_ID_STORAGE_KEY = 'selectedOrganizationId';

// Fallback storage for environments where localStorage is unavailable (private mode / blocked storage)
const memoryStorage = (() => {
  const mem = new Map<string, string>();
  return {
    getItem: (name: string) => mem.get(name) ?? null,
    setItem: (name: string, value: string) => {
      mem.set(name, value);
    },
    removeItem: (name: string) => {
      mem.delete(name);
    },
  };
})();

// Type-safe localStorage wrapper that returns a compatible storage interface
const safeLocalStorage = (): Storage => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      // Return memoryStorage with proper typing
      return memoryStorage as unknown as Storage;
    }
    return window.localStorage;
  } catch {
    // Return memoryStorage with proper typing
    return memoryStorage as unknown as Storage;
  }
};

export const getSelectedOrganizationIdFromStorage = (): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return localStorage.getItem(ORGANIZATION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setSelectedOrganizationIdInStorage = (organizationId: string | null) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!organizationId) {
      localStorage.removeItem(ORGANIZATION_ID_STORAGE_KEY);
    } else {
      localStorage.setItem(ORGANIZATION_ID_STORAGE_KEY, organizationId);
    }
  } catch {
    // ignore
  }
};

interface OrganizationState {
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (organizationId: string | null) => void;
  clearSelectedOrganizationId: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      selectedOrganizationId: null,
      setSelectedOrganizationId: (organizationId) => {
        setSelectedOrganizationIdInStorage(organizationId);
        set({ selectedOrganizationId: organizationId });
      },
      clearSelectedOrganizationId: () => {
        setSelectedOrganizationIdInStorage(null);
        set({ selectedOrganizationId: null });
      },
    }),
    {
      name: 'organization-storage',
      storage: createJSONStorage(safeLocalStorage),
      partialize: (state) => ({
        selectedOrganizationId: state.selectedOrganizationId,
      }),
    }
  )
);


