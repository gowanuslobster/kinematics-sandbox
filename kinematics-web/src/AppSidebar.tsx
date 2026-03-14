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
  isPlaybackPaused: boolean;
  challengeShotActive: boolean;
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
  onTogglePlaybackPaused: () => void;
  onPinCurrentTrajectory: () => void;
  onClearPinnedTrajectory: () => void;
}

// The sidebar is modeled as a list of reusable control elements. These style
// primitives describe either shared element anatomy (label/value/helper/input)
// or the layout shell for a specific element variant.
const elementBaseStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.25rem",
};

const elementLabelStyle = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#374151",
};

const elementValueStyle = {
  fontSize: "0.75rem",
  color: "#6b7280",
};

const elementInputStyle = {
  width: "100%",
  accentColor: "#2563eb",
};

const elementMaxInputStyle = {
  width: "3rem",
  padding: "2px 4px",
  fontSize: "0.7rem",
  border: "1px solid #d1d5db",
  borderRadius: 4,
} as const;

const inputElementStyle = {
  ...elementBaseStyle,
  marginRight: "0.75rem",
  marginLeft: "0.25rem",
};

const pairedInputElementRowStyle = {
  ...elementBaseStyle,
  flexDirection: "row" as const,
  alignItems: "flex-end",
  gap: "0.5rem",
  marginRight: "0.75rem",
  marginLeft: "0.25rem",
};

const sliderElementStyle = {
  ...elementBaseStyle,
};

const elementHelperTextStyle = {
  ...elementValueStyle,
  fontSize: "0.7rem",
};

const numberElementInputStyle = {
  ...elementInputStyle,
  padding: "0.35rem 0.5rem",
};

const elementHeaderRowStyle = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const buttonGroupElementStyle = {
  display: "flex",
  gap: "0.35rem",
  flexWrap: "wrap" as const,
};

const buttonGroupButtonStyle = {
  padding: "0.3rem 0.4rem",
  fontSize: "0.72rem",
  background: "#e5e7eb",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
};

const CENTIMETERS_PER_METER = 100;

function metersToCentimeters(valueInMeters: number): number {
  return Number((valueInMeters * CENTIMETERS_PER_METER).toFixed(1));
}

function centimetersToMeters(valueInCentimeters: number): number {
  return valueInCentimeters / CENTIMETERS_PER_METER;
}

/** Lightweight wrapper for sections that group one or more sidebar elements. */
function SidebarSection({ children }: { children: ReactNode }) {
  return <div style={elementBaseStyle}>{children}</div>;
}

/**
 * Normalizes number input handling so individual controls only need to define
 * their validity rule and state update callback.
 */
function parseAndApplyNumber(
  rawValue: string,
  predicate: (value: number) => boolean,
  onChange: (value: number) => void,
) {
  const nextValue = Number(rawValue);
  if (!Number.isNaN(nextValue) && predicate(nextValue)) {
    onChange(nextValue);
  }
}

/** Renders a single numeric input element with an optional helper line. */
function InputControl({
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
    <div style={inputElementStyle}>
      <span style={elementLabelStyle}>{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => parseAndApplyNumber(event.target.value, (nextValue) => nextValue >= min, onChange)}
        style={numberElementInputStyle}
        aria-label={ariaLabel}
      />
      {helperText ? <span style={elementHelperTextStyle}>{helperText}</span> : null}
    </div>
  );
}

/**
 * Renders the standard slider-based element used for the main projectile
 * parameters, including optional max-box and footer text.
 */
function SliderControl({
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
    <div style={sliderElementStyle}>
      <div style={elementHeaderRowStyle}>
        <span style={elementLabelStyle}>{label}</span>
        <span style={elementValueStyle}>{valueText}</span>
      </div>
      <input
        type="range"
        min={rangeMin}
        max={rangeMax}
        step={rangeStep}
        value={rangeValue}
        onChange={(event) => onRangeChange(Number(event.target.value))}
        style={elementInputStyle}
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
              style={elementMaxInputStyle}
              aria-label={maxAriaLabel}
            />
          </>
        ) : (
          <span style={elementHelperTextStyle}>max: {rangeMax}{label === "Launch Angle" ? "°" : ""}</span>
        )}
      </div>
      {footer}
    </div>
  );
}

/** Renders two related numeric inputs side by side as one logical element row. */
function PairedInputControl({
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
    <div style={pairedInputElementRowStyle}>
      {[left, right].map((field) => (
        <div key={field.label} style={{ ...elementBaseStyle, flex: 1, minWidth: 0 }}>
          <span style={elementLabelStyle}>{field.label}</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={field.value}
            onChange={(event) => parseAndApplyNumber(event.target.value, (nextValue) => nextValue > 0, field.onChange)}
            style={numberElementInputStyle}
            aria-label={field.ariaLabel}
          />
        </div>
      ))}
    </div>
  );
}

