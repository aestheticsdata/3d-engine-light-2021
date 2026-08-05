// The registry key -> human name derivation, and the chip label built on top of
// it.
//
// One derivation behind two surfaces: SHAPE INFO's NAME row and SHAPE STORY's
// fallback take the long form, the picker's 66px chips take the short one. The
// chip label deliberately calls through primitiveLabel rather than re-splitting
// camelCase itself, so what is pinned here is that the two never disagree about
// where the words are.

import { primitiveChipLabel } from "@ui/primitiveChipLabel";
import { primitiveLabel } from "@ui/primitiveLabel";
import { describe, expect, it } from "vitest";

describe("primitiveLabel", () => {
  it("splits camelCase into title-cased words", () => {
    expect(primitiveLabel("cube")).toBe("Cube");
    expect(primitiveLabel("torusKnot")).toBe("Torus Knot");
    expect(primitiveLabel("kisRhombicDodecahedron")).toBe("Kis Rhombic Dodecahedron");
    expect(primitiveLabel("truncatedIcosidodecahedron")).toBe("Truncated Icosidodecahedron");
  });

  // COS-410's knot keys carry their (p, q). Without the digit rule the NAME row
  // reads "Torus Knot25", which looks like a typo rather than a parameter.
  it("separates a trailing number from the word before it", () => {
    expect(primitiveLabel("torusKnot25")).toBe("Torus Knot 25");
    expect(primitiveLabel("torusKnot27")).toBe("Torus Knot 27");
    expect(primitiveLabel("torusKnot34")).toBe("Torus Knot 34");
  });
});

describe("primitiveChipLabel", () => {
  it("prefers the editorial short name where one exists", () => {
    expect(primitiveChipLabel("torusKnot")).toBe("TKNOT");
    expect(primitiveChipLabel("truncatedIcosidodecahedron")).toBe("TRICOSID");
  });

  // The four knots are the case the map exists for: the derived fallback gives
  // all three new ones TORUSKNO, which is the same chip three times over.
  it("tells the four knots apart by their (p, q)", () => {
    expect(primitiveChipLabel("torusKnot25")).toBe("TK25");
    expect(primitiveChipLabel("torusKnot27")).toBe("TK27");
    expect(primitiveChipLabel("torusKnot34")).toBe("TK34");
  });

  // Every long key in the registry today is in the map, so the cap is exercised
  // with a key that is not — which is also the case it exists for: a shape
  // landing before anyone writes it an abbreviation still gets a chip that fits.
  it("falls back to the derived form, capped at eight characters", () => {
    expect(primitiveChipLabel("cube")).toBe("CUBE");
    expect(primitiveChipLabel("pyramid")).toBe("PYRAMID");
    expect(primitiveChipLabel("semiSnubMucube")).toBe("SEMISNUB");
  });
});
