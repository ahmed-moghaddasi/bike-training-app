/**
 * Web build stub — NativeCameraTimer is never rendered on web because
 * CameraScreen guards with Platform.OS. Metro resolves this file for the
 * web bundle and NativeCameraTimer.native.tsx for iOS/Android.
 */
import type { Bike, Drill, SessionDraft, SetupVariant } from '../types';

type NativeCameraTimerProps = {
  drill: Drill;
  setup: SetupVariant;
  currentBike: Bike;
  onSessionComplete: (draft: SessionDraft) => void;
  onCancel: () => void;
};

export function NativeCameraTimer(_: NativeCameraTimerProps) {
  return null;
}
