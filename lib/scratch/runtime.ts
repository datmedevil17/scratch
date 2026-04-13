'use client';

/**
 * ScratchRuntime — interprets Script[] per sprite and animates them.
 *
 * Architecture:
 *  • Each running script spawns an async "thread" (Promise chain).
 *  • CancellationToken lets Stop abort all threads instantly.
 *  • nextFrame() / sleep() are the two async primitives used by blocks.
 *  • The stage reads getSpriteStates() on its own RAF loop to render.
 */

import { type WBlock, type Script } from './types';
import { type SpriteState, makeSpriteState, defaultEffects } from './sprite-state';
import { getBlockDef } from './blocks';
import { variableStore } from './variable-store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function num(v: string | number | undefined, fallback = 0): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}
function str(v: string | number | undefined, fallback = ''): string {
  return v === undefined ? fallback : String(v);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Convert Scratch direction (90=right) to radians for Math.cos/sin. */
function dirToRad(dir: number) {
  return ((dir - 90) * Math.PI) / 180;
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

function sleep(secs: number): Promise<void> {
  return new Promise((r) => setTimeout(r, secs * 1000));
}

// ── Cancellation ──────────────────────────────────────────────────────────────

class CancellationToken {
  cancelled = false;
  cancel() {
    this.cancelled = true;
  }
}

// ── Runtime ───────────────────────────────────────────────────────────────────

export interface RuntimeOptions {
  /** Called each time sprite state changes (for stage to re-draw). */
  onStateChange?: () => void;
}

export class ScratchRuntime {
  private spriteStates = new Map<string, SpriteState>();
  /** spriteId → Scripts authored in the workspace */
  private scripts      = new Map<string, Script[]>();
  private running      = false;
  private tokens: CancellationToken[] = [];

  // Input state
  private keysDown  = new Set<string>();
  private mouseX    = 0;
  private mouseY    = 0;
  private mouseDown = false;

  // Broadcast listeners: message → resolvers[]
  private broadcastWaiters = new Map<string, Array<() => void>>();

  // Timer
  private timerStart = 0;

  // Answer from "ask and wait"
  private answer = '';

  private opts: RuntimeOptions;

  constructor(opts: RuntimeOptions = {}) {
    this.opts = opts;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register / update sprites from the editor (call before greenFlag). */
  syncSprites(sprites: Array<{
    id: string; name: string; emoji: string; imageUrl?: string;
    x: number; y: number; direction: number; size: number; visible: boolean;
  }>) {
    for (const sp of sprites) {
      if (!this.spriteStates.has(sp.id)) {
        this.spriteStates.set(sp.id, makeSpriteState(sp));
      } else {
        // Preserve runtime-only state (variables, effects, bubbles) but sync all editor props
        const existing = this.spriteStates.get(sp.id)!;
        this.spriteStates.set(sp.id, {
          ...existing,
          name:      sp.name,
          emoji:     sp.emoji,
          imageUrl:  sp.imageUrl,
          x:         sp.x,
          y:         sp.y,
          size:      sp.size,
          direction: sp.direction,
          visible:   sp.visible,
        });
      }
    }
    // Remove sprites that no longer exist in editor
    for (const id of [...this.spriteStates.keys()]) {
      if (!sprites.find((s) => s.id === id)) this.spriteStates.delete(id);
    }
  }

  /** Called by the workspace whenever a sprite's scripts change. */
  setScripts(spriteId: string, scripts: Script[]) {
    this.scripts.set(spriteId, scripts);
  }

  /** Get current sprite states for rendering. */
  getSpriteStates(): SpriteState[] {
    return [...this.spriteStates.values()];
  }

  // ── Input events (called by stage) ────────────────────────────────────────

  setKeyDown(key: string, down: boolean) {
    down ? this.keysDown.add(key.toLowerCase()) : this.keysDown.delete(key.toLowerCase());
    if (down) this.fireKeyHats(key.toLowerCase());
  }

  setMouse(x: number, y: number, down?: boolean) {
    this.mouseX = x;
    this.mouseY = y;
    if (down !== undefined) this.mouseDown = down;
  }

  fireSpriteClick(spriteId: string) {
    this.startHats('ev3', spriteId);
  }

  // ── Run / Stop ─────────────────────────────────────────────────────────────

  greenFlag() {
    this.stopAll();
    this.timerStart = performance.now();

    // Reset sprite positions to initial state
    for (const [, s] of this.spriteStates) {
      s.sayBubble   = null;
      s.thinkBubble = null;
      s.effects     = defaultEffects();
    }

    this.running = true;
    // Start all "when 🚩 clicked" hat scripts across every sprite
    for (const [spriteId] of this.spriteStates) {
      this.startHats('ev1', spriteId);
    }
  }

  stopAll() {
    this.running = false;
    for (const tok of this.tokens) tok.cancel();
    this.tokens = [];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private startHats(hatDefId: string, spriteId?: string) {
    const ids = spriteId
      ? [spriteId]
      : [...this.spriteStates.keys()];

    for (const sid of ids) {
      const scripts = this.scripts.get(sid) ?? [];
      for (const script of scripts) {
        if (script.blocks.length === 0) continue;
        if (script.blocks[0].defId === hatDefId) {
          this.spawnThread(sid, script.blocks.slice(1));
        }
      }
    }
  }

  private fireKeyHats(key: string) {
    for (const [sid] of this.spriteStates) {
      const scripts = this.scripts.get(sid) ?? [];
      for (const script of scripts) {
        if (script.blocks.length === 0) continue;
        const hat = script.blocks[0];
        if (hat.defId !== 'ev2') continue;
        // ev2: when [key] key pressed — part index 1 is the key dropdown
        const k = str(hat.inputs[1] ?? 'space').toLowerCase();
        if (k === key || k === 'any') {
          this.spawnThread(sid, script.blocks.slice(1));
        }
      }
    }
  }

  private spawnThread(spriteId: string, blocks: WBlock[]) {
    const tok = new CancellationToken();
    this.tokens.push(tok);
    this.runBlocks(blocks, spriteId, tok).finally(() => {
      this.tokens = this.tokens.filter((t) => t !== tok);
    });
  }

  private async runBlocks(
    blocks: WBlock[],
    spriteId: string,
    tok: CancellationToken,
  ): Promise<void> {
    for (const block of blocks) {
      if (tok.cancelled) return;
      await this.execBlock(block, spriteId, tok);
    }
  }

  // ── Sprite mutators ────────────────────────────────────────────────────────

  private getSprite(id: string): SpriteState {
    return this.spriteStates.get(id)!;
  }

  private mutSprite(id: string, fn: (s: SpriteState) => Partial<SpriteState>) {
    const s = this.spriteStates.get(id);
    if (!s) return;
    Object.assign(s, fn(s));
    this.opts.onStateChange?.();
  }

  // ── Reporter / boolean evaluators ─────────────────────────────────────────

  private evalNum(block: WBlock, spriteId: string): number {
    return num(this.evalReporter(block, spriteId));
  }

  private evalReporter(block: WBlock, spriteId: string): number | string {
    const s   = this.getSprite(spriteId);
    const inp = block.inputs;

    switch (block.defId) {
      // Motion reporters
      case 'm16': return s.x;
      case 'm17': return s.y;
      case 'm18': return s.direction;
      // Looks reporters
      case 'l18': return s.size;
      case 'l19': return s.costumeIndex + 1;
      case 'l20': return 0; // backdrop # stub
      // Sound reporters
      case 's9': return 100; // volume stub
      // Sensing reporters
      case 'se5': return this.answer;
      case 'se6': return this.mouseX;
      case 'se7': return this.mouseY;
      case 'se10': return 0; // distance stub
      case 'se11': return (performance.now() - this.timerStart) / 1000;
      // Operator reporters
      case 'op1': return num(inp[0]) + num(inp[2]);
      case 'op2': return num(inp[0]) - num(inp[2]);
      case 'op3': return num(inp[0]) * num(inp[2]);
      case 'op4': {
        const divisor = num(inp[2]);
        return divisor === 0 ? 0 : num(inp[0]) / divisor;
      }
      case 'op5': {
        const lo = num(inp[1] ?? 1), hi = num(inp[3] ?? 10);
        return Math.floor(Math.random() * (hi - lo + 1)) + lo;
      }
      case 'op12': return str(inp[0]) + str(inp[2]);
      case 'op13': {
        const word = str(inp[3]); const idx = num(inp[1], 1) - 1;
        return idx >= 0 && idx < word.length ? word[idx] : '';
      }
      case 'op14': return str(inp[2]).length;
      case 'op16': return Math.round(num(inp[1]));
      case 'op17': {
        const fn  = str(inp[0] ?? 'sqrt');
        const val = num(inp[2]);
        const fns: Record<string, (v: number) => number> = {
          abs: Math.abs, floor: Math.floor, ceiling: Math.ceil,
          sqrt: Math.sqrt, sin: (v) => Math.sin((v * Math.PI) / 180),
          cos: (v) => Math.cos((v * Math.PI) / 180),
          tan: (v) => Math.tan((v * Math.PI) / 180),
          ln: Math.log, log: Math.log10,
          'e^': Math.exp, '10^': (v) => Math.pow(10, v),
        };
        return fns[fn] ? fns[fn](val) : val;
      }
      // Variable
      case 'v10': return 0; // list item stub
      case 'v11': return 0; // list length stub
      default: {
        // Generic: if the block is a plain reporter with a single num/str input,
        // return that value (handles user-typed inputs).
        const def = getBlockDef(block.defId);
        if (def?.shape === 'reporter') {
          const firstInput = Object.values(inp)[0];
          if (firstInput !== undefined) return firstInput;
        }
        return 0;
      }
    }
  }

  private evalBool(block: WBlock, spriteId: string): boolean {
    const inp = block.inputs;
    switch (block.defId) {
      case 'se1': return false; // touching stub
      case 'se2': return false; // touching color stub
      case 'se3': return false;
      case 'se8': return this.mouseDown;
      case 'se9': {
        const key = str(inp[1] ?? 'space').toLowerCase();
        return key === 'any' ? this.keysDown.size > 0 : this.keysDown.has(key);
      }
      case 'op6': return num(inp[0]) >  num(inp[2]);
      case 'op7': return num(inp[0]) <  num(inp[2]);
      case 'op8': return String(inp[0] ?? '') === String(inp[2] ?? '');
      case 'op9': return this.evalBoolFromInput(inp[0], spriteId) && this.evalBoolFromInput(inp[2], spriteId);
      case 'op10': return this.evalBoolFromInput(inp[0], spriteId) || this.evalBoolFromInput(inp[2], spriteId);
      case 'op11': return !this.evalBoolFromInput(inp[1], spriteId);
      case 'op15': return str(inp[0]).toLowerCase().includes(str(inp[2]).toLowerCase());
      case 'v12': return false; // list contains stub
      default: return false;
    }
  }

  /**
   * Evaluate a boolean that may come either from a literal or from a nested
   * boolean block stored as a WBlock reference in inputs. For now inputs only
   * hold primitives, so this just does a truthiness check.
   */
  private evalBoolFromInput(val: string | number | undefined, _spriteId: string): boolean {
    if (val === undefined) return false;
    if (typeof val === 'number') return val !== 0;
    const lower = val.toLowerCase();
    return lower !== '' && lower !== '0' && lower !== 'false';
  }

  // ── Block executor ────────────────────────────────────────────────────────

  private async execBlock(
    block: WBlock,
    spriteId: string,
    tok: CancellationToken,
  ): Promise<void> {
    if (tok.cancelled) return;
    const inp = block.inputs;

    switch (block.defId) {

      // ── Motion ──────────────────────────────────────────────────────────

      case 'm1': { // move [n] steps
        const steps = num(inp[1] ?? 10);
        this.mutSprite(spriteId, (s) => {
          const rad = dirToRad(s.direction);
          return {
            x: clamp(s.x + Math.cos(rad) * steps, -240, 240),
            y: clamp(s.y + Math.sin(rad) * steps, -180, 180),
          };
        });
        break;
      }
      case 'm2': // turn ↻ [n] degrees (clockwise)
        this.mutSprite(spriteId, (s) => ({ direction: (s.direction + num(inp[1] ?? 15)) % 360 }));
        break;
      case 'm3': // turn ↺ [n] degrees (counter-clockwise)
        this.mutSprite(spriteId, (s) => ({ direction: ((s.direction - num(inp[1] ?? 15)) + 360) % 360 }));
        break;
      case 'm4': // go to x:[n] y:[n]
        this.mutSprite(spriteId, () => ({
          x: clamp(num(inp[1] ?? 0), -240, 240),
          y: clamp(num(inp[3] ?? 0), -180, 180),
        }));
        break;
      case 'm5': { // go to [drop]
        const dest = str(inp[1] ?? 'random position');
        if (dest === 'random position') {
          this.mutSprite(spriteId, () => ({
            x: Math.round(Math.random() * 480 - 240),
            y: Math.round(Math.random() * 360 - 180),
          }));
        } else if (dest === 'mouse-pointer') {
          this.mutSprite(spriteId, () => ({ x: this.mouseX, y: this.mouseY }));
        }
        break;
      }
      case 'm6': { // glide [secs] to x:[n] y:[n]
        const secs = num(inp[1] ?? 1);
        const tx   = num(inp[3] ?? 0);
        const ty   = num(inp[5] ?? 0);
        const sx   = this.getSprite(spriteId).x;
        const sy   = this.getSprite(spriteId).y;
        const start = performance.now();
        const dur   = secs * 1000;
        while (!tok.cancelled) {
          const t = Math.min((performance.now() - start) / dur, 1);
          this.mutSprite(spriteId, () => ({ x: sx + (tx - sx) * t, y: sy + (ty - sy) * t }));
          if (t >= 1) break;
          await nextFrame();
        }
        break;
      }
      case 'm7': { // glide [secs] to [drop]
        const secs = num(inp[1] ?? 1);
        const dest = str(inp[3] ?? 'random position');
        const tx   = dest === 'random position' ? Math.round(Math.random() * 480 - 240) : this.mouseX;
        const ty   = dest === 'random position' ? Math.round(Math.random() * 360 - 180) : this.mouseY;
        const sx   = this.getSprite(spriteId).x;
        const sy   = this.getSprite(spriteId).y;
        const start = performance.now();
        const dur   = secs * 1000;
        while (!tok.cancelled) {
          const t = Math.min((performance.now() - start) / dur, 1);
          this.mutSprite(spriteId, () => ({ x: sx + (tx - sx) * t, y: sy + (ty - sy) * t }));
          if (t >= 1) break;
          await nextFrame();
        }
        break;
      }
      case 'm8': // change x by [n]
        this.mutSprite(spriteId, (s) => ({ x: clamp(s.x + num(inp[1] ?? 10), -240, 240) }));
        break;
      case 'm9': // set x to [n]
        this.mutSprite(spriteId, () => ({ x: clamp(num(inp[1] ?? 0), -240, 240) }));
        break;
      case 'm10': // change y by [n]
        this.mutSprite(spriteId, (s) => ({ y: clamp(s.y + num(inp[1] ?? 10), -180, 180) }));
        break;
      case 'm11': // set y to [n]
        this.mutSprite(spriteId, () => ({ y: clamp(num(inp[1] ?? 0), -180, 180) }));
        break;
      case 'm12': // point in direction [n]
        this.mutSprite(spriteId, () => ({ direction: num(inp[1] ?? 90) }));
        break;
      case 'm13': // point towards [drop]
        if (str(inp[1]) === 'mouse-pointer') {
          this.mutSprite(spriteId, (s) => {
            const dx = this.mouseX - s.x;
            const dy = this.mouseY - s.y;
            const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
            return { direction: (deg + 360) % 360 };
          });
        }
        break;
      case 'm14': // if on edge, bounce
        this.mutSprite(spriteId, (s) => {
          let { x, y, direction } = s;
          let bounced = false;
          if (x >= 240 || x <= -240) { direction = (180 - direction + 360) % 360; bounced = true; }
          if (y >= 180 || y <= -180) { direction = (-direction + 360) % 360; bounced = true; }
          if (bounced) {
            x = clamp(x, -240, 240);
            y = clamp(y, -180, 180);
          }
          return { x, y, direction };
        });
        break;
      case 'm15': // set rotation style — stored as metadata, no visual change in Tier 1
        break;

      // ── Looks ─────────────────────────────────────────────────────────────

      case 'l1': { // say [s] for [n] secs
        const text = str(inp[1] ?? 'Hello!');
        const secs = num(inp[3] ?? 2);
        const until = Date.now() + secs * 1000;
        this.mutSprite(spriteId, () => ({ sayBubble: { text, until }, thinkBubble: null }));
        await sleep(secs);
        if (!tok.cancelled) this.mutSprite(spriteId, (s) => ({
          sayBubble: s.sayBubble?.until === until ? null : s.sayBubble
        }));
        break;
      }
      case 'l2': // say [s] (permanent until next say)
        this.mutSprite(spriteId, () => ({ sayBubble: { text: str(inp[1] ?? 'Hello!'), until: Infinity }, thinkBubble: null }));
        break;
      case 'l3': { // think [s] for [n] secs
        const text = str(inp[1] ?? 'Hmm...');
        const secs = num(inp[3] ?? 2);
        const until = Date.now() + secs * 1000;
        this.mutSprite(spriteId, () => ({ thinkBubble: { text, until }, sayBubble: null }));
        await sleep(secs);
        if (!tok.cancelled) this.mutSprite(spriteId, (s) => ({
          thinkBubble: s.thinkBubble?.until === until ? null : s.thinkBubble
        }));
        break;
      }
      case 'l4': // think [s] (permanent)
        this.mutSprite(spriteId, () => ({ thinkBubble: { text: str(inp[1] ?? 'Hmm...'), until: Infinity }, sayBubble: null }));
        break;
      case 'l5': { // switch costume to [drop]
        const name = str(inp[1] ?? 'costume1');
        this.mutSprite(spriteId, (s) => {
          const idx = s.costumes.indexOf(name);
          return { costumeIndex: idx >= 0 ? idx : s.costumeIndex };
        });
        break;
      }
      case 'l6': // next costume
        this.mutSprite(spriteId, (s) => ({
          costumeIndex: (s.costumeIndex + 1) % Math.max(1, s.costumes.length),
        }));
        break;
      case 'l9': // change size by [n]
        this.mutSprite(spriteId, (s) => ({ size: clamp(s.size + num(inp[1] ?? 10), 5, 500) }));
        break;
      case 'l10': // set size to [n] %
        this.mutSprite(spriteId, () => ({ size: clamp(num(inp[1] ?? 100), 5, 500) }));
        break;
      case 'l11': // show
        this.mutSprite(spriteId, () => ({ visible: true }));
        break;
      case 'l12': // hide
        this.mutSprite(spriteId, () => ({ visible: false }));
        break;
      case 'l13': { // change [effect] by [n]
        const effect = str(inp[1] ?? 'color') as keyof SpriteState['effects'];
        const delta  = num(inp[3] ?? 25);
        this.mutSprite(spriteId, (s) => ({
          effects: { ...s.effects, [effect]: (s.effects[effect] ?? 0) + delta },
        }));
        break;
      }
      case 'l14': { // set [effect] to [n]
        const effect = str(inp[1] ?? 'ghost') as keyof SpriteState['effects'];
        const val    = num(inp[3] ?? 0);
        this.mutSprite(spriteId, (s) => ({
          effects: { ...s.effects, [effect]: val },
        }));
        break;
      }
      case 'l15': // clear graphic effects
        this.mutSprite(spriteId, () => ({ effects: defaultEffects() }));
        break;
      case 'l16': // go to [front/back] layer — visual z-order stub
        break;
      case 'l17': // go back [n] layers — stub
        break;

      // ── Sound (stub — Web Audio in Tier 2) ─────────────────────────────

      case 's1': case 's2': case 's3': case 's4': case 's5':
      case 's6': case 's7': case 's8':
        break;

      // ── Events ────────────────────────────────────────────────────────────

      case 'ev4': { // broadcast [message]
        const msg = str(inp[1] ?? 'message1');
        this.fireBroadcast(msg);
        break;
      }
      case 'ev5': { // broadcast [message] and wait
        const msg = str(inp[1] ?? 'message1');
        await this.fireBroadcastAndWait(msg);
        break;
      }

      // ── Control ───────────────────────────────────────────────────────────

      case 'c1': // wait [n] seconds
        await sleep(num(inp[1] ?? 1));
        break;

      case 'c2': { // repeat [n] — requires inner blocks
        const times = Math.round(num(inp[1] ?? 10));
        if (block.inner && block.inner.length > 0) {
          for (let i = 0; i < times; i++) {
            if (tok.cancelled) return;
            await this.runBlocks(block.inner, spriteId, tok);
            await nextFrame();
          }
        }
        break;
      }

      case 'c3': { // forever — requires inner blocks
        if (block.inner && block.inner.length > 0) {
          while (!tok.cancelled) {
            await this.runBlocks(block.inner, spriteId, tok);
            await nextFrame();
          }
        }
        break;
      }

      case 'c4': { // if [bool] then
        const cond = this.evalBool(this.makeBoolBlock(inp, 1), spriteId);
        if (cond && block.inner) {
          await this.runBlocks(block.inner, spriteId, tok);
        }
        break;
      }

      case 'c5': { // if [bool] then/else
        const cond = this.evalBool(this.makeBoolBlock(inp, 1), spriteId);
        const branch = cond ? block.inner : block.inner2;
        if (branch) await this.runBlocks(branch, spriteId, tok);
        break;
      }

      case 'c6': { // wait until [bool]
        while (!tok.cancelled) {
          if (this.evalBool(this.makeBoolBlock(inp, 1), spriteId)) break;
          await nextFrame();
        }
        break;
      }

      case 'c7': { // repeat until [bool]
        if (block.inner) {
          while (!tok.cancelled) {
            if (this.evalBool(this.makeBoolBlock(inp, 1), spriteId)) break;
            await this.runBlocks(block.inner, spriteId, tok);
            await nextFrame();
          }
        }
        break;
      }

      case 'c11': { // stop [drop]
        const which = str(inp[1] ?? 'all');
        if (which === 'all') this.stopAll();
        else if (which === 'this script') tok.cancel();
        break;
      }

      // ── Sensing ───────────────────────────────────────────────────────────

      case 'se4': { // ask [s] and wait
        const question = str(inp[1] ?? "What's your name?");
        const userAnswer = window.prompt(question) ?? '';
        this.answer = userAnswer;
        break;
      }
      case 'se12': // reset timer
        this.timerStart = performance.now();
        break;

      // ── Variables ─────────────────────────────────────────────────────────

      case 'v1': { // set [var] to [n]
        const name = str(inp[1] ?? 'score');
        const val  = inp[3] ?? 0;
        variableStore.set(name, val);
        this.mutSprite(spriteId, (s) => ({ variables: { ...s.variables, [name]: val } }));
        break;
      }
      case 'v2': { // change [var] by [n]
        const name  = str(inp[1] ?? 'score');
        const delta = num(inp[3] ?? 1);
        variableStore.change(name, delta);
        const next = variableStore.get(name);
        this.mutSprite(spriteId, (s) => ({ variables: { ...s.variables, [name]: next } }));
        break;
      }
      case 'v3': { // show variable watcher
        const name = str(inp[1] ?? 'score');
        variableStore.toggleWatcher(name, true);
        break;
      }
      case 'v4': { // hide variable watcher
        const name = str(inp[1] ?? 'score');
        variableStore.toggleWatcher(name, false);
        break;
      }

      default:
        break;
    }
  }

  /** Create a minimal WBlock for evaluating a boolean from inputs at given index. */
  private makeBoolBlock(inp: Record<number, string | number>, _idx: number): WBlock {
    // For now conditions are always false unless a concrete defId is provided via nested block
    // (nested boolean blocks come in Tier 3). Return a placeholder.
    return { instanceId: '', defId: '__bool__', inputs: inp };
  }

  // ── Broadcast ──────────────────────────────────────────────────────────────

  private fireBroadcast(message: string) {
    // Resolve any waiters
    const waiters = this.broadcastWaiters.get(message) ?? [];
    for (const r of waiters) r();
    this.broadcastWaiters.set(message, []);

    // Start "when I receive" hat scripts
    this.startHats('ev6_' + message); // unique key per message

    // General ev6 hats matching this message
    for (const [sid] of this.spriteStates) {
      const scripts = this.scripts.get(sid) ?? [];
      for (const script of scripts) {
        if (script.blocks.length === 0) continue;
        const hat = script.blocks[0];
        if (hat.defId === 'ev6') {
          const msg = str(hat.inputs[1] ?? 'message1');
          if (msg === message) this.spawnThread(sid, script.blocks.slice(1));
        }
      }
    }
  }

  private fireBroadcastAndWait(message: string): Promise<void> {
    return new Promise((resolve) => {
      const prev = this.broadcastWaiters.get(message) ?? [];
      this.broadcastWaiters.set(message, [...prev, resolve]);
      this.fireBroadcast(message);
    });
  }

  // ── Variable access (for stage watchers) ──────────────────────────────────

  getGlobalVars(): Map<string, number | string> {
    const raw = variableStore.all();
    const out = new Map<string, number | string>();
    raw.forEach((entry, key) => out.set(key, entry.value));
    return out;
  }
}
