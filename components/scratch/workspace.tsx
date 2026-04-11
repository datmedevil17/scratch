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
  type BlockDef,
  getBlockDef,
  getCategoryForBlock,
  DRAG_BLOCK_KEY,
} from "@/lib/scratch/blocks";
import { RenderedBlock } from "@/components/scratch/block-renderer";
import { FloatingToolbar } from "@/components/scratch/floating-toolbar";

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
const BLOCK_HEIGHT_ESTIMATE = 48; // px height per block for proximity calc

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

// ── WorkspaceBlock ───────────────────────────────────────────────────────────
function WorkspaceScriptBlock({ defId }: { defId: string }) {
  const def  = getBlockDef(defId);
  const cat  = getCategoryForBlock(defId);
  if (!def || !cat) return null;
  return (
    <RenderedBlock
      block={def}
      color={cat.color}
      className={cn(def.shape === 'hat' && 'mt-4', '-mb-1.5')} 
    />
  );
}

// ── Script card ──────────────────────────────────────────────────────────────
function ScriptCard({
  script,
  isSelected,
  onPointerDown,
  onContextMenu,
}: {
  script: Script;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div
      className={cn(
        'absolute flex flex-col cursor-grab select-none rounded active:cursor-grabbing',
        isSelected && 'ring-2 ring-blue-400 ring-offset-2',
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
  const trashRef = useRef<HTMLDivElement>(null);
  
  const [transform, setTransform] = useState<Transform>({ panX: 40, panY: 40, scale: 1 });
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [trashOver, setTrashOver] = useState(false);

  // History Stack
  const [past, setPast] = useState<Script[][]>([]);
  const [future, setFuture] = useState<Script[][]>([]);
  const dragInitialScripts = useRef<Script[] | null>(null);

  // For script dragging
  const dragging = useRef<{
    scriptId: string;
    startX: number; startY: number;
    origX: number;  origY: number;
  } | null>(null);

  // For canvas panning
  const panning = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);
  const spaceHeld = useRef(false);

  // ── History Helper ────────────────────────────────────────────────────────
  const commitHistory = useCallback((newScripts: Script[]) => {
    setPast(p => [...p, scripts].slice(-30));
    setFuture([]);
    setScripts(newScripts);
  }, [scripts]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [...f, scripts]);
    setScripts(prev);
  }, [past, scripts]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture(f => f.slice(0, -1));
    setPast(p => [...p, scripts]);
    setScripts(next);
  }, [future, scripts]);

  // ── Keyboard: space bar ───────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); spaceHeld.current = true; } };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeld.current = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  // ── Zoom Controls ─────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => {
      const delta  = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      const scale  = Math.min(SCALE_MAX, Math.max(SCALE_MIN, prev.scale + delta));
      return { ...prev, scale };
    });
  }, []);

  const zoomIn = () => setTransform(p => ({ ...p, scale: Math.min(SCALE_MAX, p.scale + SCALE_STEP) }));
  const zoomOut = () => setTransform(p => ({ ...p, scale: Math.max(SCALE_MIN, p.scale - SCALE_STEP) }));
  const resetZoom = () => setTransform(p => ({ ...p, scale: 1 }));

  // ── Pointer Handlers ──────────────────────────────────────────────────────
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

  const onScriptPointerDown = useCallback((e: React.PointerEvent, scriptId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const container = containerRef.current!;
    container.setPointerCapture(e.pointerId);
    
    dragInitialScripts.current = scripts; // snapshot for history
    const sc = scripts.find((s) => s.id === scriptId)!;
    dragging.current = {
      scriptId,
      startX: e.clientX, startY: e.clientY,
      origX: sc.x,       origY: sc.y,
    };
    setSelectedId(scriptId);
    setCtxMenu(null);
  }, [scripts]);

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

      // Hit test trash
      if (trashRef.current) {
        const rect = trashRef.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          setTrashOver(true);
        } else {
          setTrashOver(false);
        }
      }
    }
  }, [transform.scale]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragging.current) {
      // Handle drag drop on canvas or trash
      if (trashOver && selectedId) {
        // Delete
        const next = scripts.filter(s => s.id !== selectedId);
        setScripts(next);
        setPast(p => [...p, dragInitialScripts.current!].slice(-30));
        setFuture([]);
        setSelectedId(null);
        setTrashOver(false);
      } else if (dragInitialScripts.current !== scripts) {
        // Moved - push to history! 
        // Note: dragInitialScripts.current is captured before drag. We push IT to the past, and scripts is already updated.
        const prev = dragInitialScripts.current!;
        const moved = prev.some((pScript) => {
          const s = scripts.find(sc => sc.id === pScript.id);
          return s && (s.x !== pScript.x || s.y !== pScript.y);
        });
        if (moved) {
          setPast(p => [...p, prev].slice(-30));
          setFuture([]);
        }
      }
    }
    panning.current  = null;
    dragging.current = null;
    dragInitialScripts.current = null;
  }, [trashOver, selectedId, scripts]);

  // ── Palette Drop (Snapping logic) ─────────────────────────────────────────
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
    const cx   = snap((e.clientX - rect.left - transform.panX) / transform.scale);
    const cy   = snap((e.clientY - rect.top  - transform.panY) / transform.scale);

    // Proximity check for snap
    // We look for a script whose bottom is near the drop coordinate
    let snappedScriptId = null;
    const SNAP_RADIUS = 40;

    for (const s of scripts) {
      const bottomY = s.y + (s.blocks.length * BLOCK_HEIGHT_ESTIMATE);
      if (Math.abs(cx - s.x) < SNAP_RADIUS && Math.abs(cy - bottomY) < SNAP_RADIUS) {
        snappedScriptId = s.id;
        break;
      }
    }

    if (snappedScriptId) {
      // Append to existing
      const next = scripts.map(s => s.id === snappedScriptId 
        ? { ...s, blocks: [...s.blocks, { instanceId: uid(), defId: blockId }] } 
        : s
      );
      commitHistory(next);
      setSelectedId(snappedScriptId);
    } else {
      // Form new script
      const newScript: Script = { id: uid(), x: cx, y: cy, blocks: [{ instanceId: uid(), defId: blockId }] };
      commitHistory([...scripts, newScript]);
      setSelectedId(newScript.id);
    }
  }, [transform, scripts, commitHistory]);

  const deleteScript = useCallback((id: string) => {
    commitHistory(scripts.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [scripts, selectedId, commitHistory]);

  const duplicateScript = useCallback((id: string) => {
    const src = scripts.find((s) => s.id === id);
    if (!src) return;
    const copy: Script = {
      id: uid(),
      x: src.x + 24,
      y: src.y + 24,
      blocks: src.blocks.map((b) => ({ ...b, instanceId: uid() })),
    };
    commitHistory([...scripts, copy]);
  }, [scripts, commitHistory]);

  const onScriptContextMenu = useCallback((e: React.MouseEvent, scriptId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, scriptId });
    setSelectedId(scriptId);
  }, []);

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
      {/* ── Top-level Controls ───────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
        <FloatingToolbar
          canUndo={past.length > 0} canRedo={future.length > 0}
          canCopy={!!selectedId} canPaste={false} canDelete={!!selectedId}
          onUndo={undo} onRedo={redo}
          onCopy={() => {}} onPaste={() => {}} 
          onDelete={() => { if (selectedId) deleteScript(selectedId); }}
          onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom}
          zoomLevel={Math.round(transform.scale * 100)}
        />
      </div>

      {/* ── Transformed canvas ───────────────────────────────────────────── */}
      <div
        className="absolute origin-top-left"
        style={{ transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.scale})` }}
      >
        {scripts.map((script) => (
          <ScriptCard
            key={script.id}
            script={script}
            isSelected={script.id === selectedId}
            onPointerDown={onScriptPointerDown}
            onContextMenu={onScriptContextMenu}
          />
        ))}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu menu={ctxMenu} onDelete={deleteScript} onDuplicate={duplicateScript} onClose={() => setCtxMenu(null)} />
      )}

      {/* ── Zoom controls (bottom left) ──────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md border border-border bg-white shadow-sm dark:bg-neutral-900 pointer-events-auto">
        <button
          onClick={zoomOut}
          className="flex size-7 items-center justify-center rounded-l-md hover:bg-muted"
        >
          <MagnifyingGlassMinus className="size-3.5" />
        </button>
        <button
          className="min-w-[42px] text-center text-[10px] font-semibold tabular-nums hover:bg-muted px-1"
          onClick={resetZoom}
          title="Reset view"
        >
          {Math.round(transform.scale * 100)}%
        </button>
        <button
          onClick={zoomIn}
          className="flex size-7 items-center justify-center rounded-r-md hover:bg-muted"
        >
          <MagnifyingGlassPlus className="size-3.5" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <button
          onClick={resetZoom}
          className="flex size-7 items-center justify-center rounded-md hover:bg-muted"
        >
          <CornersIn className="size-3.5" />
        </button>
      </div>

      {/* ── Trash drop zone ──────────────────────────────────────────────── */}
      <div
        ref={trashRef}
        className={cn(
          'absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full border-2 transition-colors pointer-events-auto',
          trashOver
            ? 'border-red-400 bg-red-100 text-red-500 shadow-[0_0_15px_#f87171] dark:bg-red-900/40 dark:shadow-[0_0_15px_#7f1d1d]'
            : 'border-border bg-white text-muted-foreground dark:bg-neutral-900',
        )}
      >
        <Trash className="size-4" />
      </div>

      {/* ── Tip when empty ───────────────────────────────────────────────── */}
      {scripts.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/60 select-none">
          Drag blocks from the palette to start scripting
        </p>
      )}
    </div>
  );
}
