import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrajectoryPoint } from "./physics";

type Mode = "live" | "challenge";
type AnalysisSource = "none" | "manual" | "auto";

interface ChallengeShot {
  points: TrajectoryPoint[];
  hit: boolean;
  visibleCount: number;
}

const ANIMATION_INTERVAL_MS = 16;
const ANIMATION_POINTS_PER_FRAME = 2;
const STATIC_POINT_DELTA_EPSILON = 1e-4;
const STATIC_FRAME_STREAK_TO_PAUSE = 6;
const STATIC_IDLE_MS = 300;

export function useChallengePlayback(
  mode: Mode,
  points: TrajectoryPoint[],
  hit: boolean,
) {
  const lastInteractionAtRef = useRef<number>(0);
  const staticFrameStreakRef = useRef<number>(0);
  const [challengeShot, setChallengeShot] = useState<ChallengeShot | null>(null);
  const [activeAnalysisPoint, setActiveAnalysisPoint] = useState<TrajectoryPoint | null>(null);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>("none");
  const [isAutoScrubbing, setIsAutoScrubbing] = useState(false);
  const challengeShotRef = useRef<ChallengeShot | null>(null);

  const isChallenge = mode === "challenge";
  const isAnimating =
    isChallenge
    && challengeShot != null
    && challengeShot.visibleCount < challengeShot.points.length;
  const challengeComplete =
    isChallenge
    && challengeShot != null
    && challengeShot.visibleCount >= challengeShot.points.length;

  useEffect(() => {
    challengeShotRef.current = challengeShot;
  }, [challengeShot]);

  useEffect(() => {
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
    if (!challengeShot || challengeShot.visibleCount >= challengeShot.points.length) return;

    let lastFrameTime: number | null = null;
    let frameId = 0;

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
        currentShot.visibleCount + ANIMATION_POINTS_PER_FRAME,
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
  }, [challengeShot]);

  const visiblePoints = useMemo(() => {
    if (mode === "live") return points;
    if (!challengeShot) return [];
    return challengeShot.points.slice(0, challengeShot.visibleCount);
  }, [mode, challengeShot, points]);

  const displayHit =
    mode === "live"
      ? hit
      : challengeComplete && challengeShot
        ? challengeShot.hit
        : false;

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

  const fire = useCallback(() => {
    if (mode !== "challenge") return;
    staticFrameStreakRef.current = 0;
    lastInteractionAtRef.current = Date.now();
    const shot = {
      points: [...points],
      hit,
      visibleCount: 0,
    };
    setAnalysisSource("auto");
    setIsAutoScrubbing(true);
    setActiveAnalysisPoint(shot.points[0] ?? null);
    challengeShotRef.current = shot;
    setChallengeShot(shot);
  }, [hit, mode, points]);

  const resetForLiveMode = useCallback(() => {
    staticFrameStreakRef.current = 0;
    setIsAutoScrubbing(false);
    setAnalysisSource("none");
    setActiveAnalysisPoint(null);
    challengeShotRef.current = null;
    setChallengeShot(null);
  }, []);

  const resetForChallengeMode = useCallback(() => {
    setAnalysisSource("none");
    setActiveAnalysisPoint(null);
  }, []);

  return {
    activeAnalysisPoint,
    analysisSource,
    challengeComplete,
    challengeShot,
    displayHit,
    isAnimating,
    visiblePoints,
    fire,
    handleManualAnalysisPointChange,
    resetForChallengeMode,
    resetForLiveMode,
  };
}
