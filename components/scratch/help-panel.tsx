'use client';

import { useState } from "react";
import {
  Question, X, ArrowRight, ArrowLeft, Lightbulb, BookOpen, Checks,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Tutorial data ─────────────────────────────────────────────────────────────
interface TutorialStep {
  title:     string;
  body:      string;
  highlight?: string;   // CSS selector hint for future product-tour integration
}

interface Tutorial {
  id:    string;
  title: string;
  icon:  string;
  steps: TutorialStep[];
}

const TUTORIALS: Tutorial[] = [
  {
    id: 'move-sprite',
    title: 'Move a Sprite',
    icon: '🏃',
    steps: [
      { title: 'Select Motion blocks', body: 'Click the blue "Motion" category in the block palette on the left.', highlight: '#motion-tab' },
      { title: 'Drag "move 10 steps"', body: 'Drag the "move 10 steps" block onto the workspace canvas in the center.', highlight: '#m1' },
      { title: 'Add a trigger', body: 'Go to Events and drag "when 🚩 clicked" above your move block.', highlight: '#ev1' },
      { title: 'Click Run', body: 'Press the green flag ▶ in the header or the stage controls to run your script!', highlight: '#run-button' },
    ],
  },
  {
    id: 'say-hello',
    title: 'Make a Sprite Talk',
    icon: '💬',
    steps: [
      { title: 'Open Looks', body: 'Click the purple "Looks" category in the block palette.' },
      { title: 'Drag "say Hello!"', body: 'Drag the "say Hello! for 2 seconds" block to the workspace.' },
      { title: 'Add green flag', body: 'Add "when 🚩 clicked" from Events above it.' },
      { title: 'Run!', body: 'Click the green flag. Your sprite will show a speech bubble!' },
    ],
  },
  {
    id: 'forever-loop',
    title: 'Create a Loop',
    icon: '🔁',
    steps: [
      { title: 'Grab "forever"', body: 'In Control (orange), find the "forever" block and drag it to the workspace.' },
      { title: 'Nest a block inside', body: 'Drag "move 10 steps" into the gap inside the forever loop.' },
      { title: 'Add bounce', body: 'From Motion, add "if on edge, bounce" inside the loop too.' },
      { title: 'Trigger and run', body: 'Add "when 🚩 clicked" on top and run. The sprite will bounce forever!' },
    ],
  },
];

// ── TipBubble ─────────────────────────────────────────────────────────────────
// A floating tooltip-style tip shown over the workspace
export function TipBubble({ tip, onDismiss }: { tip: string; onDismiss: () => void }) {
  return (
    <div className="pointer-events-auto flex max-w-[220px] items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2.5 shadow-lg dark:border-yellow-800 dark:bg-yellow-950/40">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-yellow-500" weight="fill" />
      <p className="flex-1 text-[11px] leading-relaxed text-yellow-900 dark:text-yellow-100">{tip}</p>
      <button onClick={onDismiss} className="mt-0.5 shrink-0">
        <X className="size-3 text-yellow-500" />
      </button>
    </div>
  );
}

// ── HelpPanel ─────────────────────────────────────────────────────────────────
export interface HelpPanelProps {
  open:    boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [step,           setStep]           = useState(0);
  const [completed,      setCompleted]      = useState<Set<string>>(new Set());

  if (!open) return null;

  function startTutorial(t: Tutorial) {
    setActiveTutorial(t);
    setStep(0);
  }

  function nextStep() {
    if (!activeTutorial) return;
    if (step < activeTutorial.steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      setCompleted((prev) => new Set(prev).add(activeTutorial.id));
      setActiveTutorial(null);
      setStep(0);
    }
  }

  function prevStep() { setStep((s) => Math.max(0, s - 1)); }

  return (
    <div className="absolute right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-border bg-white shadow-xl dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-4 text-blue-500" />
          <span className="text-sm font-semibold">Help & Tutorials</span>
        </div>
        <button onClick={onClose} className="flex size-6 items-center justify-center rounded hover:bg-muted">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      {activeTutorial ? (
        /* ── Active tutorial ─────────────────────────────────────── */
        <div className="flex flex-1 flex-col p-4">
          {/* Progress dots */}
          <div className="mb-4 flex items-center gap-1.5">
            {activeTutorial.steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i < step     ? 'w-4 bg-blue-400'
                    : i === step ? 'w-4 bg-blue-600'
                    : 'w-1.5 bg-muted',
                )}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Step {step + 1} of {activeTutorial.steps.length}
            </p>
            <h3 className="mb-2 text-sm font-bold">{activeTutorial.steps[step].title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {activeTutorial.steps[step].body}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={() => setActiveTutorial(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Exit
            </button>
            <div className="flex flex-1 justify-end gap-2">
              {step > 0 && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  <ArrowLeft className="size-3" /> Back
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
              >
                {step < activeTutorial.steps.length - 1 ? (
                  <><span>Next</span><ArrowRight className="size-3" /></>
                ) : (
                  <><Checks className="size-3" /><span>Done!</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Tutorial list ───────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto">
          {/* Quick tips */}
          <div className="border-b border-border p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Tips</p>
            <div className="space-y-2">
              {[
                'Drag blocks from the left palette onto the canvas.',
                'Right-click a script for Duplicate / Delete.',
                'Scroll to zoom, space+drag to pan.',
                'Drop blocks on the trash icon to delete.',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Lightbulb className="mt-0.5 size-3 shrink-0 text-yellow-400" weight="fill" />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tutorials */}
          <div className="p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tutorials</p>
            <div className="space-y-2">
              {TUTORIALS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startTutorial(t)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="text-xl">{t.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">{t.steps.length} steps</p>
                  </div>
                  {completed.has(t.id) && (
                    <Checks className="size-4 text-green-500" weight="bold" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
