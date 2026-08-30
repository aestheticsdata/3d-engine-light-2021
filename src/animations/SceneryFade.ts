// The scenery's withdrawal: how much of the sky and how much of the floor are
// still standing, and what the pair was before a molecule took them away.
//
// A molecule is not standing in a landscape (HAL-174). It is a structure held in
// nothing, and the checker floor and the photographed sky are the two layers
// that exist to give a solid a sense of ground and scale. Selecting one withdraws
// both; leaving one hands them back.
//
// The two numbers here are what makes that a withdrawal rather than a pair of
// switches thrown in the same frame. Each is a reveal — 1 for the layer as it
// ships, 0 for gone — and each layer reads its own meaning into it: the floor
// shrinks its disc toward the orbit target, the sky sweeps a boundary from the
// zenith down to the horizon. Neither is a dimmer.
//
// Every clock reading arrives from the caller, for the reason ShapeSwitcher's
// does: STEP advances a synthetic clock a frame at a time, and a fade stamped
// with performance.now() would sit at a start moment the stepper cannot reach. A
// paused console holds the sweep where it is and STEP walks it forward.
//
// The remembered pair is the other half of the state, and it is a memory rather
// than a rule: a CHECKER FLOOR that was already off before the molecule was
// picked must not come back on when the console leaves it.

import { easeInOutCubic, lerp } from "@animations/shapeTransition/easing";

// The two switches this animates. Deliberately not the renderer's own
// BackgroundLayers: GRID OVERLAY and GROUND SHADOW are decided non-goals of the
// withdrawal, and a record carrying them would invite a later ticket to fold
// them in by accident.
export interface SceneryLayers {
  sky: boolean;
  floor: boolean;
}

// One layer's travel. Per layer rather than one pair of endpoints on a shared
// clock, because a flip made by hand mid-withdrawal only stops the layer it
// names — the other one has to keep going.
interface LayerFade {
  from: number;
  to: number;
  startedAt: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// What a switch's reveal is once nothing is animating: the boolean, as a number.
const revealFor = (on: boolean): number => (on ? 1 : 0);

class SceneryFade {
  private readonly durationMs: number;
  // What the two switches currently say, which is the store's own answer held
  // one step closer. It is what lets a sync tell a flip made by hand from a
  // re-read — every world-layer change raises one callback, FOG and GRID STEP
  // included, and snapping on one of those would cut a withdrawal short.
  private switches: SceneryLayers;
  // Non-null exactly while the console is inside the MOLECULES family: the pair
  // to hand back on the way out.
  private remembered: SceneryLayers | null;
  private skyRevealValue: number;
  private floorRevealValue: number;
  private skyFade: LayerFade | null;
  private floorFade: LayerFade | null;

  constructor(durationMs: number) {
    this.durationMs = durationMs;
    // Both on, for the reason BackgroundRenderer's own layer flags open that
    // way: this is a seed, not a value the console ever shows. Main reads the
    // store into it before a frame is painted.
    this.switches = { sky: true, floor: true };
    this.remembered = null;
    this.skyRevealValue = 1;
    this.floorRevealValue = 1;
    this.skyFade = null;
    this.floorFade = null;
  }

  public get skyReveal(): number {
    return this.skyRevealValue;
  }

  public get floorReveal(): number {
    return this.floorRevealValue;
  }

  public get isFading(): boolean {
    return this.skyFade !== null || this.floorFade !== null;
  }

  // Into the family. The pair is captured on the way IN and only then: walking
  // water → methane → caffeine is three transitions and one withdrawal, and a
  // second capture would remember the off/off the first one wrote.
  public enter(layers: SceneryLayers, now: number) {
    if (!this.remembered) {
      this.remembered = { ...layers };
    }

    this.switches = { sky: false, floor: false };
    this.fadeTo(0, 0, now);
  }

  // Out of it. Returns the pair the caller has to write back to the store, or
  // null when there was no molecule to leave — the boot shape and every
  // solid-to-solid switch take that path, and neither should touch the two
  // switches at all.
  public leave(now: number): SceneryLayers | null {
    const restored = this.remembered;

    if (!restored) {
      return null;
    }

    this.remembered = null;
    this.switches = { ...restored };
    this.fadeTo(revealFor(restored.sky), revealFor(restored.floor), now);

    return restored;
  }

