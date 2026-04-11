'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Stop, Waveform, Trash, Upload, Plus, MicrophoneStage,
  FastForward, Rewind, SpeakerHigh, SpeakerNone,
  CopySimple, Clipboard, ArrowCounterClockwise, ArrowClockwise,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface SoundAsset {
  id:       string;
  name:     string;
  duration: number;
  size:     string;
  mono:     boolean;
  url?:     string;
  wave?:    number[];
}

function uid() { return Math.random().toString(36).slice(2, 7); }

const DEMO_SOUNDS: SoundAsset[] = [
  { id: 's1', name: 'pop',                  duration: 0.02,   size: '12KB',   mono: true,  wave: generateMockWave(1, 200) },
  { id: 's2', name: 'Your Best Ni...',      duration: 167.58, size: '3.6MB',  mono: false, wave: generateMockWave(2, 200) },
];

function generateMockWave(seed: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    return Math.max(0.04, Math.abs(Math.sin(t * 24 + seed) * Math.cos(t * 9 - seed * 0.5) * 0.7 + Math.sin(t * 60 + seed * 0.2) * 0.3));
  });
}

function fmt(s: number) {
  if (isNaN(s)) return '00:00.00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
}

const FX = [
  { label: 'Faster',   icon: <FastForward className="size-4" /> },
  { label: 'Slower',   icon: <Rewind      className="size-4" /> },
  { label: 'Louder',   icon: <SpeakerHigh className="size-4" /> },
  { label: 'Softer',   icon: <SpeakerNone className="size-4" /> },
  { label: 'Mute',     icon: <SpeakerNone className="size-4" /> },
  { label: 'Fade in',  icon: <span className="text-[10px] font-bold">▷|</span> },
  { label: 'Fade out', icon: <span className="text-[10px] font-bold">|◁</span> },
  { label: 'Reverse',  icon: <span className="text-[10px] font-bold">⇄</span>  },
  { label: 'Robot',    icon: <span className="text-[10px]">🤖</span>            },
  { label: 'Echo',     icon: <span className="text-[10px] font-bold">))))</span> },
];

