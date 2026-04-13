'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowCounterClockwise, ArrowClockwise,
  CopySimple, Clipboard, Trash,
  FlipHorizontal, FlipVertical,
  ArrowsClockwise,
  Cursor, PencilSimple, Eraser, TextT, Minus, Circle, Rectangle,
  Upload, DownloadSimple, MagnifyingGlassPlus, MagnifyingGlassMinus,
  Plus, Eyedropper, PaintBucket, GridFour, MagnetStraight,
  SelectionAll,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Costume {
  id: string;
  name: string;
  width: number;
  height: number;
  imgData?: ImageData;
}

interface SelectionRect { x: number; y: number; w: number; h: number }

type DrawTool =
  | 'select' | 'pencil' | 'eraser' | 'fill' | 'text'
  | 'line' | 'ellipse' | 'rect' | 'picker';

function uid() { return Math.random().toString(36).slice(2, 9); }

const CANVAS_W = 480;
const CANVAS_H = 360;
const GRID_SIZE = 20;
const HISTORY_LIMIT = 40;

const INITIAL_COSTUMES: Costume[] = [
  { id: 'c1', name: 'costume 1', width: CANVAS_W, height: CANVAS_H },
  { id: 'c2', name: 'costume 2', width: CANVAS_W, height: CANVAS_H },
];

// ── Tool definitions ──────────────────────────────────────────────────────────
const DRAW_TOOLS: { id: DrawTool; label: string; icon: React.ReactNode }[] = [
  { id: 'select',  label: 'Select (S)',  icon: <Cursor        className="size-4" /> },
  { id: 'pencil',  label: 'Pencil (P)',  icon: <PencilSimple  className="size-4" /> },
  { id: 'eraser',  label: 'Eraser (E)',  icon: <Eraser        className="size-4" /> },
  { id: 'fill',    label: 'Fill (F)',    icon: <PaintBucket   className="size-4" /> },
  { id: 'text',    label: 'Text (T)',    icon: <TextT         className="size-4" /> },
  { id: 'line',    label: 'Line (L)',    icon: <Minus         className="size-4" /> },
  { id: 'ellipse', label: 'Ellipse (O)', icon: <Circle        className="size-4" /> },
  { id: 'rect',    label: 'Rect (R)',    icon: <Rectangle     className="size-4" /> },
  { id: 'picker',  label: 'Picker (I)',  icon: <Eyedropper    className="size-4" /> },
];

// ── History helpers ─────────────────────────────────────────────────────────
function pushHistory(
  hMap: Map<string, ImageData[]>,
  idxMap: Map<string, number>,
  id: string,
  imgData: ImageData,
) {
  const stack = hMap.get(id) ?? [];
  const idx   = idxMap.get(id) ?? -1;
  // Truncate any forward history
  const trimmed = stack.slice(0, idx + 1);
  trimmed.push(imgData);
  if (trimmed.length > HISTORY_LIMIT) trimmed.shift();
  hMap.set(id, trimmed);
  idxMap.set(id, trimmed.length - 1);
}

function undoHistory(
  hMap: Map<string, ImageData[]>,
  idxMap: Map<string, number>,
  id: string,
): ImageData | null {
  const idx = idxMap.get(id) ?? -1;
  if (idx <= 0) return null;
  idxMap.set(id, idx - 1);
  return (hMap.get(id) ?? [])[idx - 1] ?? null;
}

function redoHistory(
  hMap: Map<string, ImageData[]>,
  idxMap: Map<string, number>,
  id: string,
): ImageData | null {
  const stack = hMap.get(id) ?? [];
  const idx   = idxMap.get(id) ?? -1;
  if (idx >= stack.length - 1) return null;
  idxMap.set(id, idx + 1);
  return stack[idx + 1];
}

// ── BFS Flood Fill ──────────────────────────────────────────────────────────
function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, hexColor: string) {
  const cW = ctx.canvas.width;
  const cH = ctx.canvas.height;
  const hexToRgb = (hex: string) => {
    const b = parseInt(hex.replace('#', ''), 16);
    return [(b >> 16) & 255, (b >> 8) & 255, b & 255];
  };
  const imgData = ctx.getImageData(0, 0, cW, cH);
  const data = imgData.data;
  const [tr, tg, tb] = hexToRgb(hexColor);
  const startIdx = (y * cW + x) * 4;
  const [sr, sg, sb, sa] = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
  if (sr === tr && sg === tg && sb === tb && sa === 255) return;
  const match = (p: number) => data[p]===sr && data[p+1]===sg && data[p+2]===sb && data[p+3]===sa;
  const set   = (p: number) => { data[p]=tr; data[p+1]=tg; data[p+2]=tb; data[p+3]=255; };
  const q = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.shift()!;
    if (!match((cy * cW + cx) * 4)) continue;
    let lx = cx; while (lx >= 0 && match((cy*cW+lx)*4)) { set((cy*cW+lx)*4); lx--; } lx++;
    let rx = cx+1; while (rx < cW && match((cy*cW+rx)*4)) { set((cy*cW+rx)*4); rx++; } rx--;
    for (let nx = lx; nx <= rx; nx++) {
      if (cy > 0   && match(((cy-1)*cW+nx)*4)) q.push([nx, cy-1]);
      if (cy < cH-1 && match(((cy+1)*cW+nx)*4)) q.push([nx, cy+1]);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Checkerboard background ────────────────────────────────────────────────
function CheckerCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const sz = 12;
    for (let y = 0; y < c.height; y += sz)
      for (let x = 0; x < c.width; x += sz) {
        ctx.fillStyle = (Math.floor(x/sz)+Math.floor(y/sz))%2===0 ? '#444' : '#333';
        ctx.fillRect(x, y, sz, sz);
      }
  }, []);
  return <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className={className} />;
}

