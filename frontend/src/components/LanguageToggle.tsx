import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'th';
  const toggle = () => {
    const next = current === 'th' ? 'en' : 'th';
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-theme-surface-tertiary text-theme-text-secondary hover:text-theme-text transition-all duration-200 active:scale-95 shrink-0"
      title={current === 'th' ? 'Switch to English' : 'สลับเป็นภาษาไทย'}
    >
      <Languages size={16} />
      <span className="sr-only">{current === 'th' ? 'EN' : 'TH'}</span>
    </button>
  );
}
