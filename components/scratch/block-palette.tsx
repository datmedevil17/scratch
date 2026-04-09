'use client';

import { useState, useMemo } from "react";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Part types ──────────────────────────────────────────────────────────────
type Part =
  | { k: 'text'; v: string }
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'drop'; v: string; opts: string[] }
  | { k: 'color'; v: string }
  | { k: 'bool' };

const t = (v: string): Part => ({ k: 'text', v });
const n = (v: number): Part => ({ k: 'num', v });
const s = (v: string): Part => ({ k: 'str', v });
const d = (v: string, opts: string[]): Part => ({ k: 'drop', v, opts });
const col = (v: string): Part => ({ k: 'color', v });
const b = (): Part => ({ k: 'bool' });

type Shape = 'hat' | 'stack' | 'reporter' | 'boolean' | 'cap';

interface BlockDef {
  id: string;
  shape: Shape;
  parts: Part[];
}

interface Category {
  id: string;
  label: string;
  color: string;
  blocks: BlockDef[];
}

// ── Block definitions ───────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
  {
    id: 'motion',
    label: 'Motion',
    color: '#4c97ff',
    blocks: [
      { id: 'm1',  shape: 'stack',    parts: [t('move'), n(10), t('steps')] },
      { id: 'm2',  shape: 'stack',    parts: [t('turn ↻'), n(15), t('degrees')] },
      { id: 'm3',  shape: 'stack',    parts: [t('turn ↺'), n(15), t('degrees')] },
      { id: 'm4',  shape: 'stack',    parts: [t('go to x:'), n(0), t('y:'), n(0)] },
      { id: 'm5',  shape: 'stack',    parts: [t('go to'), d('mouse-pointer', ['mouse-pointer', 'random position'])] },
      { id: 'm6',  shape: 'stack',    parts: [t('glide'), n(1), t('secs to x:'), n(0), t('y:'), n(0)] },
      { id: 'm7',  shape: 'stack',    parts: [t('glide'), n(1), t('secs to'), d('random position', ['random position', 'mouse-pointer'])] },
      { id: 'm8',  shape: 'stack',    parts: [t('change x by'), n(10)] },
      { id: 'm9',  shape: 'stack',    parts: [t('set x to'), n(0)] },
      { id: 'm10', shape: 'stack',    parts: [t('change y by'), n(10)] },
      { id: 'm11', shape: 'stack',    parts: [t('set y to'), n(0)] },
      { id: 'm12', shape: 'stack',    parts: [t('point in direction'), n(90)] },
      { id: 'm13', shape: 'stack',    parts: [t('point towards'), d('mouse-pointer', ['mouse-pointer', 'Sprite1'])] },
      { id: 'm14', shape: 'stack',    parts: [t('if on edge, bounce')] },
      { id: 'm15', shape: 'stack',    parts: [t('set rotation style'), d('left-right', ["left-right", "don't rotate", 'all around'])] },
      { id: 'm16', shape: 'reporter', parts: [t('x position')] },
      { id: 'm17', shape: 'reporter', parts: [t('y position')] },
      { id: 'm18', shape: 'reporter', parts: [t('direction')] },
    ],
  },
  {
    id: 'looks',
    label: 'Looks',
    color: '#9966ff',
    blocks: [
      { id: 'l1',  shape: 'stack',    parts: [t('say'), s('Hello!'), t('for'), n(2), t('seconds')] },
      { id: 'l2',  shape: 'stack',    parts: [t('say'), s('Hello!')] },
      { id: 'l3',  shape: 'stack',    parts: [t('think'), s('Hmm...'), t('for'), n(2), t('seconds')] },
      { id: 'l4',  shape: 'stack',    parts: [t('think'), s('Hmm...')] },
      { id: 'l5',  shape: 'stack',    parts: [t('switch costume to'), d('costume1', ['costume1', 'costume2'])] },
      { id: 'l6',  shape: 'stack',    parts: [t('next costume')] },
      { id: 'l7',  shape: 'stack',    parts: [t('switch backdrop to'), d('backdrop1', ['backdrop1', 'backdrop2'])] },
      { id: 'l8',  shape: 'stack',    parts: [t('next backdrop')] },
      { id: 'l9',  shape: 'stack',    parts: [t('change size by'), n(10)] },
      { id: 'l10', shape: 'stack',    parts: [t('set size to'), n(100), t('%')] },
      { id: 'l11', shape: 'stack',    parts: [t('show')] },
      { id: 'l12', shape: 'stack',    parts: [t('hide')] },
      { id: 'l13', shape: 'stack',    parts: [t('change'), d('color', ['color', 'fisheye', 'whirl', 'pixelate', 'mosaic', 'brightness', 'ghost']), t('effect by'), n(25)] },
      { id: 'l14', shape: 'stack',    parts: [t('set'), d('ghost', ['color', 'fisheye', 'whirl', 'pixelate', 'mosaic', 'brightness', 'ghost']), t('effect to'), n(0)] },
      { id: 'l15', shape: 'stack',    parts: [t('clear graphic effects')] },
      { id: 'l16', shape: 'stack',    parts: [t('go to'), d('front', ['front', 'back']), t('layer')] },
      { id: 'l17', shape: 'stack',    parts: [t('go back'), n(1), t('layers')] },
      { id: 'l18', shape: 'reporter', parts: [t('size')] },
      { id: 'l19', shape: 'reporter', parts: [t('costume #')] },
      { id: 'l20', shape: 'reporter', parts: [t('backdrop #')] },
    ],
  },
  {
    id: 'sound',
    label: 'Sound',
    color: '#cf63cf',
    blocks: [
      { id: 's1', shape: 'stack',    parts: [t('play sound'), d('pop', ['pop']), t('until done')] },
      { id: 's2', shape: 'stack',    parts: [t('start sound'), d('pop', ['pop'])] },
      { id: 's3', shape: 'stack',    parts: [t('stop all sounds')] },
      { id: 's4', shape: 'stack',    parts: [t('change'), d('pitch', ['pitch', 'pan left/right']), t('effect by'), n(10)] },
      { id: 's5', shape: 'stack',    parts: [t('set'), d('pan left/right', ['pitch', 'pan left/right']), t('effect to'), n(0)] },
      { id: 's6', shape: 'stack',    parts: [t('clear sound effects')] },
      { id: 's7', shape: 'stack',    parts: [t('change volume by'), n(-10)] },
      { id: 's8', shape: 'stack',    parts: [t('set volume to'), n(100), t('%')] },
      { id: 's9', shape: 'reporter', parts: [t('volume')] },
    ],
  },
  {
    id: 'events',
    label: 'Events',
    color: '#ffab19',
    blocks: [
      { id: 'ev1', shape: 'hat',  parts: [t('when 🚩 clicked')] },
      { id: 'ev2', shape: 'hat',  parts: [t('when'), d('space', ['space', 'up arrow', 'down arrow', 'left arrow', 'right arrow', 'any']), t('key pressed')] },
      { id: 'ev3', shape: 'hat',  parts: [t('when this sprite clicked')] },
      { id: 'ev4', shape: 'stack', parts: [t('broadcast'), d('message1', ['message1'])] },
      { id: 'ev5', shape: 'stack', parts: [t('broadcast'), d('message1', ['message1']), t('and wait')] },
      { id: 'ev6', shape: 'hat',  parts: [t('when I receive'), d('message1', ['message1'])] },
    ],
  },
  {
    id: 'control',
    label: 'Control',
    color: '#ffab19',
    blocks: [
      { id: 'c1',  shape: 'stack', parts: [t('wait'), n(1), t('seconds')] },
      { id: 'c2',  shape: 'stack', parts: [t('repeat'), n(10)] },
      { id: 'c3',  shape: 'stack', parts: [t('forever')] },
      { id: 'c4',  shape: 'stack', parts: [t('if'), b(), t('then')] },
      { id: 'c5',  shape: 'stack', parts: [t('if'), b(), t('then / else')] },
      { id: 'c6',  shape: 'stack', parts: [t('wait until'), b()] },
      { id: 'c7',  shape: 'stack', parts: [t('repeat until'), b()] },
      { id: 'c8',  shape: 'stack', parts: [t('create clone of'), d('myself', ['myself', 'Sprite1'])] },
      { id: 'c9',  shape: 'hat',   parts: [t('when I start as a clone')] },
      { id: 'c10', shape: 'cap',   parts: [t('delete this clone')] },
      { id: 'c11', shape: 'cap',   parts: [t('stop'), d('all', ['all', 'this script', 'other scripts in sprite'])] },
    ],
  },
  {
    id: 'sensing',
    label: 'Sensing',
    color: '#5cb1d6',
    blocks: [
      { id: 'se1',  shape: 'boolean',  parts: [t('touching'), d('mouse-pointer', ['mouse-pointer', 'edge', 'Sprite1']), t('?')] },
      { id: 'se2',  shape: 'boolean',  parts: [t('touching color'), col('#ff4444'), t('?')] },
      { id: 'se3',  shape: 'boolean',  parts: [t('color'), col('#ff4444'), t('is touching'), col('#4444ff'), t('?')] },
      { id: 'se4',  shape: 'stack',    parts: [t('ask'), s("What's your name?"), t('and wait')] },
      { id: 'se5',  shape: 'reporter', parts: [t('answer')] },
      { id: 'se6',  shape: 'reporter', parts: [t('mouse x')] },
      { id: 'se7',  shape: 'reporter', parts: [t('mouse y')] },
      { id: 'se8',  shape: 'boolean',  parts: [t('mouse down?')] },
      { id: 'se9',  shape: 'boolean',  parts: [t('key'), d('space', ['space', 'any', 'up arrow', 'down arrow', 'left arrow', 'right arrow']), t('pressed?')] },
      { id: 'se10', shape: 'reporter', parts: [t('distance to'), d('mouse-pointer', ['mouse-pointer', 'Sprite1'])] },
      { id: 'se11', shape: 'reporter', parts: [t('timer')] },
      { id: 'se12', shape: 'stack',    parts: [t('reset timer')] },
      { id: 'se13', shape: 'reporter', parts: [d('x position', ['x position', 'y position', 'direction', 'costume #', 'size', 'volume']), t('of'), d('Sprite1', ['Sprite1', 'Stage'])] },
    ],
  },
  {
    id: 'operators',
    label: 'Operators',
    color: '#59c059',
    blocks: [
      { id: 'op1',  shape: 'reporter', parts: [n(0), t('+'), n(0)] },
      { id: 'op2',  shape: 'reporter', parts: [n(0), t('−'), n(0)] },
      { id: 'op3',  shape: 'reporter', parts: [n(0), t('×'), n(0)] },
      { id: 'op4',  shape: 'reporter', parts: [n(0), t('÷'), n(0)] },
      { id: 'op5',  shape: 'reporter', parts: [t('pick random'), n(1), t('to'), n(10)] },
      { id: 'op6',  shape: 'boolean',  parts: [n(0), t('>'), n(0)] },
      { id: 'op7',  shape: 'boolean',  parts: [n(0), t('<'), n(0)] },
      { id: 'op8',  shape: 'boolean',  parts: [n(0), t('='), n(0)] },
      { id: 'op9',  shape: 'boolean',  parts: [b(), t('and'), b()] },
      { id: 'op10', shape: 'boolean',  parts: [b(), t('or'), b()] },
      { id: 'op11', shape: 'boolean',  parts: [t('not'), b()] },
      { id: 'op12', shape: 'reporter', parts: [t('join'), s('Hello'), s('World')] },
      { id: 'op13', shape: 'reporter', parts: [t('letter'), n(1), t('of'), s('apple')] },
      { id: 'op14', shape: 'reporter', parts: [t('length of'), s('apple')] },
      { id: 'op15', shape: 'boolean',  parts: [s('apple'), t('contains'), s('a'), t('?')] },
      { id: 'op16', shape: 'reporter', parts: [t('round'), n(0)] },
      { id: 'op17', shape: 'reporter', parts: [d('sqrt', ['abs', 'floor', 'ceiling', 'sqrt', 'sin', 'cos', 'tan', 'ln', 'log', 'e^', '10^']), t('of'), n(0)] },
    ],
  },
  {
    id: 'variables',
    label: 'Variables',
    color: '#ff8c1a',
    blocks: [
      { id: 'v1',  shape: 'stack',    parts: [t('set'), d('score', ['score']), t('to'), n(0)] },
      { id: 'v2',  shape: 'stack',    parts: [t('change'), d('score', ['score']), t('by'), n(1)] },
      { id: 'v3',  shape: 'stack',    parts: [t('show variable'), d('score', ['score'])] },
      { id: 'v4',  shape: 'stack',    parts: [t('hide variable'), d('score', ['score'])] },
      { id: 'v5',  shape: 'stack',    parts: [t('add'), s('thing'), t('to'), d('list', ['list'])] },
      { id: 'v6',  shape: 'stack',    parts: [t('delete'), n(1), t('of'), d('list', ['list'])] },
      { id: 'v7',  shape: 'stack',    parts: [t('delete all of'), d('list', ['list'])] },
      { id: 'v8',  shape: 'stack',    parts: [t('insert'), s('thing'), t('at'), n(1), t('of'), d('list', ['list'])] },
      { id: 'v9',  shape: 'stack',    parts: [t('replace item'), n(1), t('of'), d('list', ['list']), t('with'), s('thing')] },
      { id: 'v10', shape: 'reporter', parts: [t('item'), n(1), t('of'), d('list', ['list'])] },
      { id: 'v11', shape: 'reporter', parts: [t('length of'), d('list', ['list'])] },
      { id: 'v12', shape: 'boolean',  parts: [d('list', ['list']), t('contains'), s('thing'), t('?')] },
    ],
  },
  {
    id: 'myblocks',
    label: 'My Blocks',
    color: '#ff6680',
    blocks: [],
  },
];

