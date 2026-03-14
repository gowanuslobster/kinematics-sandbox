import type { ReactNode } from "react";
import { AIR_DENSITY_SEA_LEVEL } from "./physics";
import type { MicroscopeBallType } from "./PhysicsMicroscope";
import type {
  SimulationControlActions,
  SimulationControlValues,
} from "./useSimulationControls";

type Mode = "live" | "challenge";

interface AppSidebarProps {
  mode: Mode;
  isAnimating: boolean;
  pinnedTrajectoryActive: boolean;
  values: SimulationControlValues;
  derived: {
    selectedBallLabel: string;
    ballPresetOptions: Array<{
      key: Exclude<MicroscopeBallType, "custom">;
      label: string;
    }>;
  };
  actions: SimulationControlActions;
  onFire: () => void;
  onPinCurrentTrajectory: () => void;
  onClearPinnedTrajectory: () => void;
}

const sliderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.25rem",
};

const labelStyle = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#374151",
};

const valueStyle = {
  fontSize: "0.75rem",
  color: "#6b7280",
};

const inputStyle = {
  width: "100%",
  accentColor: "#2563eb",
};

const maxInputStyle = {
  width: "3rem",
  padding: "2px 4px",
  fontSize: "0.7rem",
  border: "1px solid #d1d5db",
  borderRadius: 4,
} as const;

function SidebarSection({ children }: { children: ReactNode }) {
  return <div style={sliderStyle}>{children}</div>;
}

function NumberInputControl({
  label,
  value,
  min,
  step,
  ariaLabel,
  helperText,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number | "any";
  ariaLabel: string;
  helperText?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div
      style={{
        ...sliderStyle,
        marginRight: "0.75rem",
        marginLeft: "0.25rem",
      }}
    >
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (!Number.isNaN(nextValue) && nextValue >= min) {
            onChange(nextValue);
          }
        }}
        style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
        aria-label={ariaLabel}
      />
      {helperText ? <span style={{ ...valueStyle, fontSize: "0.7rem" }}>{helperText}</span> : null}
    </div>
  );
}

function RangeControl({
  label,
  valueText,
  rangeMin,
  rangeMax,
  rangeStep,
  rangeValue,
  rangeAriaLabel,
  onRangeChange,
  maxValue,
  maxMin,
  maxStep,
  maxAriaLabel,
  onMaxChange,
  footer,
}: {
  label: string;
  valueText: string;
  rangeMin: number;
  rangeMax: number;
  rangeStep?: number;
  rangeValue: number;
  rangeAriaLabel: string;
  onRangeChange: (value: number) => void;
  maxValue?: number;
  maxMin?: number;
  maxStep?: number;
  maxAriaLabel?: string;
  onMaxChange?: (value: number) => void;
  footer?: ReactNode;
}) {
  return (
    <SidebarSection>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{valueText}</span>
      <input
        type="range"
        min={rangeMin}
        max={rangeMax}
        step={rangeStep}
        value={rangeValue}
        onChange={(event) => onRangeChange(Number(event.target.value))}
        style={inputStyle}
        aria-label={rangeAriaLabel}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
        {onMaxChange && maxValue != null && maxMin != null && maxStep != null && maxAriaLabel ? (
          <>
            <label
              style={{ fontSize: "0.7rem", color: "#6b7280", marginRight: "4px", alignSelf: "center" }}
            >
              max:
            </label>
            <input
              type="number"
              min={maxMin}
              step={maxStep}
              value={maxValue}
              onChange={(event) => onMaxChange(Number(event.target.value))}
              style={maxInputStyle}
              aria-label={maxAriaLabel}
            />
          </>
        ) : (
          <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>max: {rangeMax}{label === "Launch Angle" ? "°" : ""}</span>
        )}
      </div>
      {footer}
    </SidebarSection>
  );
}

