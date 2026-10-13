'use client';

import * as React from 'react';
import { Mic, Square, Trash2, Send, Play, Pause } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VoiceRecorderBarProps {
  onSendVoice: (audioFile: File, durationSeconds: number) => void;
  onCancel: () => void;
}

export function VoiceRecorderBar({ onSendVoice, onCancel }: VoiceRecorderBarProps) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = React.useState(false);
  const [permissionError, setPermissionError] = React.useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);

  // Start recording on mount
  React.useEffect(() => {
    let mounted = true;

    async function startRecording() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setPermissionError('Microphone not supported in this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const finalType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: finalType });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };

        recorder.start(250);
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setElapsedSeconds(prev => prev + 1);
        }, 1000);
      } catch (err: unknown) {
        console.error('Microphone error:', err);
        setPermissionError('Microphone permission denied or unavailable.');
      }
    }

    startRecording();

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    }
  };

  const handleSend = () => {
    if (!audioBlob) return;
    const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([audioBlob], `voice_recording_${Date.now()}.${ext}`, {
      type: audioBlob.type,
    });
    onSendVoice(file, elapsedSeconds);
  };

  const togglePreviewPlay = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play().catch(e => console.error(e));
      setIsPlayingPreview(true);
    }
  };

  if (permissionError) {
    return (
      <div className="flex items-center justify-between p-3 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 text-xs">
        <span>{permissionError}</span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#071F17] border border-[#0C3B2E]/20 dark:border-white/10 shadow-lg animate-in slide-in-from-bottom-2 duration-150">
      {audioUrl && (
        <audio
          ref={audioPreviewRef}
          src={audioUrl}
          onEnded={() => setIsPlayingPreview(false)}
        />
      )}

      {/* Recording indicator & timer */}
      <div className="flex items-center gap-3">
        {isRecording ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Recording</span>
          </div>
        ) : (
          <button
            onClick={togglePreviewPlay}
            className="w-8 h-8 rounded-full bg-[#0C3B2E] text-white flex items-center justify-center cursor-pointer shadow-xs hover:bg-[#155E49] transition-colors"
            aria-label="Play audio preview"
          >
            {isPlayingPreview ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>
        )}

        <span className="font-mono text-xs font-bold text-foreground">
          {formatDuration(elapsedSeconds)}
        </span>

        {/* Pulsing audio bars */}
        {isRecording && (
          <div className="flex items-center gap-1 h-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-500 rounded-full animate-pulse"
                style={{
                  height: `${Math.max(4, ((i * 5) % 16) + 4)}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer rounded-xl"
          title="Discard recording"
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        {isRecording ? (
          <Button
            size="sm"
            onClick={handleStopRecording}
            variant="outline"
            className="rounded-xl gap-1.5 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer text-xs font-semibold"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSend}
            className="rounded-xl gap-1.5 bg-[#0C3B2E] hover:bg-[#155E49] text-white shadow-md text-xs font-semibold cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Send Audio
          </Button>
        )}
      </div>
    </div>
  );
}
