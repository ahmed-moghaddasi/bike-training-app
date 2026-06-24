export type LocalVideoSaveResult = 'shared' | 'downloaded' | 'cancelled' | 'unsupported';

export async function shareOrDownloadVideo(blob: Blob, filename: string): Promise<LocalVideoSaveResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Fall through to the download fallback below.
    }
  }

  if (typeof document !== 'undefined' && typeof URL !== 'undefined' && 'createObjectURL' in URL) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  return 'unsupported';
}
