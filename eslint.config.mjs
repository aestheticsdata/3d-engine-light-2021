// Mechanical enforcement of the house style. Every rule below encodes a numbered
// rule from notes/oop-refonte/reference/house-style.md and nothing else — no
// stylistic pack, no `recommended` preset, nothing that would flood the baseline.
// Each message names the rule it enforces, so a failure tells you what you broke
// and where to read about it.
//
// This is the only artifact of the OOP refonte epic (COS-356) that keeps working
// after the last ticket merges. A convention nobody can enforce lasts about three
// weeks; src/ui/ is the proof.

import tseslint from "typescript-eslint";

// R1 — a bare `class X {}`, then `export default X;` as the last line.
const R1_EXPORT_DEFAULT_CLASS = {
  selector: "ExportDefaultDeclaration > ClassDeclaration",
  message:
    "R1: declare a bare `class X {}` and `export default X;` on the last line. Never `export default class`.",
};

const R1_EXPORT_NAMED_CLASS = {
  selector: "ExportNamedDeclaration > ClassDeclaration",
  message:
    "R1: declare a bare `class X {}` and `export default X;` on the last line. Never `export class`.",
};

// D4 — this repo has never used inheritance, `implements`, `abstract` or
// `protected`, and the epic keeps that at zero. Contracts are plain interfaces,
// checked structurally: StateMachine already consumes its states table that way.
const D4_IMPLEMENTS = {
  selector: "TSClassImplements",
  message:
    "D4: no `implements`. Declare the contract as an interface and let structural typing check it.",
};

const D4_ABSTRACT_CLASS = {
  selector: "ClassDeclaration[abstract=true]",
  message: "D4: no `abstract` classes. Inject a collaborator instead.",
};

const D4_ABSTRACT_MEMBER = {
  selector: "TSAbstractMethodDefinition, TSAbstractPropertyDefinition",
  message: "D4: no `abstract` members. Inject a collaborator instead.",
};

const D4_INHERITANCE = {
  selector: "ClassDeclaration[superClass]",
  message:
    "D4: no inheritance. Every class here is standalone — inject a collaborator rather than extending one.",
};

const D4_PROTECTED = {
  selector:
    "MethodDefinition[accessibility='protected'], PropertyDefinition[accessibility='protected']",
  message:
    "D4: no `protected` — it only means something under inheritance, which this repo does not use. Use `private`.",
};

// R15 — no module-level mutable state.
const R15_MODULE_LET = {
  selector: "Program > VariableDeclaration[kind='let']",
  message:
    "R15: no module-level mutable state. Make it `const`, or move it onto the class that owns it.",
};

// I4 — the iteration-form ruling in the house style's inconsistencies table:
// `for…of`, because `for…in` over an array yields string indices.
const I4_FOR_IN = {
  selector: "ForInStatement",
  message:
    "I4: use `for…of`. `for…in` over an array yields string indices, not elements.",
};

// R20 — an acronym keeps its capitals in a type name: UIStateStore, never
// UiStateStore. Half-capitalising one is what autocomplete produces, and it
// makes the same acronym read two ways in one tree — this repo had UiStateStore,
// DomScope, FpsMeter and ViewportHud beside an already-correct UV.
//
// Type names only. camelCase members keep the conventional treatment, so
// `dogUrl` and `viewportHud` are deliberately untouched: full-capping there
// gives `skyURL` and `syncFromDOM`, a different and far more contested
// convention than the one this rule encodes. `id.name` and `local.name` are
// what scope it to declarations and import bindings rather than every mention.
// Extended forms are listed separately — `Rgba` as well as `Rgb` — because the
// acronym has to match to its full length: in `RgbaColor` the trailing `a`
// defeats the "followed by a capital" test, so a list holding only `Rgb` reads
// as covering it while actually letting it through.
const ACRONYMS =
  "Ui|Ux|Fps|Hud|Dom|Uv|Fov|Url|Uri|Api|Css|Html|Xml|Json|Svg|Rgba|Rgb|Gpu|Cpu|Http|Uuid";

