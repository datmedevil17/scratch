/**
 * Connection detection helpers for the Scratch workspace.
 *
 * A "snap target" is the closest compatible connection point to the
 * current drag position. During onDragOver we compute this and show
 * a visual hint; on drop we execute the connection.
 */

export type SnapKind =
  | 'append'   // drop block(s) BELOW the last block of an existing script
  | 'prepend'  // drop block(s) ABOVE the first block of an existing script
  | 'insert';  // splice block(s) BETWEEN two existing blocks

export interface SnapTarget {
  scriptId: string;
  kind: SnapKind;
  /** Only set for 'insert' — the index at which to splice the new block(s). */
  insertIndex?: number;
  /** Canvas-space X/Y where the snap indicator should render */
  indicatorX: number;
  indicatorY: number;
  /** Canvas-space width of the target script card (for the indicator line). */
  indicatorWidth: number;
}

/** Maximum canvas-space distance (px) within which a snap fires. */
const SNAP_RADIUS = 60;

export interface ScriptSummary {
  id: string;
  x: number;
  y: number;
  /** Measured DOM width of the script card in canvas px (0 = unknown). */
  width: number;
  /** Height of each individual block in the script, in canvas px. */
  blockHeights: number[];
  /** True when the first block is a hat — prepend is invalid above a hat. */
  firstBlockIsHat: boolean;
  /** True when the last block is a cap/forever — append is invalid below a terminator. */
  lastBlockIsTerminal: boolean;
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
    const totalHeight = s.blockHeights.reduce((a, b) => a + b, 0);
    const w = s.width || 120;

    // ── Prepend snap: just above the first block ──────────────────────────
    if (!s.firstBlockIsHat) {
      const dPrepend = Math.hypot(cx - s.x, cy - s.y);
      if (dPrepend < SNAP_RADIUS && dPrepend < bestDist) {
        bestDist = dPrepend;
        best = {
          scriptId:       s.id,
          kind:           'prepend',
          indicatorX:     s.x,
          indicatorY:     s.y,
          indicatorWidth: w,
        };
      }
    }

    // ── Insert snap: between each pair of adjacent blocks ─────────────────
    // Build cumulative Y offsets for each inter-block joint.
    let cumY = s.y;
    for (let i = 0; i < s.blockHeights.length - 1; i++) {
      cumY += s.blockHeights[i];
      const jointY = cumY;
      const dInsert = Math.hypot(cx - s.x, cy - jointY);
      if (dInsert < SNAP_RADIUS && dInsert < bestDist) {
        bestDist = dInsert;
        best = {
          scriptId:       s.id,
          kind:           'insert',
          insertIndex:    i + 1,
          indicatorX:     s.x,
          indicatorY:     jointY,
          indicatorWidth: w,
        };
      }
    }

    // ── Append snap: just below the last block ────────────────────────────
    if (!s.lastBlockIsTerminal) {
      const appendY = s.y + totalHeight;
      const dAppend = Math.hypot(cx - s.x, cy - appendY);
      if (dAppend < SNAP_RADIUS && dAppend < bestDist) {
        bestDist = dAppend;
        best = {
          scriptId:       s.id,
          kind:           'append',
          indicatorX:     s.x,
          indicatorY:     appendY,
          indicatorWidth: w,
        };
      }
    }
  }

  return best;
}
