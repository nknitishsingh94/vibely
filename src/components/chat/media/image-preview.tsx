'use client';

import * as React from 'react';
import { Download, Maximize2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { formatBytes } from '@/lib/utils';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  filename?: string | null;
  fileSize?: number | null;
}

export function ImagePreview({ src, alt, filename, fileSize }: ImagePreviewProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="relative group overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 border border-border/30 max-w-sm cursor-pointer">
        <img
          src={src}
          alt={alt || filename || 'Shared image'}
          loading="lazy"
          onClick={() => setIsOpen(true)}
          className="w-full max-h-72 object-cover rounded-xl transition-transform duration-200 group-hover:scale-[1.01]"
        />
        <div
          onClick={() => setIsOpen(true)}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white"
        >
          <span className="p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-xs transition-colors">
            <Maximize2 className="w-4 h-4" />
          </span>
        </div>
      </div>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="full"
        title={filename || 'Image Preview'}
        description={fileSize ? formatBytes(fileSize) : undefined}
      >
        <div className="flex flex-col items-center justify-center p-2">
          <img
            src={src}
            alt={alt || filename || 'Full size preview'}
            className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
          />
          <div className="mt-4 flex items-center justify-between w-full pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground truncate max-w-xs">
              {filename || 'image.jpg'}
            </span>
            <a
              href={src}
              download={filename || 'duochat-image.jpg'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          </div>
        </div>
      </Dialog>
    </>
  );
}
