'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import { PlayIcon, StopIcon, CornersOutIcon, CornersInIcon, CrosshairIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Stage is 480×360 (4:3), matching Scratch's coordinate system ─────────────
const STAGE_W = 480;
const STAGE_H = 360;

export interface StageProps {
  isRunning: boolean;
  onRun:  () => void;
  onStop: () => void;
}

export function Stage({ isRunning, onRun, onStop }: StageProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const lastTime  = useRef<number>(0);

  const [fps, setFps]       = useState(0);
  const [stageCoords, setStageCoords] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen]   = useState(false);

  // ── FPS counter (only ticks while running) ──────────────────────────────
  useEffect(() => {
    if (!isRunning) { setFps(0); return; }

    function tick(now: number) {
      const dt = now - lastTime.current;
      lastTime.current = now;
      if (dt > 0) setFps(Math.round(1000 / dt));
      rafRef.current = requestAnimationFrame(tick);
    }
    lastTime.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning]);

  // ── Draw idle / running frame ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    if (isRunning) {
      // Running: white stage with a subtle "running" watermark
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.fillStyle = 'rgba(76,151,255,0.08)';
      ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶', STAGE_W / 2, STAGE_H / 2);
    } else {
      // Idle: white background with grid lines
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      // horizontal axis
      ctx.beginPath(); ctx.moveTo(0, STAGE_H / 2); ctx.lineTo(STAGE_W, STAGE_H / 2); ctx.stroke();
      // vertical axis
      ctx.beginPath(); ctx.moveTo(STAGE_W / 2, 0); ctx.lineTo(STAGE_W / 2, STAGE_H); ctx.stroke();
      // subtle tick marks every 60px
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      for (let x = 0; x <= STAGE_W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, STAGE_H); ctx.stroke();
      }
      for (let y = 0; y <= STAGE_H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(STAGE_W, y); ctx.stroke();
      }
      // center label
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Stage (480 × 360)', STAGE_W / 2, 4);
    }
  }, [isRunning]);

  // ── Mouse → Scratch coordinates (-240…240, -180…180) ────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px   = (e.clientX - rect.left)  / rect.width;
    const py   = (e.clientY - rect.top)   / rect.height;
    const sx   = Math.round(px * STAGE_W - STAGE_W / 2);
    const sy   = Math.round(-(py * STAGE_H - STAGE_H / 2));
    setStageCoords({ x: sx, y: sy });
  }, []);

  const onMouseLeave = useCallback(() => setStageCoords(null), []);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  return (
    <div className="flex w-[360px] shrink-0 flex-col border-l border-border bg-white dark:bg-neutral-900">
      {/* Stage canvas */}
      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ aspectRatio: `${STAGE_W}/${STAGE_H}` }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <canvas
          ref={canvasRef}
          width={STAGE_W}
          height={STAGE_H}
          className="h-full w-full"
        />

        {/* Running overlay pulse */}
        {isRunning && (
          <div className="pointer-events-none absolute inset-0 animate-pulse border-2 border-green-400/60" />
        )}

        {/* Fullscreen toggle (top-right) */}
        <button
          onClick={toggleFullscreen}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded bg-black/30 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100 [div:hover_>_&]:opacity-100"
        >
          {fullscreen
            ? <CornersInIcon  className="size-3.5" />
            : <CornersOutIcon className="size-3.5" />
          }
        </button>

        {/* Coordinates overlay (bottom-left) */}
        {stageCoords && (
          <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-white">
            <CrosshairIcon className="size-2.5" />
            x: {stageCoords.x.toString().padStart(4, '\u00a0')}
            &nbsp; y: {stageCoords.y.toString().padStart(4, '\u00a0')}
          </div>
        )}

        {/* FPS (top-left when running) */}
        {isRunning && fps > 0 && (
          <div className="absolute left-1 top-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-green-300">
            {fps} fps
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
        {/* Green flag */}
        <button
          id="stage-run-btn"
          aria-label="Run"
          disabled={isRunning}
          onClick={onRun}
          className={cn(
            'flex size-8 items-center justify-center rounded-full border-2 transition-all',
            isRunning
              ? 'border-green-400 bg-green-100 text-green-500 opacity-60 dark:bg-green-900/20'
              : 'border-green-400 bg-green-50 text-green-500 hover:bg-green-100 hover:scale-105 dark:bg-green-900/10',
          )}
        >
          <PlayIcon weight="fill" className="size-3.5" />
        </button>

        {/* StopIcon */}
        <button
          id="stage-stop-btn"
          aria-label="Stop"
          disabled={!isRunning}
          onClick={onStop}
          className={cn(
            'flex size-8 items-center justify-center rounded-full border-2 transition-all',
            !isRunning
              ? 'border-red-400 bg-red-50 text-red-400 opacity-60 dark:bg-red-900/10'
              : 'border-red-400 bg-red-50 text-red-400 hover:bg-red-100 hover:scale-105 dark:bg-red-900/10',
          )}
        >
          <StopIcon weight="fill" className="size-3.5" />
        </button>

        <span className="ml-auto text-[10px] font-medium text-muted-foreground">
          {isRunning ? 'Running…' : 'Stopped'}
        </span>

        {/* Fullscreen shortcut */}
        <button
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          <CornersOutIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
