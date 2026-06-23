export type MotionDirection = 'left-to-right' | 'right-to-left';

export type MotionDetectorState =
  | 'calibrating'
  | 'idle'
  | 'left-active'
  | 'right-active'
  | 'cooldown';

export interface MotionDetectorConfig {
  /** Luminance delta (0-255) required for a sampled pixel to count as changed. */
  pixelDeltaThreshold: number;
  /** Fraction (0-1) of changed pixels required to activate either strip. */
  changedRatioThreshold: number;
  consecutiveFrames: number;
  cooldownMs: number;
  calibrationFrames: number;
  sequenceTimeoutMs: number;
  sampleWidth: number;
  sampleHeight: number;
  /** Baseline blend applied only to pixels that currently resemble the background. */
  baselineLearningRate: number;
}

export interface MotionAnalysis {
  timestamp: number;
  calibrated: boolean;
  calibrationProgress: number;
  state: MotionDetectorState;
  leftChangedRatio: number;
  rightChangedRatio: number;
  /** Strongest strip ratio, normalized so 1 is the configured activation threshold. */
  score: number;
  detection: boolean;
  direction?: MotionDirection;
}

export const DEFAULT_MOTION_DETECTOR_CONFIG: MotionDetectorConfig = {
  pixelDeltaThreshold: 16,
  changedRatioThreshold: 0.02,
  consecutiveFrames: 2,
  cooldownMs: 3_000,
  calibrationFrames: 12,
  sequenceTimeoutMs: 1_500,
  sampleWidth: 32,
  sampleHeight: 60,
  baselineLearningRate: 0.02,
};

type PendingStrip = 'left' | 'right' | null;

export class MotionDetector {
  readonly config: MotionDetectorConfig;

  private baseline: Float32Array | null = null;
  private calibrationSamples = 0;
  private leftStreak = 0;
  private rightStreak = 0;
  private pendingStrip: PendingStrip = null;
  private pendingSince = 0;
  private lastDetectionAt = Number.NEGATIVE_INFINITY;

  constructor(config: Partial<MotionDetectorConfig> = {}) {
    this.config = validateConfig({ ...DEFAULT_MOTION_DETECTOR_CONFIG, ...config });
  }

  get isCalibrated() {
    return this.calibrationSamples >= this.config.calibrationFrames;
  }

  /** Clears calibration, crossing state, and cooldown. */
  reset() {
    this.baseline = null;
    this.calibrationSamples = 0;
    this.leftStreak = 0;
    this.rightStreak = 0;
    this.pendingStrip = null;
    this.pendingSince = 0;
    this.lastDetectionAt = Number.NEGATIVE_INFINITY;
  }

  /** Relearns the empty scene while preserving configuration. */
  startCalibration() {
    this.reset();
  }

  /** Adds one known-empty frame to the baseline without running crossing detection. */
  calibrate(frame: ImageData, timestamp = 0): MotionAnalysis {
    const luminance = this.downsampleLuminance(frame);
    this.addCalibrationSample(luminance);
    return this.makeAnalysis(timestamp, 0, 0, false);
  }

  analyze(frame: ImageData, timestamp: number): MotionAnalysis {
    const luminance = this.downsampleLuminance(frame);
    if (!this.isCalibrated || !this.baseline) {
      this.addCalibrationSample(luminance);
      return this.makeAnalysis(timestamp, 0, 0, false);
    }

    const halfWidth = Math.floor(this.config.sampleWidth / 2);
    let leftChanged = 0;
    let rightChanged = 0;
    let leftPixels = 0;
    let rightPixels = 0;

    for (let index = 0; index < luminance.length; index += 1) {
      const x = index % this.config.sampleWidth;
      const changed = Math.abs(luminance[index] - this.baseline[index]) >= this.config.pixelDeltaThreshold;
      if (x < halfWidth) {
        leftPixels += 1;
        if (changed) leftChanged += 1;
      } else {
        rightPixels += 1;
        if (changed) rightChanged += 1;
      }

      // A rider should not be blended into the empty-scene model.
      if (!changed) {
        const rate = this.config.baselineLearningRate;
        this.baseline[index] += (luminance[index] - this.baseline[index]) * rate;
      }
    }

    const leftRatio = leftPixels ? leftChanged / leftPixels : 0;
    const rightRatio = rightPixels ? rightChanged / rightPixels : 0;
    const leftActive = leftRatio >= this.config.changedRatioThreshold;
    const rightActive = rightRatio >= this.config.changedRatioThreshold;
    this.leftStreak = leftActive ? this.leftStreak + 1 : 0;
    this.rightStreak = rightActive ? this.rightStreak + 1 : 0;

    if (this.pendingStrip && timestamp - this.pendingSince > this.config.sequenceTimeoutMs) {
      this.clearSequence();
    }

    const coolingDown = timestamp - this.lastDetectionAt < this.config.cooldownMs;
    if (coolingDown) {
      this.clearSequence();
      return this.makeAnalysis(timestamp, leftRatio, rightRatio, false);
    }

    const leftConfirmed = this.leftStreak >= this.config.consecutiveFrames;
    const rightConfirmed = this.rightStreak >= this.config.consecutiveFrames;

    // Whole-zone changes (camera shake or a nearby hand) cannot begin a sequence.
    if (!this.pendingStrip && leftConfirmed !== rightConfirmed) {
      this.pendingStrip = leftConfirmed ? 'left' : 'right';
      this.pendingSince = timestamp;
    }

    let direction: MotionDirection | undefined;
    if (this.pendingStrip === 'left' && rightConfirmed) direction = 'left-to-right';
    if (this.pendingStrip === 'right' && leftConfirmed) direction = 'right-to-left';

    if (direction) {
      this.lastDetectionAt = timestamp;
      this.clearSequence();
      return this.makeAnalysis(timestamp, leftRatio, rightRatio, true, direction);
    }

    return this.makeAnalysis(timestamp, leftRatio, rightRatio, false);
  }

