'use client';

import { useState } from "react";
import {
  Code as CodeIcon, PencilSimple as PencilSimpleIcon, Waveform as WaveformIcon,
  Gear as GearIcon, Question as QuestionIcon, GridFour as GridFourIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

import { ScratchHeader }   from "@/components/scratch/header";
import { BlockPalette }    from "@/components/scratch/block-palette";
import { Workspace }       from "@/components/scratch/workspace";
import { Stage }           from "@/components/scratch/stage";
import { SpritePanel }     from "@/components/scratch/sprite-panel";
import { CostumeEditor }   from "@/components/scratch/costume-editor";
import { SoundEditor }     from "@/components/scratch/sound-editor";
import { SettingsPanel }   from "@/components/scratch/settings-panel";
import { AssetManager }    from "@/components/scratch/asset-manager";
import { HelpPanel }       from "@/components/scratch/help-panel";
import { type Sprite }     from "@/components/scratch/sprite-panel";

// ── Types ─────────────────────────────────────────────────────────────────────
type WorkspaceTab = 'code' | 'costumes' | 'sounds';

// ── Demo data ─────────────────────────────────────────────────────────────────
const INITIAL_SPRITES: Sprite[] = [
  { id: 's1', name: 'Cat',     emoji: '🐱', x: 0,   y: 0,   size: 100, direction: 90, visible: true },
  { id: 's2', name: 'Balloon', emoji: '🎈', x: 60,  y: 40,  size: 80,  direction: 90, visible: true },
  { id: 's3', name: 'Car',     emoji: '🚗', x: -80, y: -30, size: 120, direction: 90, visible: true },
];

function uid() { return Math.random().toString(36).slice(2, 7); }

// ── Top workspace tab button ──────────────────────────────────────────────────
function WorkspaceTabBtn({
  active, icon, label, accent, onClick,
}: {
  active:  boolean;
  icon:    React.ReactNode;
  label:   string;
  accent?: string;   // Tailwind text color class for active state
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-4 py-2 text-[12px] font-semibold transition-colors',
        active
          ? cn('border-current', accent ?? 'text-blue-500 border-blue-500')
          : 'border-transparent text-white/50 hover:text-white/80',
      )}
    >
      {icon} {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [isRunning,    setIsRunning]    = useState(false);
  const [projectName,  setProjectName]  = useState('My First Project');
  const [user,         setUser]         = useState<{ name: string; avatar?: string } | null>(null);

  // Workspace tab
  const [wsTab,        setWsTab]        = useState<WorkspaceTab>('code');

  // Sprites
  const [sprites,      setSprites]      = useState<Sprite[]>(INITIAL_SPRITES);
  const [selectedSpriteId, setSelected] = useState<string | null>('s1');

  const [showSettings, setShowSettings] = useState(false);
  const [showAssets,   setShowAssets]   = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);

  // ── Sprite actions ─────────────────────────────────────────────────────
  const addSprite = () => {
    const id = uid();
    setSprites(prev => [...prev, {
      id, name: `Sprite${prev.length + 1}`, emoji: '⭐',
      x: 0, y: 0, size: 100, direction: 90, visible: true,
    }]);
    setSelected(id);
  };

  const deleteSprite = (id: string) => {
    setSprites(prev => {
      const next = prev.filter(s => s.id !== id);
      if (selectedSpriteId === id) setSelected(next[0]?.id ?? null);
      return next;
    });
  };

  const duplicateSprite = (id: string) => {
    setSprites(prev => {
      const src = prev.find(s => s.id === id);
      if (!src) return prev;
      const copy = { ...src, id: uid(), name: src.name + ' copy', x: src.x + 10, y: src.y + 10 };
      return [...prev, copy];
    });
  };

  const toggleVisible = (id: string) =>
    setSprites(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));

  const updateProp = (id: string, prop: Partial<Omit<Sprite, 'id' | 'name' | 'emoji'>>) =>
    setSprites(prev => prev.map(s => s.id === id ? { ...s, ...prop } : s));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#111] text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <ScratchHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        isRunning={isRunning}
        onRun={() => setIsRunning(true)}
        onStop={() => setIsRunning(false)}
        onNew={() => { setProjectName('Untitled Project'); setIsRunning(false); }}
        onSave={() => alert('Save triggered')}
        onLoad={() => alert('Load triggered')}
        onExport={() => alert('Export triggered')}
        onFullscreen={() => document.documentElement.requestFullscreen?.()}
        onShare={() => alert('Share triggered')}
        user={user}
        onLogin={() => setUser({ name: 'ScratchDev' })}
        onLogout={() => setUser(null)}
      />

      {/* ── Workspace tab bar ────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-end border-b border-white/10 bg-[#1a1a1a] px-2">
        <WorkspaceTabBtn
          active={wsTab === 'code'}
          icon={<CodeIcon className="size-3.5" />}
          label="Code"
          accent="text-blue-400 border-blue-400"
          onClick={() => setWsTab('code')}
        />
        <WorkspaceTabBtn
          active={wsTab === 'costumes'}
          icon={<PencilSimpleIcon className="size-3.5" />}
          label="Costumes"
          accent="text-[#ff4466] border-[#ff4466]"
          onClick={() => setWsTab('costumes')}
        />
        <WorkspaceTabBtn
          active={wsTab === 'sounds'}
          icon={<WaveformIcon className="size-3.5" />}
          label="Sounds"
          accent="text-[#ff4466] border-[#ff4466]"
          onClick={() => setWsTab('sounds')}
        />

        {/* Right side: auxiliary buttons */}
        <div className="ml-auto flex items-center gap-0.5 pb-1 pr-1">
          <button onClick={() => setShowAssets(true)}   title="Assets"   className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white">
            <GridFourIcon className="size-3.5" />
          </button>
          <button onClick={() => setShowSettings(true)} title="Settings" className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white">
            <GearIcon className="size-3.5" />
          </button>
          <button onClick={() => setShowHelp(v => !v)}  title="Help"     className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white">
            <QuestionIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main editor row ──────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── LEFT / CENTRE: Workspace pane (switches by tab) ──────────── */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {wsTab === 'code' && (
            <>
              <BlockPalette />
              <div className="relative flex min-w-0 flex-1 flex-col">
                <Workspace />
              </div>
            </>
          )}

          {wsTab === 'costumes' && <CostumeEditor />}
          {wsTab === 'sounds'   && <SoundEditor />}
        </div>

        {/* ── RIGHT: Stage + Sprite panel ─────────────────────────────── */}
        <div className="flex w-[360px] shrink-0 flex-col border-l border-white/10">
          <Stage
            isRunning={isRunning}
            onRun={() => setIsRunning(true)}
            onStop={() => setIsRunning(false)}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <SpritePanel
              sprites={sprites}
              selectedId={selectedSpriteId}
              onSelect={setSelected}
              onAdd={addSprite}
              onUpload={() => setShowAssets(true)}
              onDelete={deleteSprite}
              onDuplicate={duplicateSprite}
              onToggleVisible={toggleVisible}
              onPropChange={updateProp}
            />
          </div>
        </div>

        {/* Help drawer */}
        <div className="absolute right-0 top-12 bottom-0 z-50">
          <HelpPanel open={showHelp} onClose={() => setShowHelp(false)} />
        </div>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <AssetManager  
        open={showAssets}   
        onClose={() => setShowAssets(false)}
        onUse={(assetId, type) => {
          if (type === 'sprites') {
             // Fake fetch from asset list - in real life we'd lookup by ID
             const nm = `Imported ${assetId}`;
             const id = uid();
             setSprites(prev => [...prev, {
                id, name: nm, emoji: '🪄',
                x: 0, y: 0, size: 100, direction: 90, visible: true
             }]);
             setSelected(id);
          }
        }}
      />
    </div>
  );
}
