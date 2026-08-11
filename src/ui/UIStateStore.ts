// The shared store for UI values that have no engine home yet.
//
// Shipped deliberately empty. Each widget ticket adds one slice for the values
// it owns — shading mode, texture, base colour, UV scale, scale, the four
// lighting values, fog, grid step, projection, sky / floor / grid / shadow,
// dropped frames — by extending UIState and registering its defaults.
//
// THE CONTRACT: a slice is only complete when the toolbar's RESET path restores
// it. Adding a value here without adding it to RESET leaves the console with a
// control that RESET silently ignores, which is the bug this store exists to
// prevent.
//
// Consumers subscribe rather than keeping private copies — the quick toggles
// and the scene graph both read state the inspector owns, and a second copy is
// how the two ends of a toggle end up disagreeing.
//
// Two behaviours here are load-bearing and easy to tidy into a bug. registerSlice
// writes the slice into BOTH defaults and state before notifying, which is what
// makes RESET coverage automatic. resetAll notifies ONCE for the whole console
// rather than once per slice, so the panels repaint in a single pass. Both are
// pinned by src/ui/__tests__/UIStateStore.test.ts.

import type { ProjectionMode } from "@primitives/Camera";
import type { TextureMode } from "@rendering/material";
import type { ShadingMode } from "@rendering/shadingMode";

// The RENDER LOOP chips, plus CUSTOM for the fourth slot's number input. MAX
// is uncapped rather than a number, because rAF is the only clock the engine
// has and a cap can only ever remove frames — there is no value that means
// "faster than the display". Declared here rather than beside the section
// that renders it because the store is what both it and RenderLoop's target
// read.
export type FrameRateCapKey = "30" | "60" | "MAX" | "CUSTOM";

export interface UIState {
  // Slices are added here by the ticket that owns each value.

  // --- scene graph ---------------------------------------------------------
  // Keyed by the stable row id, never by the displayed name: the mesh row's
  // label changes with every primitive, so selecting by what it says would
  // drop the selection on each shape change.
  sceneSelection?: string;
  sceneHidden?: readonly string[];
  // The drawn count (D6) — what Surface3D.render returns, not the registry
  // count. Published by Main on the existing 90ms display throttle; the scene
  // graph subscribes rather than reading the renderer itself, so there is one
  // number behind the row, the toolbar and the telemetry card.
  drawnTriangles?: number;

  // --- SHAPE tab -----------------------------------------------------------
  // Absolute degrees, written straight into ShapeRig — there is no mapping
  // between what the row shows and what the engine applies, which is what the
  // rate sliders these replaced needed a whole module for. spin is degrees per
  // second on the same rig. Registered by TransformSection. The camera's own
  // three angles are camElev / camAzim / camRoll in the WORLD block below.
  pitch?: number;
  yaw?: number;
  roll?: number;
  spin?: number;
  // texture and baseColor became live with E4a: the mode reaches every triangle
  // through Mesh.setMaterial and the colour multiplies the authored one. The
  // mode is typed by the engine rather than by this store, the same trade
  // projection makes below — one union for the chip and for the branch in
  // resolveMaterial, so neither end can grow a value the other does not have.
  // baseColor holds the palette NAME, not the colour: the store stays readable
  // and MaterialSection is the only thing that resolves it.
  //
  // uvScale became live with E4b. It tiles the two generated textures and is
  // deliberately inert in AUTHORED and SOLID — resolveMaterial is where that is
  // decided, not here and not the row.
  scale?: number;
  texture?: TextureMode;
  baseColor?: string;
  uvScale?: number;

  // --- RENDER tab -----------------------------------------------------------
  // zbuffer, dither and edgeAA are the three PIPELINE booleans this store owns,
  // and none of them is a placeholder any more. zbuffer stopped being one with
  // E3b (COS-242) — it selects Surface3D's rasteriser backend — and dither /
  // edgeAA with E3d (COS-244), which gave each a per-pixel pass inside that
  // backend. All three are stored here for the same reason every live control
  // is: RESET has to be able to undo them.
  //
  // They reach the engine on the render request rather than through
  // TriangleRenderOptions, because all three describe the frame rather than a
  // triangle — see Surface3D's SurfaceRenderRequest for that distinction.
  //
  // The four light* values stopped being placeholders with E4a's successor
  // (E3a/COS-241). All four reach one directional key light, and the scene
  // graph's KEY_LIGHT row switches that same light off — five controls, one
  // light, which is why not one of them is held anywhere but here.
  //
  // shadingMode stopped being chip-selection state with E3c (COS-243). It used
  // to be held here and read by nothing, with a warning against printing it in
  // the status bar, the HUD or SHAPE INFO — those three describe what the
  // rasteriser actually does, and a GOURAUD there would have been the same lie
  // a cosmetic CSS filter would have been. All six modes reach a real branch
  // now, so this is the field Main reads to build the frame's render options
  // and the three readouts print it.
  //
  // frameRateCap is the third live value in this tab, alongside wireframe and
  // culling: it really does gate RenderLoop's onFrame. It is stored rather than
  // held on the loop so RESET restores it through the same registry as
  // everything else.
  shadingMode?: ShadingMode;
  frameRateCap?: FrameRateCapKey;
  // The last committed value from the RENDER LOOP panel's custom fps input,
  // read only when frameRateCap is "CUSTOM" — the other two cap keys resolve
  // through FrameRateSection's own fixed table instead.
  customFrameRateFps?: number;
  zbuffer?: boolean;
  dither?: boolean;
  edgeAA?: boolean;
  lightAzimuth?: number;
  lightElevation?: number;
  lightAmbient?: number;
  lightSpecular?: number;

