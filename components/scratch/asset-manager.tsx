'use client';

import { useState } from "react";
import {
  MagnifyingGlass, Upload, Smiley, Image, Waveform, Plus, Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────
type AssetType = 'sprites' | 'backgrounds' | 'sounds';

interface Asset {
  id:    string;
  name:  string;
  type:  AssetType;
  emoji: string;  // placeholder thumbnail
}

const DEMO_ASSETS: Asset[] = [
  { id: 'a1',  type: 'sprites',     emoji: '🐱', name: 'Cat'         },
  { id: 'a2',  type: 'sprites',     emoji: '🐶', name: 'Dog'         },
  { id: 'a3',  type: 'sprites',     emoji: '🚗', name: 'Car'         },
  { id: 'a4',  type: 'sprites',     emoji: '⭐', name: 'Star'        },
  { id: 'a5',  type: 'sprites',     emoji: '🎈', name: 'Balloon'     },
  { id: 'a6',  type: 'sprites',     emoji: '🦋', name: 'Butterfly'   },
  { id: 'a7',  type: 'backgrounds', emoji: '🌅', name: 'Sunset'      },
  { id: 'a8',  type: 'backgrounds', emoji: '🌃', name: 'City Night'  },
  { id: 'a9',  type: 'backgrounds', emoji: '🌊', name: 'Ocean'       },
  { id: 'a10', type: 'backgrounds', emoji: '🏔️', name: 'Mountain'    },
  { id: 'a11', type: 'sounds',      emoji: '🎵', name: 'pop.wav'     },
  { id: 'a12', type: 'sounds',      emoji: '🎵', name: 'meow.wav'    },
  { id: 'a13', type: 'sounds',      emoji: '🥁', name: 'drum.wav'    },
];

const TAB_ICONS: Record<AssetType, React.ReactNode> = {
  sprites:     <Smiley  className="size-3.5" />,
  backgrounds: <Image   className="size-3.5" />,
  sounds:      <Waveform className="size-3.5" />,
};

// ── AssetCard ────────────────────────────────────────────────────────────────
function AssetCard({
  asset, onUse, onDelete,
}: {
  asset: Asset;
  onUse: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="group relative rounded-lg border border-border bg-background transition-shadow hover:shadow-md"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-scratch-asset', JSON.stringify({ id: asset.id, type: asset.type }));
      }}
    >
      {/* Thumbnail */}
      <div className="flex aspect-square items-center justify-center rounded-t-lg bg-muted text-3xl">
        {asset.emoji}
      </div>

      {/* Name */}
      <p className="truncate px-1.5 pb-1.5 pt-1 text-[10px] text-center font-medium">
        {asset.name}
      </p>

      {/* Hover overlay */}
      {hover && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-black/40">
          <button
            onClick={onUse}
            className="rounded bg-white px-2.5 py-1 text-[10px] font-semibold text-black hover:bg-gray-100"
          >
            Use
          </button>
          <button
            onClick={onDelete}
            className="flex size-5 items-center justify-center rounded bg-red-500 text-white"
          >
            <Trash className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── AssetManager ──────────────────────────────────────────────────────────────
export interface AssetManagerProps {
  open:    boolean;
  onClose: () => void;
  onUse?:  (assetId: string, type: AssetType) => void;
}

export function AssetManager({ open, onClose, onUse }: AssetManagerProps) {
  const [tab,    setTab]    = useState<AssetType>('sprites');
  const [query,  setQuery]  = useState('');
  const [assets, setAssets] = useState<Asset[]>(DEMO_ASSETS);

  const visible = assets.filter(
    (a) => a.type === tab && a.name.toLowerCase().includes(query.toLowerCase()),
  );

  const deleteAsset = (id: string) => setAssets((prev) => prev.filter((a) => a.id !== id));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asset Manager</DialogTitle>
        </DialogHeader>

        {/* Tabs + search */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <div className="flex gap-1">
            {(['sprites', 'backgrounds', 'sounds'] as AssetType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  tab === t
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {TAB_ICONS[t]} {t}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5">
            <MagnifyingGlass className="size-3 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-28 bg-transparent text-xs outline-none"
            />
          </div>

          <button className="flex items-center gap-1 rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-600">
            <Upload className="size-3" weight="bold" /> Upload
          </button>
        </div>

        {/* Grid */}
        {visible.length > 0 ? (
          <div className="grid max-h-[320px] grid-cols-5 gap-2 overflow-y-auto pr-1">
            {visible.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onUse={() => { onUse?.(asset.id, asset.type); onClose(); }}
                onDelete={() => deleteAsset(asset.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No {tab} found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
