import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { KeyboardShortcutsDialog } from '../components/common/KeyboardShortcutsDialog';
import type { ShortcutGroup } from '../components/common/KeyboardShortcutsDialog';

interface KeyboardShortcutsContextType {
  openShortcutsDialog: () => void;
  closeShortcutsDialog: () => void;
  registerShortcuts: (shortcuts: ShortcutGroup[]) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

export const useKeyboardShortcutsContext = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider');
  }
  return context;
};

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  defaultShortcuts?: ShortcutGroup[];
}

export const KeyboardShortcutsProvider = ({ children, defaultShortcuts = [] }: KeyboardShortcutsProviderProps) => {
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutGroup[]>(defaultShortcuts);

  const openShortcutsDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeShortcutsDialog = useCallback(() => {
    setOpen(false);
  }, []);

  const registerShortcuts = useCallback((newShortcuts: ShortcutGroup[]) => {
    setShortcuts(prev => [...prev, ...newShortcuts]);
  }, []);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        openShortcutsDialog,
        closeShortcutsDialog,
        registerShortcuts,
      }}
    >
      {children}
      <KeyboardShortcutsDialog open={open} onClose={closeShortcutsDialog} shortcuts={shortcuts} />
    </KeyboardShortcutsContext.Provider>
  );
};
