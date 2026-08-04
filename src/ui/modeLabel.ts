// The shading-mode label, in one place.
//
// The design offers six modes — POINTS / WIRE / FLAT / GOURAUD / DEPTH /
// NORMALS — but the renderer only distinguishes wireframe from filled today, so
// this collapses to two. The remaining four become real in de-mock E3, and the
// RENDER tab takes ownership of a `shadingMode` slice in the store at that point.
//
// Ownership: drafted here by the status-bar ticket, which was the first
// consumer. The RENDER tab extends this function rather than declaring a second
// label table — the status bar, the viewport HUD and the inspector must all
// print the same word for the same state.

export type ShadingMode = "WIRE" | "FLAT";

export const modeLabel = (wireframeEnabled: boolean): ShadingMode => (wireframeEnabled ? "WIRE" : "FLAT");

// The six-chip vocabulary the RENDER tab's SHADING MODE grid picks from — the
// same shading concept as ShadingMode above, at the finer resolution the chip
// grid needs before the renderer can back all six.
export type ShadingModeKey = "POINTS" | "WIRE" | "FLAT" | "GOURAUD" | "DEPTH" | "NORMALS";

// The single definition of the shading↔wireframe relationship. Main.ts and
// ShadingSection.ts both need to agree on which chip means "wireframe" — a
// second independently-spelled "WIRE" literal in either one is how that
// agreement drifts silently, with nothing thrown when it does.
export const impliesWireframe = (mode: ShadingModeKey): boolean => mode === "WIRE";