/** Sidebar for simulation controls, mode-specific actions, and chart limits. */
export function AppSidebar({
  mode,
  isAnimating,
  isPlaybackPaused,
  challengeShotActive,
  pinnedTrajectoryActive,
  values,
  derived,
  actions,
  onFire,
  onTogglePlaybackPaused,
  onPinCurrentTrajectory,
  onClearPinnedTrajectory,
}: AppSidebarProps) {
  const isChallenge = mode === "challenge";
  // The challenge action button becomes a small playback transport control
  // once a shot exists and has not yet finished revealing.
  const challengeButtonLabel =
    isAnimating ? "Pause" : isPlaybackPaused ? "Resume" : "Fire!";
  const challengeButtonHandler =
    challengeShotActive && (isAnimating || isPlaybackPaused)
      ? onTogglePlaybackPaused
      : onFire;
  const challengeButtonBackground =
    isAnimating ? "#d97706" : isPlaybackPaused ? "#2563eb" : "#dc2626";

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
            onClick={challengeButtonHandler}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              fontWeight: 600,
              background: challengeButtonBackground,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {challengeButtonLabel}
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
          {pinnedTrajectoryActive ? <span style={elementHelperTextStyle}>Pinned trajectory active</span> : null}
        </SidebarSection>
      )}

      <SliderControl
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

      <SliderControl
        label="Launch Angle"
        valueText={`${values.launchAngle}°`}
        rangeMin={0}
        rangeMax={90}
        rangeValue={values.launchAngle}
        rangeAriaLabel="Launch angle in degrees"
        onRangeChange={actions.setLaunchAngle}
      />

      <SliderControl
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
          <span style={elementHelperTextStyle}>
            Moon 1.62 · Mars 3.7 · Earth 9.81 · Saturn 10.4 · Jupiter 24.8 m/s²
          </span>
        }
      />

      <SliderControl
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
        footer={<span style={elementHelperTextStyle}>Typical sphere ≈ 0.5</span>}
      />

      <div style={inputElementStyle}>
        <span style={elementLabelStyle}>Ball preset</span>
        <div style={buttonGroupElementStyle}>
          {derived.ballPresetOptions.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => actions.applyBallPreset(preset.key)}
              style={buttonGroupButtonStyle}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <span style={elementHelperTextStyle}>Selected: {derived.selectedBallLabel}</span>
      </div>

      <InputControl
        label="Mass (kg)"
        value={values.mass}
        min={0.0001}
        step="any"
        ariaLabel="Ball mass"
        onChange={actions.setMass}
      />

      <InputControl
        label="Radius (cm)"
        value={metersToCentimeters(values.radius)}
        min={0.1}
        step="any"
        ariaLabel="Ball radius in centimeters"
        onChange={(nextValue) => actions.setRadius(centimetersToMeters(nextValue))}
      />

      <SliderControl
        label="Spin (RPM)"
        valueText={`${values.spinRpm} (backspin +)`}
        rangeMin={-3000}
        rangeMax={3000}
        rangeStep={50}
        rangeValue={values.spinRpm}
        rangeAriaLabel="Spin RPM"
        onRangeChange={actions.setSpinRpm}
      />

      <InputControl
        label="Air density (kg/m³)"
        value={values.airDensity}
        min={0}
        step="any"
        ariaLabel="Air density"
        helperText={`Sea level ≈ ${AIR_DENSITY_SEA_LEVEL.toFixed(2)}; 0 = vacuum`}
        onChange={actions.setAirDensity}
      />

      <PairedInputControl
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

      <InputControl
        label="Target diameter"
        value={values.targetDiameter}
        min={0.001}
        step="any"
        ariaLabel="Target diameter"
        onChange={actions.setTargetDiameter}
      />

      <div style={pairedInputElementRowStyle}>
        <div style={{ ...elementBaseStyle, flex: 1, minWidth: 0 }}>
          <span style={elementLabelStyle}>X-axis max</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={values.xAxisMax}
            onChange={(event) => parseAndApplyNumber(event.target.value, (nextValue) => nextValue > 0, actions.setXAxisMax)}
            style={numberElementInputStyle}
            aria-label="X-axis maximum"
          />
        </div>
        <div style={{ ...elementBaseStyle, flex: 1, minWidth: 0 }}>
          <span style={elementLabelStyle}>Y-axis max</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={values.yAxisMax}
            onChange={(event) => parseAndApplyNumber(event.target.value, (nextValue) => nextValue > 0, actions.setYAxisMax)}
            style={numberElementInputStyle}
            aria-label="Y-axis maximum"
          />
        </div>
      </div>
    </aside>
  );
}
