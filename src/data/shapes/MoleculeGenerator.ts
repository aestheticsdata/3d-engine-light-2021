// A ball-and-stick sweep over a molecule file: one sphere per atom through
// SphereGenerator, one rod per bond swept here, every triangle in its
// element's CPK fill straight into the registry's per-triangle slot.
//
// THE ROD is three rings — one at each atom, one at the midpoint, so each half
// takes the colour of the atom it touches — and it has no end caps. That
// absence is deliberate rather than a bug: both ends are buried inside a ball,
// so a cap is triangles nobody can ever see. Its rings close by modulo instead
// of carrying the sphere's duplicated seam vertex, because nothing here wraps
// a checker or a UV around the tube. KnotPath is deliberately not involved: it
// solves the frame problem — a normal that does not spin along a curve — and a
// straight segment does not have one. One arbitrary perpendicular and a cross
// product are the whole frame.
//
// WINDING comes from each component, never from the centroid of the whole.
// PolyhedronBuilder's "flip any face whose normal points away from the centre"
// is meaningless here: a molecule is many closed surfaces and the centroid of
// the whole is inside none of them — benzene's is empty ring space. Each ball
// keeps SphereGenerator's own winding, which translation preserves; each rod
// triangle is tested against its own outward spokes, the same per-triangle
// decision TorusKnotGenerator makes.
//
// CENTRED on the centroid of the atom positions, not the centre of mass: the
// pivot is what SPIN turns about, so it has to be the visual centre or the
// molecule wobbles.
//
// SCALED BY A CONSTANT SHARED WITH EVERY OTHER MOLECULE, which is the one rule
// here worth reading twice. Each molecule used to be rescaled independently so
// that its own widest atom landed on the registry's 100-unit envelope, which
// gave every molecule the same stage presence and made the drawn size of an
// atom depend on how big the REST of its molecule was. An oxygen came out at
// 35.2 units in water and 7.6 in caffeine — the same atom, 4.65 times the
// size — and water's oxygen against CO2's, both triatomic, already differed by
// 1.6 times. Relative sizes inside one molecule were right; across the family
// they meant nothing, which is worse than useless on a teaching card.
//
// So the conversion from Angstroms to engine units is now a constant. A carbon
// is one size everywhere, and a molecule that is genuinely five times larger
// than water looks five times larger, because it is.

import MeshBuilder from "@data/builders/MeshBuilder";
import Vec3Math from "@data/builders/Vec3Math";
import elements from "@data/molecules/elements";
import SphereGenerator from "@data/shapes/SphereGenerator";

import type { Bond, Molecule } from "@data/molecules/types";
import type { Object3D } from "@data/types";

type Vec3 = [number, number, number];

// The ceiling TorusKnotGenerator holds the knots under, restated for the same
// reason it restates it: GeometryWidget derives POLY BUDGET as the next power
// of two above the densest registry shape, so one molecule over 8192 would
// double the denominator and halve the bar for every shape in the console.
// GeometryWidget cannot be imported from here (it imports the registry, and
// this file is in it), so the two agree by construction instead.
//
// TRIED AND REVERTED (HAL-173): 16384, with MAX_LAT_SEGMENTS at 17, to double
// every ball. It worked and it cost too much. Caffeine went to 15424 triangles
// and became the densest shape in the registry, which moved the console's
// derived bar to 16384 and halved it for the twenty-four shapes that had not
// changed; caffeine's frame time went from 3.7 ms to 7.4 ms. The balls were
// visibly rounder and it was not worth the frame rate. Anyone proposing it
// again should have a plan for the frame time first, not for the bar.
const TRIANGLE_BUDGET = 8192;

// How far a molecule may reach from its own centroid before the constructor
// refuses to build it.
//
// This was 100, described as "the envelope the rest of the registry sits in",
// and that description was WRONG about the registry it was describing. Read
// out of the geometry baseline, eight shapes already reach past 100: cross
// 108.6, donut 110.0, the four torus knots 115.7–116.0, cube and pyramid
// 173.2, and the Menger sponge 181.9. 100 is the sphere's radius and the
// polyhedra's circumradius, not the console's ceiling — and it was refusing
// molecules at reaches the donut and the cross have drawn at since the first
// commit.
//
// 173.2 is 100·√3: the corner of the cube whose half-edge is 100, which is
// exactly where cube and pyramid sit. It is the largest reach in the registry
// that a shape arrives at by construction rather than by subdivision, so it is
// the number with a reason behind it. The sponge is past it and is its own
// case.
//
// RAISING THIS CEILING MOVES NOTHING. It is compared against, never multiplied
// by; every mesh in the registry is byte-identical either side of this change,
// which is exactly what makes it a different act from touching the scale
// below. That one would resize all seven molecules to admit an eighth.
//
// It still bites where it was meant to. The triangle budget caps a molecule at
// 68 atoms, and 68 atoms strung out in a line would reach well past this — a
// molecule that large wants the render decisions of its own ticket, which is
// what the throw is for.
const ENVELOPE_RADIUS = 100 * Math.sqrt(3);

