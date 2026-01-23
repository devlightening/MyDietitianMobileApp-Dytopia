'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyableKeyProps {
  keyValue: string;
  className?: string;
}

export function CopyableKey({ keyValue, className }: CopyableKeyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border',
      className
    )}>
      <code className="flex-1 font-mono text-sm font-semibold text-foreground break-all">
        {keyValue}
      </code>
      <button
        onClick={handleCopy}
        className={cn(
          'flex-shrink-0 p-2 rounded-md transition-all',
          copied
            ? 'bg-green-500 text-white'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
        title={copied ? 'Kopyalandı!' : 'Kopyala'}
      >
        {copied ? (
          <Check className="w-4 h-4" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
