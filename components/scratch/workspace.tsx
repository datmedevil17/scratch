'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  CornersIn,
  Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  type BlockDef,
  getBlockDef,
  getCategoryForBlock,
  DRAG_BLOCK_KEY,
} from "@/lib/scratch/blocks";
import { RenderedBlock } from "@/components/scratch/block-renderer";

// ── Types ────────────────────────────────────────────────────────────────────
interface WBlock {
  instanceId: string;
  defId: string;
}

interface Script {
  id: string;
  x: number;
  y: number;
  blocks: WBlock[];
}

interface Transform {
  panX: number;
  panY: number;
  scale: number;
}

// ── Constants ────────────────────────────────────────────────────────────────
const SCALE_MIN  = 0.25;
const SCALE_MAX  = 2.5;
const SCALE_STEP = 0.15;
const GRID       = 10;

function snap(v: number) { return Math.round(v / GRID) * GRID; }
function uid()  { return Math.random().toString(36).slice(2, 9); }

// ── Context menu ─────────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; scriptId: string }

function ContextMenu({
  menu,
  onDelete,
  onDuplicate,
  onClose,
}: {
  menu: CtxMenu;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}) {
  // close on outside click
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('pointerdown', h);
    return () => window.removeEventListener('pointerdown', h);
  }, [onClose]);

  const item = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent';

  return (
    <div
      className="absolute z-50 min-w-[140px] rounded border border-border bg-popover shadow-md"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button className={item} onClick={() => { onDuplicate(menu.scriptId); onClose(); }}>
        Duplicate
      </button>
      <div className="h-px bg-border" />
      <button
        className={cn(item, 'text-destructive')}
        onClick={() => { onDelete(menu.scriptId); onClose(); }}
      >
        Delete
      </button>
    </div>
  );
}

// ── WorkspaceBlock (single rendered block inside a script) ───────────────────
function WorkspaceScriptBlock({ defId }: { defId: string }) {
  const def  = getBlockDef(defId);
  const cat  = getCategoryForBlock(defId);
  if (!def || !cat) return null;
  return (
    <RenderedBlock
      block={def}
      color={cat.color}
      className={cn(def.shape === 'hat' && 'mt-4')}
    />
  );
}

// ── Script card ──────────────────────────────────────────────────────────────
function ScriptCard({
  script,
  scale,
  isSelected,
  onPointerDown,
  onContextMenu,
}: {
  script: Script;
  scale: number;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div
      className={cn(
        'absolute cursor-grab select-none rounded active:cursor-grabbing',
        isSelected && 'ring-2 ring-blue-400 ring-offset-1',
      )}
      style={{ left: script.x, top: script.y, touchAction: 'none' }}
      onPointerDown={(e) => onPointerDown(e, script.id)}
      onContextMenu={(e) => onContextMenu(e, script.id)}
    >
      {script.blocks.map((wb) => (
        <WorkspaceScriptBlock key={wb.instanceId} defId={wb.defId} />
      ))}
    </div>
  );
}

