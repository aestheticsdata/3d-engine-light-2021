// The colour arithmetic behind the BASE swatch: read a CSS colour, multiply two
// of them, write one back.
//
// Parsed here rather than by the browser. The obvious implementation is a
// scratch 1x1 context — assign ctx.fillStyle and read it back, and any CSS
// colour normalises itself — and it was rejected on purpose: that needs a DOM,
// and the blend below is exactly the kind of pure derivation the de-mock epic
// keeps moving into the node test environment. A multiply that can only be
// exercised through a canvas is a multiply nothing asserts.
//
// The cost of doing it by hand is coverage, and it is bounded. Every authored
// colour in the whole registry is an rgba() string, and getComputedStyle hands
// back rgb() — the two forms below, plus hex for a shape author writing one by
// hand. Anything else parses as null and passes through unblended, so an
// unrecognised colour draws as authored rather than as black.
//
// Channels are 0..255 and alpha is 0..1, which is what the CSS forms carry and
// what canvas fillStyle accepts back.

export type RGBA = [number, number, number, number];

// Whitespace-tolerant because the registry is: `rgba(0,180,89,1)` and
// `rgba(100, 194, 166,1)` are both authored, in the same file in some cases.
const FUNCTIONAL = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const OPAQUE = 1;
const CHANNEL_MAX = 255;

// The typeof guard earns its keep even though the parameter is typed: nothing in
// this project runs under strictNullChecks, so a malformed fourth slot in the
// registry reaches here as `undefined` rather than as a compile error. It is the
// same guard, for the same reason, that MaterialSummary already carries.
export const parseCssColor = (css: string): RGBA | null => {
  if (typeof css !== "string") {
    return null;
  }

  const functional = FUNCTIONAL.exec(css.trim());

  if (functional) {
    return [
      Number(functional[1]),
      Number(functional[2]),
      Number(functional[3]),
      functional[4] === undefined ? OPAQUE : Number(functional[4]),
    ];
  }

  const hex = HEX.exec(css.trim());

  if (!hex) {
    return null;
  }

  // Doubled digit by digit rather than by parsing the short form as a number:
  // #abc is #aabbcc, not #000abc.
  const digits = hex[1].length === 3 ? hex[1].replace(/./g, (digit) => digit + digit) : hex[1];

  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
    OPAQUE,
  ];
};

// Multiply, not replace, and that is the whole reason the BASE swatch is worth
// having: each shape's internal contrast survives it. The sphere stays a
// two-tone checker and the Menger sponge stays six-coloured, because every
// channel is scaled by the same factor rather than overwritten by one colour.
// White is therefore the identity, which is what lets the console open on a
// swatch and still draw the palette the registry authored.
//
// Alpha comes from the authored colour alone. The swatch names a hue, not a
// transparency — OPACITY is a separate control on the same tab, and letting the
// swatch move alpha too would give the console two paths to the same pixel.
export const multiplyColor = (authored: RGBA, base: RGBA): RGBA => [
  Math.round((authored[0] * base[0]) / CHANNEL_MAX),
  Math.round((authored[1] * base[1]) / CHANNEL_MAX),
  Math.round((authored[2] * base[2]) / CHANNEL_MAX),
  authored[3],
];

export const formatRgba = (rgba: RGBA): string => `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
