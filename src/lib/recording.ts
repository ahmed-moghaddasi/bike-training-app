export const TARGET_VIDEO_BITS_PER_SECOND = 600_000;
export const MAX_RECORDING_DURATION_MS = 8 * 60 * 1_000;

export const CAMERA_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 640 },
  height: { ideal: 480 },
};

export const CAMERA_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: CAMERA_VIDEO_CONSTRAINTS,
};

const MEDIA_RECORDER_MIME_TYPES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function selectMediaRecorderMimeType(): string | undefined {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return undefined;
  }

  return MEDIA_RECORDER_MIME_TYPES.find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  );
}

export function getMediaRecorderOptions(): MediaRecorderOptions {
  const mimeType = selectMediaRecorderMimeType();

  return {
    videoBitsPerSecond: TARGET_VIDEO_BITS_PER_SECOND,
    ...(mimeType ? { mimeType } : {}),
  };
}

export function estimateRecordingBytes(
  durationMs: number,
  videoBitsPerSecond = TARGET_VIDEO_BITS_PER_SECOND,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  if (!Number.isFinite(videoBitsPerSecond) || videoBitsPerSecond <= 0) return 0;

  return Math.ceil((durationMs / 1_000) * (videoBitsPerSecond / 8));
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"] as const;
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1_024)),
    units.length - 1,
  );
  const value = bytes / 1_024 ** unitIndex;
  const precision = unitIndex === 0 || value >= 10 ? 0 : 1;

  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