// ── Draw dashed selection rect on overlay ─────────────────────────────────
function drawSelectionRect(oCtx: CanvasRenderingContext2D, sel: SelectionRect) {
  oCtx.save();
  oCtx.strokeStyle = '#00aaff';
  oCtx.lineWidth = 1;
  oCtx.setLineDash([4, 4]);
  oCtx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h);
  // Corner handles
  oCtx.setLineDash([]);
  oCtx.fillStyle = '#00aaff';
  [[sel.x, sel.y],[sel.x+sel.w,sel.y],[sel.x,sel.y+sel.h],[sel.x+sel.w,sel.y+sel.h]].forEach(([hx,hy])=>{
    oCtx.fillRect(hx - 3, hy - 3, 6, 6);
  });
  oCtx.restore();
}

// ── Thumbnail generation ──────────────────────────────────────────────────
function makeThumbnail(canvas: HTMLCanvasElement): string {
  const th = document.createElement('canvas');
  th.width  = 56; th.height = 42;
  const tCtx = th.getContext('2d')!;
  // Checkerboard bg for thumb
  for (let y=0; y<42; y+=6) for (let x=0; x<56; x+=6) {
    tCtx.fillStyle = (Math.floor(x/6)+Math.floor(y/6))%2===0 ? '#2a2a2a' : '#222222';
    tCtx.fillRect(x,y,6,6);
  }
  tCtx.drawImage(canvas, 0, 0, 56, 42);
  return th.toDataURL();
}

