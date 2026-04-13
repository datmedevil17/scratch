'use client';

import { useRef, useCallback, useEffect, useState } from "react";
import { PlayIcon, StopIcon, CornersOutIcon, CornersInIcon, CrosshairIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { type ScratchRuntime } from "@/lib/scratch/runtime";
import { type SpriteState } from "@/lib/scratch/sprite-state";

// ── Image cache ───────────────────────────────────────────────────────────────
const imageCache    = new Map<string, HTMLImageElement>();
const imageReady    = new Set<string>(); // tracks fully-loaded images

function loadImage(url: string): HTMLImageElement {
  if (imageCache.has(url)) return imageCache.get(url)!;
  const img = new Image();
  // crossOrigin is needed if the browser ever enforces CORS
  img.src = url;
  imageCache.set(url, img);
  img.onload  = () => imageReady.add(url);
  img.onerror = () => console.warn('[Stage] Failed to load image:', url);
  // If the browser already has it cached, onload may not fire
  if (img.complete) imageReady.add(url);
  return img;
}

const STAGE_W = 480;
const STAGE_H = 360;

// ── Sprite palette (cycles by index) ─────────────────────────────────────────
const SPRITE_COLORS = [
  '#4c97ff', '#9966ff', '#cf63cf', '#ffab19',
  '#59c059', '#5cb1d6', '#ff6680', '#ff8c1a',
];

function spriteColor(idx: number) {
  return SPRITE_COLORS[idx % SPRITE_COLORS.length];
}

// ── Scratch → canvas coordinate conversion ────────────────────────────────────
function toCanvasX(sx: number) { return sx + STAGE_W / 2; }
function toCanvasY(sy: number) { return STAGE_H / 2 - sy; }

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: SpriteState,
  colorIdx: number,
) {
  if (!s.visible) return;

  const cx    = toCanvasX(s.x);
  const cy    = toCanvasY(s.y);
  const scale = s.size / 100;
  const r     = 22 * scale;

  ctx.save();

  if (s.effects.ghost > 0) {
    ctx.globalAlpha = Math.max(0, 1 - s.effects.ghost / 100);
  }

  // ── Image costume ──────────────────────────────────────────────────────────
  if (s.imageUrl) {
    const img = loadImage(s.imageUrl);
    if (imageReady.has(s.imageUrl)) {
      const dim = Math.max(r * 4, 48); // reasonable visible size
      ctx.drawImage(img, cx - dim / 2, cy - dim / 2, dim, dim);
    } else {
      // Still loading — draw placeholder; RAF loop will render the real image
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = spriteColor(colorIdx);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  ctx.translate(cx, cy);

  const color     = spriteColor(colorIdx);
  const darkColor = shadeColor(color, -30);

  // ── Body circle ────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Direction arrow ────────────────────────────────────────────────────────
  const angleDeg = s.direction - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const arrowLen = r * 0.65;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(
    Math.cos(angleRad) * arrowLen,
    Math.sin(angleRad) * arrowLen,
  );
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arrowhead dot
  ctx.beginPath();
  ctx.arc(
    Math.cos(angleRad) * arrowLen,
    Math.sin(angleRad) * arrowLen,
    2.5, 0, Math.PI * 2,
  );
  ctx.fillStyle = 'white';
  ctx.fill();

  // ── Sprite initial ────────────────────────────────────────────────────────
  const initial = (s.name?.[0] ?? '?').toUpperCase();
  ctx.font = `bold ${Math.round(13 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(initial, 0, 0);

  ctx.restore();

  // ── Label below sprite ────────────────────────────────────────────────────
  if (scale >= 0.6) {
    ctx.save();
    ctx.font = `10px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(s.name, cx, cy + r + 3);
    ctx.restore();
  }

  // ── Speech / thought bubble ───────────────────────────────────────────────
  const bubble = s.sayBubble ?? s.thinkBubble;
  if (bubble && (bubble.until === Infinity || Date.now() < bubble.until)) {
    drawBubble(ctx, cx, cy - r - 4, bubble.text, !!s.thinkBubble && !s.sayBubble);
  }
}

/** Darken/lighten a hex color by `amount` (negative = darker). */
function shadeColor(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  think: boolean,
) {
  const pad = 6;
  ctx.font = '12px sans-serif';
  const lines = wrapText(ctx, text, 120);
  const lineH = 16;
  const bw = Math.min(
    140,
    lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2,
  );
  const bh = lines.length * lineH + pad * 2;
  const bx = x - bw / 2;
  const by = y - bh - 10;

  ctx.fillStyle   = 'white';
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'white';
  if (think) {
    ctx.beginPath(); ctx.arc(x - 2, by + bh + 4, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 2, by + bh + 9, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bh);
    ctx.lineTo(x,     by + bh + 10);
    ctx.lineTo(x + 6, by + bh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.stroke();
  }

  ctx.fillStyle    = '#111';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, bx + pad, by + pad + i * lineH);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Stage component ───────────────────────────────────────────────────────────
export interface StageProps {
  isRunning:     boolean;
  onRun:         () => void;
  onStop:        () => void;
  runtime?:      ScratchRuntime;
  backgroundUrl?: string | null;
}

export function Stage({ isRunning, onRun, onStop, runtime, backgroundUrl }: StageProps) {
  const wrapRef        = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const isRunningRef   = useRef(isRunning);
  const runtimeRef     = useRef(runtime);
  const backgroundRef  = useRef(backgroundUrl);

  // Keep refs in sync so the RAF loop never stales
  useEffect(() => { isRunningRef.current  = isRunning;     }, [isRunning]);
  useEffect(() => { runtimeRef.current    = runtime;       }, [runtime]);
  useEffect(() => { backgroundRef.current = backgroundUrl; }, [backgroundUrl]);

  const [fps,         setFps]         = useState(0);
  const [stageCoords, setStageCoords] = useState<{ x: number; y: number } | null>(null);
  const stageCoordsRef                = useRef(stageCoords);
  useEffect(() => { stageCoordsRef.current = stageCoords; }, [stageCoords]);

  const [fullscreen, setFullscreen] = useState(false);

  // ── Single render loop (never torn down while mounted) ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime   = performance.now();
    let frameCount = 0;
    let fpsTimer   = 0;

    function drawFrame(now: number) {
      const dt = now - lastTime;
      lastTime  = now;

      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 500) {
        setFps(Math.round((frameCount / fpsTimer) * 1000));
        frameCount = 0;
        fpsTimer   = 0;
      }

      // White / backdrop background
      ctx!.clearRect(0, 0, STAGE_W, STAGE_H);
      const bgUrl = backgroundRef.current;
      if (bgUrl) {
        const bgImg = loadImage(bgUrl);
        if (imageReady.has(bgUrl)) {
          ctx!.drawImage(bgImg, 0, 0, STAGE_W, STAGE_H);
        } else {
          ctx!.fillStyle = '#ffffff';
          ctx!.fillRect(0, 0, STAGE_W, STAGE_H);
        }
      } else {
        ctx!.fillStyle = '#ffffff';
        ctx!.fillRect(0, 0, STAGE_W, STAGE_H);
      }

      // Idle: grid + axes
      if (!isRunningRef.current) {
        ctx!.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx!.lineWidth = 1;
        for (let x = 0; x <= STAGE_W; x += 60) {
          ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, STAGE_H); ctx!.stroke();
        }
        for (let y = 0; y <= STAGE_H; y += 60) {
          ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(STAGE_W, y); ctx!.stroke();
        }
        ctx!.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx!.lineWidth = 1;
        ctx!.beginPath(); ctx!.moveTo(0, STAGE_H / 2); ctx!.lineTo(STAGE_W, STAGE_H / 2); ctx!.stroke();
        ctx!.beginPath(); ctx!.moveTo(STAGE_W / 2, 0); ctx!.lineTo(STAGE_W / 2, STAGE_H); ctx!.stroke();
      }

      // Sprites
      const rt = runtimeRef.current;
      if (rt) {
        const states = rt.getSpriteStates();
        states.forEach((s: SpriteState, i: number) => drawSprite(ctx!, s, i));
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // runs once — uses refs for isRunning / runtime

  // ── Keyboard → runtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!runtime) return;
    const kd = (e: KeyboardEvent) => runtime.setKeyDown(e.key, true);
    const ku = (e: KeyboardEvent) => runtime.setKeyDown(e.key, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup',   ku);
    };
  }, [runtime]);

  // ── Scratch coords from mouse position ────────────────────────────────────
  function toScratch(e: React.MouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px   = (e.clientX - rect.left)  / rect.width;
    const py   = (e.clientY - rect.top)   / rect.height;
    return {
      x: Math.round(px * STAGE_W - STAGE_W / 2),
      y: Math.round(-(py * STAGE_H - STAGE_H / 2)),
    };
  }

  const onMouseMove  = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toScratch(e);
    setStageCoords({ x, y });
    runtimeRef.current?.setMouse(x, y);
  }, []);

  const onMouseLeave = useCallback(() => setStageCoords(null), []);

  const onMouseDown  = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toScratch(e);
    runtimeRef.current?.setMouse(x, y, true);
  }, []);

  const onMouseUp    = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = toScratch(e);
    runtimeRef.current?.setMouse(x, y, false);
  }, []);

  // ── Sprite click ──────────────────────────────────────────────────────────
  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const { x: cx, y: cy } = toScratch(e);
    const states = [...rt.getSpriteStates()].reverse();
    for (const s of states) {
      if (!s.visible) continue;
      const r = (22 * s.size) / 100; // matches drawing radius
      if (Math.hypot(cx - s.x, cy - s.y) < r) {
        rt.fireSpriteClick(s.id);
        break;
      }
    }
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  return (
    <div className="flex w-full flex-col">
      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden border-b border-border"
        style={{ aspectRatio: `${STAGE_W}/${STAGE_H}` }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={onCanvasClick}
      >
        <canvas
          ref={canvasRef}
          width={STAGE_W}
          height={STAGE_H}
          className="h-full w-full"
        />

        {/* Running border pulse */}
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 animate-pulse border-2 border-green-400/60" />
        )}

        {/* Stage coords overlay */}
        {stageCoords && (
          <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-white">
            <CrosshairIcon className="size-2.5" />
            x:{stageCoords.x.toString().padStart(4, '\u00a0')}
            &nbsp;y:{stageCoords.y.toString().padStart(4, '\u00a0')}
          </div>
        )}

        {/* FPS counter */}
        {isRunning && fps > 0 && (
          <div className="absolute left-1 top-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-green-300">
            {fps} fps
          </div>
        )}
      </div>

      {/* ── Controls bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5">
        <button
          id="stage-run-btn"
          aria-label="Run"
          disabled={isRunning}
          onClick={onRun}
          className={cn(
            'flex size-8 items-center justify-center rounded-full border-2 transition-all',
            isRunning
              ? 'border-green-500 bg-green-500/10 text-green-400 opacity-60'
              : 'border-green-500 bg-green-500/10 text-green-400 hover:scale-105 hover:bg-green-500/20',
          )}
        >
          <PlayIcon weight="fill" className="size-3.5" />
        </button>

        <button
          id="stage-stop-btn"
          aria-label="Stop"
          disabled={!isRunning}
          onClick={onStop}
          className={cn(
            'flex size-8 items-center justify-center rounded-full border-2 transition-all',
            !isRunning
              ? 'border-red-500 bg-red-500/10 text-red-400 opacity-60'
              : 'border-red-500 bg-red-500/10 text-red-400 hover:scale-105 hover:bg-red-500/20',
          )}
        >
          <StopIcon weight="fill" className="size-3.5" />
        </button>

        <span className="ml-auto text-[10px] font-medium text-white/40">
          {isRunning ? 'Running…' : 'Stopped'}
        </span>

        <button
          onClick={toggleFullscreen}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
        >
          {fullscreen
            ? <CornersInIcon  className="size-3.5" />
            : <CornersOutIcon className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
