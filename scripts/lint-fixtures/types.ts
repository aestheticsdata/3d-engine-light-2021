// Supplies a type to scripts/lint-fixtures/violations.ts so the R19 fixture can import
// a binding it only ever uses in a type position. Nothing here is a violation.

interface Contract {
  area(): number;
}

export type { Contract };
