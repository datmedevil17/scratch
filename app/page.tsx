'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CodeIcon,
  PencilSimpleIcon,
  WaveformIcon,
  GearIcon,
  QuestionIcon,
  GridFourIcon,
  CaretLeftIcon,
  CaretRightIcon,
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
import { ScratchRuntime }  from "@/lib/scratch/runtime";
import { type Script }     from "@/lib/scratch/types";

type WorkspaceTab = 'code' | 'costumes' | 'sounds';

const INITIAL_BG = '/Backgrounds/background_color_desert.svg';

const INITIAL_SPRITES: Sprite[] = [
  {
    id: 's1', name: 'character_beige_climb_b',
    emoji: '👤', imageUrl: '/Characters/character_beige_climb_b.svg',
    x: 0, y: 0, size: 100, direction: 90, visible: true,
  },
  {
    id: 's2', name: 'bee_a',
    emoji: '🐝', imageUrl: '/Enemies/bee_a.svg',
    x: 80, y: 60, size: 80, direction: 90, visible: true,
  },
  {
    id: 's3', name: 'fish_blue_rest',
    emoji: '🐟', imageUrl: '/Enemies/fish_blue_rest.svg',
    x: -100, y: -50, size: 90, direction: 90, visible: true,
  },
];

function uid() { return Math.random().toString(36).slice(2, 7); }

