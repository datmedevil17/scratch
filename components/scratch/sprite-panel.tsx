'use client';

import { useState } from "react";
import {
  Plus, Upload, Copy, Trash, Eye, EyeSlash, DotsSixVertical,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface Sprite {
  id:        string;
  name:      string;
  emoji:     string;
  x:         number;
  y:         number;
  size:      number;
  direction: number;
  visible:   boolean;
}

export interface SpritePanelProps {
  sprites:         Sprite[];
  selectedId:      string | null;
  onSelect:        (id: string) => void;
  onAdd:           () => void;
  onUpload:        () => void;
  onDelete:        (id: string) => void;
  onDuplicate:     (id: string) => void;
  onToggleVisible: (id: string) => void;
  onPropChange:    (id: string, prop: Partial<Omit<Sprite, 'id' | 'name' | 'emoji'>>) => void;
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
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5 rounded border border-input bg-background px-1.5 py-0.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-xs outline-none tabular-nums"
        />
        {suffix && <span className="shrink-0 text-[10px] text-muted-foreground">{suffix}</span>}
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
        'group relative flex cursor-pointer items-center gap-2 rounded-lg border-2 bg-background p-2 transition-all hover:shadow-sm',
        selected
          ? 'border-blue-400 shadow-md shadow-blue-200/50 dark:shadow-blue-900/40'
          : 'border-transparent hover:border-border',
      )}
    >
      {/* Drag handle */}
      <DotsSixVertical className="size-3 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />

      {/* Thumbnail */}
      <div className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md text-xl',
        selected ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-muted',
      )}>
        {sprite.emoji}
      </div>

      {/* Name */}
      <span className="flex-1 truncate text-xs font-medium">{sprite.name}</span>

      {/* Actions — shown on hover or when selected */}
      <div className={cn(
        'flex items-center gap-0.5 transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
          className="flex size-5 items-center justify-center rounded hover:bg-muted"
          title={sprite.visible ? 'Hide' : 'Show'}
        >
          {sprite.visible
            ? <Eye     className="size-3 text-muted-foreground" />
            : <EyeSlash className="size-3 text-muted-foreground" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="flex size-5 items-center justify-center rounded hover:bg-muted"
          title="Duplicate"
        >
          <Copy className="size-3 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex size-5 items-center justify-center rounded hover:bg-muted"
          title="Delete"
        >
          <Trash className="size-3 text-destructive" />
        </button>
      </div>
    </div>
  );
}

// ── SpritePanel ──────────────────────────────────────────────────────────────
export function SpritePanel({
  sprites, selectedId, onSelect, onAdd, onUpload,
  onDelete, onDuplicate, onToggleVisible, onPropChange,
}: SpritePanelProps) {
  const selected = sprites.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col border-t border-border bg-[#f9f9f9] dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sprites</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onUpload}
            title="Upload sprite"
            className="flex size-6 items-center justify-center rounded hover:bg-muted"
          >
            <Upload className="size-3.5 text-muted-foreground" />
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
          <p className="py-4 text-center text-[11px] text-muted-foreground">No sprites yet</p>
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
        <div className="border-t border-border px-3 py-2">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Properties</p>
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
                ? 'border-border bg-background hover:bg-muted'
                : 'border-muted-foreground/30 bg-muted text-muted-foreground',
            )}
          >
            {selected.visible
              ? <Eye className="size-3.5" />
              : <EyeSlash className="size-3.5" />}
            {selected.visible ? 'Visible' : 'Hidden'}
          </button>
        </div>
      )}
    </div>
  );
}
