'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  CornersInIcon,
  TrashIcon,
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
import {
  findSnapTarget,
  type SnapTarget,
} from "@/lib/scratch/connections";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WBlock {
  instanceId: string;
  defId: string;
  /** Editable input values keyed by part-index. */
  inputs: Record<number, string | number>;
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

// ── Constants ─────────────────────────────────────────────────────────────────
const SCALE_MIN  = 0.25;
const SCALE_MAX  = 2.5;
const SCALE_STEP = 0.15;
const GRID       = 10;

function snap(v: number) { return Math.round(v / GRID) * GRID; }
function uid()  { return Math.random().toString(36).slice(2, 9); }

function defaultInputs(def: BlockDef): Record<number, string | number> {
  const result: Record<number, string | number> = {};
  def.parts.forEach((p, i) => {
    if (p.k === 'num') result[i] = p.v;
    if (p.k === 'str') result[i] = p.v;
  });
  return result;
}

// ── Context menu ──────────────────────────────────────────────────────────────
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

  const item =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent';

  return (
    <div
      className="absolute z-50 min-w-[140px] rounded border border-border bg-popover shadow-md"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className={item}
        onClick={() => { onDuplicate(menu.scriptId); onClose(); }}
      >
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

// ── SnapIndicator ─────────────────────────────────────────────────────────────
/**
 * A glowing white line rendered on the canvas to show where a dropped
 * block will connect to an existing script.
 */
function SnapIndicator({ target }: { target: SnapTarget }) {
  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: target.indicatorX,
        top:  target.indicatorY - 2,
        width: 120,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'white',
        boxShadow: '0 0 8px 3px rgba(255,255,255,0.9)',
      }}
    />
  );
}

// ── WorkspaceBlock ─────────────────────────────────────────────────────────────
function WorkspaceScriptBlock({
  wblock,
  isFirst,
  onInputChange,
}: {
  wblock: WBlock;
  isFirst: boolean;
  onInputChange: (partIndex: number, value: string | number) => void;
}) {
  const def  = getBlockDef(wblock.defId);
  const cat  = getCategoryForBlock(wblock.defId);
  if (!def || !cat) return null;

  /**
   * Vertical positioning for the stacked blocks:
   *
   * First block in script:
   *   - Hat blocks need extra top margin for the dome (18 px + clearance)
   *   - Stack/cap blocks need margin for their top notch (7 px + clearance)
   *
   * Subsequent blocks:
   *   - BLOCK_GAP_PX (6 px) gap between block bodies so the plug of the
   *     block above and the notch of this block occupy the SAME 6 px band,
   *     creating a visually seamless connection.
   */
  const topClass = isFirst
    ? def.shape === 'hat'
      ? 'mt-[22px]'
      : def.shape !== 'reporter' && def.shape !== 'boolean'
      ? 'mt-[10px]'
      : 'mt-1'
    : 'mt-[6px]';

  return (
    <RenderedBlock
      block={def}
      color={cat.color}
      inputs={wblock.inputs}
      onInputChange={onInputChange}
      className={topClass}
    />
  );
}

