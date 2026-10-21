'use client';

import * as React from 'react';
import { Download, Film, Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useChat } from '@/context/chat-context';
import { downloadMediaFile } from '@/lib/file-downloader';

interface VideoPlayerProps {
  src: string;
  filename?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
}

export function VideoPlayer({ src, filename, fileSize, mimeType }: VideoPlayerProps) {
  const { notifySecurityEvent } = useChat();
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!src || isDownloading) return;

    notifySecurityEvent?.('video_saved', filename || 'video.mp4');
    await downloadMediaFile({
      url: src,
      filename: filename || 'vibely-video.mp4',
      mimeType: mimeType || 'video/mp4',
      onStart: () => setIsDownloading(true),
      onFinish: () => setIsDownloading(false),
    });
  };

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

        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
          title="Download video directly to Files"
          aria-label="Download video directly to Files"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
