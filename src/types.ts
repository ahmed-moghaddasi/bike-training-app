export type DiagramKey = 'circle' | 'figure-eight' | 'hairpin' | 'l-turn' | 'straight-line';

export type DrillGroup = 'foundations' | 'race-craft';

export type BikeCategory = 'pitbike' | 'minigp' | 'lightweight' | 'full-size';

export type Bike = {
  id: string;
  name: string;
  category: BikeCategory;
  engineSize?: string;
  notes?: string;
  isCurrent?: boolean;
};

export type SetupVariant = {
  id: string;
  drillId: string;
  name: string;
  coneCount: number;
  measurements: string[];
  isDefault?: boolean;
};

export type CameraPlacement = {
  positionDescription: string;
  whatCameraShouldSee: string[];
  timingPoint: string;
  detectionZoneSuggestion: string;
};

export type TimingRule = {
  startRule: string;
  lapRule: string;
  comparisonContext: string;
  detectionsPerLap?: number;
  detectionMode?: 'laps' | 'straight-line';
};

export type Progression = {
  title: string;
  description: string;
  comparisonType: 'sameTimingContext' | 'newSetupVariant';
  targetSetupVariantId?: string;
};

export type Drill = {
  id: string;
  name: string;
  group: DrillGroup;
  isReady: boolean;
  shortDescription: string;
  whatThisTrains: string[];
  whyItMatters: string;
  diagramKey: DiagramKey;
  defaultSetupVariantId: string;
  setupVariants: SetupVariant[];
  conePlacementSteps: string[];
  cameraPlacement: CameraPlacement;
  timingRule: TimingRule;
  howToRideSteps: string[];
  coachingCues: string[];
  commonMistakes: string[];
  reviewPrompts: string[];
  successMetrics: string[];
  progressions: Progression[];
};

export type Lap = {
  lapNumber: number;
  time: number;
  timestampInVideo?: number;
  /** Warm-up/cool-down (start/end of a riding segment) or break (the lap spanning a mid-session pause) — shown to the rider but left out of best/average/spread. */
  lapLabel?: 'warmup' | 'cooldown' | 'break';
  excludedFromScoring?: boolean;
  entrySpeedKph?: number;
  stoppingDistanceMeters?: number;
  brakingDurationMs?: number;
  speedMethod?: 'direct' | 'kinematic';
  /** True when the bike stopped at or past the far edge of frame; stoppingDistanceMeters is a lower bound. */
  stopOffScreen?: boolean;
};

export type DetectionEvent = {
  eventType: 'sessionStart' | 'lapDetected';
  detectedAt: string;
  videoTimestamp: number;
  lapNumber?: number;
  score?: number;
};

export type SessionDraft = {
  drillId: string;
  setupVariantId: string;
  bikeId: string;
  laps: Lap[];
  videoUri?: string;
  videoSaved: boolean;
  videoSizeBytes?: number;
  videoDurationSeconds?: number;
  recordingStopReason?: 'user' | 'maxDuration';
  startedAt: string;
  endedAt: string;
  detectionEvents: DetectionEvent[];
  /** Laps haven't been detected yet — Session Summary should run lapDetector against videoUri. */
  needsProcessing?: boolean;
};

/**
 * One recorded draft's hand-off to server-side processing, owned by App (not
 * by whichever screen happens to be mounted) so navigating away from Session
 * Summary doesn't interrupt the upload or the trigger call. Lap detection
 * itself now happens out-of-process (GitHub Actions worker) — this job only
 * tracks getting the video there, not the detection result. The actual laps
 * show up later via loadSavedSessions() the next time Sessions is opened.
 * See JobRunner in App.tsx.
 */
export type ProcessingJob = {
  id: string;
  drillId: string;
  draft: SessionDraft;
  status: 'uploading' | 'queued' | 'error';
  /** Set once the pending `sessions` row is created — needed before notes can be attached. */
  sessionId?: string;
  errorMessage?: string;
  /** Notes typed on Session Summary before the user chose to save without waiting for upload to finish. */
  notes: string;
  /** Set when the user taps Save Session — JobRunner attaches notes once a sessionId exists. */
  saveRequested: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError?: string;
};

export type Session = {
  id: string;
  date: string;
  bikeId: string;
  drillId: string;
  setupVariantId: string;
  laps: Lap[];
  /** Whether the rider saved a copy of the video to their own device. The app never stores or re-serves the file. */
  videoSaved: boolean;
  notes?: string;
  conditions?: string;
  /** Server-side processing state — undefined for the seed/mock sessions, which are always 'ready'. */
  status?: 'ready' | 'queued' | 'processing' | 'error';
  errorMessage?: string;
};

export type ProgressContext = {
  bikeId: string;
  drillId: string;
  setupVariantId: string;
};
