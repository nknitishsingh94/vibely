'use client';

import * as React from 'react';
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  X,
  RotateCw,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvatarPickerModal({ isOpen, onClose }: AvatarPickerModalProps) {
  const { profile, uploadAvatar } = useAuth();

  const [mode, setMode] = React.useState<'menu' | 'camera' | 'preview'>('menu');
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [cameraFacing, setCameraFacing] = React.useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);

  // Stop camera tracks helper
  const stopCamera = React.useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      cameraStreamRef.current = null;
    }
  }, []);

  // Reset state when closing
  React.useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setMode('menu');
      setCapturedImage(null);
      setCameraError(null);
      setIsSaving(false);
    }
  }, [isOpen, stopCamera]);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start Camera
  const startCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
    stopCamera();
    setCameraError(null);
    setMode('camera');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      setCameraError(
        'Could not access camera. Please check permissions or choose an image from your files.'
      );
    }
  };

  // Flip Camera (Front / Back)
  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    await startCamera(nextFacing);
  };

  // Capture Snapshot from Camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 640;

    const canvas = document.createElement('canvas');
    const size = Math.min(vw, vh);
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Centered square crop
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    if (cameraFacing === 'user') {
      // Mirror mode for selfie camera
      ctx.translate(400, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    stopCamera();
    setCapturedImage(dataUrl);
    setMode('preview');
  };

  // Handle File Upload from Device Gallery / File Manager
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, or WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const size = Math.min(iw, ih);
        const sx = (iw - size) / 2;
        const sy = (ih - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        setCapturedImage(dataUrl);
        setMode('preview');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save Avatar (Upload to Server / Supabase)
  const handleSaveAvatar = async () => {
    if (!capturedImage) return;
    setIsSaving(true);

    const res = await uploadAvatar(capturedImage);
    setIsSaving(false);

    if (res.success) {
      toast.success('Profile picture updated successfully!');
      onClose();
    } else {
      toast.error(res.error || 'Failed to update profile picture');
    }
  };

  // Remove Avatar
  const handleRemoveAvatar = async () => {
    setIsSaving(true);
    const res = await uploadAvatar(null);
    setIsSaving(false);

    if (res.success) {
      toast.success('Profile picture removed');
      onClose();
    } else {
      toast.error(res.error || 'Failed to remove picture');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="relative w-full max-w-sm rounded-3xl bg-[#0B141A] border border-white/10 shadow-2xl overflow-hidden flex flex-col p-6">
        {/* Glow ambient accent */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Profile Photo</h3>
              <p className="text-[11px] text-white/50">Customise how partners see you</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Menu Mode */}
        {mode === 'menu' && (
          <div className="py-6 flex flex-col items-center space-y-6 z-10">
            {/* Current Avatar with Ring */}
            <div className="relative group">
              <Avatar
                src={profile?.avatar_path}
                name={profile?.display_name || 'User'}
                size="xl"
                className="w-28 h-28 text-3xl ring-4 ring-emerald-500/40 shadow-xl"
              />
              <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-600 text-white shadow-md border-2 border-[#0B141A]">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <div className="text-center">
              <h4 className="text-base font-bold text-white">{profile?.display_name}</h4>
              <p className="text-xs text-white/50 font-mono mt-0.5">
                {profile?.username ? `@${profile.username.replace(/^@/, '')}` : 'No username set'}
              </p>
            </div>

            {/* Action buttons list */}
            <div className="w-full space-y-2.5 pt-2">
              {/* Take Photo button */}
              <button
                type="button"
                onClick={() => startCamera('user')}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-white transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-white">Take Live Photo</p>
                  <p className="text-[11px] text-white/50">Capture directly with camera</p>
                </div>
              </button>

              {/* Choose from gallery button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-white transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-white">Upload from Gallery</p>
                  <p className="text-[11px] text-white/50">Choose from device storage</p>
                </div>
              </button>

              {/* Remove photo option if user has one */}
              {profile?.avatar_path && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleRemoveAvatar}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-rose-400">Remove Photo</p>
                    <p className="text-[11px] text-rose-400/60">Reset to initial badge</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Live Camera Mode */}
        {mode === 'camera' && (
          <div className="py-4 flex flex-col items-center space-y-4 z-10">
            {cameraError ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3 my-4">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl text-xs"
                  >
                    Upload from Gallery
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setMode('menu')}
                    className="rounded-xl text-xs bg-white/10 hover:bg-white/20"
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Live Circular Camera Viewport */}
                <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-emerald-500/50 shadow-2xl bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      cameraFacing === 'user' ? '-scale-x-100' : ''
                    }`}
                  />
                  {/* Subtle target circle guide */}
                  <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
                </div>

                <p className="text-xs text-white/60">Center your face in the circle</p>

                {/* Camera Action Buttons */}
                <div className="flex items-center justify-center gap-6 pt-2 w-full">
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setMode('menu');
                    }}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Shutter Button */}
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 border-4 border-white/20 transition-all cursor-pointer"
                    title="Capture Photo"
                  >
                    <Camera className="w-7 h-7" />
                  </button>

                  {/* Switch Front/Back Camera */}
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Flip camera"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. Preview & Crop Mode */}
        {mode === 'preview' && (
          <div className="py-6 flex flex-col items-center space-y-6 z-10">
            {/* Circular Preview */}
            <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl bg-black flex items-center justify-center">
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-white">Looking great!</h4>
              <p className="text-xs text-white/50">
                Ready to save this as your profile picture?
              </p>
            </div>

            {/* Preview Action Buttons */}
            <div className="flex items-center justify-center gap-3 w-full pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => {
                  setCapturedImage(null);
                  setMode('menu');
                }}
                className="flex-1 rounded-2xl h-11 border-white/15 text-white hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Retake
              </Button>

              <Button
                type="button"
                disabled={isSaving}
                isLoading={isSaving}
                onClick={handleSaveAvatar}
                className="flex-1 rounded-2xl h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Save Photo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
