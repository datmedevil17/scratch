'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowCounterClockwise, ArrowClockwise,
  CopySimple, Clipboard, Trash,
  FlipHorizontal, FlipVertical,
  ArrowUp, ArrowDown, ArrowLineUp, ArrowLineDown,
  Cursor, PencilSimple, Eraser, TextT, Minus, Circle, Rectangle,
  Upload, DownloadSimple, MagnifyingGlassPlus, MagnifyingGlassMinus,
  Plus, Eyedropper, PaintBucket
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Costume {
  id: string;
  name: string;
  width: number;
  height: number;
  emoji: string;
  imgData?: ImageData; // Stored canvas pixel data
}

type DrawTool = 'select' | 'reshape' | 'pencil' | 'eraser' | 'fill' | 'text' | 'line' | 'ellipse' | 'rect' | 'picker';

function uid() { return Math.random().toString(36).slice(2, 7); }

const INITIAL_COSTUMES: Costume[] = [
  { id: 'c1', name: 'costume 1', width: 480, height: 360, emoji: '🦴' },
  { id: 'c2', name: 'enimi 9',   width: 480, height: 360, emoji: '🕴' },
];

// ── Tool definitions ──────────────────────────────────────────────────────────
const DRAW_TOOLS: { id: DrawTool; label: string; icon: React.ReactNode }[] = [
  { id: 'select',  label: 'Select',  icon: <Cursor       className="size-4" /> },
  { id: 'reshape', label: 'Reshape', icon: <Cursor       className="size-4 rotate-45" /> },
  { id: 'pencil',  label: 'Pencil',  icon: <PencilSimple className="size-4" /> },
  { id: 'eraser',  label: 'Eraser',  icon: <Eraser       className="size-4" /> },
  { id: 'fill',    label: 'Fill',    icon: <PaintBucket  className="size-4" /> },
  { id: 'text',    label: 'Text',    icon: <TextT        className="size-4" /> },
  { id: 'line',    label: 'Line',    icon: <Minus        className="size-4" /> },
  { id: 'ellipse', label: 'Ellipse', icon: <Circle       className="size-4" /> },
  { id: 'rect',    label: 'Rect',    icon: <Rectangle    className="size-4" /> },
  { id: 'picker',  label: 'Picker',  icon: <Eyedropper   className="size-4" /> },
];

// ── BFS Flood Fill helper ───────────────────────────────────────────────────
function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, hexColor: string) {
  const cW = ctx.canvas.width;
  const cH = ctx.canvas.height;
  const idToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  const hexToRgb = (hex: string) => {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };

  const imgData = ctx.getImageData(0, 0, cW, cH);
  const data = imgData.data;
  const targetColorArr = hexToRgb(hexColor);

  const startPos = (y * cW + x) * 4;
  const sr = data[startPos];
  const sg = data[startPos + 1];
  const sb = data[startPos + 2];
  const sa = data[startPos + 3];

  // If clicked color is already the target color, abort
  if (sr === targetColorArr[0] && sg === targetColorArr[1] && sb === targetColorArr[2] && sa === 255) return;

  const match = (p: number) => data[p] === sr && data[p+1] === sg && data[p+2] === sb && data[p+3] === sa;
  const setPix = (p: number) => {
    data[p] = targetColorArr[0];
    data[p+1] = targetColorArr[1];
    data[p+2] = targetColorArr[2];
    data[p+3] = 255;
  };

  const queue = [[x, y]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    let currentPos = (cy * cW + cx) * 4;

    if (!match(currentPos)) continue;

    // Move left
    let lx = cx;
    while (lx >= 0 && match((cy * cW + lx) * 4)) {
      setPix((cy * cW + lx) * 4);
      lx--;
    }
    lx++;

    // Move right
    let rx = cx + 1;
    while (rx < cW && match((cy * cW + rx) * 4)) {
      setPix((cy * cW + rx) * 4);
      rx++;
    }
    rx--;

    // Scan up and down
    for (let nx = lx; nx <= rx; nx++) {
      if (cy > 0 && match(((cy - 1) * cW + nx) * 4)) queue.push([nx, cy - 1]);
      if (cy < cH - 1 && match(((cy + 1) * cW + nx) * 4)) queue.push([nx, cy + 1]);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ── Checkerboard pattern background ───────────────────────────────────────────
function CheckerCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const size = 12;
    for (let y = 0; y < c.height; y += size) {
      for (let x = 0; x < c.width; x += size) {
        ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#2a2a2a' : '#222222';
        ctx.fillRect(x, y, size, size);
      }
    }
  }, []);
  return <canvas ref={ref} width={480} height={360} className={className} />;
}

