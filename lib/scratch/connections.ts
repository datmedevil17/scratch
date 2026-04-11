/**
 * Connection detection helpers for the Scratch workspace.
 *
 * A "snap target" is the closest compatible connection point to the
 * current drag position. During onDragOver we compute this and show
 * a visual hint; on drop we execute the connection.
 */

export type SnapKind =
  | 'append'  // drop block(s) BELOW the last block of an existing script
  | 'prepend'; // drop block(s) ABOVE the first block of an existing script

export interface SnapTarget {
  scriptId: string;
  kind: SnapKind;
  /** Canvas-space X/Y where the snap indicator should render */
  indicatorX: number;
  indicatorY: number;
}

/**
 * Estimated visual height of one stacked block in canvas pixels.
 * Hat blocks are a bit taller due to the dome; average them.
 */
export const BLOCK_HEIGHT_PX = 34;

/** Maximum canvas-space distance (px) within which a snap fires. */
const SNAP_RADIUS = 50;

interface ScriptSummary {
  id: string;
  x: number;
  y: number;
  blockCount: number;
}

/**
 * Given the canvas-space drop coordinate (cx, cy) and the list of
 * existing scripts, return the best SnapTarget or null.
 */
export function findSnapTarget(
  cx: number,
  cy: number,
  scripts: ScriptSummary[],
): SnapTarget | null {
  let best: SnapTarget | null = null;
  let bestDist = Infinity;

  for (const s of scripts) {
    const scriptHeight = s.blockCount * BLOCK_HEIGHT_PX;

    // ── Append snap: just below the last block ────────────────────────────
    const appendX = s.x;
    const appendY = s.y + scriptHeight;
    const dAppend = Math.hypot(cx - appendX, cy - appendY);
    if (dAppend < SNAP_RADIUS && dAppend < bestDist) {
      bestDist = dAppend;
      best = {
        scriptId: s.id,
        kind: 'append',
        indicatorX: s.x,
        indicatorY: appendY,
      };
    }

    // ── Prepend snap: just above the first block ──────────────────────────
    const prependY = s.y;
    const dPrepend = Math.hypot(cx - s.x, cy - prependY);
    if (dPrepend < SNAP_RADIUS && dPrepend < bestDist) {
      bestDist = dPrepend;
      best = {
        scriptId: s.id,
        kind: 'prepend',
        indicatorX: s.x,
        indicatorY: prependY,
      };
    }
  }

  return best;
}
