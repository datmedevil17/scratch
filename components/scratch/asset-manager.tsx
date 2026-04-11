'use client';

import { useState, useRef } from "react";
import {
  MagnifyingGlass, Upload, SmileySticker, Image as ImageIcon, Waveform,
  Trash, MusicNote, X, ArrowsClockwise, Plus,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type AssetTab = 'sprites' | 'backdrops' | 'sounds';

interface Asset {
  id:    string;
  name:  string;
  type:  AssetTab;
  emoji: string;
  tags?: string[];
}

const DEMO_ASSETS: Asset[] = [
  // Sprites
  { id: 'a1',  type: 'sprites',   emoji: '🐱', name: 'Cat',         tags: ['animal', 'cute'] },
  { id: 'a2',  type: 'sprites',   emoji: '🐶', name: 'Dog',         tags: ['animal'] },
  { id: 'a3',  type: 'sprites',   emoji: '🚗', name: 'Car',         tags: ['vehicle'] },
  { id: 'a4',  type: 'sprites',   emoji: '⭐', name: 'Star',        tags: ['shape'] },
  { id: 'a5',  type: 'sprites',   emoji: '🎈', name: 'Balloon',     tags: ['party'] },
  { id: 'a6',  type: 'sprites',   emoji: '🦋', name: 'Butterfly',   tags: ['animal'] },
  { id: 'a7',  type: 'sprites',   emoji: '🐸', name: 'Frog',        tags: ['animal'] },
  { id: 'a8',  type: 'sprites',   emoji: '🚀', name: 'Rocket',      tags: ['space'] },
  { id: 'a9',  type: 'sprites',   emoji: '🦊', name: 'Fox',         tags: ['animal'] },
  { id: 'a10', type: 'sprites',   emoji: '🎃', name: 'Pumpkin',     tags: ['holiday'] },
  // Backdrops
  { id: 'b1',  type: 'backdrops', emoji: '🌅', name: 'Sunset',      tags: ['nature'] },
  { id: 'b2',  type: 'backdrops', emoji: '🌃', name: 'City Night',  tags: ['city'] },
  { id: 'b3',  type: 'backdrops', emoji: '🌊', name: 'Ocean',       tags: ['nature'] },
  { id: 'b4',  type: 'backdrops', emoji: '🏔️', name: 'Mountains',   tags: ['nature'] },
  { id: 'b5',  type: 'backdrops', emoji: '🏠', name: 'House',       tags: ['indoor'] },
  { id: 'b6',  type: 'backdrops', emoji: '🌌', name: 'Galaxy',      tags: ['space'] },
  // Sounds
  { id: 's1',  type: 'sounds',    emoji: '🎵', name: 'pop.wav',     tags: ['effect'] },
  { id: 's2',  type: 'sounds',    emoji: '🐱', name: 'meow.wav',    tags: ['animal'] },
  { id: 's3',  type: 'sounds',    emoji: '🥁', name: 'drum beat',   tags: ['music'] },
  { id: 's4',  type: 'sounds',    emoji: '🎸', name: 'guitar riff', tags: ['music'] },
  { id: 's5',  type: 'sounds',    emoji: '🎹', name: 'piano',       tags: ['music'] },
];

const TABS: { id: AssetTab; label: string; icon: React.ReactNode }[] = [
  { id: 'sprites',   label: 'Sprites',   icon: <SmileySticker className="size-4" /> },
  { id: 'backdrops', label: 'Backdrops', icon: <ImageIcon     className="size-4" /> },
  { id: 'sounds',    label: 'Sounds',    icon: <Waveform      className="size-4" /> },
];

function uid() { return Math.random().toString(36).slice(2, 8); }

// ── Asset Card ────────────────────────────────────────────────────────────────
function AssetCard({
  asset, onUse, onDelete,
}: {
  asset: Asset;
  onUse: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative cursor-pointer rounded-xl border border-white/10 bg-[#1e1e1e] transition-all hover:border-white/20 hover:bg-[#252525]">
      {/* Thumbnail */}
      <div className="flex aspect-square items-center justify-center rounded-t-xl bg-[#161616] text-4xl select-none">
        {asset.emoji}
      </div>

      {/* Name */}
      <p className="truncate px-2 pb-2 pt-1.5 text-[10px] text-center font-medium text-white/70">
        {asset.name}
      </p>

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          onClick={onUse}
          className="rounded-lg bg-[#ff4466] px-3 py-1.5 text-[11px] font-bold text-white shadow-lg hover:bg-[#ff2255] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onDelete}
          className="flex size-6 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-red-500/80 hover:text-white transition-colors"
        >
          <Trash className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ── AssetManager ──────────────────────────────────────────────────────────────
export interface AssetManagerProps {
  open:    boolean;
  onClose: () => void;
  onUse?:  (assetId: string, type: AssetTab) => void;
}

export function AssetManager({ open, onClose, onUse }: AssetManagerProps) {
  const [tab,    setTab]    = useState<AssetTab>('sprites');
  const [query,  setQuery]  = useState('');
  const [assets, setAssets] = useState<Asset[]>(DEMO_ASSETS);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const visible = assets.filter(
    a => a.type === tab && a.name.toLowerCase().includes(query.toLowerCase()),
  );

  const deleteAsset = (id: string) => setAssets(prev => prev.filter(a => a.id !== id));

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isSound = file.type.startsWith('audio');
    const isImage = file.type.startsWith('image');
    const type: AssetTab = isSound ? 'sounds' : isImage ? 'sprites' : 'sprites';
    const newAsset: Asset = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ''),
      type,
      emoji: isSound ? '🎵' : '🖼️',
    };
    setAssets(prev => [...prev, newAsset]);
    setTab(type);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative flex w-[780px] max-w-[95vw] flex-col rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#1a1a1a] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#ff4466]/20 text-[#ff4466]">
              <Plus className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Add Asset</h2>
          </div>

          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Tab bar + search ─────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#151515] px-5 py-2">
          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setQuery(''); }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  tab === t.id
                    ? 'bg-[#ff4466]/15 text-[#ff4466]'
                    : 'text-white/40 hover:bg-white/5 hover:text-white/70',
                )}
              >
                {t.icon} {t.label}
                <span className={cn(
                  'ml-0.5 rounded-full px-1.5 py-px text-[9px] font-bold',
                  tab === t.id ? 'bg-[#ff4466]/20 text-[#ff4466]' : 'bg-white/10 text-white/30',
                )}>
                  {assets.filter(a => a.type === t.id).length}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1a1a] px-2.5 py-1.5">
            <MagnifyingGlass className="size-3.5 shrink-0 text-white/30" />
            <input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-36 bg-transparent text-xs text-white placeholder:text-white/25 outline-none"
            />
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-[#ff4466] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[#ff2255] transition-colors"
          >
            <Upload className="size-3.5" weight="bold" /> Upload
          </button>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,audio/*" onChange={handleUpload} />
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Sidebar: category filter hint */}
          <div className="hidden w-40 shrink-0 flex-col border-r border-white/10 bg-[#131313] p-3 sm:flex">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/25">Categories</p>
            {['All', 'Animals', 'People', 'Space', 'Nature', 'Vehicles', 'Music', 'Effects'].map(cat => (
              <button
                key={cat}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors',
                  cat === 'All'
                    ? 'bg-white/8 font-semibold text-white'
                    : 'text-white/40 hover:bg-white/5 hover:text-white/70',
                )}
              >
                {cat}
              </button>
            ))}

            <div className="mt-auto border-t border-white/10 pt-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/25">Source</p>
              <button className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[11px] bg-white/8 font-semibold text-white hover:bg-white/10">
                <ArrowsClockwise className="size-3" /> Library
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[11px] text-white/40 hover:bg-white/5 hover:text-white/70"
              >
                <Upload className="size-3" /> Upload
              </button>
            </div>
          </div>

          {/* Asset grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {visible.length > 0 ? (
              <>
                <p className="mb-3 text-[10px] text-white/30">
                  {visible.length} {tab} available
                </p>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                  {visible.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onUse={() => { onUse?.(asset.id, asset.type); onClose(); }}
                      onDelete={() => deleteAsset(asset.id)}
                    />
                  ))}

                  {/* Upload placeholder card */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-transparent text-white/20 transition-colors hover:border-[#ff4466]/40 hover:bg-[#ff4466]/5 hover:text-[#ff4466]/60"
                  >
                    <Upload className="size-5" />
                    <span className="text-[9px] font-medium">Upload</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/25">
                {tab === 'sounds'
                  ? <MusicNote className="size-10 opacity-30" />
                  : tab === 'backdrops'
                  ? <ImageIcon className="size-10 opacity-30" />
                  : <SmileySticker className="size-10 opacity-30" />
                }
                <p className="text-sm">No {tab} found{query ? ` for "${query}"` : ''}</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-1 rounded-lg bg-[#ff4466]/15 px-4 py-2 text-xs font-semibold text-[#ff4466] hover:bg-[#ff4466]/25 transition-colors"
                >
                  Upload one
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 bg-[#1a1a1a] px-5 py-3">
          <p className="text-[10px] text-white/25">
            Drag assets directly into the workspace or click Add
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
