'use client';

import { useState, useEffect } from "react";
import {
  FilePlus,
  FolderOpen,
  FloppyDisk,
  DownloadSimple,
  Play,
  Stop,
  ArrowsOut,
  ShareNetwork,
  User,
  SignOut,
  Gear,
  CaretDown,
  List,
  X,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────
   Scratch cat SVG logo (simplified)
───────────────────────────────────────── */
function ScratchCatLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="20" fill="#ff6680" />
      {/* body */}
      <ellipse cx="20" cy="26" rx="10" ry="9" fill="#ffab19" />
      {/* head */}
      <circle cx="20" cy="16" r="9" fill="#ffab19" />
      {/* ears */}
      <polygon points="13,10 11,4 17,9" fill="#ffab19" />
      <polygon points="27,10 29,4 23,9" fill="#ffab19" />
      {/* eyes */}
      <ellipse cx="17" cy="15" rx="2.2" ry="2.5" fill="white" />
      <ellipse cx="23" cy="15" rx="2.2" ry="2.5" fill="white" />
      <circle cx="17.5" cy="15.5" r="1.2" fill="#222" />
      <circle cx="23.5" cy="15.5" r="1.2" fill="#222" />
      {/* smile */}
      <path d="M17 19.5 Q20 22 23 19.5" stroke="#222" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* whiskers */}
      <line x1="9" y1="16" x2="14" y2="17" stroke="#a0522d" strokeWidth="0.8" />
      <line x1="9" y1="18" x2="14" y2="18" stroke="#a0522d" strokeWidth="0.8" />
      <line x1="31" y1="16" x2="26" y2="17" stroke="#a0522d" strokeWidth="0.8" />
      <line x1="31" y1="18" x2="26" y2="18" stroke="#a0522d" strokeWidth="0.8" />
    </svg>
  );
}

/* ─────────────────────────────────────────
   Types / props
───────────────────────────────────────── */
interface ScratchHeaderProps {
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
  isRunning?: boolean;
  onRun?: () => void;
  onStop?: () => void;
  onNew?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  onShare?: () => void;
  user?: { name: string; avatar?: string } | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export function ScratchHeader({
  projectName = "Untitled Project",
  onProjectNameChange,
  isRunning = false,
  onRun,
  onStop,
  onNew,
  onSave,
  onLoad,
  onExport,
  onFullscreen,
  onShare,
  user = null,
  onLogin,
  onLogout,
}: ScratchHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);

  // sync external changes
  useEffect(() => {
    setNameValue(projectName);
  }, [projectName]);

  function commitName() {
    setEditingName(false);
    const trimmed = nameValue.trim() || "Untitled Project";
    setNameValue(trimmed);
    onProjectNameChange?.(trimmed);
  }

