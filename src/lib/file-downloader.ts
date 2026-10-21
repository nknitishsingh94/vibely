'use client';

import { toast } from '@/components/ui/toast';

export interface DownloadOptions {
  url: string;
  filename?: string | null;
  mimeType?: string | null;
  onStart?: () => void;
  onFinish?: () => void;
}

/**
 * Downloads a video, document, photo, or audio file directly to the device's local files.
 * - On Native Android (Capacitor/Vibely APK): Routes to Android DownloadManager -> saves directly in Downloads/Files without opening Chrome.
 * - On Web Browser: Converts cross-origin file to a same-origin Blob URL and triggers instant silent download to Downloads folder without navigating away.
 */
export async function downloadMediaFile(options: DownloadOptions): Promise<boolean> {
  const { url, filename, mimeType, onStart, onFinish } = options;

  if (!url) {
    toast.error('Download URL not found');
    return false;
  }

  const cleanFilename = (filename || 'download').trim().replace(/[/\\?%*:|"<>]/g, '_');

  try {
    onStart?.();

    // 1. Android Native App (Vibely Native Bridge)
    if (typeof window !== 'undefined' && (window as any).VibelyNative?.downloadFile) {
      try {
        (window as any).VibelyNative.downloadFile(url, cleanFilename, mimeType || '');
        toast.success(`Downloading ${cleanFilename} to Files...`);
        onFinish?.();
        return true;
      } catch (nativeErr) {
        console.warn('VibelyNative downloadFile fallback:', nativeErr);
      }
    }

    // 2. Web Browser: Fetch as Blob and trigger direct same-origin download
    // (Prevents Chrome/browser from opening file in a new tab when target="_blank" is used on cross-origin URLs)
    toast.info(`Downloading ${cleanFilename}...`);

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = blobUrl;
    anchor.download = cleanFilename;
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
      onFinish?.();
    }, 1500);

    toast.success(`Saved ${cleanFilename} to your device!`);
    return true;
  } catch (err: any) {
    console.error('Error downloading file:', err);

    // Fallback: direct anchor download without target="_blank"
    try {
      const fallbackAnchor = document.createElement('a');
      fallbackAnchor.style.display = 'none';
      fallbackAnchor.href = url;
      fallbackAnchor.download = cleanFilename;
      document.body.appendChild(fallbackAnchor);
      fallbackAnchor.click();
      document.body.removeChild(fallbackAnchor);
      onFinish?.();
      return true;
    } catch {
      toast.error('Failed to download file. Please check your connection.');
      onFinish?.();
      return false;
    }
  }
}