// ── SoundEditor ──────────────────────────────────────────────────────────────
export function SoundEditor() {
  const [sounds,    setSounds]    = useState<SoundAsset[]>(DEMO_SOUNDS);
  const [activeId,  setActiveId]  = useState<string>(DEMO_SOUNDS[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead,  setPlayhead]  = useState(0);   // 0–1
  const [isRecording, setIsRecording] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const rafRef   = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = sounds.find(s => s.id === activeId) ?? sounds[0];
  const DURATION = active?.duration ?? 5;

  // Initialize generic audio context loader for waveform extraction
  const extractWaveform = async (url: string): Promise<number[]> => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0); // mono
      
      const wave = [];
      const BARS = 200;
      const step = Math.ceil(channelData.length / BARS);
      for (let i = 0; i < BARS; i++) {
        let max = 0;
        for (let j = 0; j < step; j++) {
          const val = Math.abs(channelData[i * step + j] || 0);
          if (val > max) max = val;
        }
        wave.push(Math.max(0.04, max)); // min bar height
      }
      return wave;
    } catch (e) {
      console.error(e);
      return generateMockWave(0, 200);
    }
  };

  // ── Playback HTML5 Audio ──────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!audioRef.current || !active?.url) {
      // Stub playback for demo sounds
      setIsPlaying(true);
      const start = performance.now() - playhead * DURATION * 1000;
      function tick() {
        const elapsed = (performance.now() - start) / 1000;
        const pct = Math.min(elapsed / DURATION, 1);
        setPlayhead(pct);
        if (pct < 1) rafRef.current = requestAnimationFrame(tick);
        else { setPlayhead(0); setIsPlaying(false); }
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const a = audioRef.current;
    a.currentTime = playhead * DURATION;
    a.play().catch(console.error);
    setIsPlaying(true);

    const updatePlayhead = () => {
      if (a.duration) {
        setPlayhead(a.currentTime / a.duration);
        rafRef.current = requestAnimationFrame(updatePlayhead);
      }
    };
    rafRef.current = requestAnimationFrame(updatePlayhead);
  }, [playhead, DURATION, active]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    } else {
      setPlayhead(0); // stub reset
    }
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    // When active changes, reset playhead
    stop();
    setPlayhead(0);
    if (audioRef.current && active?.url) {
      audioRef.current.src = active.url;
      audioRef.current.load();
    }
  }, [activeId, active?.url, stop]);

  // ── File Upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    
    // Wait for metadata to get duration
    audio.onloadedmetadata = async () => {
      const wave = await extractWaveform(url);
      const id = uid();
      setSounds(prev => [...prev, {
        id, 
        name: file.name.replace(/\.[^.]+$/, ''), 
        duration: audio.duration, 
        size: (file.size / 1024 / 1024).toFixed(2) + 'MB', 
        mono: false,
        url,
        wave
      }]);
      setActiveId(id);
    };
  };

  // ── Recording ────────────────────────────────────────────────────────────
  const toggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        const wave = await extractWaveform(url);
        
        const audioEl = new Audio(url);
        audioEl.onloadedmetadata = () => {
           const id = uid();
           setSounds(prev => [...prev, {
             id, 
             name: 'recording1', 
             duration: audioEl.duration, 
             size: (audioBlob.size / 1024).toFixed(1) + 'KB', 
             mono: true,
             url,
             wave
           }]);
           setActiveId(id);
        };
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or unavailable.");
      console.error(err);
    }
  };

  const deleteSound = (id: string) => {
    const next = sounds.filter(s => s.id !== id);
    setSounds(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
    if (isPlaying) stop();
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPlayhead(pct);
    if (audioRef.current) {
       audioRef.current.currentTime = pct * DURATION;
    }
  };

  const currentTime = playhead * DURATION;

  return (
    <div className="flex h-full bg-[#111] text-white overflow-hidden">
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setPlayhead(0); cancelAnimationFrame(rafRef.current); }} className="hidden" />
      
      {/* ── Left: Sound list sidebar ─────────────────────────────────────── */}
      <div className="flex w-[88px] shrink-0 flex-col border-r border-white/10 bg-[#1a1a1a] overflow-y-auto">
        {sounds.map((s, i) => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              onClick={() => { setActiveId(s.id); stop(); }}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 cursor-pointer px-2 py-2.5 select-none',
                isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#1e1e1e]',
              )}
            >
              <span className="text-[9px] text-white/40 self-start">{i + 1}</span>

              {/* Waveform thumbnail */}
              <div className={cn(
                'flex size-12 items-center justify-center rounded',
                isActive ? 'ring-2 ring-[#ff4466]' : 'bg-[#222]',
              )}>
                <Waveform className={cn('size-6', isActive ? 'text-[#ff4466]' : 'text-white/30')} />
              </div>

              <span className="text-[9px] text-white/70 truncate w-full text-center leading-tight">{s.name}</span>
              <span className="text-[8px] text-white/30 font-mono">{s.duration.toFixed(2)}</span>

              <button
                onClick={e => { e.stopPropagation(); deleteSound(s.id); }}
                className="absolute right-1 top-1 hidden size-4 items-center justify-center rounded-full bg-white/10 text-white group-hover:flex hover:bg-red-500"
              >
                <span className="text-[10px] leading-none">✕</span>
              </button>
            </div>
          );
        })}

        {/* FAB */}
        <div className="mt-auto sticky bottom-0 bg-[#1a1a1a] border-t border-white/10 flex flex-col items-center gap-2 py-3">
          <input type="file" accept="audio/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex size-9 items-center justify-center rounded-full bg-[#ff4466] hover:bg-[#ff2255] transition-colors shadow-lg"
            title="Upload sound"
          >
            <Upload className="size-4" />
          </button>
          <button
            onClick={toggleRecord}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors shadow-lg",
              isRecording ? "bg-red-500 animate-pulse" : "bg-[#ff4466] hover:bg-[#ff2255]"
            )}
            title={isRecording ? "Stop recording" : "Record mic"}
          >
            {isRecording ? <Stop className="size-4" weight="fill" /> : <MicrophoneStage className="size-4 text-white" />}
          </button>
        </div>
      </div>

      {/* ── Main editor ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ── Top toolbar ─────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#1a1a1a] px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50">Sound</span>
            <input
              value={active?.name ?? ''}
              onChange={e => setSounds(prev => prev.map(s => s.id === activeId ? { ...s, name: e.target.value } : s))}
              className="h-6 w-36 rounded bg-[#2a2a2a] px-2 text-xs text-white border border-white/10 focus:border-[#ff4466]/60 focus:outline-none"
            />
          </div>

          <div className="flex gap-0.5">
            <button title="Undo" className="flex size-7 items-center justify-center rounded hover:bg-white/10">
              <ArrowCounterClockwise className="size-3.5 text-white/60" />
            </button>
            <button title="Redo" className="flex size-7 items-center justify-center rounded hover:bg-white/10">
              <ArrowClockwise className="size-3.5 text-white/60" />
            </button>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {[
            { icon: <CopySimple className="size-3.5" />, label: 'Copy'        },
            { icon: <Clipboard  className="size-3.5" />, label: 'Paste'       },
            { icon: <Plus       className="size-3.5" />, label: 'Copy to New' },
            { icon: <Trash      className="size-3.5 text-red-400" />, label: 'Delete' },
          ].map(({ icon, label }) => (
            <button key={label} title={label} className="flex flex-col items-center gap-0.5 rounded px-1.5 py-1 hover:bg-white/10">
              {icon}
              <span className="text-[8px] text-white/40 whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Waveform canvas ──────────────────────────────────────────────── */}
        <div className="relative flex-1 cursor-crosshair overflow-hidden bg-[#0f0f0f]" onClick={seekTo}>
          <div className="absolute inset-0 flex items-center px-4">
            {(active?.wave || []).map((v, i, arr) => {
              const pct     = i / arr.length;
              const isPast  = pct <= playhead;
              return (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    height:          `${Math.min(100, v * 85)}%`,
                    backgroundColor: isPast ? '#d946a8' : '#7c3d73',
                    marginRight:     '1px',
                    borderRadius:    '1px',
                  }}
                />
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-[#ff4466] shadow-[0_0_6px_#ff4466]" style={{ left: `${playhead * 100}%` }} />
          <div className="pointer-events-none absolute bottom-2 left-4 text-[11px] font-mono text-white/50">{fmt(currentTime)} / {fmt(DURATION)}</div>
          <div className="pointer-events-none absolute bottom-2 right-4 text-[11px] font-mono text-white/30">{active?.mono ? 'Mono' : 'Stereo'} ({active?.size})</div>
        </div>

        {/* ── Bottom: Play + Effects ──────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-4 border-t border-white/10 bg-[#1a1a1a] px-4 py-2">
          <button
            onClick={isPlaying ? stop : play}
            className={cn('flex size-10 shrink-0 items-center justify-center rounded-full transition-colors shadow-lg', isPlaying ? 'bg-[#ff4466] hover:bg-[#ff2255]' : 'bg-[#ff4466] hover:bg-[#ff2255]')}
          >
            {isPlaying ? <Stop weight="fill" className="size-4 text-white" /> : <svg viewBox="0 0 16 16" className="size-4 fill-white"><path d="M3 2.5l10 5.5-10 5.5z" /></svg>}
          </button>

          <div className="flex flex-1 items-center gap-1 overflow-x-auto">
            {FX.map(({ label, icon }) => (
              <button key={label} title={label} className="flex shrink-0 flex-col items-center gap-0.5 rounded px-2.5 py-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                <span className="text-white/70">{icon}</span>
                <span className="text-[9px] whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
