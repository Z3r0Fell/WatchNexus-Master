import { useState, useCallback } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({ title: 'Are you sure?', description: '', confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: () => {} });
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setOptions({
        title: opts.title || 'Are you sure?',
        description: opts.description || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        onConfirm: () => resolve(true),
      });
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    optionsRef.current.onConfirm();
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const ConfirmDialog = useCallback(() => (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
  ), [open, options, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
}
