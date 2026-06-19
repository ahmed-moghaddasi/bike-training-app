import type { Drill, ProgressContext, Session } from '../types';

export function formatLap(seconds: number | undefined) {
  if (!seconds || Number.isNaN(seconds)) return '--';
  return seconds.toFixed(2);
}

export function formatDate(date: string, compact = false) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', compact
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

export function bestLap(session: Session) {
  return Math.min(...session.laps.map((lap) => lap.time));
}

export function averageLap(session: Session) {
  const total = session.laps.reduce((sum, lap) => sum + lap.time, 0);
  return total / session.laps.length;
}

export function lapSpread(session: Session) {
  const times = session.laps.map((lap) => lap.time);
  return Math.max(...times) - Math.min(...times);
}

export function contextKey(context: ProgressContext) {
  return `${context.bikeId}:${context.drillId}:${context.setupVariantId}`;
}

export function sessionsForContext(sessions: Session[], context: ProgressContext) {
  return sessions
    .filter(
      (session) =>
        session.bikeId === context.bikeId &&
        session.drillId === context.drillId &&
        session.setupVariantId === context.setupVariantId,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function latestSession(sessions: Session[]) {
  return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

export function getSetupName(drill: Drill | undefined, setupVariantId: string) {
  return drill?.setupVariants.find((setup) => setup.id === setupVariantId)?.name ?? setupVariantId;
}
