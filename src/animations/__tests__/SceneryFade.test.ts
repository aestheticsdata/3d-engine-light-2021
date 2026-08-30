// The scenery's withdrawal, and above all what it REMEMBERS: the pair of
// switches a molecule takes away has to come back as it was, not as both on.
//
// Every clock reading is a literal here for the same reason the console hands
// one in rather than reading performance.now(): the fade has no clock of its
// own, so a test can walk it a frame at a time exactly as STEP does.

import SceneryFade from "@animations/SceneryFade";
import data from "@data/data";
import moleculeInfo from "@data/moleculeInfo";
import { describe, expect, it } from "vitest";

import type { SceneryLayers } from "@animations/SceneryFade";

const DURATION = 1000;

const fade = () => new SceneryFade(DURATION);

const BOTH_ON: SceneryLayers = { sky: true, floor: true };

describe("entering the family", () => {
  it("remembers the pair it was handed and empties both reveals over the duration", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);

    expect(scenery.isFading).toBe(true);
    expect(scenery.skyReveal).toBe(1);

    scenery.update(DURATION / 2);

    expect(scenery.skyReveal).toBeGreaterThan(0);
    expect(scenery.skyReveal).toBeLessThan(1);
    expect(scenery.floorReveal).toBe(scenery.skyReveal);

    scenery.update(DURATION);

    expect(scenery.skyReveal).toBe(0);
    expect(scenery.floorReveal).toBe(0);
    expect(scenery.isFading).toBe(false);
  });

  it("hands back exactly what it was given, not both switches on", () => {
    const scenery = fade();

    scenery.enter({ sky: true, floor: false }, 0);
    scenery.update(DURATION);

    expect(scenery.leave(DURATION)).toEqual({ sky: true, floor: false });
  });

  // A floor already switched off before the molecule was picked must not be
  // turned on by leaving it, and its reveal must not travel either.
  it("leaves a layer that was already off at nothing on the way back out", () => {
    const scenery = fade();

    scenery.snapTo({ sky: true, floor: false });
    scenery.enter({ sky: true, floor: false }, 0);
    scenery.update(DURATION);
    scenery.leave(DURATION);
    scenery.update(DURATION * 2);

    expect(scenery.skyReveal).toBe(1);
    expect(scenery.floorReveal).toBe(0);
  });

  // Water → methane → caffeine is three transitions and one withdrawal. A second
  // capture would remember the off/off the first one wrote, and the console
  // would come out of the family with no scenery at all.
  it("does not re-capture the pair on a molecule to molecule switch", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION);
    // The rule hands it the store's own values, which by now are both off.
    scenery.enter({ sky: false, floor: false }, DURATION);

    expect(scenery.leave(DURATION)).toEqual(BOTH_ON);
  });

  it("starts nothing on a molecule to molecule switch, both layers being gone already", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION);
    scenery.enter({ sky: false, floor: false }, DURATION);

    expect(scenery.isFading).toBe(false);
  });
});

describe("leaving the family", () => {
  it("returns null when there was no molecule to leave", () => {
    expect(fade().leave(0)).toBeNull();
  });

  it("returns null on a second leave, so a solid to solid switch touches nothing", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.leave(DURATION);

    expect(scenery.leave(DURATION * 2)).toBeNull();
  });

  it("brings the remembered pair back over the duration", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION);
    scenery.leave(DURATION);
    scenery.update(DURATION * 1.5);

    expect(scenery.skyReveal).toBeGreaterThan(0);
    expect(scenery.skyReveal).toBeLessThan(1);

    scenery.update(DURATION * 2);

    expect(scenery.skyReveal).toBe(1);
    expect(scenery.floorReveal).toBe(1);
    expect(scenery.isFading).toBe(false);
  });
});

describe("a flip made by hand", () => {
  it("is instant, and leaves no fade in flight", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION / 2);

    expect(scenery.isFading).toBe(true);

    scenery.snapTo({ sky: true, floor: true });

    expect(scenery.skyReveal).toBe(1);
    expect(scenery.floorReveal).toBe(1);
    expect(scenery.isFading).toBe(false);
  });

  // SKY DOME was off before the molecule was ever picked, and the user pressed it
  // back on over the molecule. Leaving has to hand back what they asked for, not
  // the value the console walked in with.
  it("becomes the new remembered value while a molecule is on screen", () => {
    const scenery = fade();

    scenery.snapTo({ sky: false, floor: true });
    scenery.enter({ sky: false, floor: true }, 0);
    scenery.update(DURATION);
    scenery.snapTo({ sky: true, floor: false });

    expect(scenery.leave(DURATION)).toEqual({ sky: true, floor: true });
  });

  // The other half of the same press: the rule had already driven FLOOR off, so
  // nothing about the floor moved and its own memory — on, from before the
  // molecule — has to survive the sky being pressed.
  it("leaves the memory of a layer the press did not move exactly where it was", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION);
    scenery.snapTo({ sky: true, floor: false });

    expect(scenery.leave(DURATION)).toEqual(BOTH_ON);
  });

  // Only the layer the press names. A press on FLOOR says nothing about what
  // the sky was before the molecule took it, and overwriting both would lose it.
  it("replaces only the layer that moved, leaving the other one's memory alone", () => {
    const scenery = fade();

    scenery.enter({ sky: true, floor: false }, 0);
    scenery.update(DURATION);
    scenery.snapTo({ sky: false, floor: true });

    expect(scenery.leave(DURATION)).toEqual({ sky: true, floor: true });
  });

  it("stops only the layer that moved, leaving the other one still sweeping", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION / 2);
    scenery.snapTo({ sky: true, floor: false });

    expect(scenery.skyReveal).toBe(1);
    expect(scenery.isFading).toBe(true);

    scenery.update(DURATION);

    expect(scenery.floorReveal).toBe(0);
  });

  // FOG and GRID STEP raise the same callback the two switches do, so the pair
  // arrives unchanged many times over a drag. Snapping on one of those would cut
  // a withdrawal short at whatever frame the slider happened to move on.
  it("does nothing when the pair has not actually moved", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION / 2);

    const midSweep = scenery.skyReveal;

    scenery.snapTo({ sky: false, floor: false });

    expect(scenery.skyReveal).toBe(midSweep);
    expect(scenery.isFading).toBe(true);
  });
});

