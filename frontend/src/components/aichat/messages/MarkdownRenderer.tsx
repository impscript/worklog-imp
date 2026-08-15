import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onOpenInCanvas?: (content: string, title?: string) => void;
}

function CodeBlock({
  language,
  value,
  onOpenInCanvas,
}: {
  language: string;
  value: string;
  onOpenInCanvas?: (content: string, title?: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLengthy = value.split('\n').length > 8;

  return (
    <div className="relative my-3 rounded-2xl overflow-hidden border border-slate-800/90 bg-slate-950 text-slate-100 shadow-lg group">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-indigo-400" />
          <span className="font-bold uppercase tracking-wider text-slate-300">
            {language || 'code'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLengthy && onOpenInCanvas && (
            <button
              type="button"
              onClick={() => onOpenInCanvas(value, `${language.toUpperCase()} Code`)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
            >
              เปิดใน Canvas
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer select-none"
            title="คัดลอกโค้ด"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>คัดลอก</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Text Area */}
      <div className="p-4 overflow-x-auto custom-scrollbar font-mono text-xs leading-relaxed selection:bg-indigo-500/30 selection:text-white">
        <pre className="!bg-transparent !p-0 !m-0">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  onOpenInCanvas,
}) => {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none text-theme-text', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && typeof children === 'string' && !children.includes('\n');
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-semibold border border-indigo-200/60 dark:border-indigo-800/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match ? match[1] : ''}
                value={codeString}
                onOpenInCanvas={onOpenInCanvas}
              />
            );
          },
          table({ children }) {
            return (
              <div className="my-4 w-full overflow-x-auto rounded-xl border border-theme-border/80 shadow-sm custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse divide-y divide-theme-border/60">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-theme-surface-secondary/70 text-theme-text font-bold">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-theme-border/40 bg-theme-surface/30">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-theme-surface-secondary/30 transition-colors">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3.5 py-2.5 font-bold text-theme-text whitespace-nowrap">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3.5 py-2.5 text-theme-text-secondary leading-relaxed">{children}</td>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 pl-4 border-l-4 border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 py-2 pr-3 rounded-r-xl text-xs text-theme-text-secondary italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5"
              >
                {children}
              </a>
            );
          },
          ul({ children }) {
            return <ul className="my-2 space-y-1 list-disc list-inside text-theme-text-secondary">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-2 space-y-1 list-decimal list-inside text-theme-text-secondary">{children}</ol>;
          },
          p({ children }) {
            return <p className="my-2 leading-relaxed text-theme-text-secondary">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-black text-theme-text mt-4 mb-2 pb-1 border-b border-theme-border/50">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-extrabold text-theme-text mt-3 mb-1.5">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold text-theme-text mt-2 mb-1">{children}</h3>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
