import { useEffect } from 'react';

// Warns the user before closing/reloading the tab while there are unsaved edits.
// (Covers browser-level navigation; in-app navigation away simply discards the
//  modal-local draft, which is the expected behaviour here.)
export function useUnsavedPrompt(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