describe("a whole scene arriving", () => {
  // RESET's restored defaults and a preset file's own pair both win outright:
  // there is nothing older left to remember.
  it("drops what was remembered and matches the reveals to the pair", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION);
    scenery.adopt({ sky: true, floor: false });

    expect(scenery.skyReveal).toBe(1);
    expect(scenery.floorReveal).toBe(0);
    expect(scenery.isFading).toBe(false);
    expect(scenery.leave(DURATION)).toBeNull();
  });

  // A preset saved while a molecule was displayed carries sky and floor off, and
  // those are the values leaving that molecule has to restore.
  it("lets a preset's own pair seed what the next molecule remembers", () => {
    const scenery = fade();

    scenery.adopt({ sky: false, floor: false });
    scenery.enter({ sky: false, floor: false }, 0);

    expect(scenery.leave(DURATION)).toEqual({ sky: false, floor: false });
  });
});

describe("settle", () => {
  it("finishes a sweep in flight at once, which is what RESET does", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION / 2);
    scenery.settle();

    expect(scenery.skyReveal).toBe(0);
    expect(scenery.floorReveal).toBe(0);
    expect(scenery.isFading).toBe(false);
  });
});

describe("update", () => {
  it("reports a moved reveal, which is what invalidates the background snapshot", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);

    expect(scenery.update(0)).toBe(false);
    expect(scenery.update(DURATION / 2)).toBe(true);
    expect(scenery.update(DURATION)).toBe(true);
    expect(scenery.update(DURATION * 2)).toBe(false);
  });

  it("holds the sweep where it is when the clock does not advance, so STEP walks it", () => {
    const scenery = fade();

    scenery.enter(BOTH_ON, 0);
    scenery.update(DURATION / 4);

    const held = scenery.skyReveal;

    scenery.update(DURATION / 4);

    expect(scenery.skyReveal).toBe(held);
  });
});

// The rule as Main runs it: one lookup in moleculeInfo, and the two calls it
// chooses between. Driven off the table rather than a list of molecule keys
// written out here, so a molecule added later is covered without this file being
// touched — which is the same argument moleculeInfo's own MoleculeKey makes.
//
// Main itself needs a document to construct, so the branch is mirrored rather
// than imported. The table read is the half that can drift, and it is the half
// this pins.
describe("the molecule rule over the whole registry", () => {
  const applyRule = (scenery: SceneryFade, primitive: string, layers: SceneryLayers, now: number): SceneryLayers => {
    if (moleculeInfo[primitive]) {
      scenery.enter(layers, now);

      return { sky: false, floor: false };
    }

    return scenery.leave(now) ?? layers;
  };

  const primitives = Object.keys(data);
  const molecules = primitives.filter((primitive) => moleculeInfo[primitive]);
  const solids = primitives.filter((primitive) => !moleculeInfo[primitive]);

  it("has both kinds in the registry, or the two sweeps below prove nothing", () => {
    expect(molecules.length).toBeGreaterThan(0);
    expect(solids.length).toBeGreaterThan(0);
  });

  it("drives both switches off for every molecule, and empties both reveals", () => {
    molecules.forEach((primitive) => {
      const scenery = fade();

      expect(applyRule(scenery, primitive, BOTH_ON, 0)).toEqual({ sky: false, floor: false });

      scenery.update(DURATION);

      expect(scenery.skyReveal).toBe(0);
      expect(scenery.floorReveal).toBe(0);
    });
  });

  it("restores the remembered pair for every solid, from every molecule", () => {
    molecules.forEach((primitive) => {
      const scenery = fade();

      applyRule(scenery, primitive, { sky: true, floor: false }, 0);
      scenery.update(DURATION);

      solids.forEach((solid) => {
        const leaving = new SceneryFade(DURATION);

        leaving.enter({ sky: true, floor: false }, 0);
        leaving.update(DURATION);

        expect(applyRule(leaving, solid, BOTH_ON, DURATION)).toEqual({ sky: true, floor: false });
      });
    });
  });

  it("leaves a solid to solid switch alone, both switches included", () => {
    const scenery = fade();

    solids.forEach((solid) => {
      expect(applyRule(scenery, solid, BOTH_ON, 0)).toEqual(BOTH_ON);
      expect(scenery.skyReveal).toBe(1);
      expect(scenery.floorReveal).toBe(1);
    });
  });
});
