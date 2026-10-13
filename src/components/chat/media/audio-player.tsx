'use client';

import * as React from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Music } from 'lucide-react';
import { formatDuration, formatBytes } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  filename?: string | null;
  fileSize?: number | null;
  initialDuration?: number | null;
  isOutgoing?: boolean;
}

export function AudioPlayer({
  src,
  filename,
  fileSize,
  initialDuration,
  isOutgoing = false,
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(initialDuration || 0);
  const [isMuted, setIsMuted] = React.useState(false);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
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

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`rounded-2xl p-3 w-72 sm:w-80 border shadow-xs transition-colors ${
        isOutgoing
          ? 'bg-primary-foreground/15 text-primary-foreground border-white/20'
          : 'bg-card text-card-foreground border-border/80'
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              isOutgoing ? 'bg-white/20' : 'bg-primary/10 text-primary'
            }`}
          >
            <Music className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium truncate">
            {filename || 'Audio track'}
          </span>
        </div>
        {fileSize && (
          <span className="text-[10px] opacity-75 shrink-0">
            {formatBytes(fileSize)}
          </span>
        )}
      </div>

      {/* Waveform / Visualizer bars */}
      <div className="flex items-center gap-1 h-6 px-1 my-1 opacity-80">
        {Array.from({ length: 24 }).map((_, i) => {
          const barHeight = Math.sin((i / 24) * Math.PI) * 16 + 4;
          const isPast = (i / 24) * 100 <= progressPercent;
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-150 ${
                isPast
                  ? isOutgoing
                    ? 'bg-white'
                    : 'bg-primary'
                  : isOutgoing
                  ? 'bg-white/30'
                  : 'bg-muted-foreground/30'
              } ${isPlaying ? 'wave-bar' : ''}`}
              style={{
                height: `${isPlaying ? Math.max(4, (barHeight * (i % 3 + 1)) % 20) : barHeight}px`,
                animationDelay: `${(i * 0.05).toFixed(2)}s`,
              }}
            />
          );
        })}
      </div>

      {/* Controls & Progress bar */}
      <div className="space-y-1.5 mt-2">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek audio playback"
          className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
        />

        <div className="flex items-center justify-between text-[11px] font-mono opacity-80">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isOutgoing
                ? 'bg-white text-primary hover:bg-white/90'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <a
              href={src}
              download={filename || 'audio.mp3'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download audio file"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
