// One command, run by hand, that turns a PubChem CID into a molecule file in
// this epic's own shape:
//
//     node scripts/fetch-molecule.mjs 2519 caffeine
//     node scripts/fetch-molecule.mjs caffeine
//
// The first argument is a CID or a compound name; the optional second is the
// registry key the file is written under, which defaults to the name given or
// to PubChem's IUPAC name. That default is why the argument exists: CID 962 is
// water and its IUPACName is "oxidane", which nobody wants as a registry key.
//
// BUILD TIME, NEVER RUNTIME. This writes a file, a human reads it, git holds
// it. The app never talks to PubChem: no fetch in the browser, no cache to
// invalidate, no CORS, no rate limit in production, and the shape is identical
// on every machine forever. The same bargain snapshot-geometry.mjs already
// makes.
//
// WHERE THE LINE IS, and it is worth stating because this script makes the
// wrong side of it look easy: hand-derive the small symmetric molecules from
// published experimental constants, and use this from roughly ten atoms up.
// Water, methane, ammonia, CO2 and benzene are trigonometry over two measured
// numbers — exact, readable, and checkable by a reviewer who knows chemistry.
// PubChem's 3D records are COMPUTED CONFORMERS, which is a different kind of
// number: one plausible arrangement, not the structure. Regenerating the
// starter five through this script would trade four decimals of experiment for
// a conformer and lose the only thing that made those files reviewable.
//
// GENERATED OUTPUT IS SOURCE, NOT A CACHE. What lands in src/data/molecules is
// then edited by hand like anything else: if the conformer has a methyl
// rotated into a bond or a ring slightly puckered, fix the numbers in the file
// and say so in its header. This script does not get to be the authority
// twice, and nothing re-runs it to "refresh" a molecule.
//
// The cross-check below is the reason this is worth having at all rather than
// a curl and a text editor.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moleculeDir = path.join(root, "src/data/molecules");

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound";
const PROPERTIES = "MolecularFormula,MolecularWeight,IUPACName,InChIKey";

// PubChem's own limits are 5 requests/second and 400/minute. Two requests per
// molecule is nowhere near them, and a batch mode looping this script would
// hit them immediately — which is one of several reasons there is no batch
// mode.
const die = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

// The repo's own derivations, loaded through Vite so the aliases resolve the
// way the app resolves them. Duplicating either one here would defeat the
// entire point: the cross-check has to exercise the code that ships, or it
// proves only that this script agrees with itself.
//
// Two builds rather than one because each module is its own entry and matching
// several outputs by name is more moving parts than a hand-run script needs.
const loadModule = async (relativePath) => {
  const result = await build({
    configFile: path.join(root, "vite.config.js"),
    logLevel: "silent",
    build: { ssr: path.join(root, relativePath), write: false, minify: false, target: "esnext" },
  });

  const bundles = Array.isArray(result) ? result : [result];
  const encoded = Buffer.from(bundles[0].output[0].code).toString("base64");

  return import(`data:text/javascript;base64,${encoded}`);
};

const fetchText = async (url, what) => {
  const response = await fetch(url);

  // A 404 on the 3D record is a STOP, never a fallback to the 2D one. A 2D SDF
  // carries z = 0 for every atom, so the molecule would build, render, spin,
  // and be flat — wrong in the one way that survives review because nothing
  // errors. Large and flexible compounds genuinely have no precomputed
  // conformer, and buckminsterfullerene (CID 123591) is one of them.
  if (response.status === 404) {
    die(
      `PubChem has no ${what} for this compound (404).\n` +
        "This is a stop, not something to work around by fetching the 2D record: a 2D\n" +
        "SDF is z = 0 for every atom and would ship a flat molecule that renders fine.\n" +
        "The alternatives, so nobody re-researches them:\n" +
        "  NCI/CADD  https://cactus.nci.nih.gov/chemical/structure/<name>/file?format=sdf&get3d=true\n" +
        "  ChEBI     https://www.ebi.ac.uk/chebi/downloads\n" +
        "A molecule whose shape is fixed by symmetry (C60 is a truncated icosahedron)\n" +
        "should be hand-derived instead, the way methane is built from cube corners.",
    );
  }

  if (!response.ok) {
    die(`PubChem returned ${response.status} for ${what}: ${url}`);
  }

  return response.text();
};

