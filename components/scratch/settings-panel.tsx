'use client';

import { useState, useEffect } from "react";
import { XIcon, ToggleLeftIcon, ToggleRightIcon, GlobeIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────
export interface EditorSettings {
  theme:     'light' | 'dark' | 'system';
  grid:      boolean;
  snapGrid:  number;   // px
  language:  string;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme:    'system',
  grid:     true,
  snapGrid: 10,
  language: 'en',
};

const LANGUAGES = [
  { code: 'en', label: 'English'  },
  { code: 'es', label: 'Español'  },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch'  },
  { code: 'zh', label: '中文'      },
  { code: 'ja', label: '日本語'    },
  { code: 'ko', label: '한국어'    },
  { code: 'pt', label: 'Português' },
];

const STORAGE_KEY = 'scratch-editor-settings';

function load(): EditorSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: EditorSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center">
      {on
        ? <ToggleRightIcon className="size-6 text-blue-500" weight="fill" />
        : <ToggleLeftIcon  className="size-6 text-muted-foreground" weight="fill" />}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ── SettingsPanel (Dialog) ────────────────────────────────────────────────────
export interface SettingsPanelProps {
  open:    boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<EditorSettings>(load);

  // Persist on every change
  useEffect(() => { save(settings); }, [settings]);

  function set<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="size-4" /> Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Theme */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appearance</span>
            <Row label="Theme">
              <div className="flex rounded border border-border overflow-hidden">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => set('theme', t)}
                    className={cn(
                      'px-2.5 py-1 text-xs capitalize transition-colors',
                      settings.theme === t
                        ? 'bg-foreground text-background'
                        : 'hover:bg-muted',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Row>
          </div>

          {/* Workspace */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Workspace</span>
            <Row label="Show grid">
              <Toggle on={settings.grid} onToggle={() => set('grid', !settings.grid)} />
            </Row>
            <Row label="Snap distance">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={4} max={40} step={2}
                  value={settings.snapGrid}
                  onChange={(e) => set('snapGrid', Number(e.target.value))}
                  className="w-28 accent-blue-500"
                  disabled={!settings.grid}
                />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {settings.snapGrid}px
                </span>
              </div>
            </Row>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Language</span>
            <Row label="Interface language">
              <div className="flex items-center gap-1.5">
                <GlobeIcon className="size-3.5 text-muted-foreground" />
                <select
                  value={settings.language}
                  onChange={(e) => set('language', e.target.value)}
                  className="rounded border border-input bg-background py-0.5 pl-1.5 pr-6 text-xs outline-none focus:border-ring"
                >
                  {LANGUAGES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </Row>
          </div>

          {/* Reset */}
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="mt-1 w-full rounded border border-border py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Reset to defaults
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