// ── CostumeEditor ─────────────────────────────────────────────────────────────
export function CostumeEditor({
  externalImageUrl,
  externalImageName,
}: {
  externalImageUrl?: string | null;
  externalImageName?: string;
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const gridRef    = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Per-costume undo/redo (refs to avoid re-renders)
  const historyMap  = useRef<Map<string, ImageData[]>>(new Map());
  const histIdxMap  = useRef<Map<string, number>>(new Map());

  // Drawing state refs
  const drawing       = useRef(false);
  const startPos      = useRef<{ x:number; y:number }|null>(null);
  const lastPos       = useRef<{ x:number; y:number }|null>(null);
  // Snapshot before pencil/eraser stroke begins (for push on pointer-up)
  const strokeSnapshot = useRef<ImageData|null>(null);

  // Selection refs
  const selClipboard   = useRef<ImageData|null>(null);    // cut/copied pixels
  const selSnapshot    = useRef<ImageData|null>(null);    // canvas before the cut
  const isDraggingSel  = useRef(false);
  const dragAnchor     = useRef<{mx:number;my:number;sx:number;sy:number}|null>(null);

  // Drag-reorder
  const dragSrcId = useRef<string|null>(null);

  // React state
  const [costumes,    setCostumes]    = useState<Costume[]>(INITIAL_COSTUMES);
  const [activeId,    setActiveId]    = useState<string>(INITIAL_COSTUMES[0].id);
  const [tool,        setTool]        = useState<DrawTool>('pencil');
  const [fillColor,   setFillColor]   = useState('#ff4466');
  const [outlineColor,setOutlineColor]= useState('#ffffff');
  const [outlineSize, setOutlineSize] = useState(4);
  const [eraserSize,  setEraserSize]  = useState(20);
  const [zoom,        setZoom]        = useState(100);
  const [showGrid,    setShowGrid]    = useState(false);
  const [snapToGrid,  setSnapToGrid]  = useState(false);
  const [selection,   setSelection]   = useState<SelectionRect|null>(null);
  const [textOverlay, setTextOverlay] = useState<{x:number;y:number}|null>(null);
  const [textValue,   setTextValue]   = useState('');
  const [fontSize,    setFontSize]    = useState(24);
  const [fontBold,    setFontBold]    = useState(false);
  const [thumbs,      setThumbs]      = useState<Record<string,string>>({});

  const activeCostume = costumes.find(c => c.id === activeId);

  // ── Load external asset URL into a new costume (from "Open in Editor") ──
  useEffect(() => {
    if (!externalImageUrl) return;
    const img = new Image();
    img.onload = () => {
      const id   = uid();
      const name = externalImageName
        ?? externalImageUrl.split('/').pop()?.replace(/\.[^.]+$/, '')
        ?? 'imported';
      setCostumes(prev => [...prev, { id, name, width: CANVAS_W, height: CANVAS_H }]);
      setActiveId(id);
      // Draw on next frame so canvasRef picks up the fresh active costume
      requestAnimationFrame(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height, 1);
        const dw = img.width * scale, dh = img.height * scale;
        const dx = (CANVAS_W - dw) / 2,  dy = (CANVAS_H - dh) / 2;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, dx, dy, dw, dh);
      });
    };
    img.onerror = () => console.warn('[CostumeEditor] Failed to load:', externalImageUrl);
    img.src = externalImageUrl;
  // externalImageUrl changing is the trigger; name is secondary
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalImageUrl]);

  // Snap helper
  const snap = useCallback((v: number) => snapToGrid ? Math.round(v / GRID_SIZE) * GRID_SIZE : v, [snapToGrid]);

  // ── getPos: converts pointer event → canvas pixel coords ──────────────
  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: snap(Math.round((e.clientX - rect.left) * (e.currentTarget.width  / rect.width))),
      y: snap(Math.round((e.clientY - rect.top)  * (e.currentTarget.height / rect.height))),
    };
  }, [snap]);

  // ── getCanvasPos: client coords → canvas pixel (for text overlay) ─────
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left) * (canvas.width  / rect.width)),
      y: Math.round((clientY - rect.top)  * (canvas.height / rect.height)),
    };
  }, []);

  // ── canvasToClient: canvas pixel → client coords (for text overlay pos) ─
  const canvasToClient = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width  / canvas.width;
    const scaleY = rect.height / canvas.height;
    return { x: rect.left + cx * scaleX, y: rect.top + cy * scaleY };
  }, []);

  // ── Save canvas pixels → costume state + push history + thumbnail ─────
  const saveState = useCallback((skipHistory = false) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!skipHistory) {
      pushHistory(historyMap.current, histIdxMap.current, activeId, data);
    }
    setThumbs(prev => ({ ...prev, [activeId]: makeThumbnail(canvas) }));
    setCostumes(prev => prev.map(c => c.id === activeId ? { ...c, imgData: data } : c));
  }, [activeId]);

  // ── Restore ImageData to canvas ────────────────────────────────────────
  const restoreToCanvas = useCallback((imgData: ImageData) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imgData, 0, 0);
    setThumbs(prev => ({ ...prev, [activeId]: makeThumbnail(canvas) }));
    setCostumes(prev => prev.map(c => c.id === activeId ? { ...c, imgData } : c));
  }, [activeId]);

  // ── Init / Swap canvas on active costume change ──────────────────────
  useEffect(() => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !activeCostume) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
    setSelection(null);
    setTextOverlay(null);
    setTextValue('');

    if (activeCostume.imgData) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(activeCostume.imgData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Seed history if empty
    if (!(historyMap.current.has(activeId))) {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      pushHistory(historyMap.current, histIdxMap.current, activeId, snap);
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grid overlay ───────────────────────────────────────────────────────
  useEffect(() => {
    const gc = gridRef.current; if (!gc) return;
    const gCtx = gc.getContext('2d')!;
    gCtx.clearRect(0, 0, gc.width, gc.height);
    if (!showGrid) return;
    gCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    gCtx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_W; x += GRID_SIZE) {
      gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, CANVAS_H); gCtx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_SIZE) {
      gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(CANVAS_W, y); gCtx.stroke();
    }
  }, [showGrid]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 's') setTool('select');
      if (key === 'p') setTool('pencil');
      if (key === 'e') setTool('eraser');
      if (key === 'f') setTool('fill');
      if (key === 't') setTool('text');
      if (key === 'l') setTool('line');
      if (key === 'o') setTool('ellipse');
      if (key === 'r') setTool('rect');
      if (key === 'i') setTool('picker');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Undo ──────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const imgData = undoHistory(historyMap.current, histIdxMap.current, activeId);
    if (imgData) restoreToCanvas(imgData);
  }, [activeId, restoreToCanvas]);

  // ── Redo ──────────────────────────────────────────────────────────────
  const handleRedo = useCallback(() => {
    const imgData = redoHistory(historyMap.current, histIdxMap.current, activeId);
    if (imgData) restoreToCanvas(imgData);
  }, [activeId, restoreToCanvas]);

  // ── Flip Horizontal ───────────────────────────────────────────────────
  const handleFlipH = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tCtx = tmp.getContext('2d')!;
    tCtx.translate(canvas.width, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    saveState();
  }, [saveState]);

  // ── Flip Vertical ─────────────────────────────────────────────────────
  const handleFlipV = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tCtx = tmp.getContext('2d')!;
    tCtx.translate(0, canvas.height);
    tCtx.scale(1, -1);
    tCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    saveState();
  }, [saveState]);

  // ── Rotate 90° CW ─────────────────────────────────────────────────────
  const handleRotateCW = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tCtx = tmp.getContext('2d')!;
    tCtx.translate(canvas.width / 2, canvas.height / 2);
    tCtx.rotate(Math.PI / 2);
    tCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    saveState();
  }, [saveState]);

  // ── Rotate 90° CCW ────────────────────────────────────────────────────
  const handleRotateCCW = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tCtx = tmp.getContext('2d')!;
    tCtx.translate(canvas.width / 2, canvas.height / 2);
    tCtx.rotate(-Math.PI / 2);
    tCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    saveState();
  }, [saveState]);

  // ── Selection helpers ─────────────────────────────────────────────────
  const normalizeRect = (x1:number,y1:number,x2:number,y2:number): SelectionRect => ({
    x: Math.min(x1,x2), y: Math.min(y1,y2),
    w: Math.abs(x2-x1),  h: Math.abs(y2-y1),
  });

  const isInsideSel = (px: number, py: number, sel: SelectionRect) =>
    px >= sel.x && px <= sel.x + sel.w && py >= sel.y && py <= sel.y + sel.h;

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
    setSelection(null);
    overlayRef.current?.getContext('2d')!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    saveState();
  }, [selection, saveState]);

  const copySelection = useCallback(() => {
    if (!selection) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    selClipboard.current = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
  }, [selection]);

  const cutSelection = useCallback(() => {
    if (!selection) return;
    copySelection();
    deleteSelection();
  }, [selection, copySelection, deleteSelection]);

  const pasteSelection = useCallback(() => {
    if (!selClipboard.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const { width: w, height: h } = selClipboard.current;
    ctx.putImageData(selClipboard.current, 10, 10);
    const newSel: SelectionRect = { x: 10, y: 10, w, h };
    setSelection(newSel);
    const oCtx = overlayRef.current?.getContext('2d');
    if (oCtx) { oCtx.clearRect(0,0,CANVAS_W,CANVAS_H); drawSelectionRect(oCtx, newSel); }
    saveState();
  }, [saveState]);

  const duplicateSelection = useCallback(() => {
    copySelection();
    pasteSelection();
  }, [copySelection, pasteSelection]);

  // ── Upload image ───────────────────────────────────────────────────────
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      // Scale to fit, centered
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height, 1);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (CANVAS_W - dw) / 2, dy = (CANVAS_H - dh) / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, dx, dy, dw, dh);
      URL.revokeObjectURL(url);
      saveState();
    };
    img.src = url;
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [saveState]);

  // ── Export PNG ────────────────────────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeCostume?.name ?? 'costume'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [activeCostume]);

  // ── Commit text overlay ────────────────────────────────────────────────
  const commitText = useCallback(() => {
    if (!textOverlay || !textValue.trim()) { setTextOverlay(null); setTextValue(''); return; }
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.font = `${fontBold ? 'bold ' : ''}${fontSize}px sans-serif`;
    ctx.fillStyle = fillColor;
    ctx.fillText(textValue, textOverlay.x, textOverlay.y);
    setTextOverlay(null);
    setTextValue('');
    saveState();
  }, [textOverlay, textValue, fontSize, fontBold, fillColor, saveState]);

  // ── Pointer events ─────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(e);
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // Commit pending text if tool changes
    if (tool !== 'text' && textOverlay) commitText();

    // ── Picker ──────────────────────────────────────────────────────────
    if (tool === 'picker') {
      const p = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      if (p[3] > 0) setFillColor('#' + [p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
      return;
    }

    // ── Fill ─────────────────────────────────────────────────────────────
    if (tool === 'fill') {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      pushHistory(historyMap.current, histIdxMap.current, activeId, snap);
      floodFill(ctx, pos.x, pos.y, fillColor);
      saveState(true); // history already pushed
      return;
    }

    // ── Text ──────────────────────────────────────────────────────────────
    if (tool === 'text') {
      if (textOverlay) commitText();
      setTextOverlay({ x: pos.x, y: pos.y });
      setTextValue('');
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    // ── Select ────────────────────────────────────────────────────────────
    if (tool === 'select') {
      if (selection && isInsideSel(pos.x, pos.y, selection)) {
        // Start dragging selection
        isDraggingSel.current = true;
        dragAnchor.current = { mx: pos.x, my: pos.y, sx: selection.x, sy: selection.y };
        // Grab the pixels for moving
        selClipboard.current = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
        selSnapshot.current  = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Clear the cut region
        ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
      } else {
        // Start new marquee
        isDraggingSel.current = false;
        dragAnchor.current = null;
        selClipboard.current = null;
        selSnapshot.current = null;
        setSelection(null);
        drawing.current = true;
        startPos.current = pos;
      }
      return;
    }

    // ── Freehand tools: snapshot before stroke ────────────────────────────
    strokeSnapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    drawing.current = true;
    startPos.current = pos;
    lastPos.current  = pos;
  }, [tool, fillColor, activeId, selection, textOverlay, commitText, saveState, getPos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx  = canvas.getContext('2d')!;
    const oCtx = overlay.getContext('2d')!;
    const pos  = getPos(e);

    // ── Select: dragging selection ──────────────────────────────────────
    if (tool === 'select' && isDraggingSel.current && dragAnchor.current && selection && selClipboard.current && selSnapshot.current) {
      const dx = pos.x - dragAnchor.current.mx;
      const dy = pos.y - dragAnchor.current.my;
      const newX = dragAnchor.current.sx + dx;
      const newY = dragAnchor.current.sy + dy;
      // Restore the hole
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(selSnapshot.current, 0, 0);
      ctx.clearRect(selection.x, selection.y, selection.w, selection.h);
      // Draw moved pixels on overlay
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      // Create tmp canvas for the clip data
      const tmp = document.createElement('canvas');
      tmp.width = selClipboard.current.width; tmp.height = selClipboard.current.height;
      tmp.getContext('2d')!.putImageData(selClipboard.current, 0, 0);
      oCtx.drawImage(tmp, newX, newY);
      drawSelectionRect(oCtx, { x: newX, y: newY, w: selection.w, h: selection.h });
      return;
    }

    // ── Select: marquee drawing ───────────────────────────────────────────
    if (tool === 'select' && drawing.current && startPos.current) {
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      const r = normalizeRect(startPos.current.x, startPos.current.y, pos.x, pos.y);
      drawSelectionRect(oCtx, r);
      return;
    }

    if (!drawing.current || !startPos.current || !lastPos.current) return;

    // ── Freehand drawing ──────────────────────────────────────────────────
    if (tool === 'pencil' || tool === 'eraser') {
      ctx.save();
      ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : fillColor;
      ctx.lineWidth   = tool === 'eraser' ? eraserSize : outlineSize;
      ctx.lineCap     = 'round'; ctx.lineJoin = 'round';
      if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
    } else {
      // Shape preview on overlay
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      oCtx.strokeStyle = outlineColor;
      oCtx.fillStyle   = fillColor;
      oCtx.lineWidth   = outlineSize || 1;
      const w = pos.x - startPos.current.x;
      const h = pos.y - startPos.current.y;
      oCtx.beginPath();
      if (tool === 'rect') {
        oCtx.rect(startPos.current.x, startPos.current.y, w, h);
        oCtx.fill(); if (outlineSize > 0) oCtx.stroke();
      } else if (tool === 'ellipse') {
        oCtx.ellipse(startPos.current.x + w/2, startPos.current.y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
        oCtx.fill(); if (outlineSize > 0) oCtx.stroke();
      } else if (tool === 'line') {
        oCtx.moveTo(startPos.current.x, startPos.current.y);
        oCtx.lineTo(pos.x, pos.y);
        oCtx.stroke();
      }
    }
    lastPos.current = pos;
  }, [tool, fillColor, outlineColor, outlineSize, eraserSize, selection, getPos]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx  = canvas.getContext('2d', { willReadFrequently: true })!;
    const oCtx = overlay.getContext('2d')!;
    const pos  = getPos(e);

    // ── Select: finish drag ───────────────────────────────────────────────
    if (tool === 'select' && isDraggingSel.current && dragAnchor.current && selection && selClipboard.current) {
      const dx = pos.x - dragAnchor.current.mx;
      const dy = pos.y - dragAnchor.current.my;
      const newX = dragAnchor.current.sx + dx;
      const newY = dragAnchor.current.sy + dy;
      // Commit moved pixels to main canvas
      const tmp = document.createElement('canvas');
      tmp.width = selClipboard.current.width; tmp.height = selClipboard.current.height;
      tmp.getContext('2d')!.putImageData(selClipboard.current, 0, 0);
      ctx.drawImage(tmp, newX, newY);
      const newSel = { x: newX, y: newY, w: selection.w, h: selection.h };
      setSelection(newSel);
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      drawSelectionRect(oCtx, newSel);
      isDraggingSel.current = false;
      dragAnchor.current = null;
      saveState();
      return;
    }

    // ── Select: finish marquee ────────────────────────────────────────────
    if (tool === 'select' && drawing.current && startPos.current) {
      const r = normalizeRect(startPos.current.x, startPos.current.y, pos.x, pos.y);
      if (r.w > 2 && r.h > 2) {
        setSelection(r);
        oCtx.clearRect(0, 0, overlay.width, overlay.height);
        drawSelectionRect(oCtx, r);
      } else {
        setSelection(null);
        oCtx.clearRect(0, 0, overlay.width, overlay.height);
      }
      drawing.current = false;
      startPos.current = null;
      return;
    }

    if (!drawing.current || !startPos.current) return;

    // ── Shape commit ──────────────────────────────────────────────────────
    if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
      // Push snapshot taken at pointer-down
      if (strokeSnapshot.current) {
        pushHistory(historyMap.current, histIdxMap.current, activeId, strokeSnapshot.current);
        strokeSnapshot.current = null;
      }
      const finalPos = lastPos.current ?? pos;
      ctx.strokeStyle = outlineColor;
      ctx.fillStyle   = fillColor;
      ctx.lineWidth   = outlineSize || 1;
      const w = finalPos.x - startPos.current.x;
      const h = finalPos.y - startPos.current.y;
      ctx.beginPath();
      if (tool === 'rect') {
        ctx.rect(startPos.current.x, startPos.current.y, w, h);
        ctx.fill(); if (outlineSize > 0) ctx.stroke();
      } else if (tool === 'ellipse') {
        ctx.ellipse(startPos.current.x+w/2, startPos.current.y+h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
        ctx.fill(); if (outlineSize > 0) ctx.stroke();
      } else if (tool === 'line') {
        ctx.lineCap = 'round';
        ctx.moveTo(startPos.current.x, startPos.current.y);
        ctx.lineTo(finalPos.x, finalPos.y);
        ctx.stroke();
      }
      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      saveState(true); // history pushed above
    } else if (tool === 'pencil' || tool === 'eraser') {
      // Push the snapshot from before the stroke
      if (strokeSnapshot.current) {
        pushHistory(historyMap.current, histIdxMap.current, activeId, strokeSnapshot.current);
        strokeSnapshot.current = null;
      }
      saveState(true);
    }

    drawing.current  = false;
    startPos.current = null;
    lastPos.current  = null;
  }, [tool, fillColor, outlineColor, outlineSize, activeId, selection, saveState, getPos]);

  // ── Costume management ────────────────────────────────────────────────
  const addCostume = () => {
    const id = uid();
    setCostumes(prev => [...prev, { id, name: `costume ${prev.length + 1}`, width: CANVAS_W, height: CANVAS_H }]);
    setActiveId(id);
  };

  const deleteCostume = (id: string) => {
    if (costumes.length <= 1) return; // always keep one
    const next = costumes.filter(c => c.id !== id);
    setCostumes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
  };

  const duplicateCostume = (id: string) => {
    const src = costumes.find(c => c.id === id);
    if (!src) return;
    const newId = uid();
    const copy: Costume = { ...src, id: newId, name: src.name + ' copy' };
    // Copy history too if exists
    const srcHistory = historyMap.current.get(id);
    if (srcHistory) {
      historyMap.current.set(newId, [...srcHistory]);
      histIdxMap.current.set(newId, histIdxMap.current.get(id) ?? srcHistory.length - 1);
    }
    // Copy thumbnail
    setThumbs(prev => ({ ...prev, [newId]: prev[id] ?? '' }));
    setCostumes(prev => {
      const idx = prev.findIndex(c => c.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveId(newId);
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────────
  const onDragStart = (id: string) => { dragSrcId.current = id; };
  const onDrop = (targetId: string) => {
    if (!dragSrcId.current || dragSrcId.current === targetId) return;
    setCostumes(prev => {
      const arr = [...prev];
      const srcIdx = arr.findIndex(c => c.id === dragSrcId.current);
      const tgtIdx = arr.findIndex(c => c.id === targetId);
      const [item] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, item);
      return arr;
    });
    dragSrcId.current = null;
  };

  // ── Cursor style ──────────────────────────────────────────────────────
  const cursorStyle = (): React.CSSProperties['cursor'] => {
    if (tool === 'picker') return 'alias';
    if (tool === 'fill')   return 'cell';
    if (tool === 'eraser') return 'cell';
    if (tool === 'select' && selection) return 'crosshair';
    return 'crosshair';
  };

  // ── Text overlay position in client coords ────────────────────────────
  const textClientPos = textOverlay ? canvasToClient(textOverlay.x, textOverlay.y) : null;

  return (
    <div className="flex h-full bg-[#111] text-white overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleUpload}
      />

      {/* ── Left: Costume list sidebar ──────────────────────────────────── */}
      <div className="flex w-[92px] shrink-0 flex-col border-r border-white/10 bg-[#1a1a1a] overflow-y-auto">
        {costumes.map((c, i) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              draggable
              onDragStart={() => onDragStart(c.id)}
              onDragOver={ev => ev.preventDefault()}
              onDrop={() => onDrop(c.id)}
              onClick={() => setActiveId(c.id)}
              className={cn(
                'group relative flex flex-col items-center gap-1 cursor-pointer px-2 py-2 text-center select-none transition-colors',
                isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]',
              )}
            >
              <span className="text-[9px] text-white/40 self-start">{i + 1}</span>
              <div className={cn(
                'flex size-14 items-center justify-center rounded overflow-hidden bg-black/20',
                isActive ? 'ring-2 ring-[#ff4466]' : '',
              )}>
                {thumbs[c.id]
                  ? <img src={thumbs[c.id]} alt={c.name} className="w-full h-full object-contain" />
                  : <span className="text-[9px] text-white/30 text-center leading-tight px-1">empty</span>
                }
              </div>
              <span className="text-[9px] font-medium text-white/80 truncate w-full text-center">{c.name}</span>

              {/* Hover actions */}
              <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  title="Duplicate"
                  onClick={ev => { ev.stopPropagation(); duplicateCostume(c.id); }}
                  className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-white"
                >
                  <CopySimple className="size-2.5" />
                </button>
                {costumes.length > 1 && (
                  <button
                    title="Delete"
                    onClick={ev => { ev.stopPropagation(); deleteCostume(c.id); }}
                    className="flex size-4 items-center justify-center rounded-full bg-red-500 text-white"
                  >
                    <Trash className="size-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="mt-auto sticky bottom-0 bg-[#1a1a1a] border-t border-white/10 flex flex-col items-center gap-2 py-3">
          <button onClick={addCostume} title="New costume" className="flex size-9 items-center justify-center rounded-full bg-[#ff4466] text-white hover:bg-[#ff2255] transition-colors shadow-lg">
            <Plus className="size-4" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Upload image" className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors">
            <Upload className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ── Top toolbar ─────────────────────────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 bg-[#1a1a1a] px-3 py-1.5">

          {/* Costume name */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/50">Costume</span>
            <input
              value={activeCostume?.name ?? ''}
              onChange={e => setCostumes(prev => prev.map(c => c.id === activeId ? { ...c, name: e.target.value } : c))}
              className="h-6 w-28 rounded bg-[#2a2a2a] px-2 text-xs text-white border border-white/10 focus:border-[#ff4466]/60 focus:outline-none"
            />
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border-l border-white/10 pl-3">
            <button title="Undo (Ctrl+Z)" onClick={handleUndo} className="flex size-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              <ArrowCounterClockwise className="size-3.5" />
            </button>
            <button title="Redo (Ctrl+Y)" onClick={handleRedo} className="flex size-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              <ArrowClockwise className="size-3.5" />
            </button>
          </div>

          {/* Transforms */}
          <div className="flex items-center gap-0.5 border-l border-white/10 pl-3">
            <button title="Flip Horizontal" onClick={handleFlipH} className="flex size-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              <FlipHorizontal className="size-3.5" />
            </button>
            <button title="Flip Vertical" onClick={handleFlipV} className="flex size-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              <FlipVertical className="size-3.5" />
            </button>
            <button title="Rotate 90° CCW" onClick={handleRotateCCW} className="flex size-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              <ArrowCounterClockwise className="size-3.5" />
            </button>
            <button title="Rotate 90° CW" onClick={handleRotateCW} className="flex size-7 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              <ArrowsClockwise className="size-3.5" />
            </button>
          </div>

          {/* Selection clipboard actions - visible when selection active */}
          {selection && (
            <div className="flex items-center gap-0.5 border-l border-white/10 pl-3">
              <button title="Cut" onClick={cutSelection} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20">
                <Minus className="size-3" /> Cut
              </button>
              <button title="Copy" onClick={copySelection} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20">
                <CopySimple className="size-3" /> Copy
              </button>
              <button title="Duplicate selection" onClick={duplicateSelection} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20">
                <SelectionAll className="size-3" /> Dup
              </button>
              <button title="Delete selection" onClick={deleteSelection} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/30">
                <Trash className="size-3" /> Del
              </button>
            </div>
          )}
          {selClipboard.current && (
            <button title="Paste" onClick={pasteSelection} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20 border-l border-white/10 ml-1 pl-3">
              <Clipboard className="size-3" /> Paste
            </button>
          )}

          {/* Fill / Outline */}
          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <label className="flex items-center gap-1.5 text-[10px] text-white/60">
              Fill
              <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)}
                className="size-5 cursor-pointer rounded-sm border-0 bg-transparent p-0" />
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-white/60">
              Outline
              <input type="color" value={outlineColor} onChange={e => setOutlineColor(e.target.value)}
                className="size-5 cursor-pointer rounded-sm border-0 bg-transparent p-0" />
              <input type="number" min={0} max={20} value={outlineSize} onChange={e => setOutlineSize(Number(e.target.value))}
                className="h-5 w-8 rounded bg-[#2a2a2a] px-1 text-center text-[10px] text-white border border-white/10" />
            </label>
          </div>

          {/* Eraser size (when tool = eraser) */}
          {tool === 'eraser' && (
            <label className="flex items-center gap-1.5 border-l border-white/10 pl-3 text-[10px] text-white/60">
              Eraser
              <input type="number" min={2} max={80} value={eraserSize} onChange={e => setEraserSize(Number(e.target.value))}
                className="h-5 w-10 rounded bg-[#2a2a2a] px-1 text-center text-[10px] text-white border border-white/10" />
              px
            </label>
          )}

          {/* Font controls (when tool = text) */}
          {tool === 'text' && (
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              <label className="flex items-center gap-1 text-[10px] text-white/60">
                Size
                <input type="number" min={8} max={200} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                  className="h-5 w-12 rounded bg-[#2a2a2a] px-1 text-center text-[10px] text-white border border-white/10" />
              </label>
              <button
                onClick={() => setFontBold(v => !v)}
                className={cn('h-5 w-7 rounded text-[10px] font-bold border transition-colors',
                  fontBold ? 'bg-[#ff4466]/30 border-[#ff4466]/60 text-[#ff4466]' : 'bg-[#2a2a2a] border-white/10 text-white/60 hover:bg-white/10'
                )}
              >B</button>
            </div>
          )}

          {/* Grid / Snap / Clear */}
          <div className="flex items-center gap-0.5 border-l border-white/10 pl-3 ml-auto">
            <button
              title="Toggle grid"
              onClick={() => setShowGrid(v => !v)}
              className={cn('flex size-7 items-center justify-center rounded transition-colors',
                showGrid ? 'bg-[#ff4466]/20 text-[#ff4466]' : 'text-white/50 hover:bg-white/10 hover:text-white'
              )}
            >
              <GridFour className="size-3.5" />
            </button>
            <button
              title="Snap to grid"
              onClick={() => setSnapToGrid(v => !v)}
              className={cn('flex size-7 items-center justify-center rounded transition-colors',
                snapToGrid ? 'bg-[#ff4466]/20 text-[#ff4466]' : 'text-white/50 hover:bg-white/10 hover:text-white'
              )}
            >
              <MagnetStraight className="size-3.5" />
            </button>
            <button
              title="Clear canvas"
              onClick={() => {
                const c = canvasRef.current; if (!c) return;
                const ctx = c.getContext('2d', { willReadFrequently: true })!;
                // Push current state to history before clearing
                pushHistory(historyMap.current, histIdxMap.current, activeId,
                  ctx.getImageData(0, 0, c.width, c.height));
                ctx.clearRect(0, 0, c.width, c.height);
                saveState(true);
              }}
              className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/30 ml-1"
            >
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
                onClick={() => { setTool(id); if (id !== 'select') setSelection(null); }}
                className={cn(
                  'flex size-8 items-center justify-center rounded transition-colors',
                  tool === id ? 'bg-[#ff4466]/20 text-[#ff4466]' : 'text-white/50 hover:bg-white/10 hover:text-white',
                )}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Canvas viewport — centered, scrollable when zoomed in */}
          <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#0d0d0d]">
            <div
              className="relative shadow-2xl ring-1 ring-white/10 shrink-0"
              style={{
                width:  CANVAS_W * (zoom / 100),
                height: CANVAS_H * (zoom / 100),
              }}
            >
              <CheckerCanvas className="absolute inset-0 w-full h-full" />

              {/* Main drawing canvas */}
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 z-10 touch-none w-full h-full"
                style={{ imageRendering: 'pixelated', cursor: cursorStyle() }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />

              {/* Overlay canvas (shape previews, selection rect) */}
              <canvas
                ref={overlayRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 z-20 pointer-events-none touch-none w-full h-full"
              />

              {/* Grid canvas */}
              <canvas
                ref={gridRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 z-30 pointer-events-none touch-none w-full h-full"
              />
            </div>

            {/* Text overlay input (absolutely positioned over canvas in client coords) */}
            {textOverlay && textClientPos && (
              <input
                ref={textInputRef}
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitText(); }
                  if (e.key === 'Escape') { setTextOverlay(null); setTextValue(''); }
                }}
                onBlur={commitText}
                className="fixed z-50 border border-[#00aaff] bg-transparent text-transparent caret-white outline-none"
                style={{
                  left: textClientPos.x,
                  top:  textClientPos.y,
                  fontSize: `${fontSize * (zoom / 100)}px`,
                  fontWeight: fontBold ? 'bold' : 'normal',
                  fontFamily: 'sans-serif',
                  color: fillColor,
                  background: 'rgba(0,170,255,0.08)',
                  minWidth: 80,
                  padding: '2px 4px',
                }}
                placeholder="Type here…"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-[#1a1a1a] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20 transition-colors"
            >
              <Upload className="size-3" /> Import
            </button>
            <button
              onClick={handleExportPNG}
              className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20 transition-colors"
            >
              <DownloadSimple className="size-3" /> Export PNG
            </button>
          </div>

          <span className="text-[10px] text-white/30 font-mono">
            {activeCostume ? `${activeCostume.width} × ${activeCostume.height}` : ''}
            {selection ? `  |  sel: ${selection.w}×${selection.h}` : ''}
          </span>

          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(25, z - 25))} className="flex size-6 items-center justify-center hover:bg-white/10 rounded">
              <MagnifyingGlassMinus className="size-3 text-white/50" />
            </button>
            <span className="w-10 text-center text-[10px] font-mono text-white/50">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(400, z + 25))} className="flex size-6 items-center justify-center hover:bg-white/10 rounded">
              <MagnifyingGlassPlus className="size-3 text-white/50" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