// ── Part renderer ───────────────────────────────────────────────────────────
function RenderPart({ part }: { part: Part }) {
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

// ── Block shape SVG notch (top connector) ───────────────────────────────────
function StackNotch({ color }: { color: string }) {
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

// Hat bump (event trigger shape on top)
function HatBump({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 80 16"
      className="absolute -top-[15px] left-0 h-4 w-20"
      aria-hidden="true"
    >
      <path
        d="M0 16 Q0 0 40 0 Q80 0 80 16"
        fill={color}
      />
    </svg>
  );
}

// ── BlockItem ───────────────────────────────────────────────────────────────
function BlockItem({
  block,
  color,
  onDragStart,
}: {
  block: BlockDef;
  color: string;
  onDragStart?: (blockId: string) => void;
}) {
  const isReporter = block.shape === 'reporter';
  const isBoolean  = block.shape === 'boolean';
  const isHat      = block.shape === 'hat';
  const isStack    = block.shape === 'stack' || block.shape === 'cap';

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(block.id)}
      className={cn(
        'relative mx-2 mb-1.5 flex cursor-grab flex-wrap items-center gap-x-1 gap-y-0.5 px-2 text-[11px] font-semibold text-white select-none transition-opacity active:cursor-grabbing active:opacity-70',
        isReporter ? 'rounded-full py-1 px-3'
          : isBoolean  ? 'py-1'
          : isHat      ? 'mt-4 rounded-t-2xl rounded-b-sm py-1.5'
          : /* stack/cap */ 'rounded py-1.5',
        isBoolean && 'rounded-sm',
      )}
      style={{
        backgroundColor: color,
        boxShadow: `0 2px 0 color-mix(in srgb, ${color} 70%, #000 30%)`,
        ...(isBoolean ? {
          clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)',
          paddingLeft: '18px',
          paddingRight: '18px',
        } : {}),
      }}
    >
      {/* Connector notch on stack blocks (not hat / reporter / boolean) */}
      {isStack && <StackNotch color={color} />}
      {isHat   && <HatBump color={color} />}

      {block.parts.map((part, i) => (
        <RenderPart key={i} part={part} />
      ))}
    </div>
  );
}

