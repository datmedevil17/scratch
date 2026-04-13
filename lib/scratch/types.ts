/**
 * Shared runtime types used by workspace, runtime, and stage.
 */

/** One block instance on the canvas, with live input values. */
export interface WBlock {
  instanceId: string;
  /** References a BlockDef id from blocks.ts */
  defId: string;
  /** Part-index → current value (num/str/drop overrides). */
  inputs: Record<number, string | number>;
  /** Inner body blocks — used by C-blocks (repeat, forever, if-then). */
  inner?: WBlock[];
  /** Second inner body — used by if/else 'else' branch. */
  inner2?: WBlock[];
}

/** A positioned group of blocks on the workspace canvas. */
export interface Script {
  id: string;
  x: number;
  y: number;
  blocks: WBlock[];
}
