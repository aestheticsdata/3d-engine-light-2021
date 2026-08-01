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
    },
  },

  { ignores: ["dist/**", "node_modules/**"] },
);