// ── Workspace ────────────────────────────────────────────────────────────────
export function Workspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<Transform>({ panX: 40, panY: 40, scale: 1 });
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [trashOver, setTrashOver] = useState(false);

  // For script dragging
  const dragging = useRef<{
    scriptId: string;
    startX: number; startY: number;
    origX: number;  origY: number;
  } | null>(null);

  // For canvas panning (space+drag or middle-button drag)
  const panning = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const spaceHeld = useRef(false);

  // ── Keyboard: space bar ───────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); spaceHeld.current = true; } };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeld.current = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  // ── Zoom via scroll wheel ─────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => {
      const delta  = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      const scale  = Math.min(SCALE_MAX, Math.max(SCALE_MIN, prev.scale + delta));
      return { ...prev, scale };
    });
  }, []);

  // ── Pointer down on canvas background (pan) ───────────────────────────────
  const onCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || spaceHeld.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      panning.current = {
        startX: e.clientX, startY: e.clientY,
        origPanX: transform.panX, origPanY: transform.panY,
      };
      e.preventDefault();
    } else {
      setSelectedId(null);
      setCtxMenu(null);
    }
  }, [transform]);

  // ── Pointer down on a script (drag) ──────────────────────────────────────
  const onScriptPointerDown = useCallback((e: React.PointerEvent, scriptId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const container = containerRef.current!;
    container.setPointerCapture(e.pointerId);
    const sc = scripts.find((s) => s.id === scriptId)!;
    dragging.current = {
      scriptId,
      startX: e.clientX, startY: e.clientY,
      origX: sc.x,       origY: sc.y,
    };
    setSelectedId(scriptId);
    setCtxMenu(null);
  }, [scripts]);

  // ── Pointer move ──────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panning.current) {
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      setTransform((prev) => ({
        ...prev,
        panX: panning.current!.origPanX + dx,
        panY: panning.current!.origPanY + dy,
      }));
    } else if (dragging.current) {
      const dx = (e.clientX - dragging.current.startX) / transform.scale;
      const dy = (e.clientY - dragging.current.startY) / transform.scale;
      const nx = snap(dragging.current.origX + dx);
      const ny = snap(dragging.current.origY + dy);
      setScripts((prev) =>
        prev.map((s) => s.id === dragging.current!.scriptId ? { ...s, x: nx, y: ny } : s)
      );
    }
  }, [transform.scale]);

  // ── Pointer up ────────────────────────────────────────────────────────────
  const onPointerUp = useCallback(() => {
    panning.current  = null;
    dragging.current = null;
  }, []);

  // ── Drop from palette ─────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_BLOCK_KEY)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (!raw) return;
    const { blockId } = JSON.parse(raw) as { blockId: string; catId: string };
    const def = getBlockDef(blockId);
    if (!def) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const cx   = (e.clientX - rect.left - transform.panX) / transform.scale;
    const cy   = (e.clientY - rect.top  - transform.panY) / transform.scale;

    const newScript: Script = {
      id: uid(),
      x: snap(cx),
      y: snap(cy),
      blocks: [{ instanceId: uid(), defId: blockId }],
    };
    setScripts((prev) => [...prev, newScript]);
    setSelectedId(newScript.id);
  }, [transform]);

  // ── Trash drop ────────────────────────────────────────────────────────────
  const onTrashDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Remove selected script (user dragged it to trash)
    if (selectedId) {
      setScripts((prev) => prev.filter((s) => s.id !== selectedId));
      setSelectedId(null);
    }
    setTrashOver(false);
  }, [selectedId]);

  // ── Context menu ──────────────────────────────────────────────────────────
  const onScriptContextMenu = useCallback((e: React.MouseEvent, scriptId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, scriptId });
    setSelectedId(scriptId);
  }, []);

  const deleteScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const duplicateScript = useCallback((id: string) => {
    setScripts((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      const copy: Script = {
        id: uid(),
        x: src.x + 24,
        y: src.y + 24,
        blocks: src.blocks.map((b) => ({ ...b, instanceId: uid() })),
      };
      return [...prev, copy];
    });
  }, []);

  // ── Reset view ────────────────────────────────────────────────────────────
  const resetView = () => setTransform({ panX: 40, panY: 40, scale: 1 });

  // ── Render ────────────────────────────────────────────────────────────────
  const pct = Math.round(transform.scale * 100);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[#e9eef2] dark:bg-neutral-800"
      style={{
        cursor: spaceHeld.current ? 'grab' : 'default',
        backgroundImage: 'radial-gradient(circle, #b8c4ce 1px, transparent 1px)',
        backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`,
        backgroundPosition: `${transform.panX}px ${transform.panY}px`,
      }}
      onWheel={onWheel}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Transformed canvas */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.scale})`,
        }}
      >
        {scripts.map((script) => (
          <ScriptCard
            key={script.id}
            script={script}
            scale={transform.scale}
            isSelected={script.id === selectedId}
            onPointerDown={onScriptPointerDown}
            onContextMenu={onScriptContextMenu}
          />
        ))}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          onDelete={deleteScript}
          onDuplicate={duplicateScript}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── Zoom controls ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md border border-border bg-white shadow-sm dark:bg-neutral-900">
        <button
          aria-label="Zoom out"
          onClick={() => setTransform((p) => ({ ...p, scale: Math.max(SCALE_MIN, p.scale - SCALE_STEP) }))}
          className="flex size-7 items-center justify-center rounded-l-md hover:bg-muted"
        >
          <MagnifyingGlassMinus className="size-3.5" />
        </button>
        <button
          className="min-w-[42px] text-center text-[10px] font-semibold tabular-nums hover:bg-muted px-1"
          onClick={resetView}
          title="Reset view"
        >
          {pct}%
        </button>
        <button
          aria-label="Zoom in"
          onClick={() => setTransform((p) => ({ ...p, scale: Math.min(SCALE_MAX, p.scale + SCALE_STEP) }))}
          className="flex size-7 items-center justify-center rounded-r-md hover:bg-muted"
        >
          <MagnifyingGlassPlus className="size-3.5" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <button
          aria-label="Fit view"
          onClick={resetView}
          className="flex size-7 items-center justify-center rounded-md hover:bg-muted"
        >
          <CornersIn className="size-3.5" />
        </button>
      </div>

      {/* ── Trash drop zone ───────────────────────────────────────────────── */}
      <div
        className={cn(
          'absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full border-2 transition-colors',
          trashOver
            ? 'border-red-400 bg-red-100 text-red-500 dark:bg-red-900/30'
            : 'border-border bg-white text-muted-foreground dark:bg-neutral-900',
        )}
        onDragOver={(e) => { e.preventDefault(); setTrashOver(true); }}
        onDragLeave={() => setTrashOver(false)}
        onDrop={onTrashDrop}
        title="Drop here to delete"
      >
        <Trash className="size-4" />
      </div>

      {/* ── Tip when empty ────────────────────────────────────────────────── */}
      {scripts.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/60 select-none">
          Drag blocks from the palette to start scripting
        </p>
      )}
    </div>
  );
}
