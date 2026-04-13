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
import { RenderedBlock, CBlock, RenderPart } from "@/components/scratch/block-renderer";
import { FloatingToolbar } from "@/components/scratch/floating-toolbar";
import {
  findSnapTarget,
  type SnapTarget,
  type ScriptSummary,
} from "@/lib/scratch/connections";
import { type WBlock, type Script } from "@/lib/scratch/types";

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
// Minimum pointer movement (px in client-space) before we treat it as a drag
const DRAG_THRESHOLD = 6;

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

// ── Block / script height estimation ──────────────────────────────────────────
const SHAPE_HEIGHT: Record<string, number> = {
  hat:      50,
  stack:    34,
  cap:      30,
  c:        72,
  c2:      110,
  reporter: 24,
  boolean:  24,
};

function estimateBlockHeight(defId: string): number {
  const def = getBlockDef(defId);
  return def ? (SHAPE_HEIGHT[def.shape] ?? 34) : 34;
}

function isTerminalBlock(defId: string): boolean {
  const def = getBlockDef(defId);
  return def?.shape === 'cap' || !!(def?.terminal);
}

function buildSummaries(
  scripts: Script[],
  cardRefs: Map<string, HTMLDivElement>,
  excludeId?: string,
): ScriptSummary[] {
  return scripts
    .filter(s => s.id !== excludeId)
    .map(s => {
      const firstDef = s.blocks[0]     ? getBlockDef(s.blocks[0].defId)                   : null;
      const lastDef  = s.blocks.length ? getBlockDef(s.blocks[s.blocks.length - 1].defId) : null;
      const el = cardRefs.get(s.id);
      return {
        id:                  s.id,
        x:                   s.x,
        y:                   s.y,
        width:               el ? el.offsetWidth : 0,
        blockHeights:        s.blocks.map(b => estimateBlockHeight(b.defId)),
        firstBlockIsHat:     firstDef?.shape === 'hat',
        lastBlockIsTerminal: !!(lastDef?.shape === 'cap' || lastDef?.terminal),
      };
    });
}

// ── Deep block clone (new instanceIds throughout) ─────────────────────────────
function deepCloneBlock(b: WBlock): WBlock {
  return {
    ...b,
    instanceId: uid(),
    inner:  b.inner?.map(deepCloneBlock),
    inner2: b.inner2?.map(deepCloneBlock),
  };
}

// ── Apply snap: insert / append / prepend blocks into a script ────────────────
function applySnap(
  scripts: Script[],
  target: SnapTarget,
  newBlocks: WBlock[],
  removeId?: string,
): Script[] {
  return scripts
    .filter(s => s.id !== removeId)
    .map(s => {
      if (s.id !== target.scriptId) return s;
      let blocks: WBlock[];
      if (target.kind === 'append') {
        blocks = [...s.blocks, ...newBlocks];
      } else if (target.kind === 'prepend') {
        blocks = [...newBlocks, ...s.blocks];
      } else {
        // insert
        const idx = target.insertIndex ?? s.blocks.length;
        blocks = [
          ...s.blocks.slice(0, idx),
          ...newBlocks,
          ...s.blocks.slice(idx),
        ];
      }
      return { ...s, blocks };
    });
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
function SnapIndicator({ target }: { target: SnapTarget }) {
  const isInsert = target.kind === 'insert';
  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left:   target.indicatorX - 2,
        top:    target.indicatorY - (isInsert ? 3 : 2),
        width:  target.indicatorWidth + 4,
        height: isInsert ? 6 : 4,
        borderRadius: 3,
        backgroundColor: isInsert ? '#fff700' : 'white',
        boxShadow: isInsert
          ? '0 0 12px 4px rgba(255,247,0,0.85)'
          : '0 0 8px 3px rgba(255,255,255,0.9)',
      }}
    />
  );
}