function WorkspaceTabBtn({
  active, icon, label, accent, onClick,
}: {
  active: boolean; icon: React.ReactNode; label: string; accent?: string; onClick: () => void;
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

export default function Home() {
  const [isRunning,    setIsRunning]    = useState(false);
  const [projectName,  setProjectName]  = useState('My First Project');
  const [user,         setUser]         = useState<{ name: string; avatar?: string } | null>(null);
  const [wsTab,        setWsTab]        = useState<WorkspaceTab>('code');
  const [sprites,      setSprites]      = useState<Sprite[]>(INITIAL_SPRITES);
  const [selectedSpriteId, setSelected] = useState<string | null>('s1');
  const [showSettings, setShowSettings] = useState(false);
  const [showAssets,   setShowAssets]   = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const [paletteOpen,  setPaletteOpen]  = useState(true);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(INITIAL_BG);
  // Asset to open in the costume editor (set by "Open in Editor" from asset manager)
  const [editorImage,  setEditorImage]  = useState<{ url: string; name: string } | null>(null);

  // ── Runtime (one singleton, lives as long as the page) ────────────────────
  const runtimeRef = useRef<ScratchRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = new ScratchRuntime();
  }
  const runtime = runtimeRef.current;

  // Keep runtime sprite list in sync with editor sprites
  useEffect(() => {
    runtime.syncSprites(sprites);
  }, [sprites, runtime]);

  // ── Per-sprite script storage: spriteId → Script[] ────────────────────────
  const allScripts = useRef<Map<string, Script[]>>(new Map());

  const handleScriptsChange = useCallback((spriteId: string, scripts: Script[]) => {
    allScripts.current.set(spriteId, scripts);
    runtime.setScripts(spriteId, scripts);
  }, [runtime]);

  // ── Run / Stop ─────────────────────────────────────────────────────────────
  const handleRun = useCallback(() => {
    runtime.syncSprites(sprites);
    // Push all current scripts into the runtime before starting
    for (const [sid, scripts] of allScripts.current) {
      runtime.setScripts(sid, scripts);
    }
    runtime.greenFlag();
    setIsRunning(true);
  }, [runtime, sprites]);

  const handleStop = useCallback(() => {
    runtime.stopAll();
    setIsRunning(false);
  }, [runtime]);

  // ── Save / Load ────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const data = {
      projectName,
      sprites,
      scripts: Object.fromEntries(allScripts.current),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.scratch.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectName, sprites]);

  const handleLoad = useCallback(() => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target!.result as string);
          if (data.projectName) setProjectName(data.projectName);
          if (data.sprites)     setSprites(data.sprites);
          if (data.scripts) {
            allScripts.current = new Map(Object.entries(data.scripts));
            for (const [sid, scripts] of allScripts.current) {
              runtime.setScripts(sid, scripts as Script[]);
            }
          }
          setIsRunning(false);
          runtime.stopAll();
        } catch {
          alert('Invalid project file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [runtime]);

  // ── Sprite actions ─────────────────────────────────────────────────────────
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
    allScripts.current.delete(id);
    runtime.setScripts(id, []);
  };

  const duplicateSprite = (id: string) => {
    setSprites(prev => {
      const src = prev.find(s => s.id === id);
      if (!src) return prev;
      const copy = { ...src, id: uid(), name: src.name + ' copy', x: src.x + 10, y: src.y + 10 };
      // Also copy scripts
      const srcScripts = allScripts.current.get(id) ?? [];
      allScripts.current.set(copy.id, JSON.parse(JSON.stringify(srcScripts)));
      return [...prev, copy];
    });
  };

  const toggleVisible = (id: string) =>
    setSprites(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));

  const updateProp = (id: string, prop: Partial<Omit<Sprite, 'id' | 'name' | 'emoji'>>) =>
    setSprites(prev => prev.map(s => s.id === id ? { ...s, ...prop } : s));

  const activeSpriteId = selectedSpriteId ?? sprites[0]?.id ?? '';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#111] text-white">

      <ScratchHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onNew={() => {
          handleStop();
          setProjectName('Untitled Project');
          setSprites(INITIAL_SPRITES);
          setBackgroundUrl(INITIAL_BG);
          allScripts.current = new Map();
        }}
        onSave={handleSave}
        onLoad={handleLoad}
        onExport={handleSave}
        onFullscreen={() => document.documentElement.requestFullscreen?.()}
        onShare={() => alert('Share not yet implemented')}
        user={user}
        onLogin={() => setUser({ name: 'ScratchDev' })}
        onLogout={() => setUser(null)}
      />

      {/* ── Workspace tab bar ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-end border-b border-white/10 bg-[#1a1a1a] px-2">
        <WorkspaceTabBtn active={wsTab === 'code'}     icon={<CodeIcon         className="size-3.5" />} label="Code"     accent="text-blue-400 border-blue-400"     onClick={() => setWsTab('code')} />
        <WorkspaceTabBtn active={wsTab === 'costumes'} icon={<PencilSimpleIcon className="size-3.5" />} label="Costumes" accent="text-[#ff4466] border-[#ff4466]"   onClick={() => setWsTab('costumes')} />
        <WorkspaceTabBtn active={wsTab === 'sounds'}   icon={<WaveformIcon     className="size-3.5" />} label="Sounds"   accent="text-[#ff4466] border-[#ff4466]"   onClick={() => setWsTab('sounds')} />

        <div className="ml-auto flex items-center gap-0.5 pb-1 pr-1">
          <button onClick={() => setShowAssets(true)}    title="Assets"   className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"><GridFourIcon  className="size-3.5" /></button>
          <button onClick={() => setShowSettings(true)}  title="Settings" className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"><GearIcon      className="size-3.5" /></button>
          <button onClick={() => setShowHelp(v => !v)}   title="Help"     className="flex size-7 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white"><QuestionIcon  className="size-3.5" /></button>
        </div>
      </div>

      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 overflow-hidden">

        {/* LEFT / CENTRE */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {wsTab === 'code' && (
            <>
              {/* Collapsible palette */}
              <div
                className={cn(
                  'relative flex shrink-0 overflow-hidden transition-all duration-200',
                  paletteOpen ? 'w-80' : 'w-0',
                )}
              >
                <BlockPalette />
              </div>

              {/* Toggle tab */}
              <button
                onClick={() => setPaletteOpen(v => !v)}
                title={paletteOpen ? 'Close palette' : 'Open palette'}
                className="relative z-10 flex w-4 shrink-0 items-center justify-center bg-[#1a1a1a] hover:bg-white/10 border-x border-white/10 transition-colors"
              >
                {paletteOpen
                  ? <CaretLeftIcon  className="size-3 text-white/50" />
                  : <CaretRightIcon className="size-3 text-white/50" />}
              </button>

              <div className="relative flex min-w-0 flex-1 flex-col">
                <Workspace
                  initialScripts={allScripts.current.get(activeSpriteId) ?? []}
                  onScriptsChange={(scripts) => handleScriptsChange(activeSpriteId, scripts)}
                />
              </div>
            </>
          )}
          {wsTab === 'costumes' && (
            <CostumeEditor
              externalImageUrl={editorImage?.url}
              externalImageName={editorImage?.name}
            />
          )}
          {wsTab === 'sounds'   && <SoundEditor />}
        </div>

        {/* RIGHT: Stage + Sprite panel */}
        <div className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#111]">
          <Stage
            isRunning={isRunning}
            onRun={handleRun}
            onStop={handleStop}
            runtime={runtime}
            backgroundUrl={backgroundUrl}
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
              backgroundUrl={backgroundUrl}
              onChangeBackground={() => setShowAssets(true)}
            />
          </div>
        </div>

        <HelpPanel open={showHelp} onClose={() => setShowHelp(false)} />
      </main>

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <AssetManager
        open={showAssets}
        onClose={() => setShowAssets(false)}
        onUse={(_assetId, type, meta) => {
          if (type === 'sprites') {
            const id = uid();
            setSprites(prev => [...prev, {
              id,
              name:     meta?.name ?? 'Sprite',
              emoji:    '⭐',
              imageUrl: meta?.url,
              x: 0, y: 0, size: 100, direction: 90, visible: true,
            }]);
            setSelected(id);
          } else if (type === 'backdrops') {
            setBackgroundUrl(meta?.url ?? null);
          }
        }}
        onOpenInEditor={(url, name) => {
          // Switch to Costumes tab and load the asset into the editor
          setEditorImage({ url, name });
          setWsTab('costumes');
          // Reset after a tick so re-selecting the same asset fires the effect again
          setTimeout(() => setEditorImage(null), 500);
        }}
      />
    </div>
  );
}
