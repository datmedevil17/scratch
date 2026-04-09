'use client';

import { useState } from "react";
import { PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface ScratchVariable {
  id:      string;
  name:    string;
  value:   number | string;
  global:  boolean;
  visible: boolean;
}

export interface ScratchList {
  id:      string;
  name:    string;
  items:   string[];
  visible: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 7); }

// ── VariablesPanel ───────────────────────────────────────────────────────────
export function VariablesPanel() {
  const [variables, setVariables] = useState<ScratchVariable[]>([
    { id: 'v1', name: 'score',  value: 0,   global: true,  visible: true  },
    { id: 'v2', name: 'health', value: 100, global: true,  visible: true  },
    { id: 'v3', name: 'lives',  value: 3,   global: false, visible: false },
  ]);
  const [lists, setLists] = useState<ScratchList[]>([
    { id: 'l1', name: 'items', items: ['sword', 'shield'], visible: false },
  ]);
  const [tab, setTab] = useState<'vars' | 'lists'>('vars');
  const [newVarName, setNewVarName] = useState('');
  const [newListName, setNewListName] = useState('');

  const addVariable = () => {
    const name = newVarName.trim();
    if (!name) return;
    setVariables((prev) => [...prev, { id: uid(), name, value: 0, global: true, visible: false }]);
    setNewVarName('');
  };

  const deleteVariable = (id: string) => setVariables((prev) => prev.filter((v) => v.id !== id));
  const toggleVarVisible = (id: string) =>
    setVariables((prev) => prev.map((v) => v.id === id ? { ...v, visible: !v.visible } : v));

  const addList = () => {
    const name = newListName.trim();
    if (!name) return;
    setLists((prev) => [...prev, { id: uid(), name, items: [], visible: false }]);
    setNewListName('');
  };

  const deleteList = (id: string) => setLists((prev) => prev.filter((l) => l.id !== id));
  const toggleListVisible = (id: string) =>
    setLists((prev) => prev.map((l) => l.id === id ? { ...l, visible: !l.visible } : l));

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['vars', 'lists'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-semibold capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-orange-400 text-orange-600'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'vars' ? 'Variables' : 'Lists'}
          </button>
        ))}
      </div>

      {tab === 'vars' && (
        <>
          {/* Variable list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {variables.map((v) => (
              <div
                key={v.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-scratch-variable', v.name);
                }}
                className="group flex cursor-grab items-center gap-2 rounded-md border border-transparent bg-orange-50 px-2 py-1.5 transition-colors hover:border-orange-200 dark:bg-orange-950/20"
              >
                {/* Badge */}
                <span className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {String(v.value)}
                </span>
                <span className="flex-1 truncate text-xs font-medium">{v.name}</span>
                {v.global
                  ? <span className="rounded bg-orange-100 px-1 text-[9px] text-orange-500 dark:bg-orange-950">global</span>
                  : <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">local</span>}
                <button onClick={() => toggleVarVisible(v.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                  {v.visible
                    ? <EyeIcon     className="size-3 text-muted-foreground" />
                    : <EyeSlashIcon className="size-3 text-muted-foreground/40" />}
                </button>
                <button onClick={() => deleteVariable(v.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                  <TrashIcon className="size-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>

          {/* Add variable */}
          <div className="border-t border-border px-2 py-2">
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Variable name"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addVariable()}
                className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs outline-none focus:border-orange-400"
              />
              <button
                onClick={addVariable}
                className="flex size-7 items-center justify-center rounded bg-orange-400 text-white hover:bg-orange-500"
              >
                <PlusIcon className="size-3.5" weight="bold" />
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'lists' && (
        <>
          {/* List items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {lists.map((l) => (
              <div key={l.id} className="group rounded-md border border-border bg-background p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="flex-1 truncate text-xs font-semibold">{l.name}</span>
                  <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">{l.items.length}</span>
                  <button onClick={() => toggleListVisible(l.id)}>
                    {l.visible
                      ? <EyeIcon     className="size-3 text-muted-foreground" />
                      : <EyeSlashIcon className="size-3 text-muted-foreground/40" />}
                  </button>
                  <button onClick={() => deleteList(l.id)}>
                    <TrashIcon className="size-3 text-destructive" />
                  </button>
                </div>
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {l.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <span className="w-4 shrink-0 text-right text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 truncate rounded bg-muted px-1 py-0.5">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Add list */}
          <div className="border-t border-border px-2 py-2">
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="List name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addList()}
                className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs outline-none focus:border-orange-400"
              />
              <button
                onClick={addList}
                className="flex size-7 items-center justify-center rounded bg-orange-400 text-white hover:bg-orange-500"
              >
                <PlusIcon className="size-3.5" weight="bold" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
