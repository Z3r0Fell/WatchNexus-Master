import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export function usePrompt() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({ title: 'Input required', description: '', placeholder: '', defaultValue: '', onConfirm: () => {} });
  const [value, setValue] = useState('');
  const valueRef = useRef('');
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const prompt = useCallback((opts) => {
    return new Promise((resolve) => {
      const onConfirm = () => resolve(valueRef.current);
      setOptions({
        title: opts.title || 'Input required',
        description: opts.description || '',
        placeholder: opts.placeholder || '',
        defaultValue: opts.defaultValue || '',
        onConfirm,
      });
      setValue(opts.defaultValue || '');
      valueRef.current = opts.defaultValue || '';
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    optionsRef.current.onConfirm();
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setValue('');
  }, []);

  const handleValueChange = useCallback((next) => {
    setValue(next);
    valueRef.current = next;
  }, []);

  const PromptDialog = useCallback(() => (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <Input
          value={value}
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
  ), [open, options, value, handleConfirm, handleCancel, handleValueChange]);

  return { prompt, PromptDialog };
}
