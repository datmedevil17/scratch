'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Scroll Spy to Highlight Active Category ───────────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        let bestMatch = CATEGORIES[0].id;
        let minDistance = Infinity;

        // Find the category whose top is closest to the top of the container
        for (const cat of CATEGORIES) {
          const el = categoryRefs.current.get(cat.id);
          if (el) {
            const distance = Math.abs(el.offsetTop - container.scrollTop);
            if (distance < minDistance) {
              minDistance = distance;
              bestMatch = cat.id;
            }
            // If it's the very top of the scroll container, bias towards it
            if (el.offsetTop <= container.scrollTop + 20 && el.offsetTop + el.clientHeight > container.scrollTop) {
                bestMatch = cat.id;
                break;
            }
          }
        }
        setActiveCatId(bestMatch);
      }, 50);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  const scrollToCategory = useCallback((id: string) => {
    setActiveCatId(id);
    const container = scrollContainerRef.current;
    const el = categoryRefs.current.get(id);
    if (container && el) {
      container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
    }
  }, []);

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    
    return CATEGORIES.map(cat => ({
      ...cat,
      blocks: cat.blocks.filter(bl => blockSearchText(bl).includes(q))
    })).filter(cat => cat.blocks.length > 0 || cat.id === 'myblocks'); // Always show myblocks if it has button, or empty depending on search but let's just keep matching.
  }, [query]);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-[#f9f9f9] dark:bg-neutral-900">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-2">
        <MagnifyingGlassIcon className="size-3.5 shrink-0 text-muted-foreground" />
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
                onClick={() => { setQuery(''); scrollToCategory(cat.id); }}
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
        <div ref={scrollContainerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3 relative scroll-smooth">
          {visibleCategories.length > 0 ? (
            visibleCategories.map(cat => {
              if (query && cat.blocks.length === 0 && cat.id !== 'myblocks') return null;
              
              return (
                <div 
                  key={cat.id} 
                  ref={(el) => {
                    if (el) categoryRefs.current.set(cat.id, el);
                  }}
                  className="mb-6"
                >
                  <p
                    className="mx-2 mb-2 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </p>

                  {cat.id === 'myblocks' && !query && (
                    <button
                      className="mx-2 mb-3 flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
                      style={{ backgroundColor: cat.color }}
                    >
                      <PlusIcon className="size-3.5" weight="bold" />
                      Make a Block
                    </button>
                  )}

                  {cat.blocks.map(block => (
                    <PaletteBlock
                      key={block.id}
                      block={block}
                      color={cat.color}
                      catId={cat.id}
                    />
                  ))}
                </div>
              );
            })
          ) : (
            <p className="px-4 text-[11px] text-muted-foreground mt-2">
              No blocks match &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
