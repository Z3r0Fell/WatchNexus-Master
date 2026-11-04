import { useState, useCallback, useRef, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({ title: 'Are you sure?', description: '', confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: () => {} });
  const optionsRef = useRef(options);
  const resolveRef = useRef(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      // Settle any still-pending confirm as cancelled before opening a new one.
      if (resolveRef.current) resolveRef.current(false);
      resolveRef.current = resolve;
      setOptions({
        title: opts.title || 'Are you sure?',
        description: opts.description || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        onConfirm: () => { resolveRef.current = null; resolve(true); },
      });
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    optionsRef.current.onConfirm();
  }, []);

  // Cancel / Escape / outside click must settle the promise, or callers that
  // `await confirm()` hang forever.
  const handleCancel = useCallback(() => {
    setOpen(false);
    const r = resolveRef.current;
    resolveRef.current = null;
    if (r) r(false);
  }, []);

  const handleOpenChange = useCallback((next) => {
    if (next) setOpen(true); else handleCancel();
  }, [handleCancel]);

  const ConfirmDialog = useCallback(() => (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{options.cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{options.confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ), [open, options, handleConfirm, handleCancel, handleOpenChange]);

  return { confirm, ConfirmDialog };
}
