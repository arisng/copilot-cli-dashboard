import { useState, useEffect, useCallback, useRef } from 'react';

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    lastFocusedElement.current = document.activeElement as HTMLElement;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Restore focus after a short delay to allow the modal to close
    setTimeout(() => {
      lastFocusedElement.current?.focus();
    }, 0);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K or Cmd+K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        // Don't trigger if user is typing in an input (unless it's a special case)
        const target = event.target as HTMLElement;
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        // Allow Ctrl+K in inputs for the command palette, but not for other shortcuts
        event.preventDefault();
        toggle();
        return;
      }

      // Close on Escape
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
