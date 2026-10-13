'use client';

import * as React from 'react';
import { Download, Film } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  filename?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
}

export function VideoPlayer({ src, filename, fileSize, mimeType }: VideoPlayerProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border/40 bg-black max-w-sm sm:max-w-md shadow-xs">
      <video
        src={src}
        controls
        preload="metadata"
        className="w-full max-h-80 object-contain bg-black"
      >
        Your browser does not support the video tag.
      </video>

      <div className="bg-card/90 px-3.5 py-2 flex items-center justify-between text-xs text-card-foreground border-t border-border/30">
        <div className="flex items-center gap-2 truncate">
          <Film className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate font-medium">{filename || 'Video clip'}</span>
          {fileSize && (
            <span className="text-muted-foreground text-[11px] shrink-0">
              ({formatBytes(fileSize)})
            </span>
          )}
        </div>

        <a
          href={src}
          download={filename || 'duochat-video.mp4'}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Download video"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