// ── Helper: extract searchable text from a block ────────────────────────────
function blockSearchText(block: BlockDef): string {
  return block.parts
    .map((p) => {
      if (p.k === 'text') return p.v;
      if (p.k === 'drop') return p.v;
      if (p.k === 'str')  return p.v;
      return '';
    })
    .join(' ')
    .toLowerCase();
}

// ── BlockPalette ─────────────────────────────────────────────────────────────
export interface BlockPaletteProps {
  onBlockDragStart?: (blockId: string, categoryId: string) => void;
}

export function BlockPalette({ onBlockDragStart }: BlockPaletteProps) {
  const [activeCatId, setActiveCatId] = useState<string>(CATEGORIES[0].id);
  const [query, setQuery] = useState('');

  const activeCategory = CATEGORIES.find((c) => c.id === activeCatId) ?? CATEGORIES[0];

  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeCategory.blocks;
    return activeCategory.blocks.filter((b) => blockSearchText(b).includes(q));
  }, [activeCategory, query]);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-[#f9f9f9] dark:bg-neutral-900">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-2">
        <MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search blocks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-6 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Category sidebar */}
        <nav
          className="flex w-[72px] shrink-0 flex-col overflow-y-auto border-r border-border bg-white dark:bg-neutral-950"
          aria-label="Block categories"
        >
          {CATEGORIES.map((cat) => {
            const active = cat.id === activeCatId;
            return (
              <button
                key={cat.id}
                onClick={() => { setActiveCatId(cat.id); setQuery(''); }}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-1 py-2.5 text-center text-[10px] font-semibold leading-tight transition-colors',
                  active
                    ? 'bg-white text-foreground dark:bg-neutral-900'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {/* Color dot */}
                <span
                  className="size-5 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.label}
                {/* Active indicator */}
                {active && (
                  <span
                    className="absolute inset-y-0 right-0 w-0.5"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Block list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
          {/* Category heading */}
          <p
            className="mx-2 mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: activeCategory.color }}
          >
            {activeCategory.label}
          </p>

          {/* My Blocks — Make a Block button */}
          {activeCatId === 'myblocks' && (
            <button
              className="mx-2 mb-3 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
              style={{ backgroundColor: activeCategory.color }}
            >
              <Plus className="size-3.5" weight="bold" />
              Make a Block
            </button>
          )}

          {/* Blocks */}
          {visibleBlocks.length > 0 ? (
            visibleBlocks.map((block) => (
              <BlockItem
                key={block.id}
                block={block}
                color={activeCategory.color}
                onDragStart={(id) => onBlockDragStart?.(id, activeCategory.id)}
              />
            ))
          ) : (
            <p className="px-4 text-[11px] text-muted-foreground">
              No blocks match &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
