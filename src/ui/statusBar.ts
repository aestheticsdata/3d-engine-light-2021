// The status bar's writers.
//
// This widget owns no state: every value it shows is derived somewhere else and
// pushed in through the injected FieldWriter, which is why it doubles as the
// sanity check that the shared state layer really is wired to engine state.
//
// Deliberately no uptime logic and no timer. The system widget owns the clock
// and its formatter and publishes `uptime`; the render loop cannot drive it
// anyway, since Main.stop() cancels rAF on pause while the clock has to keep
// counting.

import FieldWriter from "@ui/FieldWriter";
import { sceneObjectId } from "@ui/sceneObjectId";
import { modeLabel } from "@ui/modeLabel";
import { texLabel } from "@ui/texLabel";
import { Object3D } from "@data/types";

export const createStatusBar = (fields: FieldWriter) => ({
  setRunState: (isPlaying: boolean) => {
    fields.write("statusLabel", isPlaying ? "RUNNING" : "PAUSED");
  },

  // sceneObjectId is imported, never re-derived: the snake-case rule is what
  // makes this string match the scene-graph row and the viewport bracket.
  setSelected: (primitive: string) => {
    fields.write("selectedId", sceneObjectId(primitive));
  },

  setMode: (wireframeEnabled: boolean) => {
    fields.write("shadingMode", modeLabel(wireframeEnabled));
  },

  setTexture: (object3D: Object3D) => {
    fields.write("texLabel", texLabel(object3D));
  },
});

export type StatusBar = ReturnType<typeof createStatusBar>;

export default createStatusBar;
