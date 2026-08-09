// The shading-mode vocabulary, in one place.
//
// This was src/ui/modeLabel.ts, and it held two unions until E3c/COS-243: a
// two-valued ShadingMode for what the readouts could honestly print, and a
// six-valued ShadingModeKey for what the chip grid let you pick. The split
// existed because the renderer only distinguished wireframe from filled, so
// printing GOURAUD anywhere would have been the same lie a cosmetic CSS filter
// would have been. All six are backed by a real branch now, so the two collapse
// into the one union below.
//
// It moved out of src/ui/ with them. The union is now a branch in the render
// path — Triangle.rasterize and Rasterizer.shade both switch on it — and this
// codebase already settled which end owns a shared union: UIStateStore takes
// ProjectionMode from Camera and TextureMode from material.ts on the grounds
// that "neither end can grow a value the other does not have," and the engine
// is the end that would have to implement one. A primitive reaching into @ui/
// for the vocabulary of its own inner loop was the inversion of that.
//
// The modeLabel() the file was named after is gone with them, and its own
// Done-when asked for it to survive. It survived by becoming an identity — the
// value the store holds is already the word the design prints — and this repo
// has already ruled on that exact shape one file over: StatusBar.setProjection
// writes the union straight through, on the grounds that "the mode is already
// the word to print, so there is no label table between the engine's union and
// the three surfaces that could disagree with it." What the ticket wanted was
// one vocabulary rather than a second label table, and the union plus
// SHADING_MODES below is that vocabulary — a pass-through function in front of
// it would have been a seam that checks nothing.

export type ShadingMode = "POINTS" | "WIRE" | "FLAT" | "GOURAUD" | "DEPTH" | "NORMALS";

// Reading order, which is also the chip grid's own two rows of three: the two
// views that draw no surface, then the two lit modes, then the two that encode
// a channel rather than a colour.
export const SHADING_MODES: readonly ShadingMode[] = ["POINTS", "WIRE", "FLAT", "GOURAUD", "DEPTH", "NORMALS"];

// The single definition of the shading↔wireframe relationship. Main.ts and
// ShadingSection.ts both need to agree on which chip means "wireframe" — a
// second independently-spelled "WIRE" literal in either one is how that
// agreement drifts silently, with nothing thrown when it does.
export const impliesWireframe = (mode: ShadingMode): boolean => mode === "WIRE";

// Unlit and unfogged, the two diagnostics that answer a question about the
// geometry rather than showing what it looks like. Triangle.fill()'s wireframe
// branch has said the same thing about WIRE since E5b — "a wireframe is the
// diagnostic view, and dissolving the far edges is exactly what someone who
// switched to it is trying to see" — and it holds for the same reason of a grey
// ramp that has to decode back to a depth and an RGB that has to decode back to
// a normal.
export const isDiagnostic = (mode: ShadingMode): boolean => mode === "DEPTH" || mode === "NORMALS";
