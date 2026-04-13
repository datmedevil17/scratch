/**
 * Global variable store — shared between the runtime, variable manager UI,
 * and stage watchers.
 *
 * Uses a simple event-emitter pattern so React components can subscribe
 * without needing Redux or a context provider.
 */

export type VarValue = number | string;

export interface VarEntry {
  name: string;
  value: VarValue;
  /** Whether the on-stage watcher is visible. */
  showWatcher: boolean;
}

type Listener = (vars: Map<string, VarEntry>) => void;

class VariableStore {
  private vars = new Map<string, VarEntry>();
  private listeners = new Set<Listener>();

  /** Create or reset a variable. */
  create(name: string, initial: VarValue = 0) {
    if (!this.vars.has(name)) {
      this.vars.set(name, { name, value: initial, showWatcher: false });
      this.emit();
    }
  }

  /** Delete a variable. */
  remove(name: string) {
    this.vars.delete(name);
    this.emit();
  }

  /** Set value (called by runtime). */
  set(name: string, value: VarValue) {
    const entry = this.vars.get(name);
    if (entry) {
      entry.value = value;
      this.emit();
    } else {
      this.vars.set(name, { name, value, showWatcher: false });
      this.emit();
    }
  }

  /** Change value by delta. */
  change(name: string, delta: number) {
    const entry = this.vars.get(name);
    const cur = entry ? Number(entry.value) : 0;
    this.set(name, cur + delta);
  }

  get(name: string): VarValue {
    return this.vars.get(name)?.value ?? 0;
  }

  /** Toggle the stage watcher visibility. */
  toggleWatcher(name: string, show?: boolean) {
    const entry = this.vars.get(name);
    if (entry) {
      entry.showWatcher = show ?? !entry.showWatcher;
      this.emit();
    }
  }

  all(): Map<string, VarEntry> {
    return new Map(this.vars);
  }

  names(): string[] {
    return [...this.vars.keys()];
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snapshot = new Map(this.vars);
    for (const fn of this.listeners) fn(snapshot);
  }

  /** Wipe everything (called on New Project). */
  clear() {
    this.vars.clear();
    this.emit();
  }
}

/** Singleton — import this anywhere. */
export const variableStore = new VariableStore();
