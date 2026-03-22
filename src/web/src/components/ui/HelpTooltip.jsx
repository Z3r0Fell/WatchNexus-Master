import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * HelpTooltip — a visible question-mark icon that shows a popover with a detailed
 * description of the feature/setting it's attached to.
 *
 * Usage:
 *   <HelpTooltip
 *     title="Quality Preference"
 *     description="Controls the default video quality..."
 *     examples={["Set to 1080p for...", "Use 4K if..."]}
 *   />
 */
export const HelpTooltip = ({ title, description, examples, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span className={`relative inline-flex items-center ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid={`help-${(title || '').toLowerCase().replace(/\s+/g, '-')}`}
        className="ml-1.5 p-0.5 rounded-full text-gray-500 hover:text-violet-400 hover:bg-violet-400/10 transition-colors focus:outline-none"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 z-[100] w-80 rounded-xl border border-white/10 bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">{title}</h4>
              <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{description}</p>
            {examples && examples.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Examples</p>
                <ul className="space-y-1">
                  {examples.map((ex, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                      <span className="text-violet-400 mt-0.5 flex-shrink-0">&#8227;</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

/**
 * SectionHelp — a larger help icon meant to sit next to section/page headings
 */
export const SectionHelp = ({ title, description, examples }) => (
  <HelpTooltip title={title} description={description} examples={examples} />
);

export default HelpTooltip;
