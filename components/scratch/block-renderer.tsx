'use client';

import * as React from "react";
import { type Part, type BlockDef, type Shape } from "@/lib/scratch/blocks";
import { cn } from "@/lib/utils";

// ── Connector geometry ────────────────────────────────────────────────────────
// The notch/plug protrudes 7 px outside the block body.
// SVG is 40 × 8 px, offset left=12 so the connector is near the left edge.
export const CONNECTOR_OVERHANG = 7;  // px protruding outside block body
export const BLOCK_GAP_PX       = 6;  // gap between stacked block bodies in workspace

// ── Individual part ───────────────────────────────────────────────────────────
export function RenderPart({
  part,
  value,
  onValueChange,
}: {
  part: Part;
  value?: string | number;
  onValueChange?: (v: string | number) => void;
}) {
  switch (part.k) {
    case 'text':
      return <span className="whitespace-nowrap leading-none">{part.v}</span>;

    case 'num': {
      const val = value !== undefined ? value : part.v;
      return onValueChange ? (
        <input
          type="number"
          defaultValue={val as number}
          onBlur={(e) => onValueChange(parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex h-5 w-[36px] rounded-full bg-white/30 px-1.5 text-center text-[10px] font-semibold leading-none text-white outline-none [appearance:textfield] focus:bg-white/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span className="inline-flex h-5 min-w-[28px] items-center justify-center rounded-full bg-white/30 px-2 text-[10px] font-semibold leading-none">
          {val}
        </span>
      );
    }

    case 'str': {
      const val = value !== undefined ? value : part.v;
      return onValueChange ? (
        <input
          type="text"
          defaultValue={val as string}
          onBlur={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex h-5 min-w-[40px] max-w-[120px] rounded-sm bg-white/30 px-2 text-[10px] leading-none text-white outline-none focus:bg-white/50"
        />
      ) : (
        <span className="inline-flex h-5 min-w-[36px] items-center rounded-sm bg-white/30 px-2 text-[10px] leading-none">
          {val}
        </span>
      );
    }

    case 'drop':
      return (
        <span className="inline-flex h-5 items-center gap-0.5 rounded-sm bg-white/30 px-2 text-[10px] leading-none">
          {part.v}
          <svg viewBox="0 0 6 4" className="size-1.5 shrink-0 fill-current opacity-70">
            <path d="M0 0l3 4 3-4z" />
          </svg>
        </span>
      );

    case 'color':
      return (
        <span
          className="inline-block size-4 rounded-sm border-2 border-white/50 align-middle"
          style={{ backgroundColor: part.v }}
        />
      );

    case 'bool':
      return (
        <span
          className="inline-flex h-5 w-9 shrink-0 items-center justify-center border border-white/50"
          style={{
            clipPath:
              'polygon(8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0% 50%)',
          }}
        />
      );
  }
}

// ── SVG connector pieces ──────────────────────────────────────────────────────

/**
 * Top socket notch — sits 7 px ABOVE the block body.
 * The next block's plug slots into this.
 *
 * Shape: two humps with a rectangular slot cut between them, matching Scratch 3.
 * viewBox 0 0 40 8 → positioned at left:12, top:-7, w:40, h:8
 */
export function StackNotch({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 40 8"
      aria-hidden
      style={{
        position: 'absolute',
        top: -CONNECTOR_OVERHANG,
        left: 12,
        width: 40,
        height: 8,
        overflow: 'visible',
        display: 'block',
        pointerEvents: 'none',
      }}
    >
      {/*
        Left ramp from (0,8)↑(0,0) → plateau (0,0)→(8,0) →
        descent (8,0)→(14,8) — notch slot floor (14,8)→(26,8) —
        ascent (26,8)→(32,0) → plateau (32,0)→(40,0) → descent (40,0)→(40,8)
        The notch slot is the transparent gap at y≈8 between x=14 and x=26.
      */}
      <path
        d="M0,8 C0,8 0,0 3,0 L8,0 C10,0 11,3 11,5 C11,7 12,8 14,8 L26,8 C28,8 29,7 29,5 C29,3 30,0 32,0 L37,0 C40,0 40,8 40,8 Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Bottom plug bump — sits 7 px BELOW the block body (mirror of StackNotch).
 * This protrudes down and slots into the socket of the block below.
 */
export function StackPlug({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 40 8"
      aria-hidden
      style={{
        position: 'absolute',
        bottom: -CONNECTOR_OVERHANG,
        left: 12,
        width: 40,
        height: 8,
        overflow: 'visible',
        display: 'block',
        pointerEvents: 'none',
      }}
    >
      {/* Mirror of StackNotch — bump protrudes downward */}
      <path
        d="M0,0 C0,0 0,8 3,8 L8,8 C10,8 11,5 11,3 C11,1 12,0 14,0 L26,0 C28,0 29,1 29,3 C29,5 30,8 32,8 L37,8 C40,8 40,0 40,0 Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Hat dome — full-width curved top for event blocks.
 * Positioned 18 px above the block body.
 */
export function HatDome({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      aria-hidden
      style={{
        position: 'absolute',
        top: -18,
        left: 0,
        width: '100%',
        height: 18,
        overflow: 'visible',
        display: 'block',
        pointerEvents: 'none',
      }}
    >
      <path d="M0,18 C0,8 25,0 50,0 C75,0 100,8 100,18 Z" fill={color} />
    </svg>
  );
}

// ── Block shape classes ───────────────────────────────────────────────────────
export function blockClasses(shape: Shape) {
  return cn(
    'relative flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold text-white select-none',
    shape === 'reporter'
      ? 'rounded-full py-1 px-4'
      : shape === 'boolean'
      ? 'py-1 px-2'
      : /* hat, stack, cap */ 'rounded-[3px] py-[6px] px-3',
  );
}

export function blockStyle(shape: Shape, color: string): React.CSSProperties {
  const shadow = `0 2px 0 color-mix(in srgb, ${color} 60%, #000 40%)`;

  if (shape === 'boolean') {
    return {
      backgroundColor: color,
      clipPath:
        'polygon(10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0% 50%)',
      paddingLeft: 20,
      paddingRight: 20,
    };
  }
  if (shape === 'reporter') {
    return {
      backgroundColor: color,
      boxShadow: shadow,
    };
  }
  return {
    backgroundColor: color,
    boxShadow: shadow,
    minWidth: 80,
  };
}

// ── RenderedBlock ─────────────────────────────────────────────────────────────
export function RenderedBlock({
  block,
  color,
  inputs,
  onInputChange,
  className,
  style,
  ...rest
}: {
  block: BlockDef;
  color: string;
  /** Per-part-index overrides for editable inputs (workspace only). */
  inputs?: Record<number, string | number>;
  onInputChange?: (partIndex: number, value: string | number) => void;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const hasTopSocket  = block.shape === 'stack' || block.shape === 'cap';
  const hasBottomPlug = block.shape === 'stack' || block.shape === 'hat';
  const isHat         = block.shape === 'hat';

  return (
    <div
      className={cn(blockClasses(block.shape), className)}
      style={{ ...blockStyle(block.shape, color), ...style }}
      {...rest}
    >
      {isHat        && <HatDome    color={color} />}
      {hasTopSocket && <StackNotch color={color} />}
      {hasBottomPlug && <StackPlug  color={color} />}

      {block.parts.map((part, i) => (
        <RenderPart
          key={i}
          part={part}
          value={inputs?.[i]}
          onValueChange={onInputChange ? (v) => onInputChange(i, v) : undefined}
        />
      ))}
    </div>
  );
}