// SDF/MOL V2000, parsed by hand and by COLUMN rather than by whitespace. The
// format is fixed-width, and splitting on spaces works right up until a
// molecule has a hundred atoms and the counts line's fields run together with
// no separator at all.
const parseV2000 = (sdf) => {
  const lines = sdf.split("\n");
  const counts = lines[3];

  if (!counts?.includes("V2000")) {
    die("Not a V2000 SDF record — the counts line does not say V2000. Nothing written.");
  }

  const atomCount = Number(counts.slice(0, 3));
  const bondCount = Number(counts.slice(3, 6));

  const atoms = [];
  for (let i = 0; i < atomCount; i += 1) {
    const line = lines[4 + i];

    atoms.push({
      element: line.slice(31, 34).trim(),
      position: [Number(line.slice(0, 10)), Number(line.slice(10, 20)), Number(line.slice(20, 30))],
    });
  }

  const bonds = [];
  for (let i = 0; i < bondCount; i += 1) {
    const line = lines[4 + atomCount + i];
    const order = Number(line.slice(6, 9));

    // Order 4 is SDF's aromatic flag. The repo's Bond type is 1 | 2 | 3 on
    // purpose — the data says what the bonds ARE, and "aromatic" is a
    // description of a ring rather than of one bond. PubChem's 3D records are
    // Kekule and do not use it, so meeting a 4 means the record is not what
    // this script expects and guessing would be inventing chemistry.
    if (order === 4) {
      die(
        `Bond ${i + 1} is order 4 (aromatic). The repo's Bond type is 1 | 2 | 3 and this\n` +
          "script will not silently pick one. Nothing written.",
      );
    }

    // SDF atom references are 1-based; Bond.a and Bond.b index the atoms array.
    bonds.push({ a: Number(line.slice(0, 3)) - 1, b: Number(line.slice(3, 6)) - 1, order });
  }

  return { atoms, bonds };
};

// PubChem's ASCII formula into an element -> count map. Compared as MAPS and
// never as strings: the repo's formula is a display string carrying Unicode
// subscripts and its own citation order, so a string comparison would fail for
// a formatting reason and teach nobody anything.
const parseAsciiFormula = (formula) => {
  const counts = {};

  for (const [, symbol, digits] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    counts[symbol] = (counts[symbol] ?? 0) + (digits === "" ? 1 : Number(digits));
  }

  return counts;
};

const sameCounts = (a, b) => {
  const symbols = new Set([...Object.keys(a), ...Object.keys(b)]);

  return [...symbols].every((symbol) => a[symbol] === b[symbol]);
};

// -0 prints as "-0", which is a diff nobody wants to explain. Trailing zeros go
// too: the SDF writes four decimals whether it needs them or not.
const coordinate = (value) => String(value === 0 ? 0 : value);

const titleCase = (key) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());

const fileBody = ({ key, displayName, molecule, meta, cid, retrieved }) => {
  const atoms = molecule.atoms
    .map((atom) => `    { element: "${atom.element}", position: [${atom.position.map(coordinate).join(", ")}] },`)
    .join("\n");
  const bonds = molecule.bonds
    .map((bond) => `    { a: ${bond.a}, b: ${bond.b}, order: ${bond.order} },`)
    .join("\n");

  return `// ${displayName} — GENERATED by scripts/fetch-molecule.mjs, then reviewed by hand.
// Rewrite this header: what follows is provenance, not the write-up the file
// owes a reader, and every other molecule in this directory says something the
// coordinates do not.
//
// SOURCED: PubChem CID ${cid}, 3D record, retrieved ${retrieved}. PubChem
// records are public domain, with the caveat that an individual depositor's
// record may carry its own terms.
// ${meta.IUPACName ? `IUPAC name: ${meta.IUPACName}.` : ""}
// InChIKey: ${meta.InChIKey ?? "unknown"}.
//
// NOT DERIVED, and this is the difference between this file and water's: a
// PubChem 3D record is a COMPUTED CONFORMER — one plausible arrangement of a
// molecule that has many — not an experimental structure. Nothing here was
// solved from a bond length and an angle, so nothing here can be measured back
// out to prove it. What CAN be checked is the composition, and it was: the
// formula and molar mass counted from the atoms below agree with PubChem's own
// ${meta.MolecularFormula} and ${meta.MolecularWeight} g/mol.
//
// REVIEW THIS CONFORMER before trusting it. Look for a methyl hydrogen rotated
// into a bond and for a ring that should be planar and is not. Fixing the
// numbers here by hand is the intended workflow — this file is source, not a
// cache, and nothing re-runs the script to refresh it.

import type { Molecule } from "@data/molecules/types";

const ${key}: Molecule = {
  name: "${displayName}",
  atoms: [
${atoms}
  ],
  bonds: [
${bonds}
  ],
};

export default ${key};
`;
};

