// The status bar's writers.
//
// This widget owns no state: every value it shows is derived somewhere else and
// pushed in through the injected FieldWriter, which is why it doubles as the
// sanity check that the shared state layer really is wired to engine state.
//
// Deliberately no uptime logic and no timer, and having fields must not invite
// one. The system widget owns the clock and its formatter and publishes
// `uptime`; the render loop cannot drive it anyway, since Main.stop() cancels
// rAF on pause while the clock has to keep counting.

import FieldWriter from "@ui/FieldWriter";
import MaterialSummary from "@ui/MaterialSummary";
import { modeLabel } from "@ui/modeLabel";
import { sceneObjectId } from "@ui/sceneObjectId";

class StatusBar {
  private readonly fields: FieldWriter;

  constructor(fields: FieldWriter) {
    this.fields = fields;
  }

  public setRunState(isPlaying: boolean) {
    this.fields.write("statusLabel", isPlaying ? "RUNNING" : "PAUSED");
  }

  // sceneObjectId is imported, never re-derived: the snake-case rule is what
  // makes this string match the scene-graph row and the viewport bracket.
  public setSelected(primitive: string) {
    this.fields.write("selectedId", sceneObjectId(primitive));
  }

  public setMode(wireframeEnabled: boolean) {
    this.fields.write("shadingMode", modeLabel(wireframeEnabled));
  }

  // Takes the summary, not the shape: Main already built one for the panel, and
  // deriving it a second time here is how the bar and the MATERIAL row start
  // disagreeing.
  public setTexture(summary: MaterialSummary) {
    this.fields.write("texLabel", summary.label);
  }
}

export default StatusBar;
