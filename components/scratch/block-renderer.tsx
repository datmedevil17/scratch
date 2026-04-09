import { type Part, type BlockDef, type Shape } from "@/lib/scratch/blocks";
import { cn } from "@/lib/utils";

// ── Individual part ──────────────────────────────────────────────────────────
export function RenderPart({ part }: { part: Part }) {
  switch (part.k) {
    case 'text':
      return <span className="whitespace-nowrap">{part.v}</span>;

    case 'num':
      return (
        <span className="inline-flex h-4 min-w-[22px] items-center justify-center rounded-full bg-white/30 px-1.5 text-[10px] font-semibold leading-none">
          {part.v}
        </span>
      );

    case 'str':
      return (
        <span className="inline-flex h-4 min-w-[32px] items-center rounded bg-white/30 px-1.5 text-[10px] leading-none">
          {part.v}
        </span>
      );

    case 'drop':
      return (
        <span className="inline-flex h-4 items-center gap-0.5 rounded bg-white/30 px-1.5 text-[10px] leading-none">
          {part.v}
          <svg viewBox="0 0 6 4" className="size-1.5 shrink-0 fill-current opacity-70">
            <path d="M0 0l3 4 3-4z" />
          </svg>
        </span>
      );

    case 'color':
      return (
        <span
          className="inline-block size-3.5 rounded-sm border border-white/40 align-middle"
          style={{ backgroundColor: part.v }}
        />
      );

    case 'bool':
      return (
        <span
          className="inline-flex h-4 w-8 items-center justify-center border border-white/60"
          style={{ clipPath: 'polygon(8px 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0% 50%)' }}
        />
      );
  }
}

// ── SVG connector pieces ─────────────────────────────────────────────────────
export function StackNotch({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 40 8"
      className="absolute -top-[7px] left-3 h-2 w-10"
      aria-hidden="true"
    >
      <path
        d="M0 8 Q0 0 4 0 L8 0 Q10 0 10 4 Q10 8 14 8 L26 8 Q30 8 30 4 Q30 0 32 0 L36 0 Q40 0 40 8"
        fill={color}
      />
    </svg>
  );
}

export function HatBump({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 80 16"
      className="absolute -top-[15px] left-0 h-4 w-20"
      aria-hidden="true"
    >
      <path d="M0 16 Q0 0 40 0 Q80 0 80 16" fill={color} />
    </svg>
  );
}

// ── Block shape class helpers ─────────────────────────────────────────────────
export function blockClasses(shape: Shape) {
  const isReporter = shape === 'reporter';
  const isBoolean  = shape === 'boolean';
  const isHat      = shape === 'hat';
  return cn(
    'relative flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 text-[11px] font-semibold text-white select-none',
    isReporter ? 'rounded-full py-1 px-3'
      : isBoolean  ? 'py-1'
      : isHat      ? 'mt-4 rounded-t-2xl rounded-b-sm py-1.5'
      : /* stack/cap */ 'rounded py-1.5',
  );
}

export function blockStyle(shape: Shape, color: string): React.CSSProperties {
  const base: React.CSSProperties = {
    backgroundColor: color,
    boxShadow: `0 2px 0 color-mix(in srgb, ${color} 70%, #000 30%)`,
  };
  if (shape === 'boolean') {
    return {
      ...base,
      clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)',
      paddingLeft: '18px',
      paddingRight: '18px',
    };
  }
  return base;
}

// ── Reusable rendered block (no drag logic — callers add that) ───────────────
export function RenderedBlock({
  block,
  color,
  className,
  style,
  ...rest
}: {
  block: BlockDef;
  color: string;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const isStack = block.shape === 'stack' || block.shape === 'cap';
  const isHat   = block.shape === 'hat';

  return (
    <div
      className={cn(blockClasses(block.shape), className)}
      style={{ ...blockStyle(block.shape, color), ...style }}
      {...rest}
    >
      {isStack && <StackNotch color={color} />}
      {isHat   && <HatBump   color={color} />}
      {block.parts.map((part, i) => (
        <RenderPart key={i} part={part} />
      ))}
    </div>
  );
}
