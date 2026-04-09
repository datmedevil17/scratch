'use client';

import { useState } from "react";
import {
  PencilSimple, Waveform, Database, Gear, Question,
  GridFour,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

import { ScratchHeader }    from "@/components/scratch/header";
import { BlockPalette }     from "@/components/scratch/block-palette";
import { Workspace }        from "@/components/scratch/workspace";
import { Stage }            from "@/components/scratch/stage";
import { SpritePanel }      from "@/components/scratch/sprite-panel";
import { CostumeEditor }    from "@/components/scratch/costume-editor";
import { SoundEditor }      from "@/components/scratch/sound-editor";
import { VariablesPanel }   from "@/components/scratch/variables-panel";
import { SettingsPanel }    from "@/components/scratch/settings-panel";
import { FloatingToolbar }  from "@/components/scratch/floating-toolbar";
import { AssetManager }     from "@/components/scratch/asset-manager";
import { HelpPanel }        from "@/components/scratch/help-panel";
import { type Sprite }      from "@/components/scratch/sprite-panel";

// ── Initial demo sprites ─────────────────────────────────────────────────────
const INITIAL_SPRITES: Sprite[] = [
  { id: 's1', name: 'Cat',     emoji: '🐱', x: 0,   y: 0,   size: 100, direction: 90, visible: true },
  { id: 's2', name: 'Balloon', emoji: '🎈', x: 60,  y: 40,  size: 80,  direction: 90, visible: true },
  { id: 's3', name: 'Car',     emoji: '🚗', x: -80, y: -30, size: 120, direction: 90, visible: true },
];

function uid() { return Math.random().toString(36).slice(2, 7); }

// ── Bottom tab type ───────────────────────────────────────────────────────────
type BottomTab = 'costumes' | 'sounds' | 'variables' | null;

// ── Bottom tab bar button ─────────────────────────────────────────────────────
function TabBtn({
  active, icon, label, onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {icon} {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [isRunning,   setIsRunning]   = useState(false);
  const [projectName, setProjectName] = useState("My First Project");
  const [user,        setUser]        = useState<{ name: string; avatar?: string } | null>(null);

  // Sprites
  const [sprites,     setSprites]     = useState<Sprite[]>(INITIAL_SPRITES);
  const [selectedSprite, setSelected] = useState<string | null>('s1');

  // Panels
  const [bottomTab,   setBottomTab]   = useState<BottomTab>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAssets,   setShowAssets]   = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);

  // Toolbar state (stub — real undo/redo wired via workspace context later)
  const [zoom, setZoom] = useState(100);

  // ── Sprite actions ────────────────────────────────────────────────────
  const addSprite = () => {
    const id = uid();
    setSprites((prev) => [...prev, {
      id, name: `Sprite${prev.length + 1}`, emoji: '⭐',
      x: 0, y: 0, size: 100, direction: 90, visible: true,
    }]);
    setSelected(id);
  };

  const deleteSprite = (id: string) => {
    setSprites((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (selectedSprite === id) setSelected(next[0]?.id ?? null);
      return next;
    });
  };

  const duplicateSprite = (id: string) => {
    setSprites((prev) => {
      const src = prev.find((s) => s.id === id);
      if (!src) return prev;
      const copy = { ...src, id: uid(), name: src.name + ' copy', x: src.x + 10, y: src.y + 10 };
      return [...prev, copy];
    });
  };

  const toggleVisible = (id: string) =>
    setSprites((prev) => prev.map((s) => s.id === id ? { ...s, visible: !s.visible } : s));

  const updateProp = (id: string, prop: Partial<Omit<Sprite, 'id' | 'name' | 'emoji'>>) =>
    setSprites((prev) => prev.map((s) => s.id === id ? { ...s, ...prop } : s));

  // ── Bottom tab toggle ─────────────────────────────────────────────────
  const toggleTab = (tab: BottomTab) =>
    setBottomTab((prev) => prev === tab ? null : tab);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <ScratchHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        isRunning={isRunning}
        onRun={() => setIsRunning(true)}
        onStop={() => setIsRunning(false)}
        onNew={() => { setProjectName("Untitled Project"); setIsRunning(false); }}
        onSave={() => alert("Save triggered")}
        onLoad={() => alert("Load triggered")}
        onExport={() => alert("Export triggered")}
        onFullscreen={() => document.documentElement.requestFullscreen?.()}
        onShare={() => alert("Share triggered")}
        user={user}
        onLogin={() => setUser({ name: "ScratchDev" })}
        onLogout={() => setUser(null)}
      />

      {/* ── Main editor row ─────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 overflow-hidden">

        {/* Block palette */}
        <BlockPalette />

        {/* Centre column: workspace + bottom tabs */}
        <div className="relative flex min-w-0 flex-1 flex-col">

          {/* Floating toolbar — sits above the workspace */}
          <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
            <FloatingToolbar
              canUndo={false}  canRedo={false}
              canCopy={false}  canPaste={false}  canDelete={false}
              onUndo={() => {}} onRedo={() => {}}
              onCopy={() => {}} onPaste={() => {}} onDelete={() => {}}
              onZoomIn={() => setZoom((z) => Math.min(250, z + 15))}
              onZoomOut={() => setZoom((z) => Math.max(25, z - 15))}
              onResetZoom={() => setZoom(100)}
              zoomLevel={zoom}
            />
          </div>

          {/* Workspace canvas */}
          <Workspace />

          {/* Bottom tab bar */}
          <div className="flex shrink-0 items-center border-t border-border bg-white dark:bg-neutral-900">
            <TabBtn active={bottomTab === 'costumes'}  icon={<PencilSimple className="size-3.5" />} label="Costumes"  onClick={() => toggleTab('costumes')}  />
            <TabBtn active={bottomTab === 'sounds'}    icon={<Waveform     className="size-3.5" />} label="Sounds"    onClick={() => toggleTab('sounds')}    />
            <TabBtn active={bottomTab === 'variables'} icon={<Database     className="size-3.5" />} label="Variables" onClick={() => toggleTab('variables')} />
            <div className="ml-auto flex items-center gap-0.5 pr-1">
              <button onClick={() => setShowAssets(true)}    title="Assets"   className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"><GridFour className="size-3.5" /></button>
              <button onClick={() => setShowSettings(true)}  title="Settings" className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"><Gear     className="size-3.5" /></button>
              <button onClick={() => setShowHelp((v) => !v)} title="Help"     className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"><Question className="size-3.5" /></button>
            </div>
          </div>

          {/* Bottom panel */}
          {bottomTab && (
            <div className="h-56 shrink-0 overflow-hidden border-t border-border">
              {bottomTab === 'costumes'  && <CostumeEditor />}
              {bottomTab === 'sounds'    && <SoundEditor />}
              {bottomTab === 'variables' && <VariablesPanel />}
            </div>
          )}
        </div>

        {/* Right column: Stage + Sprite panel */}
        <div className="flex w-[360px] shrink-0 flex-col border-l border-border">
          <Stage
            isRunning={isRunning}
            onRun={() => setIsRunning(true)}
            onStop={() => setIsRunning(false)}
          />
          {/* Sprite panel fills remaining height */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <SpritePanel
              sprites={sprites}
              selectedId={selectedSprite}
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

        {/* Help panel (absolute right drawer) */}
        <div className="relative">
          <HelpPanel open={showHelp} onClose={() => setShowHelp(false)} />
        </div>

      </main>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <AssetManager  open={showAssets}   onClose={() => setShowAssets(false)}   />
    </div>
  );
}