// The acronym may sit anywhere in the name: at the front (UiState), at the back
// (ViewportHud), in the middle (ShapeUiPanel), or be the whole of it (Ui). What
// marks it as a word rather than a coincidence is PascalCase itself — it either
// opens the name or follows a lowercase letter, and it is either followed by a
// capital or ends the name.
//
// The leading `(?=[A-Z])` is what confines the rule to type names, and it is the
// only thing standing between it and `dogUrl` — the camelCase members this
// deliberately leaves alone all start lowercase. A fully capitalised acronym
// never matches a half-capitalised pattern, which is why `UV`, `DOMScope` and
// `FPSMeter` stay silent without needing an exception.
const HALF_CAPS = `/^(?=[A-Z])(?:[A-Za-z0-9]*?[a-z0-9])?(${ACRONYMS})(?=[A-Z]|$)/`;

const R20_ACRONYM_CASE = {
  selector: [
    `ClassDeclaration[id.name=${HALF_CAPS}]`,
    `TSInterfaceDeclaration[id.name=${HALF_CAPS}]`,
    `TSTypeAliasDeclaration[id.name=${HALF_CAPS}]`,
    `TSEnumDeclaration[id.name=${HALF_CAPS}]`,
    `ImportDefaultSpecifier[local.name=${HALF_CAPS}]`,
    `ImportSpecifier[local.name=${HALF_CAPS}]`,
    `ImportNamespaceSpecifier[local.name=${HALF_CAPS}]`,
  ].join(", "),
  message:
    "R20: an acronym keeps its capitals in a type name — UIStateStore, not UiStateStore. R13 then forces the filename to follow.",
};

const RESTRICTED = [
  R1_EXPORT_DEFAULT_CLASS,
  R1_EXPORT_NAMED_CLASS,
  D4_IMPLEMENTS,
  D4_ABSTRACT_CLASS,
  D4_ABSTRACT_MEMBER,
  D4_INHERITANCE,
  D4_PROTECTED,
  R15_MODULE_LET,
  I4_FOR_IN,
  R20_ACRONYM_CASE,
];

// Nothing is pending. Every rule above is an error everywhere in src/, with no
// per-file downgrade and no inline disable comment anywhere in the repo — the
// last two, Mesh's four `for…in` loops and Point2D's two bare getters, went with
// COS-372.

export default tseslint.config(
  {
    // Our own source only. Build output, deps and the JS config files are out of
    // scope — this lints the code the house style is about, nothing else.
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-restricted-syntax": ["error", ...RESTRICTED],

      // R3 — no parameter properties. Declare fields at the top of the class and
      // assign them in the constructor body.
      "@typescript-eslint/parameter-properties": [
        "error",
        { prefer: "class-property" },
      ],

      // R6 + R8 — every field and method carries an explicit modifier.
      // Constructors are exempt, and that is the house form rather than an
      // oversight: not one of the eleven owner-written classes writes
      // `public constructor`. Turning this on would have rewritten nine
      // conformant files to satisfy a rule the codebase never adopted.
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "explicit", overrides: { constructors: "off" } },
      ],

      // R19 — a binding used only in a type position is imported with
      // `import type`. Not cosmetic: a value import of a type keeps the module
      // in the emitted graph, so a type-only edge becomes a real runtime
      // dependency and a cycle TypeScript would have erased survives into the
      // bundle. The three modules that pass an interface both ways — Triangle
      // and AffineTextureMapper, Surface3D and Mesh — are exactly the shape
      // that turns into one.
      //
      // Unlike everything above, this cannot be a no-restricted-syntax
      // selector: whether an identifier lands in a type position is scope
      // analysis, not syntax. It is the one rule here the parser has to answer
      // rather than the AST.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports" },
      ],
    },
  },

  { ignores: ["dist/**", "node_modules/**"] },
);