// ── CostumeEditor ─────────────────────────────────────────────────────────────
export function CostumeEditor() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);

  const [costumes,       setCostumes]       = useState<Costume[]>(INITIAL_COSTUMES);
  const [activeId,       setActiveId]       = useState<string>(INITIAL_COSTUMES[0].id);
  const [tool,           setTool]           = useState<DrawTool>('select');
  const [fillColor,      setFillColor]      = useState('#ff4466');
  const [outlineColor,   setOutlineColor]   = useState('#ffffff');
  const [outlineSize,    setOutlineSize]    = useState(4);
  const [zoom,           setZoom]           = useState(100);

  const drawing = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const activeCostume = costumes.find(c => c.id === activeId);

  // ── Init / Swap canvas state ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; 
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !activeCostume) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);

    if (activeCostume.imgData) {
      ctx.putImageData(activeCostume.imgData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [activeId]);

  // Saves canvas pixels back to state object
  const saveState = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setCostumes(prev => prev.map(c => c.id === activeId ? { ...c, imgData: data } : c));
  }, [activeId]);

  // ── Canvas helpers ───────────────────────────────────────────────────────
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (e.currentTarget.width / rect.width),
      y: (e.clientY - rect.top)  * (e.currentTarget.height / rect.height),
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(e);
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    if (tool === 'picker') {
      const p = ctx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
      if (p[3] > 0) { // Not fully transparent
        const hex = '#' + [p[0], p[1], p[2]].map(x => x.toString(16).padStart(2, '0')).join('');
        setFillColor(hex);
      }
      return;
    }

    if (tool === 'fill') {
      floodFill(ctx, Math.round(pos.x), Math.round(pos.y), fillColor);
      saveState();
      return;
    }

    if (tool === 'text') {
      const t = prompt("Enter text:");
      if (t) {
        ctx.font = '24px sans-serif';
        ctx.fillStyle = fillColor;
        ctx.fillText(t, pos.x, pos.y);
        saveState();
      }
      return;
    }

    drawing.current = true;
    startPos.current = pos;
    lastPos.current = pos;
  }, [tool, fillColor, saveState]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !startPos.current || !lastPos.current) return;
    const canvas = canvasRef.current; 
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    
    const ctx = canvas.getContext('2d')!;
    const oCtx = overlay.getContext('2d')!;
    const pos = getPos(e);

    // Freehand drawing (commits directly to main canvas)
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.save();
      ctx.strokeStyle  = tool === 'eraser' ? 'rgba(0,0,0,1)' : outlineColor;
      ctx.lineWidth    = tool === 'eraser' ? 20 : outlineSize;
      ctx.lineCap      = 'round';
      ctx.lineJoin     = 'round';
      if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
    } 
    // Shape previews (draws to overlay canvas, cleared next frame)
    else {
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      oCtx.strokeStyle = outlineColor;
      oCtx.fillStyle = fillColor;
      oCtx.lineWidth = outlineSize;
      
      const w = pos.x - startPos.current.x;
      const h = pos.y - startPos.current.y;

      oCtx.beginPath();
      if (tool === 'rect') {
        oCtx.rect(startPos.current.x, startPos.current.y, w, h);
        oCtx.fill(); oCtx.stroke();
      } else if (tool === 'ellipse') {
        oCtx.ellipse(startPos.current.x + w/2, startPos.current.y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI * 2);
        oCtx.fill(); oCtx.stroke();
      } else if (tool === 'line') {
        oCtx.moveTo(startPos.current.x, startPos.current.y);
        oCtx.lineTo(pos.x, pos.y);
        oCtx.stroke();
      }
    }
    
    lastPos.current = pos;
  }, [tool, outlineSize, outlineColor, fillColor]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !startPos.current || !lastPos.current) return;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    
    // For shapes, commit the overlay down to the main canvas
    if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
      const pos = lastPos.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && overlay) {
        ctx.strokeStyle = outlineColor;
        ctx.fillStyle = fillColor;
        ctx.lineWidth = outlineSize;
        
        const w = pos.x - startPos.current.x;
        const h = pos.y - startPos.current.y;
        
        ctx.beginPath();
        if (tool === 'rect') {
          ctx.rect(startPos.current.x, startPos.current.y, w, h);
          ctx.fill(); ctx.stroke();
        } else if (tool === 'ellipse') {
          ctx.ellipse(startPos.current.x + w/2, startPos.current.y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else if (tool === 'line') {
          ctx.lineCap = 'round';
          ctx.moveTo(startPos.current.x, startPos.current.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
        overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
      }
    }
    
    drawing.current = false;
    startPos.current = null;
    lastPos.current = null;
    saveState();
  }, [tool, outlineSize, outlineColor, fillColor, saveState]);

  const addCostume = () => {
    const id = uid();
    const c: Costume = { id, name: `costume ${costumes.length + 1}`, width: 480, height: 360, emoji: '⭐' };
    setCostumes(prev => [...prev, c]);
    setActiveId(id);
  };

  const deleteCostume = (id: string) => {
    const next = costumes.filter(c => c.id !== id);
    setCostumes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
  };

  return (
    <div className="flex h-full bg-[#111] text-white overflow-hidden">

      {/* ── Left: Costume list sidebar ──────────────────────────────────── */}
      <div className="flex w-[88px] shrink-0 flex-col border-r border-white/10 bg-[#1a1a1a] overflow-y-auto">
        {costumes.map((c, i) => {
          const isActive = c.id === activeId;
          return (
             <div
               key={c.id}
               onClick={() => setActiveId(c.id)}
               className={cn(
                 'group relative flex flex-col items-center gap-1 cursor-pointer px-2 py-2 text-center select-none',
                 isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]',
               )}
             >
               <span className="text-[9px] text-white/40 self-start">{i + 1}</span>
               <div className={cn('flex size-14 items-center justify-center rounded text-2xl bg-black/20', isActive ? 'ring-2 ring-[#ff4466]' : '')}>
                 {/* Thumbnail preview can be rendered here later */}
                 {c.emoji}
               </div>
               <span className="text-[9px] font-medium text-white/80 truncate w-full text-center">{c.name}</span>
               
               {isActive && (
                 <button
                   onClick={(e) => { e.stopPropagation(); deleteCostume(c.id); }}
                   className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                 >
                   <Trash className="size-2.5" />
                 </button>
               )}
             </div>
          );
        })}

        <div className="mt-auto sticky bottom-0 bg-[#1a1a1a] border-t border-white/10 flex flex-col items-center gap-2 py-3">
          <button onClick={addCostume} title="Add costume" className="flex size-9 items-center justify-center rounded-full bg-[#ff4466] text-white hover:bg-[#ff2255] transition-colors shadow-lg">
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ── Top toolbar ─────────────────────────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 bg-[#1a1a1a] px-3 py-1.5">

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50">Costume</span>
            <input
              value={activeCostume?.name ?? ''}
              onChange={(e) => setCostumes(prev => prev.map(c => c.id === activeId ? { ...c, name: e.target.value } : c))}
              className="h-6 w-28 rounded bg-[#2a2a2a] px-2 text-xs text-white border border-white/10 focus:border-[#ff4466]/60 focus:outline-none"
            />
          </div>

          {/* Fill / Outline */}
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <label className="flex items-center gap-1.5 text-[11px] text-white/60">
              Fill
              <input type="color" value={fillColor}
                onChange={e => setFillColor(e.target.value)}
                className="size-5 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-white/60">
              Outline
              <input type="color" value={outlineColor}
                onChange={e => setOutlineColor(e.target.value)}
                className="size-5 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              />
              <span className="text-white/40">—</span>
              <input
                type="number" min={0} max={20} value={outlineSize}
                onChange={e => setOutlineSize(Number(e.target.value))}
                className="h-5 w-8 rounded bg-[#2a2a2a] px-1 text-center text-xs text-white border border-white/10"
              />
            </label>
          </div>
          
          <div className="flex items-center gap-0.5 border-l border-white/10 pl-4">
             <button title="Clear Canvas" onClick={() => {
                const c = canvasRef.current; if (!c) return;
                c.getContext('2d')?.clearRect(0,0,c.width,c.height);
                saveState();
             }} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/30">
               <Trash className="size-3" /> Clear
             </button>
          </div>

        </div>

        {/* ── Middle row: tools + canvas ──────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left tool strip */}
          <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-[#1a1a1a] py-2">
            {DRAW_TOOLS.map(({ id, label, icon }) => (
              <button
                key={id}
                title={label}
                onClick={() => setTool(id)}
                className={cn(
                  'flex size-8 items-center justify-center rounded transition-colors',
                  tool === id
                    ? 'bg-[#ff4466]/20 text-[#ff4466]'
                    : 'text-white/50 hover:bg-white/10 hover:text-white',
                )}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Canvas viewport */}
          <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#111]">
            <div
              className="relative shadow-2xl ring-1 ring-white/10 shrink-0"
              style={{ width: 480, height: 360, transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
            >
              <CheckerCanvas className="absolute inset-0" />

              <canvas
                ref={canvasRef}
                width={480}
                height={360}
                className="absolute inset-0 z-10 touch-none"
                style={{ imageRendering: 'pixelated', cursor: tool === 'picker' ? 'alias' : 'crosshair' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
              
              <canvas
                ref={overlayRef}
                width={480}
                height={360}
                className="absolute inset-0 z-20 pointer-events-none touch-none"
              />
            </div>
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-[#1a1a1a] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <button className="rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20">
              Convert to Vector
            </button>
          </div>

          <span className="text-[10px] text-white/30 font-mono">
            {activeCostume ? `${activeCostume.width} × ${activeCostume.height}` : ''}
          </span>

          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(25, z - 25))} className="flex size-6 items-center justify-center hover:bg-white/10"><MagnifyingGlassMinus className="size-3 text-white/50" /></button>
            <span className="w-10 text-center text-[10px] font-mono text-white/50">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(400, z + 25))} className="flex size-6 items-center justify-center hover:bg-white/10"><MagnifyingGlassPlus className="size-3 text-white/50" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
