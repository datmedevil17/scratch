'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Stop, Microphone, Upload, Scissors, Waveform,
  SpeakerHigh, SpeakerNone, Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface SoundAsset {
  id:   string;
  name: string;
  // In real impl: ArrayBuffer / AudioBuffer
}

function uid() { return Math.random().toString(36).slice(2, 7); }

const DEMO_SOUNDS: SoundAsset[] = [
  { id: 'pop',   name: 'pop.wav'   },
  { id: 'meow',  name: 'meow.wav'  },
  { id: 'drum',  name: 'drum.wav'  },
];

// ── Fake waveform bars ───────────────────────────────────────────────────────
// In a real implementation these would come from the audio buffer data.
function generateFakeWave(seed: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    return 0.1 + 0.85 * Math.abs(
      Math.sin(t * 18 + seed) * Math.cos(t * 7 - seed * 0.4) * 0.7 +
      Math.sin(t * 30 + seed * 0.3) * 0.3,
    );
  });
}

// ── SoundEditor ──────────────────────────────────────────────────────────────
export function SoundEditor() {
  const [sounds,     setSounds]     = useState<SoundAsset[]>(DEMO_SOUNDS);
  const [activeId,   setActiveId]   = useState<string>(DEMO_SOUNDS[0].id);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [volume,     setVolume]     = useState(80);
  const [muted,      setMuted]      = useState(false);
  const [playhead,   setPlayhead]   = useState(0);       // 0–1
  const [trimStart,  setTrimStart]  = useState(0);       // 0–1
  const [trimEnd,    setTrimEnd]    = useState(1);       // 0–1
  const [recording,  setRecording]  = useState(false);

  const rafRef   = useRef<number>(0);
  const startRef = useRef<number>(0);
  const DURATION = 3.2; // fake seconds

  // Fake waveform for active sound
  const waveData = generateFakeWave(sounds.findIndex((s) => s.id === activeId), 80);

  // ── Playback simulation ───────────────────────────────────────────────
  const play = useCallback(() => {
    setIsPlaying(true);
    startRef.current = performance.now() - playhead * DURATION * 1000;
    function tick() {
      const elapsed = (performance.now() - startRef.current) / 1000;
      const pct = Math.min(elapsed / DURATION, 1);
      setPlayhead(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlayhead(0);
        setIsPlaying(false);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [playhead]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setPlayhead(0);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const deleteSound = (id: string) => {
    const next = sounds.filter((s) => s.id !== id);
    setSounds(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
    if (isPlaying) stop();
  };

  const addSound = () => {
    const s: SoundAsset = { id: uid(), name: `sound${sounds.length + 1}.wav` };
    setSounds((prev) => [...prev, s]);
    setActiveId(s.id);
  };

  return (
    <div className="flex h-full bg-white dark:bg-neutral-900">
      {/* ── Sound list sidebar ──────────────────────────────────────────── */}
      <div className="flex w-44 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sounds</span>
          <div className="flex gap-0.5">
            <button title="Record" onClick={() => setRecording((r) => !r)}
              className={cn('flex size-5 items-center justify-center rounded transition-colors hover:bg-muted',
                recording && 'bg-red-100 text-red-500 dark:bg-red-900/20')}>
              <Microphone className="size-3" />
            </button>
            <button title="Upload" onClick={addSound}
              className="flex size-5 items-center justify-center rounded hover:bg-muted">
              <Upload className="size-3 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {sounds.map((s) => (
            <div
              key={s.id}
              onClick={() => { setActiveId(s.id); stop(); }}
              className={cn(
                'group flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors',
                activeId === s.id
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30'
                  : 'hover:bg-muted',
              )}
            >
              <Waveform className="size-3 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{s.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSound(s.id); }}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              >
                <Trash className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main editor ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {/* Controls bar */}
        <div className="flex items-center gap-2 border-b border-border bg-[#fafafa] px-3 py-2 dark:bg-neutral-900">
          <button
            onClick={isPlaying ? stop : play}
            disabled={!activeId}
            className={cn(
              'flex size-8 items-center justify-center rounded-full border-2 transition-all',
              isPlaying
                ? 'border-red-400 bg-red-50 text-red-500 hover:bg-red-100'
                : 'border-purple-400 bg-purple-50 text-purple-600 hover:bg-purple-100',
            )}
          >
            {isPlaying
              ? <Stop  weight="fill" className="size-3.5" />
              : <Play  weight="fill" className="size-3.5" />}
          </button>

          {/* Recording indicator */}
          {recording && (
            <div className="flex items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-500 dark:bg-red-900/20">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              Recording…
            </div>
          )}

          {/* Volume */}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setMuted((m) => !m)}>
              {muted
                ? <SpeakerNone className="size-4 text-muted-foreground" />
                : <SpeakerHigh className="size-4 text-muted-foreground" />}
            </button>
            <input
              type="range" min={0} max={100} value={muted ? 0 : volume}
              onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
              className="w-20 accent-purple-500"
            />
            <span className="w-7 text-[11px] tabular-nums text-muted-foreground">{muted ? 0 : volume}%</span>
          </div>
        </div>

        {/* Waveform */}
        <div className="relative flex-1 cursor-pointer overflow-hidden bg-[#1a1a2e] px-3 py-4"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setPlayhead(Math.max(0, Math.min(1, pct)));
          }}
        >
          {/* Trim region */}
          <div
            className="absolute inset-y-0 bg-purple-500/10"
            style={{ left: `${trimStart * 100}%`, right: `${(1 - trimEnd) * 100}%` }}
          />

          {/* Waveform bars */}
          <div className="flex h-full items-center gap-px">
            {waveData.map((v, i) => {
              const pct = i / waveData.length;
              const past = pct <= playhead;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-sm',
                    past ? 'bg-purple-400' : 'bg-purple-900/60',
                  )}
                  style={{ height: `${v * 100}%` }}
                />
              );
            })}
          </div>

          {/* Playhead needle */}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-purple-300"
            style={{ left: `${playhead * 100}%` }}
          />

          {/* Trim handles */}
          <div
            className="absolute inset-y-0 w-1 cursor-ew-resize bg-purple-400"
            style={{ left: `${trimStart * 100}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const parent = e.currentTarget.parentElement!;
              const move = (ev: PointerEvent) => {
                const rect = parent.getBoundingClientRect();
                setTrimStart(Math.max(0, Math.min(trimEnd - 0.05, (ev.clientX - rect.left) / rect.width)));
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
            }}
          />
          <div
            className="absolute inset-y-0 w-1 cursor-ew-resize bg-purple-400"
            style={{ left: `${trimEnd * 100}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const parent = e.currentTarget.parentElement!;
              const move = (ev: PointerEvent) => {
                const rect = parent.getBoundingClientRect();
                setTrimEnd(Math.min(1, Math.max(trimStart + 0.05, (ev.clientX - rect.left) / rect.width)));
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
            }}
          />

          {/* Time label */}
          <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] font-mono text-purple-300/70">
            {(playhead * DURATION).toFixed(2)}s / {DURATION.toFixed(2)}s
          </div>
        </div>

        {/* Effects bar */}
        <div className="flex items-center gap-3 border-t border-border bg-[#fafafa] px-3 py-1.5 dark:bg-neutral-900">
          <button
            title="Trim to selection"
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
          >
            <Scissors className="size-3" /> Trim
          </button>
          <span className="text-[10px] text-muted-foreground">Effects:</span>
          {['Fade in', 'Fade out', 'Reverse', 'Robot'].map((fx) => (
            <button key={fx} className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted">
              {fx}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
