import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function usePrompt() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({ title: 'Input required', description: '', placeholder: '', defaultValue: '', onConfirm: () => {} });
  const valueRef = useRef('');
  const optionsRef = useRef(options);
  const resolveRef = useRef(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const prompt = useCallback((opts) => {
    return new Promise((resolve) => {
      if (resolveRef.current) resolveRef.current(null);
      resolveRef.current = resolve;
      const onConfirm = () => { resolveRef.current = null; resolve(valueRef.current); };
      setOptions({
        title: opts.title || 'Input required',
        description: opts.description || '',
        placeholder: opts.placeholder || '',
        defaultValue: opts.defaultValue || '',
        onConfirm,
      });
      valueRef.current = opts.defaultValue || '';
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    optionsRef.current.onConfirm();
  }, []);

  // Cancel / Escape must settle the promise (resolves null) so callers don't hang.
  const handleCancel = useCallback(() => {
    setOpen(false);
    const r = resolveRef.current;
    resolveRef.current = null;
    if (r) r(null);
  }, []);

  const handleOpenChange = useCallback((next) => {
    if (next) setOpen(true); else handleCancel();
  }, [handleCancel]);

  // Uncontrolled input: keeping the typed value in state would recreate the
  // PromptDialog component on every keystroke, remounting the <Input> and
  // dropping focus after each character.
  const handleValueChange = useCallback((next) => {
    valueRef.current = next;
  }, []);

  const PromptDialog = useCallback(() => (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <Input
          defaultValue={options.defaultValue}
          autoFocus
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={options.placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ), [open, options, handleConfirm, handleCancel, handleOpenChange, handleValueChange]);

  return { prompt, PromptDialog };
}
