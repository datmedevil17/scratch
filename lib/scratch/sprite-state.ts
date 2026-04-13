/**
 * Runtime state of a single sprite.
 * This is what the runtime mutates each frame; the stage reads it to draw.
 */
export interface SpriteState {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string;

  // ── Position / transform ────────────────────────────────────────────────
  /** Scratch coords: center=0, range −240…240 */
  x: number;
  /** Scratch coords: center=0, range −180…180 (up is positive) */
  y: number;
  /** Degrees, 90 = right (Scratch convention) */
  direction: number;
  /** Percentage, 100 = normal */
  size: number;
  visible: boolean;

  // ── Appearance ──────────────────────────────────────────────────────────
  costumeIndex: number;
  costumes: string[]; // emoji or data-URL per costume

  // ── Speech / thought bubbles ────────────────────────────────────────────
  sayBubble:   { text: string; until: number } | null; // `until` = Date.now() ms expiry, Infinity = permanent
  thinkBubble: { text: string; until: number } | null;

  // ── Graphic effects ──────────────────────────────────────────────────────
  effects: {
    color:      number;
    fisheye:    number;
    whirl:      number;
    pixelate:   number;
    mosaic:     number;
    brightness: number;
    ghost:      number;
  };

  // ── Per-sprite variables ────────────────────────────────────────────────
  variables: Record<string, number | string>;
}

/** Default effects — all zeroed */
export function defaultEffects(): SpriteState['effects'] {
  return { color: 0, fisheye: 0, whirl: 0, pixelate: 0, mosaic: 0, brightness: 0, ghost: 0 };
}

/** Build a fresh SpriteState from the editor sprite descriptor. */
export function makeSpriteState(sprite: {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string;
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
}): SpriteState {
  return {
    ...sprite,
    costumeIndex: 0,
    costumes: [sprite.imageUrl ?? sprite.emoji],
    sayBubble:   null,
    thinkBubble: null,
    effects:     defaultEffects(),
    variables:   {},
  };
}
