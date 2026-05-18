import { useEffect, useCallback, RefObject } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  description: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  ignoreWhenTyping?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  target?: RefObject<HTMLElement> | HTMLElement | null;
}

/**
 * Centralized keyboard shortcuts hook
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       key: 's',
 *       ctrl: true,
 *       handler: () => handleSave(),
 *       description: 'Save form',
 *       ignoreWhenTyping: true,
 *     },
 *   ],
 * });
 * ```
 */
export const useKeyboardShortcuts = ({
  shortcuts,
  enabled = true,
  target,
}: UseKeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Check if user is typing in an input field
      const targetElement = e.target as HTMLElement;
      const isTyping =
        targetElement?.tagName === 'INPUT' ||
        targetElement?.tagName === 'TEXTAREA' ||
        (targetElement as HTMLElement)?.isContentEditable ||
        targetElement?.getAttribute('role') === 'textbox';

      // Guard against undefined key
      if (!e.key) return;

      for (const shortcut of shortcuts) {
        // Check if typing should be ignored for this shortcut
        if (shortcut.ignoreWhenTyping && isTyping) {
          // Allow Ctrl/Cmd+K to work even while typing (common pattern for search)
          if (!((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k')) {
            continue;
          }
        }

        // Check modifier keys
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const shiftMatch = shortcut.shift !== undefined ? (shortcut.shift ? e.shiftKey : !e.shiftKey) : true;
        const altMatch = shortcut.alt !== undefined ? (shortcut.alt ? e.altKey : !e.altKey) : true;

        // Check key match (case-insensitive for letter keys)
        const keyMatch =
          shortcut.key.length === 1
            ? e.key?.toLowerCase() === shortcut.key.toLowerCase()
            : e.key === shortcut.key;

        if (ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          if (shortcut.stopPropagation) {
            e.stopPropagation();
          }
          shortcut.handler(e);
          break; // Only handle first matching shortcut
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    const element = target
      ? 'current' in target
        ? target.current
        : target
      : window;

    if (!element) return;

    element.addEventListener('keydown', handleKeyDown);
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled, target]);
};

/**
 * Helper to check if a key combination matches
 */
export const matchesShortcut = (e: KeyboardEvent, shortcut: Omit<KeyboardShortcut, 'handler' | 'description'>): boolean => {
  // Guard against undefined key
  if (!e.key) return false;

  const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
  const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
  const shiftMatch = shortcut.shift !== undefined ? (shortcut.shift ? e.shiftKey : !e.shiftKey) : true;
  const altMatch = shortcut.alt !== undefined ? (shortcut.alt ? e.altKey : !e.altKey) : true;
  const keyMatch =
    shortcut.key.length === 1
      ? e.key.toLowerCase() === shortcut.key.toLowerCase()
      : e.key === shortcut.key;

  return ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch;
};
