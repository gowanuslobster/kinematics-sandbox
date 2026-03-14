import { useMemo, useState } from "react";
import { AIR_DENSITY_SEA_LEVEL, BALL_PRESETS } from "./physics";
import type { MicroscopeBallType } from "./PhysicsMicroscope";

type BallPresetKey = Exclude<MicroscopeBallType, "custom">;

const BALL_LABELS: Record<MicroscopeBallType, string> = {
  baseball: "Baseball",
  pingPong: "Ping Pong",
  cannonball: "Cannonball",
  custom: "Custom",
};

export interface SimulationControlValues {
  initialVelocity: number;
  velocityMax: number;
  launchAngle: number;
  gravity: number;
  gravityMax: number;
  dragCoefficient: number;
  dragMax: number;
  mass: number;
  radius: number;
  selectedBallType: MicroscopeBallType;
  spinRpm: number;
  airDensity: number;
  targetX: number;
  targetY: number;
  targetDiameter: number;
  xAxisMax: number;
  yAxisMax: number;
}

export interface SimulationControlActions {
  setInitialVelocity: (value: number) => void;
  updateVelocityMax: (value: number) => void;
  setLaunchAngle: (value: number) => void;
  setGravity: (value: number) => void;
  updateGravityMax: (value: number) => void;
  setDragCoefficient: (value: number) => void;
  updateDragMax: (value: number) => void;
  applyBallPreset: (preset: BallPresetKey) => void;
  setMass: (value: number) => void;
  setRadius: (value: number) => void;
  setSpinRpm: (value: number) => void;
  setAirDensity: (value: number) => void;
  setTargetX: (value: number) => void;
  setTargetY: (value: number) => void;
  setTargetDiameter: (value: number) => void;
  setXAxisMax: (value: number) => void;
  setYAxisMax: (value: number) => void;
}

export function useSimulationControls(): {
  values: SimulationControlValues;
  derived: {
    targetRadius: number;
    selectedBallLabel: string;
    ballPresetOptions: Array<{ key: BallPresetKey; label: string }>;
  };
  actions: SimulationControlActions;
} {
  const [initialVelocity, setInitialVelocity] = useState(50);
  const [velocityMax, setVelocityMax] = useState(100);
  const [launchAngle, setLaunchAngle] = useState(45);
  const [gravity, setGravity] = useState(9.81);
  const [gravityMax, setGravityMax] = useState(25);
  const [dragCoefficient, setDragCoefficientState] = useState(0.5);
  const [dragMax, setDragMax] = useState(1);
  const [mass, setMassState] = useState<number>(BALL_PRESETS.baseball.mass);
  const [radius, setRadiusState] = useState<number>(BALL_PRESETS.baseball.radius);
  const [selectedBallType, setSelectedBallType] = useState<MicroscopeBallType>("baseball");
  const [spinRpm, setSpinRpm] = useState(0);
  const [airDensity, setAirDensity] = useState(AIR_DENSITY_SEA_LEVEL);
  const [targetX, setTargetX] = useState(100);
  const [targetY, setTargetY] = useState(25);
  const [targetDiameter, setTargetDiameter] = useState(3);
  const [xAxisMax, setXAxisMax] = useState(120);
  const [yAxisMax, setYAxisMax] = useState(70);

  const actions: SimulationControlActions = {
    setInitialVelocity,
    updateVelocityMax(value) {
      if (Number.isNaN(value) || value < 1) return;
      setVelocityMax(value);
      setInitialVelocity((current) => Math.min(current, value));
    },
    setLaunchAngle,
    setGravity,
    updateGravityMax(value) {
      if (Number.isNaN(value) || value < 0.1) return;
      setGravityMax(value);
      setGravity((current) => Math.min(current, value));
    },
    setDragCoefficient(value) {
      setDragCoefficientState(value);
      setSelectedBallType("custom");
    },
    updateDragMax(value) {
      if (Number.isNaN(value) || value < 0.01 || value > 2) return;
      setDragMax(value);
      setDragCoefficientState((current) => {
        if (current <= value) return current;
        setSelectedBallType("custom");
        return value;
      });
    },
    applyBallPreset(preset) {
      const nextPreset = BALL_PRESETS[preset];
      setMassState(nextPreset.mass);
      setRadiusState(nextPreset.radius);
      setDragCoefficientState(nextPreset.dragCoefficient);
      setSelectedBallType(preset);
    },
    setMass(value) {
      setMassState(value);
      setSelectedBallType("custom");
    },
    setRadius(value) {
      setRadiusState(value);
      setSelectedBallType("custom");
    },
    setSpinRpm,
    setAirDensity,
    setTargetX,
    setTargetY,
    setTargetDiameter,
    setXAxisMax,
    setYAxisMax,
  };

  const values: SimulationControlValues = {
    initialVelocity,
    velocityMax,
    launchAngle,
    gravity,
    gravityMax,
    dragCoefficient,
    dragMax,
    mass,
    radius,
    selectedBallType,
    spinRpm,
    airDensity,
    targetX,
    targetY,
    targetDiameter,
    xAxisMax,
    yAxisMax,
  };

  const derived = useMemo(() => ({
    targetRadius: targetDiameter / 2,
    selectedBallLabel: BALL_LABELS[selectedBallType],
    ballPresetOptions: [
      { key: "baseball" as const, label: BALL_LABELS.baseball },
      { key: "pingPong" as const, label: BALL_LABELS.pingPong },
      { key: "cannonball" as const, label: BALL_LABELS.cannonball },
    ],
  }), [selectedBallType, targetDiameter]);

  return { values, derived, actions };
}