// The whole family's Angstrom-to-engine-unit conversion, and the reason an
// atom is the same size in every molecule.
//
// DECLARED, not derived from the registry, and that distinction is the point.
// Deriving it — "the scale at which the largest current molecule fits" — would
// silently resize every existing molecule the day a bigger one landed, which
// is the same class of surprise this constant exists to remove. A declared
// number means adding a molecule either fits or fails loudly, and never
// quietly moves the twenty-four shapes that were already correct.
//
// 22 was chosen as the largest round value at which the biggest molecule then
// in the registry cleared a 100-unit envelope: caffeine reaches 4.356 A, so
// 95.8 units. That envelope has since been corrected upward — see above — and
// this number did NOT follow it. It cannot: raising the scale to use the new
// headroom would resize every molecule already drawn, which is the one thing
// this constant exists to prevent. 22 is now simply the family's declared
// scale, and the reasoning that first landed on it is history rather than a
// derivation to redo.
const ENGINE_UNITS_PER_ANGSTROM = 22;

// The two drawn sizes, in Ångströms like everything in a molecule file, and
// tuned against each other once here for the whole epic.
//
// BALL_RADIUS_SCALE is what makes this a ball-and-STICK model. At full
// covalent radius the balls swallow the bond: water's O and H sum to 0.97 Å
// against a 0.9584 Å bond, so the spheres interpenetrate and the rod is
// invisible. At half, they cover 0.485 Å and leave about half the bond showing
// — enough rod to read as a bond from every angle, while the balls stay large
// enough to keep their relative sizes legible.
//
// ROD_RADIUS is then set against the SMALLEST drawn ball, hydrogen's 0.155 Å:
// a rod approaching that reads as a dumbbell rather than as a bond, so it sits
// at a little under half of it.
const BALL_RADIUS_SCALE = 0.5;
const ROD_RADIUS = 0.07;

// One resolution knob for the whole molecule: balls take lat x (lat + 2) bands
// — the demo sphere's own lat-to-lon derivation — and rods take the same
// segment count around their girth. One number scales every component
// together, which keeps the budget walk below monotonic and the rod as round
// as the balls it joins.
//
// The offset is passed to SphereGenerator explicitly rather than left to its
// identical default, so the cost predicted below and the mesh actually built
// come from the same constant. Unlike TRIANGLE_BUDGET there is no import
// barrier here to force a restatement, so agreeing by construction is simply
// available and taking it is free.
//
// Triangles per ball go as 2·lat·(lat + 2), so this knob roughly squares
// rather than scales: 12 gives 336 and 17 would give 646. That is what made
// the doubling recorded above cheap to reach and expensive to run.
const MAX_LAT_SEGMENTS = 12;
const MIN_LAT_SEGMENTS = 6;
const LON_SEGMENTS_OFFSET = 2;

// Each ball is a lat x lon quad grid at two triangles per quad; each rod is
// two bands of lat quads, one per colour half.
const trianglesAt = (latSegments: number, atomCount: number, bondCount: number): number => {
  const perBall = 2 * latSegments * (latSegments + LON_SEGMENTS_OFFSET);
  const perRod = 4 * latSegments;

  return atomCount * perBall + bondCount * perRod;
};

// The floor throws rather than clamping quietly — a silent clamp is how the
// budget moves without anyone noticing — and below six lat segments a ball
// reads as a faceted lump rather than an atom anyway.
//
// The message names the molecule, following the ruling recorded in
// decisions.md D8: every shape file builds its mesh at module scope, so this
// fires during registry evaluation, where a message naming only its counts
// leaves the author reading a stack trace to learn which data file did it.
const latSegmentsFor = (molecule: Molecule): number => {
  const atomCount = molecule.atoms.length;
  const bondCount = molecule.bonds.length;

  for (let lat = MAX_LAT_SEGMENTS; lat >= MIN_LAT_SEGMENTS; lat -= 1) {
    if (trianglesAt(lat, atomCount, bondCount) <= TRIANGLE_BUDGET) {
      return lat;
    }
  }

  throw new Error(
    `${molecule.name}: ${atomCount} atoms and ${bondCount} bonds cannot be drawn at ${MIN_LAT_SEGMENTS} lat segments within the ${TRIANGLE_BUDGET}-triangle budget.`,
  );
};

class MoleculeGenerator {
  private readonly builder: MeshBuilder;
  private readonly vec: Vec3Math;
  private readonly molecule: Molecule;
  private readonly latSegments: number;
  private readonly scale: number;
  private readonly centres: Vec3[];

