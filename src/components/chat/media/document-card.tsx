'use client';

import * as React from 'react';
import { FileText, Download, FileSpreadsheet, FileArchive, FileCode, File } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface DocumentCardProps {
  src?: string | null;
  filename?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  isOutgoing?: boolean;
}

export function DocumentCard({
  src,
  filename,
  fileSize,
  mimeType,
  isOutgoing = false,
}: DocumentCardProps) {
  const getFileIcon = () => {
    const name = (filename || '').toLowerCase();
    if (name.endsWith('.pdf') || mimeType?.includes('pdf')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz')) {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    if (name.endsWith('.json') || name.endsWith('.ts') || name.endsWith('.js')) {
      return <FileCode className="w-5 h-5 text-indigo-500" />;
    }
    return <File className="w-5 h-5 text-sky-500" />;
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all max-w-sm sm:max-w-md ${
        isOutgoing
          ? 'bg-primary-foreground/15 border-white/20 text-primary-foreground'
          : 'bg-card border-border/80 text-card-foreground shadow-xs'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            isOutgoing ? 'bg-white/20' : 'bg-muted'
          }`}
        >
          {getFileIcon()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate leading-snug">
            {filename || 'Document'}
          </p>
          <p className="text-[11px] opacity-70 mt-0.5 font-mono">
            {fileSize ? formatBytes(fileSize) : 'Document file'}
          </p>
        </div>
      </div>

      {src && (
        <a
          href={src}
          download={filename || 'document'}
          target="_blank"
          rel="noopener noreferrer"
          className={`p-2 rounded-xl shrink-0 transition-opacity cursor-pointer ${
            isOutgoing
              ? 'bg-white text-primary hover:bg-white/90'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
