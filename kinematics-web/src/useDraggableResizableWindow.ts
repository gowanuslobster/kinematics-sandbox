import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const PANEL_MIN_WIDTH = 300;
const PANEL_MIN_HEIGHT = 320;
const PANEL_DEFAULT_WIDTH = 550;
const PANEL_DEFAULT_HEIGHT = 450;
const PANEL_PADDING = 10;
const PANEL_INITIAL_X_OFFSET = 28;
const PANEL_INITIAL_Y_OFFSET = 62;

/** Shared clamp so panel position and size always stay within legal bounds. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Returns the current browser viewport, or a safe default when window is unavailable. */
function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1400, height: 900 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Keeps the floating microscope panel within the viewport while supporting
 * pointer-based dragging and bottom-right resize interactions.
 */
export function useDraggableResizableWindow() {
  // Current panel dimensions, constrained to fit within the viewport.
  const [size, setSize] = useState(() => {
    const viewport = getViewport();
    return {
      width: clamp(PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH, viewport.width - PANEL_PADDING * 2),
      height: clamp(PANEL_DEFAULT_HEIGHT, PANEL_MIN_HEIGHT, viewport.height - PANEL_PADDING * 2),
    };
  });

  // Current panel position, initialized near the upper-right and clamped on-screen.
  const [position, setPosition] = useState(() => {
    const viewport = getViewport();
    const width = clamp(PANEL_DEFAULT_WIDTH, PANEL_MIN_WIDTH, viewport.width - PANEL_PADDING * 2);
    const height = clamp(PANEL_DEFAULT_HEIGHT, PANEL_MIN_HEIGHT, viewport.height - PANEL_PADDING * 2);
    return {
      x: clamp(
        viewport.width - width - PANEL_INITIAL_X_OFFSET,
        PANEL_PADDING,
        viewport.width - width - PANEL_PADDING,
      ),
      y: clamp(
        PANEL_INITIAL_Y_OFFSET,
        PANEL_PADDING,
        viewport.height - height - PANEL_PADDING,
      ),
    };
  });

  // Mutable drag/resize session state used by global pointer event handlers.
  const actionRef = useRef<{
    type: "drag" | "resize";
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Clamps proposed dimensions so the panel stays usable inside the viewport.
  const clampSize = useCallback((width: number, height: number) => {
    const viewport = getViewport();
    return {
      width: clamp(width, PANEL_MIN_WIDTH, Math.max(PANEL_MIN_WIDTH, viewport.width - PANEL_PADDING * 2)),
      height: clamp(height, PANEL_MIN_HEIGHT, Math.max(PANEL_MIN_HEIGHT, viewport.height - PANEL_PADDING * 2)),
    };
  }, []);

  // Clamps the panel's top-left corner so the whole panel remains visible.
  const clampPosition = useCallback((x: number, y: number, panelSize = size) => {
    const viewport = getViewport();
    return {
      x: clamp(x, PANEL_PADDING, Math.max(PANEL_PADDING, viewport.width - panelSize.width - PANEL_PADDING)),
      y: clamp(y, PANEL_PADDING, Math.max(PANEL_PADDING, viewport.height - panelSize.height - PANEL_PADDING)),
    };
  }, [size]);

  // Captures the starting pointer and panel state for a drag interaction.
  const beginDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    actionRef.current = {
      type: "drag",
      startX: event.clientX,
      startY: event.clientY,
      startPosX: position.x,
      startPosY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [position.x, position.y, size.height, size.width]);

  // Captures the starting pointer and panel state for a resize interaction.
  const beginResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    actionRef.current = {
      type: "resize",
      startX: event.clientX,
      startY: event.clientY,
      startPosX: position.x,
      startPosY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [position.x, position.y, size.height, size.width]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const action = actionRef.current;
      if (!action) return;

      if (action.type === "drag") {
        const nextX = action.startPosX + (event.clientX - action.startX);
        const nextY = action.startPosY + (event.clientY - action.startY);
        setPosition(clampPosition(nextX, nextY));
      } else {
        const proposedWidth = action.startWidth + (event.clientX - action.startX);
        const proposedHeight = action.startHeight + (event.clientY - action.startY);
        const nextSize = clampSize(proposedWidth, proposedHeight);
        setSize(nextSize);
        setPosition((prev) => clampPosition(prev.x, prev.y, nextSize));
      }
    };

    const onPointerUp = () => {
      actionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [clampPosition, clampSize]);

  useEffect(() => {
    const onResize = () => {
      setSize((prev) => {
        const next = clampSize(prev.width, prev.height);
        setPosition((current) => clampPosition(current.x, current.y, next));
        return next;
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition, clampSize]);

  return { position, size, beginDrag, beginResize };
}
