import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrajectoryPoint } from "./physics";

type Mode = "live" | "challenge";
type AnalysisSource = "none" | "manual" | "auto";

interface ChallengeShot {
  points: TrajectoryPoint[];
  hit: boolean;
  visibleCount: number;
  contextKey: string;
}

const ANIMATION_INTERVAL_MS = 16;
const ANIMATION_POINTS_PER_FRAME = 2;
const STATIC_POINT_DELTA_EPSILON = 1e-4;
const STATIC_FRAME_STREAK_TO_PAUSE = 6;
const STATIC_IDLE_MS = 300;

/**
 * Encapsulates challenge-mode playback.
 * It owns the animated reveal of a fired shot, keeps track of the current
 * analysis point, and exposes the mode-dependent points/hit state that the UI
 * should render. Playback speed affects reveal cadence only; it does not
 * change the underlying simulated trajectory.
 */
export function useChallengePlayback(
  mode: Mode,
  points: TrajectoryPoint[],
  hit: boolean,
  playbackSpeed = 1,
  trajectoryContextKey: string,
) {
  // Track recent user activity so a static tail of points can fast-forward
  // instead of animating frame-by-frame when the user is idle.
  const lastInteractionAtRef = useRef<number>(0);
  const staticFrameStreakRef = useRef<number>(0);
  const [challengeShot, setChallengeShot] = useState<ChallengeShot | null>(null);
  const [activeAnalysisPoint, setActiveAnalysisPoint] = useState<TrajectoryPoint | null>(null);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>("none");
  const [isAutoScrubbing, setIsAutoScrubbing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const challengeShotRef = useRef<ChallengeShot | null>(null);
  const effectiveChallengeShot =
    challengeShot != null && challengeShot.contextKey === trajectoryContextKey
      ? challengeShot
      : null;

  const isChallenge = mode === "challenge";
  // A paused shot is still "active", but autoplay no longer owns the timeline.
  const isAnimating =
    isChallenge
    && effectiveChallengeShot != null
    && !isPaused
    && effectiveChallengeShot.visibleCount < effectiveChallengeShot.points.length;
  const isPausedDuringPlayback =
    isChallenge
    && effectiveChallengeShot != null
    && isPaused
    && effectiveChallengeShot.visibleCount < effectiveChallengeShot.points.length;
  const challengeComplete =
    isChallenge
    && effectiveChallengeShot != null
    && effectiveChallengeShot.visibleCount >= effectiveChallengeShot.points.length;

  useEffect(() => {
    challengeShotRef.current = challengeShot;
  }, [challengeShot]);

  useEffect(() => {
    // Any user interaction resets the idle detector used by the playback loop.
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
      staticFrameStreakRef.current = 0;
    };
    markInteraction();
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("pointermove", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("touchstart", markInteraction, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("pointermove", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
    };
  }, []);

  useEffect(() => {
    if (
      !effectiveChallengeShot
      || isPaused
      || effectiveChallengeShot.visibleCount >= effectiveChallengeShot.points.length
    ) return;

    let lastFrameTime: number | null = null;
    let frameId = 0;

    // Advance the visible point count on a fixed cadence while optionally
    // fast-forwarding through near-static frames after a short idle period.
    const tick = (timestamp: number) => {
      const currentShot = challengeShotRef.current;
      if (!currentShot || currentShot.visibleCount >= currentShot.points.length) {
        setIsAutoScrubbing(false);
        return;
      }
      if (lastFrameTime == null) {
        lastFrameTime = timestamp;
        frameId = requestAnimationFrame(tick);
        return;
      }
      if (timestamp - lastFrameTime < ANIMATION_INTERVAL_MS) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      lastFrameTime = timestamp;
      let nextVisibleCount = Math.min(
        currentShot.visibleCount + Math.max(1, Math.round(ANIMATION_POINTS_PER_FRAME * playbackSpeed)),
        currentShot.points.length,
      );

      const prevPoint = currentShot.points[Math.max(0, currentShot.visibleCount - 1)];
      const nextPoint = currentShot.points[Math.max(0, nextVisibleCount - 1)];
      const pointDelta =
        prevPoint && nextPoint
          ? Math.hypot(nextPoint.x - prevPoint.x, nextPoint.y - prevPoint.y)
          : Number.POSITIVE_INFINITY;

      if (pointDelta <= STATIC_POINT_DELTA_EPSILON) {
        staticFrameStreakRef.current += 1;
      } else {
        staticFrameStreakRef.current = 0;
      }

      const idleForMs = Date.now() - lastInteractionAtRef.current;
      const shouldPauseLoop =
        idleForMs >= STATIC_IDLE_MS
        && staticFrameStreakRef.current >= STATIC_FRAME_STREAK_TO_PAUSE;

      if (shouldPauseLoop) {
        nextVisibleCount = currentShot.points.length;
      }

      const nextShot = { ...currentShot, visibleCount: nextVisibleCount };
      challengeShotRef.current = nextShot;
      setChallengeShot(nextShot);

      if (nextVisibleCount > 0) {
        setActiveAnalysisPoint(nextShot.points[nextVisibleCount - 1] ?? null);
      }
      if (nextVisibleCount >= currentShot.points.length) {
        setIsAutoScrubbing(false);
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [effectiveChallengeShot, isPaused, playbackSpeed]);

  // Live mode always shows the full current path, while challenge mode reveals
  // only the points the playback loop has exposed so far.
  const visiblePoints = useMemo(() => {
    if (mode === "live") return points;
    if (!effectiveChallengeShot) return [];
    return effectiveChallengeShot.points.slice(0, effectiveChallengeShot.visibleCount);
  }, [effectiveChallengeShot, mode, points]);

  const displayHit =
    mode === "live"
      ? hit
      : challengeComplete && effectiveChallengeShot
        ? effectiveChallengeShot.hit
        : false;
  const displayedAnalysisSource =
    mode === "challenge" && effectiveChallengeShot == null ? "none" : analysisSource;
  const displayedActiveAnalysisPoint =
    mode === "challenge" && effectiveChallengeShot == null ? null : activeAnalysisPoint;

  // Ignore hover input while the auto-scrub animation is in control. Once the
  // user deliberately hovers, ownership of the analysis point becomes manual.
  const handleManualAnalysisPointChange = useCallback((point: TrajectoryPoint | null) => {
    if (isAutoScrubbing) return;
    if (analysisSource === "auto") {
      if (point == null) return;
      setAnalysisSource("manual");
      setActiveAnalysisPoint(point);
      return;
    }
    if (point == null) {
      setAnalysisSource("none");
      setActiveAnalysisPoint(null);
      return;
    }
    setAnalysisSource("manual");
    setActiveAnalysisPoint(point);
  }, [analysisSource, isAutoScrubbing]);

  // Firing snapshots the current live trajectory into challenge playback state.
  const fire = useCallback(() => {
    if (mode !== "challenge") return;
    staticFrameStreakRef.current = 0;
    lastInteractionAtRef.current = Date.now();
    const shot = {
      points: [...points],
      hit,
      visibleCount: 0,
      contextKey: trajectoryContextKey,
    };
    setAnalysisSource("auto");
    setIsAutoScrubbing(true);
    setIsPaused(false);
    setActiveAnalysisPoint(shot.points[0] ?? null);
    challengeShotRef.current = shot;
    setChallengeShot(shot);
  }, [hit, mode, points, trajectoryContextKey]);

  // Pausing freezes playback at the current visible point; resuming restarts the reveal loop.
  const togglePlaybackPaused = useCallback(() => {
    if (
      mode !== "challenge"
      || !effectiveChallengeShot
      || effectiveChallengeShot.visibleCount >= effectiveChallengeShot.points.length
    ) return;
    setIsPaused((current) => !current);
  }, [effectiveChallengeShot, mode]);

  // Returning to live mode should fully discard any challenge playback state.
  const resetForLiveMode = useCallback(() => {
    staticFrameStreakRef.current = 0;
    setIsAutoScrubbing(false);
    setIsPaused(false);
    setAnalysisSource("none");
    setActiveAnalysisPoint(null);
    challengeShotRef.current = null;
    setChallengeShot(null);
  }, []);

  // Entering challenge mode keeps the current controls/trajectory but clears
  // stale analysis state from prior hovering or playback.
  const resetForChallengeMode = useCallback(() => {
    setIsPaused(false);
    setAnalysisSource("none");
    setActiveAnalysisPoint(null);
  }, []);

  return {
    activeAnalysisPoint: displayedActiveAnalysisPoint,
    analysisSource: displayedAnalysisSource,
    challengeComplete,
    challengeShot: effectiveChallengeShot,
    displayHit,
    isAnimating,
    isPaused: isPausedDuringPlayback,
    visiblePoints,
    fire,
    togglePlaybackPaused,
    handleManualAnalysisPointChange,
    resetForChallengeMode,
    resetForLiveMode,
  };
}
