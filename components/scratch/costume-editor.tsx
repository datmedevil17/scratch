'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import {
  PencilSimple, Eraser, PaintBucket, Circle, Rectangle, TextT,
  Eyedropper, Minus, Plus, ArrowCounterClockwise, ArrowClockwise,
  Upload, Trash, Eye, EyeSlash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type Tool = 'pencil' | 'eraser' | 'fill' | 'circle' | 'rect' | 'text' | 'picker';

interface Layer { id: string; name: string; visible: boolean }

const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'pencil', icon: <PencilSimple className="size-4" />, label: 'Pencil' },
  { id: 'eraser', icon: <Eraser       className="size-4" />, label: 'Eraser' },
  { id: 'fill',   icon: <PaintBucket  className="size-4" />, label: 'Fill' },
  { id: 'circle', icon: <Circle       className="size-4" />, label: 'Circle' },
  { id: 'rect',   icon: <Rectangle    className="size-4" />, label: 'Rectangle' },
  { id: 'text',   icon: <TextT        className="size-4" />, label: 'Text' },
  { id: 'picker', icon: <Eyedropper   className="size-4" />, label: 'Color picker' },
];

const PALETTE_COLORS = [
  '#000000','#ffffff','#ff0000','#ff6600','#ffcc00',
  '#00cc00','#0066ff','#9900cc','#ff66cc','#663300',
  '#999999','#cccccc','#ff9999','#ffcc99','#ffff99',
  '#99ff99','#99ccff','#cc99ff','#ffccff','#cc9966',
];

function uid() { return Math.random().toString(36).slice(2, 7); }

// ── CostumeEditor ─────────────────────────────────────────────────────────────
export function CostumeEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool,      setTool]      = useState<Tool>('pencil');
  const [color,     setColor]     = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [opacity,   setOpacity]   = useState(100);
  const [layers,    setLayers]    = useState<Layer[]>([
    { id: uid(), name: 'Layer 1', visible: true },
  ]);
  const [activeLayer, setActiveLayer] = useState<string>(layers[0].id);
  const [showGrid,    setShowGrid]    = useState(false);

  // Drawing state
  const drawing  = useRef(false);
  const lastPos  = useRef<{ x: number; y: number } | null>(null);

  // ── Init canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Draw grid overlay ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Redraw grid on top (in a real impl we'd use a separate overlay canvas)
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      ctx.restore();
    }
  }, [showGrid]);

  // ── Canvas pointer helpers ─────────────────────────────────────────────
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = e.currentTarget.width  / rect.width;
    const scaleY = e.currentTarget.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);

    ctx.save();
    ctx.globalAlpha  = opacity / 100;
    ctx.strokeStyle  = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth    = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap      = 'round';
    ctx.lineJoin     = 'round';

    if (lastPos.current && (tool === 'pencil' || tool === 'eraser')) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    ctx.restore();
    lastPos.current = pos;
  }, [tool, color, brushSize, opacity]);

  const onPointerUp = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  // ── Layer actions ─────────────────────────────────────────────────────
  const addLayer = () => {
    const id = uid();
    setLayers((prev) => [...prev, { id, name: `Layer ${prev.length + 1}`, visible: true }]);
    setActiveLayer(id);
  };

  const toggleLayer = (id: string) =>
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, visible: !l.visible } : l));

  const deleteLayer = (id: string) => {
    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeLayer === id && next.length) setActiveLayer(next[next.length - 1].id);
      return next;
    });
  };

  return (
    <div className="flex h-full bg-[#f0f0f0] dark:bg-neutral-800">
      {/* ── Left toolbar ───────────────────────────────────────────────── */}
      <div className="flex w-10 flex-col items-center gap-1 border-r border-border bg-white py-2 dark:bg-neutral-900">
        {TOOLS.map(({ id, icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setTool(id)}
            className={cn(
              'flex size-8 items-center justify-center rounded transition-colors',
              tool === id
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {icon}
          </button>
        ))}

        <div className="my-1 h-px w-6 bg-border" />

        {/* Undo / Redo */}
        <button title="Undo" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted">
          <ArrowCounterClockwise className="size-4" />
        </button>
        <button title="Redo" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted">
          <ArrowClockwise className="size-4" />
        </button>
      </div>

      {/* ── Canvas area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar strip */}
        <div className="flex items-center gap-3 border-b border-border bg-white px-3 py-1.5 dark:bg-neutral-900">
          {/* Brush size */}
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Size
            <button onClick={() => setBrushSize(Math.max(1, brushSize - 1))} className="flex size-4 items-center justify-center rounded hover:bg-muted">
              <Minus className="size-2.5" />
            </button>
            <span className="w-4 text-center text-xs font-semibold tabular-nums">{brushSize}</span>
            <button onClick={() => setBrushSize(Math.min(50, brushSize + 1))} className="flex size-4 items-center justify-center rounded hover:bg-muted">
              <Plus className="size-2.5" />
            </button>
          </label>

          {/* Opacity */}
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Opacity
            <input
              type="range" min={1} max={100} value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="w-7 text-xs tabular-nums">{opacity}%</span>
          </label>

          {/* Grid toggle */}
          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="rounded" />
            Grid
          </label>

          {/* Color preview */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-6 cursor-pointer rounded border border-border"
            />
          </div>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <canvas
            ref={canvasRef}
            width={480}
            height={360}
            className="cursor-crosshair rounded border border-border bg-white shadow-md"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        </div>
      </div>

      {/* ── Right panel: Colors + Layers ───────────────────────────────── */}
      <div className="flex w-44 flex-col border-l border-border bg-white dark:bg-neutral-900">
        {/* Color palette */}
        <div className="border-b border-border p-2">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Colors</p>
          <div className="grid grid-cols-5 gap-1">
            {PALETTE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  'size-5 rounded-sm border transition-transform hover:scale-110',
                  color === c ? 'border-blue-400 ring-1 ring-blue-400' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Layers */}
        <div className="flex flex-1 flex-col p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Layers</p>
            <div className="flex gap-0.5">
              <button onClick={addLayer} title="Add layer" className="flex size-5 items-center justify-center rounded hover:bg-muted">
                <Plus className="size-3" />
              </button>
              <button title="Import" className="flex size-5 items-center justify-center rounded hover:bg-muted">
                <Upload className="size-3 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {[...layers].reverse().map((layer) => (
              <div
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors',
                  activeLayer === layer.id
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30'
                    : 'hover:bg-muted',
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLayer(layer.id); }}
                  className="shrink-0"
                >
                  {layer.visible
                    ? <Eye     className="size-3 text-muted-foreground" />
                    : <EyeSlash className="size-3 text-muted-foreground opacity-40" />}
                </button>
                <span className="flex-1 truncate">{layer.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
