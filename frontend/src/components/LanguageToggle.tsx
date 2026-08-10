import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'th';
  const toggle = () => {
    i18n.changeLanguage(current === 'th' ? 'en' : 'th');
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-theme-border bg-theme-surface-secondary hover:bg-theme-surface-tertiary text-theme-text-secondary hover:text-theme-text transition-all duration-200 active:scale-95 shrink-0 text-xs font-bold"
      title={current === 'th' ? 'Switch to English' : 'สลับเป็นภาษาไทย'}
    >
      <span className={current === 'th' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-theme-text-muted font-medium'}>TH</span>
      <span className="text-theme-text-muted text-[10px]">/</span>
      <span className={current === 'en' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-theme-text-muted font-medium'}>EN</span>
    </button>
  );
}

