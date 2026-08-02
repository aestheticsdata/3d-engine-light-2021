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