const [identifier, keyArgument] = process.argv.slice(2);

if (!identifier) {
  die("Usage: node scripts/fetch-molecule.mjs <cid|name> [registryKey]");
}

const selector = /^\d+$/.test(identifier) ? `cid/${identifier}` : `name/${encodeURIComponent(identifier)}`;

const sdf = await fetchText(`${PUG}/${selector}/record/SDF?record_type=3d`, "3D record");
const meta = JSON.parse(await fetchText(`${PUG}/${selector}/property/${PROPERTIES}/JSON`, "property record"))
  .PropertyTable.Properties[0];

const molecule = parseV2000(sdf);

const { moleculeFormula } = await loadModule("src/data/molecules/moleculeFormula.ts");
const { molarMass } = await loadModule("src/data/molecules/molarMass.ts");
const { atomCounts } = await loadModule("src/data/molecules/atomCounts.ts");

// THE CROSS-CHECK. The epic's central claim is that a formula is counted from
// the structure and never declared, which means it cannot contradict the mesh.
// This is that claim proved against an independent authority, on a molecule
// large enough for a parse error to hide in — an off-by-one in the atom block
// would shift every element and is otherwise entirely silent.
//
// It fails the script rather than warning: a warning on a build-time tool is a
// line of output nobody reads.
const derivedCounts = atomCounts(molecule.atoms);
const pubchemCounts = parseAsciiFormula(meta.MolecularFormula);

if (!sameCounts(derivedCounts, pubchemCounts)) {
  die(
    `Formula mismatch — nothing written.\n` +
      `  counted here: ${JSON.stringify(derivedCounts)}\n` +
      `  PubChem says: ${JSON.stringify(pubchemCounts)} (${meta.MolecularFormula})\n` +
      "Either the atom block was misparsed or the derivation is wrong. Both are bugs.",
  );
}

const derivedMass = molarMass(molecule.atoms);
const pubchemMass = Number(meta.MolecularWeight);

// A tolerance rather than equality, because the two sides round different
// standard atomic weights at different points. Anything past this is a
// composition error, not a rounding one.
if (Math.abs(derivedMass - pubchemMass) > 0.05) {
  die(
    `Molar mass mismatch — nothing written.\n` +
      `  counted here: ${derivedMass.toFixed(3)} g/mol\n` +
      `  PubChem says: ${pubchemMass} g/mol`,
  );
}

const key = keyArgument ?? (/^\d+$/.test(identifier) ? meta.IUPACName : identifier);
const displayName = titleCase(key);
const cid = meta.CID;
const retrieved = new Date().toISOString().slice(0, 10);
const target = path.join(moleculeDir, `${key}.ts`);

writeFileSync(target, fileBody({ key, displayName, molecule, meta, cid, retrieved }));

process.stdout.write(
  `${displayName}: ${molecule.atoms.length} atoms, ${molecule.bonds.length} bonds, ` +
    `${moleculeFormula(molecule.atoms)}, ${derivedMass.toFixed(2)} g/mol (PubChem ${pubchemMass})\n` +
    `written to ${path.relative(root, target)} — now read it, review the conformer, and rewrite the header.\n`,
);