  // --- WORLD tab ------------------------------------------------------------
  // fov, zoom and projection are the three live camera controls: all three reach
  // the shared Camera record through CameraController, and zoom moved here from
  // the SHAPE tab, where the shell had parked it because WORLD did not exist
  // yet. The mode is typed by the engine rather than by this store — one union
  // for the chip label and the branch in Camera.scaleAt, so neither end can
  // grow a value the other does not have.
  //
  // sky, floor and, since COS-246 (E5a), grid are live too — they gate real
  // BackgroundRenderer layers — and they are the slices with a SECOND surface
  // reading them: the viewport's quick toggles show the same three booleans as
  // this tab's rows. One boolean per switch, never a pair, which is why they
  // sit in the store rather than on the section that draws them. gridStep is
  // live alongside grid — it sizes both the grid's spacing and the floor's
  // checker cell.
  //
  // shadow and fog became live with COS-247 (E5b) and were the last two in this
  // tab: shadow gates a projected blob per posed mesh, and fog drives one
  // exponential curve read by the mesh, the checker floor and the grid alike.
  // fog also reaches back into sky — what the haze fades toward is the sky's own
  // horizon colour with it on, and the app background with it off — which is why
  // both are read in the same pass rather than by a handler each.
  //
  // camElev / camAzim / camRoll are the camera's own orientation, in the
  // vocabulary its rows use: elevation above the horizon and azimuth around it.
  // Prefixed because the SHAPE tab owns `roll` — one grep for `camRoll` finds
  // the camera's, and the engine goes on calling all three Euler angles, which
  // is what they are.
  fov?: number;
  zoom?: number;
  projection?: ProjectionMode;
  camElev?: number;
  camAzim?: number;
  camRoll?: number;
  sky?: boolean;
  floor?: boolean;
  grid?: boolean;
  shadow?: boolean;
  fog?: number;
  gridStep?: number;
}

// Optional above, and guaranteed below: every field is filled by the owning
// widget's registerSlice() call at import time. They are declared optional
// because the store starts empty and slices arrive as their modules load —
// consumers still read through a fallback rather than assuming load order.

// Exported because subscribe's callers have to be able to name the shape they
// must satisfy; the module form kept this private and left them guessing.
export type Listener = (state: Readonly<UIState>) => void;

class UIStateStore {
  private readonly state: UIState;
  private readonly listeners: Set<Listener>;
  private readonly defaults: Partial<UIState>;

  constructor() {
    this.state = {};
    this.listeners = new Set();
    this.defaults = {};
  }

  public getState(): Readonly<UIState> {
    return this.state;
  }

  public setState(patch: Partial<UIState>) {
    Object.assign(this.state, patch);
    this.notify();
  }

  // Declares a slice together with the values RESET must restore it to. Calling
  // this at the declaration site is what makes RESET coverage automatic: a
  // ticket that adds a slice gets it restored without anyone editing the reset
  // handler, which is the failure mode this registry exists to prevent.
  public registerSlice(slice: Partial<UIState>) {
    Object.assign(this.defaults, slice);
    Object.assign(this.state, slice);
    this.notify();
  }

  // Restores every registered default and notifies once, so the whole console
  // repaints in a single pass rather than once per slice.
  public resetAll() {
    Object.assign(this.state, this.defaults);
    this.notify();
  }

  // Returns the unsubscribe function.
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  // Iterating the live Set is deliberate: a listener that subscribes from
  // inside a notification is reached in that same pass, and a setState raised
  // from inside one runs its pass immediately. Main's mesh-hidden change
  // detector (src/app/Main.ts) is shaped around both. Spreading the Set into an
  // array first looks like tidying and silently changes them.
  private notify() {
    this.listeners.forEach((listener) => {
      listener(this.state);
    });
  }
}

export default UIStateStore;
