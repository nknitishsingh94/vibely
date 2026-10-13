'use client';

import * as React from 'react';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useChat } from '@/context/chat-context';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  filename?: string | null;
  fileSize?: number | null;
}

export function ImagePreview({ src, alt, filename, fileSize }: ImagePreviewProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isZoomed, setIsZoomed] = React.useState(false);
  const { broadcastActivity } = useChat();

  const handleOpen = () => {
    setIsOpen(true);
    setIsZoomed(false);
    broadcastActivity?.('viewing_image');
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsZoomed(false);
    broadcastActivity?.('in_chat');
  };

  return (
    <>
      {/* Inline Image Thumbnail (Clean, borderless, high quality) */}
      <div
        onClick={handleOpen}
        className="relative group overflow-hidden rounded-2xl cursor-pointer select-none bg-black/10 transition-all active:scale-[0.99]"
      >
        <img
          src={src}
          alt={alt || filename || 'Shared photo'}
          loading="eager"
          decoding="async"
          className="w-full max-h-80 max-w-[280px] sm:max-w-[340px] object-cover rounded-2xl transition-transform duration-300 group-hover:scale-[1.015]"
        />
        {/* Subtle hover gradient */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
      </div>

      {/* Full-Screen Borderless Lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none animate-in fade-in duration-150 p-3 sm:p-5"
          onClick={handleClose}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between z-10 w-full pt-1"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {filename || 'Photo'}
                </span>
                {fileSize && (
                  <span className="text-[11px] text-white/60 font-mono">
                    {formatBytes(fileSize)}
                  </span>
                )}
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsZoomed(prev => !prev)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                title={isZoomed ? 'Zoom Out' : 'Zoom In'}
              >
                {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
              </button>

              <a
                href={src}
                download={filename || 'vibely-photo.jpg'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Download photo"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Center Image (High-res, centered, edge-to-edge borderless) */}
          <div
            className="flex-1 flex items-center justify-center p-2 overflow-auto"
            onClick={handleClose}
          >
            <img
              src={src}
              alt={alt || filename || 'Full size photo'}
              onClick={e => {
                e.stopPropagation();
                setIsZoomed(prev => !prev);
              }}
              className={`rounded-xl object-contain drop-shadow-2xl transition-all duration-200 cursor-zoom-in ${
                isZoomed
                  ? 'max-h-none max-w-none scale-125 cursor-zoom-out'
                  : 'max-h-[82vh] w-auto max-w-full'
              }`}
            />
          </div>

          {/* Bottom Bar Indicator */}
          <div className="flex items-center justify-center pb-2 text-[11px] text-white/50">
            <span>Tap anywhere to dismiss</span>
          </div>
        </div>
      )}
    </>
  );
}