  return (
    <header className="relative z-50 flex h-12 shrink-0 items-center border-b border-border bg-[#4c97ff] text-white shadow-md">
      {/* ── Left: Logo + File menu ───────────────────── */}
      <div className="flex items-center gap-1 px-2">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2 rounded-sm px-1.5 py-1 transition-colors hover:bg-white/20"
          aria-label="Scratch home"
        >
          <ScratchCatLogo />
          <span className="hidden text-sm font-bold tracking-wide sm:block">
            Scratch
          </span>
        </a>

        {/* File dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-white hover:bg-white/20 hover:text-white data-[state=open]:bg-white/20"
            >
              File
              <CaretDown className="size-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={onNew}>
              <FilePlus className="mr-2 size-4" />
              New
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLoad}>
              <FolderOpen className="mr-2 size-4" />
              Load from computer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSave}>
              <FloppyDisk className="mr-2 size-4" />
              Save to computer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <DownloadSimple className="mr-2 size-4" />
              Export project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Centre: Project name ─────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-2">
        {editingName ? (
          <Input
            id="project-name-input"
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setNameValue(projectName);
                setEditingName(false);
              }
            }}
            className="h-7 max-w-[200px] rounded border-white/40 bg-white/20 text-center text-sm font-medium text-white placeholder:text-white/60 focus-visible:ring-white/50"
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                id="project-name-display"
                onClick={() => setEditingName(true)}
                className="max-w-[200px] truncate rounded px-2 py-1 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                {nameValue}
              </button>
            </TooltipTrigger>
            <TooltipContent>Click to rename project</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Right: Controls ──────────────────────────── */}
      <div className="flex items-center gap-1 px-2">
        {/* Run / Stop — always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="run-button"
              variant="ghost"
              size="icon"
              aria-label="Run project"
              disabled={isRunning}
              onClick={onRun}
              className={cn(
                "size-8 rounded-full text-white transition-all hover:bg-white/20",
                !isRunning && "hover:scale-110 hover:bg-green-400/30",
                isRunning && "opacity-40"
              )}
            >
              <Play weight="fill" className="size-4 text-green-300" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run ▶</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="stop-button"
              variant="ghost"
              size="icon"
              aria-label="Stop project"
              disabled={!isRunning}
              onClick={onStop}
              className={cn(
                "size-8 rounded-full text-white transition-all hover:bg-white/20",
                isRunning && "hover:scale-110 hover:bg-red-400/30",
                !isRunning && "opacity-40"
              )}
            >
              <Stop weight="fill" className="size-4 text-red-300" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop ⬛</TooltipContent>
        </Tooltip>

        {/* Desktop-only controls */}
        <div className="hidden items-center gap-1 sm:flex">
          <div className="mx-1 h-5 w-px bg-white/30" aria-hidden="true" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id="fullscreen-button"
                variant="ghost"
                size="icon"
                aria-label="Toggle fullscreen"
                onClick={onFullscreen}
                className="size-8 text-white hover:bg-white/20"
              >
                <ArrowsOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fullscreen</TooltipContent>
          </Tooltip>

          <Button
            id="share-button"
            variant="ghost"
            size="sm"
            onClick={onShare}
            className="h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white"
          >
            <ShareNetwork className="size-4" />
            <span className="hidden md:inline">Share</span>
          </Button>

          <div className="mx-1 h-5 w-px bg-white/30" aria-hidden="true" />

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="user-menu-button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 text-white hover:bg-white/20 hover:text-white data-[state=open]:bg-white/20"
                >
                  <Avatar className="size-6">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-white/30 text-xs text-white">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[100px] truncate text-xs md:block">
                    {user.name}
                  </span>
                  <CaretDown className="size-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem>
                  <User className="mr-2 size-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Gear className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <SignOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              id="login-button"
              variant="ghost"
              size="sm"
              onClick={onLogin}
              className="h-8 gap-1.5 text-white hover:bg-white/20 hover:text-white"
            >
              <User className="size-4" />
              <span>Sign in</span>
            </Button>
          )}
        </div>

        {/* Mobile hamburger */}
        <Button
          id="mobile-menu-button"
          variant="ghost"
          size="icon"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className="size-8 text-white hover:bg-white/20 sm:hidden"
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <List className="size-5" />}
        </Button>
      </div>

      {/* ── Mobile dropdown panel ────────────────────── */}
      {mobileMenuOpen && (
        <div className="absolute inset-x-0 top-12 border-b border-white/20 bg-[#4c97ff] px-4 py-3 shadow-lg sm:hidden">
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onFullscreen?.(); setMobileMenuOpen(false); }}
              className="justify-start gap-2 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowsOut className="size-4" /> Fullscreen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onShare?.(); setMobileMenuOpen(false); }}
              className="justify-start gap-2 text-white hover:bg-white/20 hover:text-white"
            >
              <ShareNetwork className="size-4" /> Share
            </Button>
            <div className="h-px bg-white/20" />
            {user ? (
              <>
                <div className="flex items-center gap-2 py-1">
                  <Avatar className="size-7">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-white/30 text-xs text-white">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-white">{user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onLogout?.(); setMobileMenuOpen(false); }}
                  className="justify-start gap-2 text-red-200 hover:bg-white/20 hover:text-red-100"
                >
                  <SignOut className="size-4" /> Sign out
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onLogin?.(); setMobileMenuOpen(false); }}
                className="justify-start gap-2 text-white hover:bg-white/20 hover:text-white"
              >
                <User className="size-4" /> Sign in
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
