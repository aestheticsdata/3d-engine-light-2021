// The file half of the toolbar: CAPTURE PNG, SAVE PRESET, LOAD and COPY CODE.
//
// Everything with a side effect that scenePreset.ts deliberately has none of —
// the canvas read, the two downloads, the file picker and the clipboard write.
// The split is what keeps the format itself under the node suite: this class
// cannot be tested without a browser, and nothing in it decides what a preset
// means.
//
// It reads the scene through a callback rather than holding the store, the
// pipeline panel and the shape switcher itself. Three collaborators to satisfy a
// class that only ever wants their current values would make this a second
// composition root beside Main, and Main is the one place already entitled to
// see all three at once.

import ActionFlash from "@ui/ActionFlash";
import { BUILD } from "@ui/buildInfo";
import DOMScope from "@ui/DOMScope";
import { PRESET_APP, parsePreset, sceneFileName, sceneSnippet, serialisePreset } from "@ui/scenePreset";

import type ActionRegistry from "@ui/ActionRegistry";
import type { ActionId } from "@ui/ActionRegistry";
import type { SceneSnapshot } from "@ui/scenePreset";

const PRESET_FILE_INPUT = "#presetFile";
// Indented rather than minified: a preset is meant to be readable and
// hand-editable, and it is a few hundred bytes either way.
const PRESET_INDENT = 2;

export interface SessionActionsOptions {
  canvas: HTMLCanvasElement;
  actions: ActionRegistry;
  // Read on each press rather than subscribed to: three of the four actions want
  // the scene as it is at the moment the button is clicked, and none of them
  // wants to know when it changes.
  scene: () => SceneSnapshot;
  primitives: readonly string[];
  onApply: (scene: SceneSnapshot) => void;
}

class SessionActions {
  private readonly canvas: HTMLCanvasElement;
  private readonly fileInput: HTMLInputElement;
  private readonly flash: ActionFlash;
  private readonly scene: () => SceneSnapshot;
  private readonly primitives: readonly string[];
  private readonly onApply: (scene: SceneSnapshot) => void;

  constructor(options: SessionActionsOptions) {
    this.canvas = options.canvas;
    this.fileInput = new DOMScope(document).require<HTMLInputElement>(
      PRESET_FILE_INPUT,
      "Preset file input is missing.",
    );
    this.flash = new ActionFlash();
    this.scene = options.scene;
    this.primitives = options.primitives;
    this.onApply = options.onApply;

    this.fileInput.addEventListener("change", this.onFileChosen);

    options.actions.register("capturePng", () => this.capturePng());
    options.actions.register("savePreset", () => this.savePreset());
    options.actions.register("loadPreset", () => this.loadPreset());
    options.actions.register("copyCode", () => this.copyCode());
  }

  public dispose() {
    this.fileInput.removeEventListener("change", this.onFileChosen);
    this.flash.dispose();
  }

  // The current backing store, captured without re-rendering — so a paused frame
  // exports exactly what is on screen, mid-transition included.
  //
  // toBlob, never toDataURL: the data URL for a full-size frame is a
  // multi-megabyte string built synchronously on the main thread, and E9b made
  // the backing store follow the window rather than staying at the 1024x640 the
  // original ticket assumed. Tainting is not a risk — the three image assets are
  // Vite imports resolving same-origin and nothing sets crossOrigin — so this
  // cannot throw SecurityError, and the null branch is the genuine encode
  // failure rather than a permissions one.
  private capturePng() {
    const primitive = this.scene().primitive;

    this.canvas.toBlob((blob) => {
      if (!blob) {
        this.fail("capturePng", "The canvas could not be encoded as a PNG.");
        return;
      }

      this.save(blob, sceneFileName(primitive, new Date(), "png"));
    }, "image/png");
  }

  private savePreset() {
    const scene = this.scene();
    const savedAt = new Date();
    const preset = serialisePreset(scene, savedAt);
    const blob = new Blob([JSON.stringify(preset, null, PRESET_INDENT)], { type: "application/json" });

    this.save(blob, sceneFileName(scene.primitive, savedAt, "json"));
  }

  // Cleared before the click so re-selecting the same file fires `change` again:
  // the picker compares against the input's current value, and loading the same
  // preset twice in a row is exactly what someone does while tweaking one.
  private loadPreset() {
    this.fileInput.value = "";
    this.fileInput.click();
  }

  private copyCode() {
    const snippet = sceneSnippet(this.scene(), BUILD, new Date());

    // No execCommand("copy") fallback on purpose. The Clipboard API needs a
    // secure context and a user gesture, and both hold here — localhost, the
    // https deploy, and a click. A browser that still refuses is one this
    // console should say no to rather than quietly route around.
    navigator.clipboard
      .writeText(snippet)
      .then(() => this.flash.flash("copyCode", "COPIED"))
      .catch((reason: unknown) => this.fail("copyCode", `The clipboard write was rejected: ${String(reason)}`));
  }

  // An arrow property: it is handed to addEventListener and needs a bound `this`
  // (R9's one sanctioned use).
  private onFileChosen = async () => {
    const file = this.fileInput.files?.[0];

    if (!file) {
      return;
    }

    const scene = await this.readPreset(file);

    if (!scene) {
      this.fail("loadPreset", `${file.name} is not a ${PRESET_APP} preset this console can read.`);
      return;
    }

    this.onApply(scene);
  };

  // Parsed and validated before anything is touched, which is what makes a
  // malformed file a no-op rather than half a scene. JSON.parse is the only
  // reader — never eval — and parsePreset checks every value it keeps.
  private async readPreset(file: File): Promise<SceneSnapshot | null> {
    try {
      return parsePreset(JSON.parse(await file.text()), this.scene(), this.primitives);
    } catch {
      return null;
    }
  }

  // The blob-to-download dance, once for both files that use it. The object URL
  // is revoked on the next task rather than immediately: revoking it in the same
  // turn as the click races the browser's own fetch of it.
  private save(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // The reason goes to the console and the verdict goes to the button, because
  // the button has room for one word and a stack trace helps nobody reading a
  // toolbar.
  private fail(id: ActionId, reason: string) {
    console.warn(`${id}: ${reason}`);
    this.flash.flash(id, "FAILED");
  }
}

export default SessionActions;
