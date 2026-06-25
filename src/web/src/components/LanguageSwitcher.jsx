import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { changeLanguage } from '../i18n';
import { LANGUAGES_BY_REGION } from '../lib/languages';
import { cn } from '../lib/utils';

export const LanguageSwitcher = ({ compact = false, align = 'left' }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = LANGUAGES_BY_REGION.flatMap(r => r.languages).find(l => l.code === i18n.language);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="language-switcher"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-lg transition-colors",
          compact
            ? "p-2 hover:bg-white/5 text-gray-400 hover:text-white"
            : "px-3 py-2 hover:bg-white/5 text-gray-400 hover:text-white w-full"
        )}
      >
        <Globe className="w-4 h-4" />
        {!compact && (
          <span className="text-sm">{currentLang?.native || currentLang?.name || 'English'}</span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute z-50 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden",
          compact
            ? (align === 'right' ? "right-0 top-full mt-1" : "left-0 top-full mt-1")
            : "right-0 bottom-full mb-2"
        )}>
          <div className="max-h-80 overflow-y-auto p-2 space-y-3 min-w-[220px]">
            {LANGUAGES_BY_REGION.map(region => (
              <div key={region.id}>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 pb-1">
                  {region.label}
                </p>
                {region.languages.map(lang => (
                  <button
                    key={lang.code}
                    data-testid={`lang-${lang.code}`}
                    onClick={() => { changeLanguage(lang.code); setOpen(false); }}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm transition-colors",
                      lang.code === i18n.language
                        ? "text-white bg-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span className="w-6 text-center text-xs text-gray-500">{lang.native.charAt(0)}</span>
                    <span className="flex-1">{lang.native}</span>
                    <span className="text-xs text-gray-600">{lang.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
