'use client';

import * as React from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { formatDuration, cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  filename?: string | null;
  fileSize?: number | null;
  initialDuration?: number | null;
  isOutgoing?: boolean;
}

export function AudioPlayer({
  src,
  initialDuration,
  isOutgoing = false,
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(initialDuration || 0);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error('Audio play error:', err));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const maxDuration = duration > 0 ? duration : (initialDuration || 100);

  return (
    <div className="flex items-center gap-2.5 py-0.5 px-0.5 min-w-[190px] sm:min-w-[220px] max-w-[260px] select-none">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* WhatsApp Circular Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-xs',
          isOutgoing
            ? 'bg-white text-emerald-700 hover:bg-white/95'
            : 'bg-emerald-600 dark:bg-emerald-500 text-white hover:opacity-90'
        )}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 ml-0.5 fill-current" />
        )}
      </button>

      {/* Progress Bar & Timestamp */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <input
          type="range"
          min="0"
          max={maxDuration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek voice note"
          className={cn(
            'w-full h-1.5 rounded-full appearance-none cursor-pointer',
            isOutgoing
              ? 'bg-white/30 accent-white'
              : 'bg-muted-foreground/25 dark:bg-white/20 accent-emerald-600 dark:accent-emerald-400'
          )}
        />

        <div className="flex items-center justify-between text-[11px] font-mono opacity-80 leading-none">
          <span>{formatDuration(isPlaying ? currentTime : (duration || initialDuration || 0))}</span>
          <Mic className={cn('w-3.5 h-3.5 opacity-60', isOutgoing ? 'text-white' : 'text-foreground')} />
        </div>
      </div>
    </div>
  );
}