function DualNumberRow({
  left,
  right,
}: {
  left: {
    label: string;
    value: number;
    ariaLabel: string;
    onChange: (value: number) => void;
  };
  right: {
    label: string;
    value: number;
    ariaLabel: string;
    onChange: (value: number) => void;
  };
}) {
  return (
    <div
      style={{
        ...sliderStyle,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: "0.5rem",
        marginRight: "0.75rem",
        marginLeft: "0.25rem",
      }}
    >
      {[left, right].map((field) => (
        <div key={field.label} style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>{field.label}</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={field.value}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (!Number.isNaN(nextValue) && nextValue > 0) {
                field.onChange(nextValue);
              }
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label={field.ariaLabel}
          />
        </div>
      ))}
    </div>
  );
}

export function AppSidebar({
  mode,
  isAnimating,
  pinnedTrajectoryActive,
  values,
  derived,
  actions,
  onFire,
  onPinCurrentTrajectory,
  onClearPinnedTrajectory,
}: AppSidebarProps) {
  const isChallenge = mode === "challenge";

  return (
    <aside
      style={{
        flexShrink: 0,
        width: 240,
        padding: "1.25rem 1rem",
        background: "#f9fafb",
        borderRight: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        overflowY: "auto",
      }}
    >
      {isChallenge ? (
        <SidebarSection>
          <button
            type="button"
            onClick={onFire}
            disabled={isAnimating}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              fontWeight: 600,
              background: isAnimating ? "#9ca3af" : "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: isAnimating ? "not-allowed" : "pointer",
            }}
          >
            {isAnimating ? "Firing…" : "Fire!"}
          </button>
        </SidebarSection>
      ) : (
        <SidebarSection>
          <button
            type="button"
            onClick={onPinCurrentTrajectory}
            style={{
              padding: "0.4rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Pin Current Trajectory
          </button>
          <button
            type="button"
            onClick={onClearPinnedTrajectory}
            disabled={!pinnedTrajectoryActive}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              background: pinnedTrajectoryActive ? "#f3f4f6" : "#d1d5db",
              color: pinnedTrajectoryActive ? "#374151" : "#6b7280",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: pinnedTrajectoryActive ? "pointer" : "not-allowed",
            }}
          >
            Clear pinned trajectory
          </button>
          {pinnedTrajectoryActive ? (
            <span style={{ ...valueStyle, fontSize: "0.7rem" }}>Pinned trajectory active</span>
          ) : null}
        </SidebarSection>
      )}

      <RangeControl
        label="Initial Velocity"
        valueText={`${values.initialVelocity} m/s`}
        rangeMin={0}
        rangeMax={Math.max(1, values.velocityMax)}
        rangeValue={Math.min(values.initialVelocity, Math.max(1, values.velocityMax))}
        rangeAriaLabel="Initial velocity in meters per second"
        onRangeChange={actions.setInitialVelocity}
        maxValue={values.velocityMax}
        maxMin={1}
        maxStep={1}
        maxAriaLabel="Velocity slider maximum"
        onMaxChange={actions.updateVelocityMax}
      />

      <RangeControl
        label="Launch Angle"
        valueText={`${values.launchAngle}°`}
        rangeMin={0}
        rangeMax={90}
        rangeValue={values.launchAngle}
        rangeAriaLabel="Launch angle in degrees"
        onRangeChange={actions.setLaunchAngle}
      />

      <RangeControl
        label="Gravity"
        valueText={`${values.gravity} m/s²`}
        rangeMin={0}
        rangeMax={Math.max(0.1, values.gravityMax)}
        rangeStep={0.1}
        rangeValue={Math.min(values.gravity, Math.max(0.1, values.gravityMax))}
        rangeAriaLabel="Gravity in m/s²"
        onRangeChange={actions.setGravity}
        maxValue={values.gravityMax}
        maxMin={0.1}
        maxStep={0.1}
        maxAriaLabel="Gravity slider maximum"
        onMaxChange={actions.updateGravityMax}
        footer={
          <span style={{ ...valueStyle, fontSize: "0.7rem" }}>
            Moon 1.62 · Mars 3.7 · Earth 9.81 · Saturn 10.4 · Jupiter 24.8 m/s²
          </span>
        }
      />

      <RangeControl
        label="Drag coefficient (C_d)"
        valueText={values.dragCoefficient.toFixed(2)}
        rangeMin={0}
        rangeMax={Math.max(0.01, values.dragMax)}
        rangeStep={0.01}
        rangeValue={Math.min(values.dragCoefficient, Math.max(0.01, values.dragMax))}
        rangeAriaLabel="Drag coefficient dimensionless"
        onRangeChange={actions.setDragCoefficient}
        maxValue={values.dragMax}
        maxMin={0.01}
        maxStep={0.01}
        maxAriaLabel="Drag coefficient maximum"
        onMaxChange={actions.updateDragMax}
        footer={<span style={{ ...valueStyle, fontSize: "0.7rem" }}>Typical sphere ≈ 0.5</span>}
      />

      <div
        style={{
          ...sliderStyle,
          marginRight: "0.75rem",
          marginLeft: "0.25rem",
        }}
      >
        <span style={labelStyle}>Ball preset</span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {derived.ballPresetOptions.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => actions.applyBallPreset(preset.key)}
              style={{
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                background: "#e5e7eb",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <span style={{ ...valueStyle, fontSize: "0.7rem" }}>Selected: {derived.selectedBallLabel}</span>
      </div>

      <NumberInputControl
        label="Mass (kg)"
        value={values.mass}
        min={0.0001}
        step="any"
        ariaLabel="Ball mass"
        onChange={actions.setMass}
      />

      <NumberInputControl
        label="Radius (m)"
        value={values.radius}
        min={0.001}
        step="any"
        ariaLabel="Ball radius"
        onChange={actions.setRadius}
      />

      <RangeControl
        label="Spin (RPM)"
        valueText={`${values.spinRpm} (backspin +)`}
        rangeMin={-3000}
        rangeMax={3000}
        rangeStep={50}
        rangeValue={values.spinRpm}
        rangeAriaLabel="Spin RPM"
        onRangeChange={actions.setSpinRpm}
      />

      <NumberInputControl
        label="Air density (kg/m³)"
        value={values.airDensity}
        min={0}
        step="any"
        ariaLabel="Air density"
        helperText={`Sea level ≈ ${AIR_DENSITY_SEA_LEVEL.toFixed(2)}; 0 = vacuum`}
        onChange={actions.setAirDensity}
      />

      <DualNumberRow
        left={{
          label: "Target X",
          value: values.targetX,
          ariaLabel: "Target X position",
          onChange: actions.setTargetX,
        }}
        right={{
          label: "Target Y",
          value: values.targetY,
          ariaLabel: "Target Y position",
          onChange: actions.setTargetY,
        }}
      />

      <NumberInputControl
        label="Target diameter"
        value={values.targetDiameter}
        min={0.001}
        step="any"
        ariaLabel="Target diameter"
        onChange={actions.setTargetDiameter}
      />

      <div
        style={{
          ...sliderStyle,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: "0.75rem",
          marginTop: "0.5rem",
          marginRight: "0.75rem",
          marginBottom: "0.25rem",
          marginLeft: "0.25rem",
        }}
      >
        <div style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>X-axis max</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={values.xAxisMax}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (!Number.isNaN(nextValue) && nextValue > 0) {
                actions.setXAxisMax(nextValue);
              }
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label="X-axis maximum"
          />
        </div>
        <div style={{ ...sliderStyle, flex: 1, minWidth: 0 }}>
          <span style={labelStyle}>Y-axis max</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={values.yAxisMax}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              if (!Number.isNaN(nextValue) && nextValue > 0) {
                actions.setYAxisMax(nextValue);
              }
            }}
            style={{ ...inputStyle, padding: "0.35rem 0.5rem" }}
            aria-label="Y-axis maximum"
          />
        </div>
      </div>
    </aside>
  );
}
