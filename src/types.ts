export type DiagramKey = 'circle' | 'figure-eight' | 'hairpin' | 'l-turn';

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
};

export type Session = {
  id: string;
  date: string;
  bikeId: string;
  drillId: string;
  setupVariantId: string;
  laps: Lap[];
  videoSaved: boolean;
  videoPath?: string;
  videoUri?: string;
  notes?: string;
  conditions?: string;
};

export type ProgressContext = {
  bikeId: string;
  drillId: string;
  setupVariantId: string;
};
