// Two HUD icon buttons, left of the theatre-mode expand toggle: one flips the
// vertical drag direction, the other the horizontal one. Independent switches
// rather than a single "invert" flag, since a user may want only one axis
// flipped — see PointerOrbit.setInvertPitch/setInvertYaw, the two methods
// this class's clicks ultimately drive.

import DOMScope from "@ui/DOMScope";

export interface OrbitInvertTogglesOptions {
  onPitchInvertChange: (inverted: boolean) => void;
  onYawInvertChange: (inverted: boolean) => void;
}

class OrbitInvertToggles {
  private readonly pitchButton: HTMLButtonElement;
  private readonly yawButton: HTMLButtonElement;
  private readonly onPitchInvertChange: (inverted: boolean) => void;
  private readonly onYawInvertChange: (inverted: boolean) => void;
  private pitchInverted: boolean;
  private yawInverted: boolean;

  constructor(options: OrbitInvertTogglesOptions) {
    const scope = new DOMScope(document);

    this.pitchButton = scope.require<HTMLButtonElement>(
      "#viewportInvertPitchToggle",
      "Invert-pitch toggle is missing.",
    );
    this.yawButton = scope.require<HTMLButtonElement>("#viewportInvertYawToggle", "Invert-yaw toggle is missing.");
    this.onPitchInvertChange = options.onPitchInvertChange;
    this.onYawInvertChange = options.onYawInvertChange;
    this.pitchInverted = true;
    this.yawInverted = false;

    this.pitchButton.addEventListener("click", this.onPitchClick);
    this.yawButton.addEventListener("click", this.onYawClick);
  }

  public dispose() {
    this.pitchButton.removeEventListener("click", this.onPitchClick);
    this.yawButton.removeEventListener("click", this.onYawClick);
  }

  private onPitchClick = () => {
    this.pitchInverted = !this.pitchInverted;
    this.pitchButton.setAttribute("aria-pressed", String(this.pitchInverted));
    this.onPitchInvertChange(this.pitchInverted);
  };

  private onYawClick = () => {
    this.yawInverted = !this.yawInverted;
    this.yawButton.setAttribute("aria-pressed", String(this.yawInverted));
    this.onYawInvertChange(this.yawInverted);
  };
}

export default OrbitInvertToggles;
