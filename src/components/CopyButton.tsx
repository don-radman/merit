import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons.tsx';
import { useToast } from '@/components/Toast.tsx';

/**
 * Copies `text`, confirms in place (the icon becomes a tick for a moment) and
 * in the toast. Falls back to a prompt if the clipboard API is unavailable —
 * which it is on http:// origins other than localhost.
 */
export default function CopyButton({
  text,
  children,
  className = 'btn',
  toast = 'Link copied',
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
  toast?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this link', text);
    }
    setCopied(true);
    push({ title: toast, body: text });
  };

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      <span>{copied ? 'Copied' : children}</span>
    </button>
  );
}