// ── ScriptCard ────────────────────────────────────────────────────────────────
function ScriptCard({
  script,
  isSelected,
  onPointerDown,
  onContextMenu,
  onInputChange,
}: {
  script: Script;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onInputChange: (scriptId: string, instanceId: string, partIdx: number, val: string | number) => void;
}) {
  return (
    <div
      className={cn(
        'absolute flex flex-col cursor-grab select-none active:cursor-grabbing',
        isSelected && 'ring-2 ring-blue-400/60 ring-offset-1 rounded',
      )}
      style={{ left: script.x, top: script.y, touchAction: 'none' }}
      onPointerDown={(e) => onPointerDown(e, script.id)}
      onContextMenu={(e) => onContextMenu(e, script.id)}
    >
      {script.blocks.map((wb, idx) => (
        <WorkspaceScriptBlock
          key={wb.instanceId}
          wblock={wb}
          isFirst={idx === 0}
          onInputChange={(partIdx, val) =>
            onInputChange(script.id, wb.instanceId, partIdx, val)
          }
        />
      ))}
    </div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────────
export function Workspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trashRef     = useRef<HTMLDivElement>(null);

  const [transform, setTransform] = useState<Transform>({
    panX: 40, panY: 40, scale: 1,
  });
  const [scripts,    setScripts]    = useState<Script[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null);
  const [trashOver,  setTrashOver]  = useState(false);
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);

  // History
  const [past,   setPast]   = useState<Script[][]>([]);
  const [future, setFuture] = useState<Script[][]>([]);
  const dragInitialScripts  = useRef<Script[] | null>(null);

  // Script dragging
  const dragging = useRef<{
    scriptId: string;
    startX: number; startY: number;
    origX: number;  origY: number;
  } | null>(null);

  // Canvas panning
  const panning = useRef<{
    startX: number; startY: number;
    origPanX: number; origPanY: number;
  } | null>(null);
  const spaceHeld = useRef(false);

  // ── History helpers ────────────────────────────────────────────────────────
  const commitHistory = useCallback((newScripts: Script[]) => {
    setPast(p => [...p, scripts].slice(-40));
    setFuture([]);
    setScripts(newScripts);
  }, [scripts]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [...f, scripts]);
    setScripts(prev);
  }, [past, scripts]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture(f => f.slice(0, -1));
    setPast(p => [...p, scripts]);
    setScripts(next);
  }, [future, scripts]);

  // ── Space bar for panning ──────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        spaceHeld.current = true;
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup',   ku);
    };
  }, []);

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform(prev => {
      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, prev.scale + delta));
      return { ...prev, scale };
    });
  }, []);

  const zoomIn    = () => setTransform(p => ({ ...p, scale: Math.min(SCALE_MAX, p.scale + SCALE_STEP) }));
  const zoomOut   = () => setTransform(p => ({ ...p, scale: Math.max(SCALE_MIN, p.scale - SCALE_STEP) }));
  const resetZoom = () => setTransform(p => ({ ...p, scale: 1 }));

  // ── Pointer handlers ───────────────────────────────────────────────────────
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
    containerRef.current!.setPointerCapture(e.pointerId);
    dragInitialScripts.current = scripts;
    const sc = scripts.find(s => s.id === scriptId)!;
    dragging.current = {
      scriptId,
      startX: e.clientX, startY: e.clientY,
      origX: sc.x, origY: sc.y,
    };
    setSelectedId(scriptId);
    setCtxMenu(null);
  }, [scripts]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panning.current) {
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      setTransform(prev => ({
        ...prev,
        panX: panning.current!.origPanX + dx,
        panY: panning.current!.origPanY + dy,
      }));
    } else if (dragging.current) {
      const dx = (e.clientX - dragging.current.startX) / transform.scale;
      const dy = (e.clientY - dragging.current.startY) / transform.scale;
      const nx = snap(dragging.current.origX + dx);
      const ny = snap(dragging.current.origY + dy);

      setScripts(prev =>
        prev.map(s =>
          s.id === dragging.current!.scriptId ? { ...s, x: nx, y: ny } : s,
        ),
      );

      // Trash hit test
      if (trashRef.current) {
        const r = trashRef.current.getBoundingClientRect();
        setTrashOver(
          e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom,
        );
      }
    }
  }, [transform.scale]);

  const onPointerUp = useCallback(() => {
    if (dragging.current) {
      if (trashOver && selectedId) {
        const next = scripts.filter(s => s.id !== selectedId);
        setScripts(next);
        setPast(p => [...p, dragInitialScripts.current!].slice(-40));
        setFuture([]);
        setSelectedId(null);
        setTrashOver(false);
      } else if (dragInitialScripts.current) {
        const moved = dragInitialScripts.current.some(ps => {
          const s = scripts.find(sc => sc.id === ps.id);
          return s && (s.x !== ps.x || s.y !== ps.y);
        });
        if (moved) {
          setPast(p => [...p, dragInitialScripts.current!].slice(-40));
          setFuture([]);
        }
      }
    }
    panning.current  = null;
    dragging.current = null;
    dragInitialScripts.current = null;
  }, [trashOver, selectedId, scripts]);

  // ── Palette → canvas drag ──────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_BLOCK_KEY)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const rect = containerRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left - transform.panX) / transform.scale;
    const cy = (e.clientY - rect.top  - transform.panY) / transform.scale;

    const summaries = scripts.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      blockCount: s.blocks.length,
    }));

    setSnapTarget(findSnapTarget(cx, cy, summaries));
  }, [transform, scripts]);

  const onDragLeave = useCallback(() => {
    setSnapTarget(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSnapTarget(null);

    const raw = e.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (!raw) return;
    const { blockId } = JSON.parse(raw) as { blockId: string; catId: string };
    const def = getBlockDef(blockId);
    if (!def) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const cx   = snap((e.clientX - rect.left - transform.panX) / transform.scale);
    const cy   = snap((e.clientY - rect.top  - transform.panY) / transform.scale);

    const summaries = scripts.map(s => ({
      id: s.id, x: s.x, y: s.y, blockCount: s.blocks.length,
    }));
    const target = findSnapTarget(cx, cy, summaries);
    const newBlock: WBlock = {
      instanceId: uid(),
      defId: blockId,
      inputs: defaultInputs(def),
    };

    if (target) {
      const next = scripts.map(s => {
        if (s.id !== target.scriptId) return s;
        const blocks =
          target.kind === 'append'
            ? [...s.blocks, newBlock]
            : [newBlock, ...s.blocks];
        return { ...s, blocks };
      });
      commitHistory(next);
      setSelectedId(target.scriptId);
    } else {
      const newScript: Script = {
        id: uid(), x: cx, y: cy,
        blocks: [newBlock],
      };
      commitHistory([...scripts, newScript]);
      setSelectedId(newScript.id);
    }
  }, [transform, scripts, commitHistory]);

  // ── Input value editing ────────────────────────────────────────────────────
  const handleInputChange = useCallback((
    scriptId: string,
    instanceId: string,
    partIdx: number,
    val: string | number,
  ) => {
    setScripts(prev =>
      prev.map(s => {
        if (s.id !== scriptId) return s;
        return {
          ...s,
          blocks: s.blocks.map(b => {
            if (b.instanceId !== instanceId) return b;
            return { ...b, inputs: { ...b.inputs, [partIdx]: val } };
          }),
        };
      }),
    );
  }, []);

  // ── Delete / duplicate ─────────────────────────────────────────────────────
  const deleteScript = useCallback((id: string) => {
    commitHistory(scripts.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [scripts, selectedId, commitHistory]);

  const duplicateScript = useCallback((id: string) => {
    const src = scripts.find(s => s.id === id);
    if (!src) return;
    const copy: Script = {
      id: uid(),
      x: src.x + 24,
      y: src.y + 24,
      blocks: src.blocks.map(b => ({ ...b, instanceId: uid() })),
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
        backgroundSize:  `${24 * transform.scale}px ${24 * transform.scale}px`,
        backgroundPosition: `${transform.panX}px ${transform.panY}px`,
      }}
      onWheel={onWheel}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Floating toolbar ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
        <FloatingToolbar
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          canCopy={!!selectedId}
          canPaste={false}
          canDelete={!!selectedId}
          onUndo={undo}
          onRedo={redo}
          onCopy={() => {}}
          onPaste={() => {}}
          onDelete={() => { if (selectedId) deleteScript(selectedId); }}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          zoomLevel={Math.round(transform.scale * 100)}
        />
      </div>

      {/* ── Transformed canvas ───────────────────────────────────────────── */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${transform.panX}px,${transform.panY}px) scale(${transform.scale})`,
        }}
      >
        {/* Snap indicator rendered in canvas space */}
        {snapTarget && <SnapIndicator target={snapTarget} />}

        {scripts.map(script => (
          <ScriptCard
            key={script.id}
            script={script}
            isSelected={script.id === selectedId}
            onPointerDown={onScriptPointerDown}
            onContextMenu={onScriptContextMenu}
            onInputChange={handleInputChange}
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

      {/* ── Zoom controls ────────────────────────────────────────────────── */}
      <div className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-1 rounded-md border border-border bg-white shadow-sm dark:bg-neutral-900">
        <button
          onClick={zoomOut}
          className="flex size-7 items-center justify-center rounded-l-md hover:bg-muted"
        >
          <MagnifyingGlassMinusIcon className="size-3.5" />
        </button>
        <button
          className="min-w-[42px] px-1 text-center text-[10px] font-semibold tabular-nums hover:bg-muted"
          onClick={resetZoom}
          title="Reset zoom"
        >
          {Math.round(transform.scale * 100)}%
        </button>
        <button
          onClick={zoomIn}
          className="flex size-7 items-center justify-center rounded-r-md hover:bg-muted"
        >
          <MagnifyingGlassPlusIcon className="size-3.5" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <button
          onClick={resetZoom}
          className="flex size-7 items-center justify-center rounded-md hover:bg-muted"
          title="Fit to screen"
        >
          <CornersInIcon className="size-3.5" />
        </button>
      </div>

      {/* ── Trash zone ───────────────────────────────────────────────────── */}
      <div
        ref={trashRef}
        className={cn(
          'pointer-events-auto absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full border-2 transition-colors',
          trashOver
            ? 'border-red-400 bg-red-100 text-red-500 shadow-[0_0_15px_#f87171]'
            : 'border-border bg-white text-muted-foreground dark:bg-neutral-900',
        )}
      >
        <TrashIcon className="size-4" />
      </div>

      {/* Empty-state hint */}
      {scripts.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/60 select-none">
          Drag blocks from the palette to start scripting
        </p>
      )}
    </div>
  );
}