  private downsampleLuminance(frame: ImageData) {
    if (frame.width < 1 || frame.height < 1 || frame.data.length < frame.width * frame.height * 4) {
      throw new Error('MotionDetector requires non-empty RGBA ImageData.');
    }

    const output = new Float32Array(this.config.sampleWidth * this.config.sampleHeight);
    for (let y = 0; y < this.config.sampleHeight; y += 1) {
      const sourceY = Math.min(frame.height - 1, Math.floor(((y + 0.5) * frame.height) / this.config.sampleHeight));
      for (let x = 0; x < this.config.sampleWidth; x += 1) {
        const sourceX = Math.min(frame.width - 1, Math.floor(((x + 0.5) * frame.width) / this.config.sampleWidth));
        const sourceIndex = (sourceY * frame.width + sourceX) * 4;
        output[y * this.config.sampleWidth + x] =
          frame.data[sourceIndex] * 0.299 +
          frame.data[sourceIndex + 1] * 0.587 +
          frame.data[sourceIndex + 2] * 0.114;
      }
    }
    return output;
  }

  private addCalibrationSample(luminance: Float32Array) {
    if (!this.baseline) this.baseline = new Float32Array(luminance.length);
    const nextCount = Math.min(this.calibrationSamples + 1, this.config.calibrationFrames);
    const weight = 1 / nextCount;
    for (let index = 0; index < luminance.length; index += 1) {
      this.baseline[index] += (luminance[index] - this.baseline[index]) * weight;
    }
    this.calibrationSamples = nextCount;
  }

  private clearSequence() {
    this.pendingStrip = null;
    this.pendingSince = 0;
    this.leftStreak = 0;
    this.rightStreak = 0;
  }

  private makeAnalysis(
    timestamp: number,
    leftChangedRatio: number,
    rightChangedRatio: number,
    detection: boolean,
    direction?: MotionDirection,
  ): MotionAnalysis {
    const coolingDown = timestamp - this.lastDetectionAt < this.config.cooldownMs;
    const state: MotionDetectorState = !this.isCalibrated
      ? 'calibrating'
      : coolingDown
        ? 'cooldown'
        : this.pendingStrip === 'left'
          ? 'left-active'
          : this.pendingStrip === 'right'
            ? 'right-active'
            : 'idle';

    return {
      timestamp,
      calibrated: this.isCalibrated,
      calibrationProgress: Math.min(1, this.calibrationSamples / this.config.calibrationFrames),
      state,
      leftChangedRatio,
      rightChangedRatio,
      score: Math.max(leftChangedRatio, rightChangedRatio) / this.config.changedRatioThreshold,
      detection,
      direction,
    };
  }
}

export function createMotionDetector(config: Partial<MotionDetectorConfig> = {}) {
  return new MotionDetector(config);
}

function validateConfig(config: MotionDetectorConfig): MotionDetectorConfig {
  if (config.pixelDeltaThreshold <= 0 || config.pixelDeltaThreshold > 255) {
    throw new Error('pixelDeltaThreshold must be between 0 and 255.');
  }
  if (config.changedRatioThreshold <= 0 || config.changedRatioThreshold > 1) {
    throw new Error('changedRatioThreshold must be between 0 and 1.');
  }
  if (config.consecutiveFrames < 1 || !Number.isInteger(config.consecutiveFrames)) {
    throw new Error('consecutiveFrames must be a positive integer.');
  }
  if (config.cooldownMs < 0 || config.sequenceTimeoutMs <= 0) {
    throw new Error('cooldownMs must be non-negative and sequenceTimeoutMs must be positive.');
  }
  if (config.calibrationFrames < 1 || !Number.isInteger(config.calibrationFrames)) {
    throw new Error('calibrationFrames must be a positive integer.');
  }
  if (config.sampleWidth < 2 || config.sampleWidth % 2 !== 0 || config.sampleHeight < 1) {
    throw new Error('sampleWidth must be an even integer of at least 2 and sampleHeight must be positive.');
  }
  if (config.baselineLearningRate < 0 || config.baselineLearningRate > 1) {
    throw new Error('baselineLearningRate must be between 0 and 1.');
  }
  return config;
}