  // A flip made by hand, which stays instant: only the molecule rule animates,
  // and making every SKY press a 1250ms dissolve is a change to a control nobody
  // asked to slow down.
  //
  // Called with the whole pair on every world-layer sync, so it decides for
  // itself whether anything moved. That is also what lets the rule's own write
  // pass straight through — enter() and leave() record the new switches before
  // the store is written, so the sync that follows finds nothing to snap.
  //
  // Per layer on both counts: a press on FLOOR leaves a sky still sweeping on its
  // own, and it replaces the floor's remembered value without claiming to have
  // learned anything about the sky's.
  public snapTo(layers: SceneryLayers) {
    const skyMoved = layers.sky !== this.switches.sky;
    const floorMoved = layers.floor !== this.switches.floor;

    if (!skyMoved && !floorMoved) {
      return;
    }

    if (this.remembered) {
      this.remembered = {
        sky: skyMoved ? layers.sky : this.remembered.sky,
        floor: floorMoved ? layers.floor : this.remembered.floor,
      };
    }

    this.switches = { ...layers };

    if (skyMoved) {
      this.skyRevealValue = revealFor(layers.sky);
      this.skyFade = null;
    }

    if (floorMoved) {
      this.floorRevealValue = revealFor(layers.floor);
      this.floorFade = null;
    }
  }

  // A whole scene arrives — RESET's restored defaults, or a preset file's own
  // pair. Both win outright and leave nothing older to remember: a preset saved
  // while a molecule was on screen already carries sky and floor off, and those
  // are the values leaving that molecule has to restore.
  public adopt(layers: SceneryLayers) {
    this.remembered = null;
    this.switches = { ...layers };
    this.skyRevealValue = revealFor(layers.sky);
    this.floorRevealValue = revealFor(layers.floor);
    this.skyFade = null;
    this.floorFade = null;
  }

  // Finishes whatever is in flight, at once. RESET re-asserts the rule against
  // the defaults it just restored, and RESET is not an animated moment anywhere
  // else in the console.
  public settle() {
    if (this.skyFade) {
      this.skyRevealValue = this.skyFade.to;
      this.skyFade = null;
    }

    if (this.floorFade) {
      this.floorRevealValue = this.floorFade.to;
      this.floorFade = null;
    }
  }

  // True when a reveal moved this frame, which is the caller's cue to push the
  // pair at the renderer again: an animating layer has to reach Surface3D's
  // background-snapshot signature, or the frame captured before the sweep began
  // is the frame it keeps serving for the whole of it.
  public update(now: number): boolean {
    const sky = this.valueAt(this.skyFade, now, this.skyRevealValue);
    const floor = this.valueAt(this.floorFade, now, this.floorRevealValue);
    const moved = sky !== this.skyRevealValue || floor !== this.floorRevealValue;

    this.skyRevealValue = sky;
    this.floorRevealValue = floor;
    this.skyFade = this.stillRunning(this.skyFade, now);
    this.floorFade = this.stillRunning(this.floorFade, now);

    return moved;
  }

  // Nothing is started for a layer already sitting at its destination, which is
  // what leaves a molecule → molecule switch with no fade in flight at all:
  // both layers are already gone, and re-running a 1250ms travel from 0 to 0
  // would hold isFading true over a frame that never moves.
  private fadeTo(sky: number, floor: number, now: number) {
    this.skyFade = sky === this.skyRevealValue ? null : { from: this.skyRevealValue, to: sky, startedAt: now };
    this.floorFade =
      floor === this.floorRevealValue ? null : { from: this.floorRevealValue, to: floor, startedAt: now };
  }

  private valueAt(fade: LayerFade | null, now: number, current: number): number {
    if (!fade) {
      return current;
    }

    return lerp(fade.from, fade.to, easeInOutCubic(clamp01((now - fade.startedAt) / this.durationMs)));
  }

  private stillRunning(fade: LayerFade | null, now: number): LayerFade | null {
    return fade && now - fade.startedAt < this.durationMs ? fade : null;
  }
}

export default SceneryFade;
