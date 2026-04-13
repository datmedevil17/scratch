'use client';

import { useState } from "react";
import {
  Plus, Upload, Copy, Trash, Eye, EyeSlash, DotsSixVertical, Image as ImageIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface Sprite {
  id:        string;
  name:      string;
  emoji:     string;
  /** Actual image URL — shown in thumbnail when present (overrides emoji) */
  imageUrl?: string;
  x:         number;
  y:         number;
  size:      number;
  direction: number;
  visible:   boolean;
}

export interface SpritePanelProps {
  sprites:           Sprite[];
  selectedId:        string | null;
  onSelect:          (id: string) => void;
  onAdd:             () => void;
  onUpload:          () => void;
  onDelete:          (id: string) => void;
  onDuplicate:       (id: string) => void;
  onToggleVisible:   (id: string) => void;
  onPropChange:      (id: string, prop: Partial<Omit<Sprite, 'id' | 'name' | 'emoji'>>) => void;
  backgroundUrl?:    string | null;
  onChangeBackground?: () => void;
}

// ── Compact number input ─────────────────────────────────────────────────────
function PropInput({
  label, value, onChange, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
      <div className="flex items-center gap-0.5 rounded border border-white/10 bg-black/20 px-1.5 py-0.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-xs text-white outline-none tabular-nums"
        />
        {suffix && <span className="shrink-0 text-[10px] text-white/30">{suffix}</span>}
      </div>
    </label>
  );
}

// ── Sprite card ──────────────────────────────────────────────────────────────
function SpriteCard({
  sprite,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisible,
}: {
  sprite: Sprite;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex cursor-pointer items-center gap-2 rounded-lg border bg-[#1e1e1e] p-2 transition-all hover:bg-[#252525]',
        selected
          ? 'border-blue-400 shadow-md shadow-blue-900/40'
          : 'border-white/10 hover:border-white/20',
      )}
    >
      {/* Drag handle */}
      <DotsSixVertical className="size-3 shrink-0 text-white/20 group-hover:text-white/50" />

      {/* Thumbnail */}
      <div className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md text-xl',
        selected ? 'bg-blue-950/40' : 'bg-black/30',
      )}>
        {sprite.imageUrl ? (
          <img
            src={sprite.imageUrl}
            alt={sprite.name}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          sprite.emoji
        )}
      </div>

      {/* Name */}
      <span className="flex-1 truncate text-xs font-medium text-white/80">{sprite.name}</span>

      {/* Actions — shown on hover or when selected */}
      <div className={cn(
        'flex items-center gap-0.5 transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
          className="flex size-5 items-center justify-center rounded hover:bg-white/10"
          title={sprite.visible ? 'Hide' : 'Show'}
        >
          {sprite.visible
            ? <Eye     className="size-3 text-white/50" />
            : <EyeSlash className="size-3 text-white/50" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="flex size-5 items-center justify-center rounded hover:bg-white/10"
          title="Duplicate"
        >
          <Copy className="size-3 text-white/50" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex size-5 items-center justify-center rounded hover:bg-white/10"
          title="Delete"
        >
          <Trash className="size-3 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ── SpritePanel ──────────────────────────────────────────────────────────────
export function SpritePanel({
  sprites, selectedId, onSelect, onAdd, onUpload,
  onDelete, onDuplicate, onToggleVisible, onPropChange,
  backgroundUrl, onChangeBackground,
}: SpritePanelProps) {
  const selected = sprites.find((s) => s.id === selectedId) ?? null;


  return (
    <div className="flex h-full flex-col border-t border-white/10 bg-[#111]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Sprites</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onUpload}
            title="Upload sprite"
            className="flex size-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"
          >
            <Upload className="size-3.5" />
          </button>
          <button
            onClick={onAdd}
            title="Add sprite"
            className="flex h-6 items-center gap-1 rounded bg-blue-500 px-2 text-[10px] font-semibold text-white hover:bg-blue-600"
          >
            <Plus className="size-3" weight="bold" /> Add
          </button>
        </div>
      </div>

      {/* Sprite list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sprites.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-white/30">No sprites yet</p>
        ) : (
          sprites.map((s) => (
            <SpriteCard
              key={s.id}
              sprite={s}
              selected={s.id === selectedId}
              onSelect={() => onSelect(s.id)}
              onDelete={() => onDelete(s.id)}
              onDuplicate={() => onDuplicate(s.id)}
              onToggleVisible={() => onToggleVisible(s.id)}
            />
          ))
        )}
      </div>

      {/* Properties */}
      {selected && (
        <div className="border-t border-white/10 px-3 py-2">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/30">Properties</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            <PropInput label="X" value={selected.x}
              onChange={(v) => onPropChange(selected.id, { x: v })} />
            <PropInput label="Y" value={selected.y}
              onChange={(v) => onPropChange(selected.id, { y: v })} />
            <PropInput label="Size" value={selected.size} suffix="%"
              onChange={(v) => onPropChange(selected.id, { size: v })} />
            <PropInput label="Direction" value={selected.direction} suffix="°"
              onChange={(v) => onPropChange(selected.id, { direction: v })} />
          </div>
          {/* Visibility toggle */}
          <button
            onClick={() => onToggleVisible(selected.id)}
            className={cn(
              'mt-2 flex w-full items-center gap-2 rounded border px-2 py-1 text-xs font-medium transition-colors',
              selected.visible
                ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                : 'border-white/5 bg-black/20 text-white/30',
            )}
          >
            {selected.visible
              ? <Eye className="size-3.5" />
              : <EyeSlash className="size-3.5" />}
            {selected.visible ? 'Visible' : 'Hidden'}
          </button>
        </div>
      )}

      {/* ── Background section ──────────────────────────────────── */}
      <div className="border-t border-white/10 px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Background</p>
          <button
            onClick={onChangeBackground}
            className="flex items-center gap-1 rounded bg-[#ff4466]/15 px-2 py-0.5 text-[10px] font-semibold text-[#ff4466] hover:bg-[#ff4466]/25 transition-colors"
          >
            <ImageIcon className="size-3" /> Change
          </button>
        </div>
        <div
          onClick={onChangeBackground}
          className="relative flex h-16 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 transition-all hover:border-white/20"
        >
          {backgroundUrl ? (
            <img
              src={backgroundUrl}
              alt="Stage background"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-white/20">
              <ImageIcon className="size-6" />
              <span className="text-[9px]">Click to add background</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