// ── Inner drop zone (inside a C-block mouth) ─────────────────────────────────
function InnerDropZone({
  blocks,
  onDrop,
  onInputChange,
}: {
  blocks: WBlock[];
  onDrop: (defId: string) => void;
  onInputChange: (instanceId: string, partIdx: number, val: string | number) => void;
}) {
  const [over, setOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_BLOCK_KEY)) return;
    e.preventDefault();
    e.stopPropagation();
    setOver(true);
  };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const raw = e.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (!raw) return;
    const { blockId } = JSON.parse(raw) as { blockId: string };
    onDrop(blockId);
  };

  return (
    <div
      className={cn(
        'min-h-[28px] rounded transition-colors',
        over ? 'bg-white/20 outline-dashed outline-1 outline-white/60' : '',
        blocks.length === 0 && !over ? 'outline-dashed outline-1 outline-white/20' : '',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {blocks.map((wb, idx) => (
        <WorkspaceBlock
          key={wb.instanceId}
          wblock={wb}
          isFirst={idx === 0}
          onInputChange={(partIdx, val) => onInputChange(wb.instanceId, partIdx, val)}
        />
      ))}
    </div>
  );
}

// ── Single block renderer (recursive for C-blocks) ────────────────────────────
function WorkspaceBlock({
  wblock,
  isFirst,
  onInputChange,
  onInnerDrop,
  onInner2Drop,
}: {
  wblock: WBlock;
  isFirst: boolean;
  onInputChange: (partIdx: number, val: string | number) => void;
  onInnerDrop?:  (defId: string) => void;
  onInner2Drop?: (defId: string) => void;
}) {
  const def = getBlockDef(wblock.defId);
  const cat = getCategoryForBlock(wblock.defId);
  if (!def || !cat) return null;

  const isC  = def.shape === 'c';
  const isC2 = def.shape === 'c2';

  const topClass = isFirst
    ? def.shape === 'hat' ? 'mt-[22px]'
      : (isC || isC2 || (def.shape !== 'reporter' && def.shape !== 'boolean')) ? 'mt-[10px]'
      : 'mt-1'
    : 'mt-[6px]';

  if (isC || isC2) {
    const headerParts = def.parts.map((part, i) => (
      <RenderPart
        key={i}
        part={part}
        value={wblock.inputs?.[i]}
        onValueChange={(v: string | number) => onInputChange(i, v)}
      />
    ));

    return (
      <CBlock
        color={cat.color}
        headerParts={headerParts}
        hasTopSocket
        hasBottomPlug={isC && !def.terminal}
        className={topClass}
        innerContent={
          <InnerDropZone
            blocks={wblock.inner ?? []}
            onDrop={(defId) => onInnerDrop?.(defId)}
            onInputChange={(_iid, _pIdx, _val) => { /* bubbled via onInputChange */ }}
          />
        }
        inner2Content={isC2 ? (
          <InnerDropZone
            blocks={wblock.inner2 ?? []}
            onDrop={(defId) => onInner2Drop?.(defId)}
            onInputChange={(_iid, _pIdx, _val) => { /* bubbled via onInputChange */ }}
          />
        ) : undefined}
      />
    );
  }

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

// ── Deep-update helpers for scripts ──────────────────────────────────────────
function updateBlockInputs(
  blocks: WBlock[],
  instanceId: string,
  partIdx: number,
  val: string | number,
): WBlock[] {
  return blocks.map((b) => {
    if (b.instanceId === instanceId) {
      return { ...b, inputs: { ...b.inputs, [partIdx]: val } };
    }
    const inner  = b.inner  ? updateBlockInputs(b.inner,  instanceId, partIdx, val) : b.inner;
    const inner2 = b.inner2 ? updateBlockInputs(b.inner2, instanceId, partIdx, val) : b.inner2;
    return { ...b, inner, inner2 };
  });
}

function appendInnerBlock(
  blocks: WBlock[],
  parentId: string,
  newBlock: WBlock,
  branch: 'inner' | 'inner2',
): WBlock[] {
  return blocks.map((b) => {
    if (b.instanceId === parentId) {
      const list = b[branch] ?? [];
      return { ...b, [branch]: [...list, newBlock] };
    }
    const inner  = b.inner  ? appendInnerBlock(b.inner,  parentId, newBlock, branch) : b.inner;
    const inner2 = b.inner2 ? appendInnerBlock(b.inner2, parentId, newBlock, branch) : b.inner2;
    return { ...b, inner, inner2 };
  });
}

// ── ScriptCard ────────────────────────────────────────────────────────────────
/**
 * Renders one script. Supports:
 * - Whole-script drag (pointer capture on the card)
 * - Per-block pull-off: pointerdown on a mid-stack block splits the script
 */
function ScriptCard({
  script,
  isSelected,
  insertGapIndex,
  onPointerDown,
  onBlockPointerDown,
  onContextMenu,
  onInputChange,
  onInnerDrop,
  onRef,
}: {
  script: Script;
  isSelected: boolean;
  /** If set, render a visual gap before this block index (for insert preview). */
  insertGapIndex?: number;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onBlockPointerDown: (e: React.PointerEvent, scriptId: string, blockIndex: number) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onInputChange: (scriptId: string, instanceId: string, partIdx: number, val: string | number) => void;
  onInnerDrop: (scriptId: string, parentId: string, defId: string, branch: 'inner' | 'inner2') => void;
  onRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={onRef}
      className={cn(
        'absolute flex w-max flex-col select-none',
        isSelected && 'ring-2 ring-blue-400/60 ring-offset-1 rounded',
      )}
      style={{ left: script.x, top: script.y, touchAction: 'none' }}
      onPointerDown={(e) => onPointerDown(e, script.id)}
      onContextMenu={(e) => onContextMenu(e, script.id)}
    >
      {script.blocks.map((wb, idx) => (
        <div
          key={wb.instanceId}
          className="relative"
          onPointerDown={(e) => {
            // Only intercept left-button; let the card-level handler take over
            // for index 0 (top block = move whole script)
            if (e.button !== 0 || idx === 0) return;
            e.stopPropagation();
            onBlockPointerDown(e, script.id, idx);
          }}
          style={{ cursor: idx === 0 ? 'grab' : 'grab' }}
        >
          {/* Insert gap indicator */}
          {insertGapIndex === idx && (
            <div
              className="pointer-events-none absolute inset-x-0 -top-1 z-10 h-1 rounded-full bg-yellow-300 shadow-[0_0_8px_3px_rgba(255,247,0,0.7)] transition-all duration-100"
            />
          )}
          <WorkspaceBlock
            wblock={wb}
            isFirst={idx === 0}
            onInputChange={(partIdx, val) =>
              onInputChange(script.id, wb.instanceId, partIdx, val)
            }
            onInnerDrop={(defId) =>
              onInnerDrop(script.id, wb.instanceId, defId, 'inner')
            }
            onInner2Drop={(defId) =>
              onInnerDrop(script.id, wb.instanceId, defId, 'inner2')
            }
          />
        </div>
      ))}
    </div>
  );
}

// ── DragGhost — floating block preview following the cursor ────────────────────
/**
 * Rendered at fixed position in the viewport. Shows a ghost block during
 * palette-to-canvas pointer drags.
 */
function DragGhost({
  defId,
  x,
  y,
}: {
  defId: string;
  x: number;
  y: number;
}) {
  const def = getBlockDef(defId);
  const cat = getCategoryForBlock(defId);
  if (!def || !cat) return null;

  const isC  = def.shape === 'c';
  const isC2 = def.shape === 'c2';

  if (isC || isC2) {
    const headerParts = def.parts.map((part, i) => (
      <RenderPart key={i} part={part} />
    ));
    return (
      <div
        className="pointer-events-none fixed z-[9999] opacity-80"
        style={{ left: x, top: y }}
      >
        <CBlock
          color={cat.color}
          headerParts={headerParts}
          hasTopSocket
          hasBottomPlug={isC}
        />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed z-[9999] opacity-80"
      style={{ left: x, top: y }}
    >
      <RenderedBlock block={def} color={cat.color} inputs={{}} onInputChange={() => {}} />
    </div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────────
export function Workspace({
  initialScripts = [],
  onScriptsChange,
}: {
  initialScripts?: Script[];
  onScriptsChange?: (scripts: Script[]) => void;
}) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const trashRef        = useRef<HTMLDivElement>(null);
  const scriptCardRefs  = useRef<Map<string, HTMLDivElement>>(new Map());

  const [transform, setTransform] = useState<Transform>({
    panX: 40, panY: 40, scale: 1,
  });
  const [scripts,    setScripts]    = useState<Script[]>(initialScripts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null);
  const [trashOver,  setTrashOver]  = useState(false);
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);
  const [spaceHeld,  setSpaceHeld]  = useState(false);

  // ── Ghost drag state (palette → canvas pointer-based) ────────────────────
  const [ghost, setGhost] = useState<{
    defId: string;
    x: number;
    y: number;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);

  // History
  const [past,   setPast]   = useState<Script[][]>([]);
  const [future, setFuture] = useState<Script[][]>([]);
  const dragInitialScripts  = useRef<Script[] | null>(null);

  // Script dragging (existing blocks)
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

  // Ghost pointer drag (from palette)
  const ghostDrag = useRef<{
    blockId: string;
    grabOffsetX: number;
    grabOffsetY: number;
    started: boolean;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  // ── History helpers ────────────────────────────────────────────────────────
  const commitHistory = useCallback((newScripts: Script[]) => {
    setPast(p => [...p, scripts].slice(-40));
    setFuture([]);
    setScripts(newScripts);
    onScriptsChange?.(newScripts);
  }, [scripts, onScriptsChange]);

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
        setSpaceHeld(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup',   ku);
    };
  }, []);

  // ── Zoom (zoom toward cursor position) ────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setTransform(prev => {
      const delta    = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      const newScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, prev.scale + delta));
      const ratio    = newScale / prev.scale;
      return {
        scale: newScale,
        panX:  mouseX - ratio * (mouseX - prev.panX),
        panY:  mouseY - ratio * (mouseY - prev.panY),
      };
    });
  }, []);

  const zoomIn    = () => setTransform(p => ({ ...p, scale: Math.min(SCALE_MAX, p.scale + SCALE_STEP) }));
  const zoomOut   = () => setTransform(p => ({ ...p, scale: Math.max(SCALE_MIN, p.scale - SCALE_STEP) }));
  const resetZoom = () => setTransform(p => ({ ...p, scale: 1 }));

  // ── Pointer handlers for existing scripts ─────────────────────────────────
  const onCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || spaceHeld) {
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
  }, [transform, spaceHeld]);

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

  /**
   * Block-level pull-off: the user grabbed block at `blockIndex` within `scriptId`.
   * Split the script: first part stays, second part becomes a new floating script.
   */
  const onBlockPointerDown = useCallback((
    e: React.PointerEvent,
    scriptId: string,
    blockIndex: number,
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const src = scripts.find(s => s.id === scriptId);
    if (!src || blockIndex <= 0 || blockIndex >= src.blocks.length) {
      // Fall back to whole-script drag
      onScriptPointerDown(e, scriptId);
      return;
    }

    // Build the two halves
    const topHalf: WBlock[]    = src.blocks.slice(0, blockIndex);
    const bottomHalf: WBlock[] = src.blocks.slice(blockIndex);

    // Estimate the Y offset of the pulled-off block
    const pulledOffsetY = topHalf.reduce((acc, b) => acc + estimateBlockHeight(b.defId), 0);

    const newScript: Script = {
      id: uid(),
      x: src.x,
      y: src.y + pulledOffsetY,
      blocks: bottomHalf,
    };

    const updatedScripts = scripts.map(s =>
      s.id === scriptId ? { ...s, blocks: topHalf } : s
    ).concat(newScript);

    // Remove the original if its top half is now empty
    const finalScripts = updatedScripts.filter(s => s.blocks.length > 0);

    setPast(p => [...p, scripts].slice(-40));
    setFuture([]);
    setScripts(finalScripts);

    // Now drag the new script
    containerRef.current!.setPointerCapture(e.pointerId);
    dragInitialScripts.current = finalScripts;
    dragging.current = {
      scriptId: newScript.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: newScript.x,
      origY: newScript.y,
    };
    setSelectedId(newScript.id);
    setCtxMenu(null);
  }, [scripts, onScriptPointerDown]);

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

      const currentScriptId = dragging.current.scriptId;

      setScripts(prev => {
        const updated = prev.map(s =>
          s.id === currentScriptId ? { ...s, x: nx, y: ny } : s,
        );
        const summaries = buildSummaries(updated, scriptCardRefs.current, currentScriptId);
        setSnapTarget(findSnapTarget(nx, ny, summaries));
        return updated;
      });

      // Trash hit test
      if (trashRef.current) {
        const r = trashRef.current.getBoundingClientRect();
        setTrashOver(
          e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom,
        );
      }
    } else if (ghostDrag.current) {
      const gd = ghostDrag.current;
      const dx = e.clientX - gd.startClientX;
      const dy = e.clientY - gd.startClientY;

      // Start showing ghost after threshold
      if (!gd.started && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        gd.started = true;
      }

      if (gd.started) {
        const ghostX = e.clientX - gd.grabOffsetX;
        const ghostY = e.clientY - gd.grabOffsetY;
        setGhost({
          defId: gd.blockId,
          x: ghostX,
          y: ghostY,
          grabOffsetX: gd.grabOffsetX,
          grabOffsetY: gd.grabOffsetY,
        });

        // Compute canvas-space coords for snap preview
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = (e.clientX - rect.left - transform.panX) / transform.scale - gd.grabOffsetX / transform.scale;
        const cy = (e.clientY - rect.top  - transform.panY) / transform.scale - gd.grabOffsetY / transform.scale;
        setSnapTarget(findSnapTarget(cx, cy, buildSummaries(scripts, scriptCardRefs.current)));
      }
    }
  }, [transform, scripts]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (ghostDrag.current?.started) {
      // Commit palette ghost drag to canvas
      const gd = ghostDrag.current;
      const def = getBlockDef(gd.blockId);
      if (def) {
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = snap((e.clientX - rect.left - transform.panX) / transform.scale - gd.grabOffsetX / transform.scale);
        const cy = snap((e.clientY - rect.top  - transform.panY) / transform.scale - gd.grabOffsetY / transform.scale);

        const summaries = buildSummaries(scripts, scriptCardRefs.current);
        const target = findSnapTarget(cx, cy, summaries);
        const newBlock: WBlock = {
          instanceId: uid(),
          defId: gd.blockId,
          inputs: defaultInputs(def),
        };

        if (target) {
          commitHistory(applySnap(scripts, target, [newBlock]));
          setSelectedId(target.scriptId);
        } else {
          const newScript: Script = {
            id: uid(), x: cx, y: cy,
            blocks: [newBlock],
          };
          commitHistory([...scripts, newScript]);
          setSelectedId(newScript.id);
        }
      }
      setGhost(null);
      setSnapTarget(null);
      ghostDrag.current = null;
    } else if (ghostDrag.current) {
      // Did not exceed threshold — treat as a click (no-op for now)
      setGhost(null);
      setSnapTarget(null);
      ghostDrag.current = null;
    }

    if (dragging.current) {
      const draggedId = dragging.current.scriptId;

      if (trashOver && draggedId) {
        const next = scripts.filter(s => s.id !== draggedId);
        setScripts(next);
        setPast(p => [...p, dragInitialScripts.current!].slice(-40));
        setFuture([]);
        setSelectedId(null);
        setTrashOver(false);
        setSnapTarget(null);
      } else {
        const dragged = scripts.find(s => s.id === draggedId);
        const summaries = buildSummaries(scripts, scriptCardRefs.current, draggedId);
        const target = dragged ? findSnapTarget(dragged.x, dragged.y, summaries) : null;

        if (target && dragged) {
          const next = applySnap(scripts, target, dragged.blocks, draggedId);
          commitHistory(next);
          setSelectedId(target.scriptId);
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
        setSnapTarget(null);
      }
    }
    panning.current  = null;
    dragging.current = null;
    dragInitialScripts.current = null;
  }, [trashOver, scripts, commitHistory, transform]);

  // ── Palette → canvas: HTML5 DnD (kept as fallback for browsers that block pointer capture across iframes) ──
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_BLOCK_KEY)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const rect = containerRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left - transform.panX) / transform.scale;
    const cy = (e.clientY - rect.top  - transform.panY) / transform.scale;

    setSnapTarget(findSnapTarget(cx, cy, buildSummaries(scripts, scriptCardRefs.current)));
  }, [transform, scripts]);

  const onDragLeave = useCallback(() => {
    setSnapTarget(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSnapTarget(null);

    const raw = e.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (!raw) return;
    const { blockId, offsetX = 0, offsetY = 0 } =
      JSON.parse(raw) as { blockId: string; catId: string; offsetX?: number; offsetY?: number };
    const def = getBlockDef(blockId);
    if (!def) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const cx = snap((e.clientX - rect.left - transform.panX) / transform.scale - offsetX / transform.scale);
    const cy = snap((e.clientY - rect.top  - transform.panY) / transform.scale - offsetY / transform.scale);

    const summaries = buildSummaries(scripts, scriptCardRefs.current);
    const target = findSnapTarget(cx, cy, summaries);
    const newBlock: WBlock = {
      instanceId: uid(),
      defId: blockId,
      inputs: defaultInputs(def),
    };

    if (target) {
      commitHistory(applySnap(scripts, target, [newBlock]));
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

  // ── Global palette pointer-drag listener (captures outside palette boundary) ──
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!ghostDrag.current) return;
      const gd = ghostDrag.current;
      const dx = e.clientX - gd.startClientX;
      const dy = e.clientY - gd.startClientY;

      if (!gd.started && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        gd.started = true;
      }

      if (gd.started) {
        setGhost({
          defId: gd.blockId,
          x: e.clientX - gd.grabOffsetX,
          y: e.clientY - gd.grabOffsetY,
          grabOffsetX: gd.grabOffsetX,
          grabOffsetY: gd.grabOffsetY,
        });

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const cx = (e.clientX - rect.left - transform.panX) / transform.scale - gd.grabOffsetX / transform.scale;
          const cy = (e.clientY - rect.top  - transform.panY) / transform.scale - gd.grabOffsetY / transform.scale;
          setSnapTarget(findSnapTarget(cx, cy, buildSummaries(scripts, scriptCardRefs.current)));
        }
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (!ghostDrag.current) return;
      const gd = ghostDrag.current;

      if (gd.started) {
        const def = getBlockDef(gd.blockId);
        if (def) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const cx = snap((e.clientX - rect.left - transform.panX) / transform.scale - gd.grabOffsetX / transform.scale);
            const cy = snap((e.clientY - rect.top  - transform.panY) / transform.scale - gd.grabOffsetY / transform.scale);

            const summaries = buildSummaries(scripts, scriptCardRefs.current);
            const target = findSnapTarget(cx, cy, summaries);
            const newBlock: WBlock = {
              instanceId: uid(),
              defId: gd.blockId,
              inputs: defaultInputs(def),
            };

            if (target) {
              commitHistory(applySnap(scripts, target, [newBlock]));
              setSelectedId(target.scriptId);
            } else {
              // Only place block if it's actually inside the canvas
              const inCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top  && e.clientY <= rect.bottom;
              if (inCanvas) {
                const newScript: Script = {
                  id: uid(), x: cx, y: cy,
                  blocks: [newBlock],
                };
                commitHistory([...scripts, newScript]);
                setSelectedId(newScript.id);
              }
            }
          }
        }
      }

      setGhost(null);
      setSnapTarget(null);
      ghostDrag.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup',   handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup',   handleWindowPointerUp);
    };
  }, [transform, scripts, commitHistory]);

  // ── Expose ghostDragStart for palette blocks to call ──────────────────────
  // We attach it to the window as a custom event so palette can trigger it
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        blockId: string;
        clientX: number;
        clientY: number;
        grabOffsetX: number;
        grabOffsetY: number;
      }>;
      ghostDrag.current = {
        blockId: ce.detail.blockId,
        grabOffsetX: ce.detail.grabOffsetX,
        grabOffsetY: ce.detail.grabOffsetY,
        started: false,
        startClientX: ce.detail.clientX,
        startClientY: ce.detail.clientY,
      };
    };
    window.addEventListener('scratch:palette-drag-start', handler);
    return () => window.removeEventListener('scratch:palette-drag-start', handler);
  }, []);

  // ── Input value editing (deep — works inside C-blocks) ────────────────────
  const handleInputChange = useCallback((
    scriptId: string,
    instanceId: string,
    partIdx: number,
    val: string | number,
  ) => {
    setScripts(prev =>
      prev.map(s => {
        if (s.id !== scriptId) return s;
        return { ...s, blocks: updateBlockInputs(s.blocks, instanceId, partIdx, val) };
      }),
    );
  }, []);

  // ── Inner C-block drop ─────────────────────────────────────────────────────
  const handleInnerDrop = useCallback((
    scriptId: string,
    parentId: string,
    defId: string,
    branch: 'inner' | 'inner2',
  ) => {
    const def = getBlockDef(defId);
    if (!def) return;
    const newBlock: WBlock = { instanceId: uid(), defId, inputs: defaultInputs(def) };
    const next = scripts.map(s => {
      if (s.id !== scriptId) return s;
      return { ...s, blocks: appendInnerBlock(s.blocks, parentId, newBlock, branch) };
    });
    commitHistory(next);
  }, [scripts, commitHistory]);

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
      blocks: src.blocks.map(deepCloneBlock),
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

  // Determine which script has an active insert gap and at what index
  const insertGapScriptId  = snapTarget?.kind === 'insert' ? snapTarget.scriptId  : null;
  const insertGapBlockIdx  = snapTarget?.kind === 'insert' ? (snapTarget.insertIndex ?? null) : null;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[#e9eef2] dark:bg-neutral-800"
      style={{
        cursor: spaceHeld ? 'grab' : 'default',
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
            insertGapIndex={
              script.id === insertGapScriptId ? insertGapBlockIdx ?? undefined : undefined
            }
            onPointerDown={onScriptPointerDown}
            onBlockPointerDown={onBlockPointerDown}
            onContextMenu={onScriptContextMenu}
            onInputChange={handleInputChange}
            onInnerDrop={handleInnerDrop}
            onRef={(el) => {
              if (el) scriptCardRefs.current.set(script.id, el);
              else scriptCardRefs.current.delete(script.id);
            }}
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

      {/* ── Floating drag ghost (follows cursor from palette) ─────────────── */}
      {ghost && (
        <DragGhost defId={ghost.defId} x={ghost.x} y={ghost.y} />
      )}
    </div>
  );
}
