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
];

// The seven files that still violate a rule the epic has not reached yet. ESLint
// allows one severity per rule per file, so a file with a pending violation is
// downgraded whole rather than having its one bad line silenced — `warn`, never
// `off`, and never an inline disable comment. Each entry names the ticket that
// deletes it. When this array is empty, delete it and the block below with it.
const PENDING = {
  // R15 — two module-scope `let` bindings at :94 and :134.
  "src/data/shapes/torusKnot.ts": "COS-362",
  // R15 — one module-scope `let` at :105.
  "src/data/shapes/rhombicTriacontahedron.ts": "COS-366",
  // I4 — four `for…in` loops at :22, :32, :38, :44.
  "src/primitives/Mesh.ts": "COS-372",
};

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
    },
  },

  {
    // R6 — Point2D.ts:10,13 are the repo's only two bare getters. COS-372 annotates
    // them and this block goes away.
    files: ["src/primitives/Point2D.ts"],
    rules: {
      "@typescript-eslint/explicit-member-accessibility": [
        "warn",
        { accessibility: "explicit", overrides: { constructors: "off" } },
      ],
    },
  },

  {
    files: Object.keys(PENDING),
    rules: { "no-restricted-syntax": ["warn", ...RESTRICTED] },
  },

  { ignores: ["dist/**", "node_modules/**"] },
);
