'use client';

import { useState, useMemo } from "react";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  type BlockDef,
  blockSearchText,
  DRAG_BLOCK_KEY,
} from "@/lib/scratch/blocks";
import { RenderedBlock } from "@/components/scratch/block-renderer";

// ── Palette block item (with HTML5 drag-from-palette) ────────────────────────
function PaletteBlock({
  block,
  color,
  catId,
}: {
  block: BlockDef;
  color: string;
  catId: string;
}) {
  return (
    <RenderedBlock
      block={block}
      color={color}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData(DRAG_BLOCK_KEY, JSON.stringify({ blockId: block.id, catId }));
      }}
      className={cn(
        'mx-2 mb-1.5 cursor-grab transition-opacity active:cursor-grabbing active:opacity-70',
        block.shape === 'hat' && 'mt-4',
      )}
    />
  );
}

// ── BlockPalette ─────────────────────────────────────────────────────────────
export function BlockPalette() {
  const [activeCatId, setActiveCatId] = useState<string>(CATEGORIES[0].id);
  const [query, setQuery] = useState('');

  const activeCategory = CATEGORIES.find((c) => c.id === activeCatId) ?? CATEGORIES[0];

  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeCategory.blocks;
    return activeCategory.blocks.filter((bl) => blockSearchText(bl).includes(q));
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
                <span className="size-5 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.label}
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
          <p
            className="mx-2 mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: activeCategory.color }}
          >
            {activeCategory.label}
          </p>

          {activeCatId === 'myblocks' && (
            <button
              className="mx-2 mb-3 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
              style={{ backgroundColor: activeCategory.color }}
            >
              <Plus className="size-3.5" weight="bold" />
              Make a Block
            </button>
          )}

          {visibleBlocks.length > 0 ? (
            visibleBlocks.map((block) => (
              <PaletteBlock
                key={block.id}
                block={block}
                color={activeCategory.color}
                catId={activeCategory.id}
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