  constructor(molecule: Molecule) {
    this.builder = new MeshBuilder();
    this.vec = new Vec3Math();
    this.molecule = molecule;
    this.latSegments = latSegmentsFor(molecule);

    const centroid = this.vec.centroid(molecule.atoms.map((atom) => atom.position));
    const centred = molecule.atoms.map((atom) => this.vec.sub(atom.position, centroid));
    const reach = Math.max(
      ...centred.map(
        (position, index) =>
          this.vec.magnitude(position) + elements[molecule.atoms[index].element].covalentRadius * BALL_RADIUS_SCALE,
      ),
    );

    // Loud rather than quiet, and for the same reason latSegmentsFor throws
    // instead of clamping: the alternative to this line is rescaling the whole
    // family to fit one newcomer, which would change twenty-four meshes that
    // nobody touched.
    if (reach * ENGINE_UNITS_PER_ANGSTROM > ENVELOPE_RADIUS) {
      throw new Error(
        `${molecule.name} reaches ${reach.toFixed(3)} Å, which is ${(reach * ENGINE_UNITS_PER_ANGSTROM).toFixed(1)} engine units at the family's shared scale and past the ${ENVELOPE_RADIUS.toFixed(1)}-unit envelope. Shrinking the scale would resize every other molecule, so this is a decision, not a constant to nudge.`,
      );
    }

    this.scale = ENGINE_UNITS_PER_ANGSTROM;
    this.centres = centred.map((position) => this.vec.scale(position, this.scale));
  }

  public build(): Object3D {
    for (let index = 0; index < this.molecule.atoms.length; index += 1) {
      this.addBall(index);
    }
    this.molecule.bonds.forEach((bond) => {
      this.addRod(bond);
    });

    return this.builder.mesh;
  }

  private addBall(index: number) {
    const element = elements[this.molecule.atoms[index].element];
    const ball = new SphereGenerator({
      radius: element.covalentRadius * BALL_RADIUS_SCALE * this.scale,
      latSegments: this.latSegments,
      lonSegments: this.latSegments + LON_SEGMENTS_OFFSET,
      origin: this.centres[index],
      fill: element.fill,
    }).build();

    this.appendMesh(ball);
  }

  private addRod(bond: Bond) {
    const start = this.centres[bond.a];
    const end = this.centres[bond.b];
    const axis = this.vec.normalize(this.vec.sub(end, start));
    const middle = this.vec.scale(this.vec.add(start, end), 0.5);

    // Any perpendicular does for a straight rod; the reference only has to
    // stay clear of the axis, and |y| < 0.9 keeps the cross well conditioned.
    const reference: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = this.vec.normalize(this.vec.cross(reference, axis));
    const v = this.vec.cross(axis, u);

    const rings = [start, middle, end].map((centre) => this.addRing(centre, u, v));

    this.addBand(rings[0], rings[1], [start, middle], elements[this.molecule.atoms[bond.a].element].fill);
    this.addBand(rings[1], rings[2], [middle, end], elements[this.molecule.atoms[bond.b].element].fill);
  }

  private addRing(centre: Vec3, u: Vec3, v: Vec3): number[] {
    const indices: number[] = [];
    const radius = ROD_RADIUS * this.scale;

    for (let segment = 0; segment < this.latSegments; segment += 1) {
      const angle = (segment * 2 * Math.PI) / this.latSegments;
      const radial = this.vec.add(
        this.vec.scale(u, Math.cos(angle) * radius),
        this.vec.scale(v, Math.sin(angle) * radius),
      );

      indices.push(this.builder.addPoint(this.vec.add(centre, radial)));
    }

    return indices;
  }

  private addBand(ringA: number[], ringB: number[], centres: [Vec3, Vec3], color: string) {
    for (let segment = 0; segment < this.latSegments; segment += 1) {
      const next = (segment + 1) % this.latSegments;

      const a = ringA[segment];
      const b = ringB[segment];
      const c = ringA[next];
      const d = ringB[next];

      // The sum of the quad's four spokes, each measured from the centre of
      // its own ring — the same per-triangle outward TorusKnotGenerator tests
      // against, for the same reason.
      const outward = this.vec.normalize(
        this.vec.add(
          this.vec.add(this.vec.sub(this.pointAsVec(a), centres[0]), this.vec.sub(this.pointAsVec(b), centres[1])),
          this.vec.add(this.vec.sub(this.pointAsVec(c), centres[0]), this.vec.sub(this.pointAsVec(d), centres[1])),
        ),
      );

      this.addOrientedTriangle(a, b, c, outward, color);
      this.addOrientedTriangle(c, b, d, outward, color);
    }
  }

  private addOrientedTriangle(a: number, b: number, c: number, outward: Vec3, color: string) {
    const faceNormal = this.vec.cross(
      this.vec.sub(this.pointAsVec(b), this.pointAsVec(a)),
      this.vec.sub(this.pointAsVec(c), this.pointAsVec(a)),
    );

    if (this.vec.dot(faceNormal, outward) <= 0) {
      this.builder.addTriangle([a, b, c, color]);
      return;
    }

    this.builder.addTriangle([a, c, b, color]);
  }

  private appendMesh(mesh: Object3D) {
    const base = this.builder.pointCount;

    mesh.points.forEach((point) => {
      this.builder.addPoint(point);
    });
    mesh.triangles.forEach((triangle) => {
      this.builder.addTriangle([triangle[0] + base, triangle[1] + base, triangle[2] + base, triangle[3]]);
    });
  }

  private pointAsVec(index: number): Vec3 {
    const point = this.builder.pointAt(index);

    return [point[0], point[1], point[2]];
  }
}

export default MoleculeGenerator;
