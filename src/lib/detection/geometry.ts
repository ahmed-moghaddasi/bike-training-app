import type { DetectionConfig } from './types';

export type CropRectRatio = { left: number; top: number; width: number; height: number };

/**
 * The crop rectangle a drill's config describes, as ratios (0-1) of the frame.
 * Shared by the offline detector (to crop actual pixels) and the Camera Timer's
 * on-screen aim overlay (to show the rider exactly where to put the crossing),
 * so the two can never drift apart.
 */
export function computeCropRectRatio(detection: DetectionConfig): CropRectRatio {
  const crossingSize = clamp01(detection.zoneWidthRatio);
  const bandSize = clamp01(detection.bandRatio);
  const bandCenter = clamp01(detection.bandCenterRatio);
  const bandStart = clamp(bandCenter - bandSize / 2, 0, 1 - bandSize);

  if (detection.orientation === 'vertical') {
    return { left: (1 - crossingSize) / 2, width: crossingSize, top: bandStart, height: bandSize };
  }
  return { top: (1 - crossingSize) / 2, height: crossingSize, left: bandStart, width: bandSize };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}
