'use client';

import { useState, useCallback } from "react";
import {
  ArrowCounterClockwise as ArrowCounterClockwiseIcon, ArrowClockwise as ArrowClockwiseIcon,
  Copy as CopyIcon, ClipboardText as ClipboardTextIcon,
  Trash as TrashIcon, MagnifyingGlassPlus as MagnifyingGlassPlusIcon,
  MagnifyingGlassMinus as MagnifyingGlassMinusIcon, CornersIn as CornersInIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────────────────
export interface FloatingToolbarProps {
  canUndo:    boolean;
  canRedo:    boolean;
  canCopy:    boolean;
  canPaste:   boolean;
  canDelete:  boolean;
  onUndo:     () => void;
  onRedo:     () => void;
  onCopy:     () => void;
  onPaste:    () => void;
  onDelete:   () => void;
  onZoomIn:   () => void;
  onZoomOut:  () => void;
  onResetZoom:() => void;
  zoomLevel:  number;   // 0–100 percentage string fed from workspace
}

// ── ToolBtn helper ────────────────────────────────────────────────────────────
function ToolBtn({
  icon, label, shortcut, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            if (disabled) {
              e.preventDefault();
              return;
            }
            onClick();
          }}
          aria-disabled={disabled}
          className={cn(
            'flex size-7 items-center justify-center rounded transition-colors',
            disabled
              ? 'cursor-not-allowed opacity-30'
              : 'hover:bg-white/20 active:bg-white/30',
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}{shortcut && <span className="ml-1 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-white/20" aria-hidden />;
}

// ── FloatingToolbar ───────────────────────────────────────────────────────────
export function FloatingToolbar({
  canUndo, canRedo, canCopy, canPaste, canDelete,
  onUndo, onRedo, onCopy, onPaste, onDelete,
  onZoomIn, onZoomOut, onResetZoom, zoomLevel,
}: FloatingToolbarProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-0.5 rounded-full px-2 py-1',
        'border border-white/20 bg-neutral-800/80 text-white shadow-lg backdrop-blur-md',
      )}
    >
      <ToolBtn icon={<ArrowCounterClockwiseIcon className="size-3.5" />} label="Undo" shortcut="⌘Z"   disabled={!canUndo}  onClick={onUndo}  />
      <ToolBtn icon={<ArrowClockwiseIcon        className="size-3.5" />} label="Redo" shortcut="⇧⌘Z"  disabled={!canRedo}  onClick={onRedo}  />

      <Divider />

      <ToolBtn icon={<CopyIcon          className="size-3.5" />} label="Copy"   shortcut="⌘C" disabled={!canCopy}   onClick={onCopy}   />
      <ToolBtn icon={<ClipboardTextIcon className="size-3.5" />} label="Paste"  shortcut="⌘V" disabled={!canPaste}  onClick={onPaste}  />
      <ToolBtn icon={<TrashIcon         className="size-3.5" />} label="Delete" shortcut="⌫"  disabled={!canDelete} onClick={onDelete} />

      <Divider />

      <ToolBtn icon={<MagnifyingGlassMinusIcon className="size-3.5" />} label="Zoom out" shortcut="−" disabled={false} onClick={onZoomOut} />
      <button
        onClick={onResetZoom}
        className="min-w-[38px] rounded px-1 text-center text-[10px] font-semibold tabular-nums hover:bg-white/20"
        title="Reset zoom"
      >
        {zoomLevel}%
      </button>
      <ToolBtn icon={<MagnifyingGlassPlusIcon className="size-3.5" />} label="Zoom in" shortcut="+" disabled={false} onClick={onZoomIn} />
    </div>
  );
}
