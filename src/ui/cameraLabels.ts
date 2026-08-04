// The two camera strings the viewport HUD and the CAMERA card both print.
//
// One decimal in both places, which is the whole reason these are not written
// out at each call site: the HUD's `cam.pos` and the card's POSITION row are the
// same number read off the same rig, and formatted twice they would start
// disagreeing about precision the first time either was tuned.

import type { EulerDegrees, Vector3 } from "@camera/CameraRig";

// A value of -1e-14 formats as "-0.0", which reads as a bug in a readout this
// ticket exists to make trustworthy — and it is reachable, because a quarter
// turn puts a float's worth of sine where an exact zero belongs. Rounding first
// makes the sign follow the printed value rather than the float behind it.
const oneDecimal = (value: number): string => (Math.round(value * 10) / 10 + 0).toFixed(1);

export const vector3Label = (position: Readonly<Vector3>): string =>
  `${oneDecimal(position.x)} ${oneDecimal(position.y)} ${oneDecimal(position.z)}`;

export const eulerDegreesLabel = (rotation: EulerDegrees): string =>
  `${oneDecimal(rotation.pitch)}° ${oneDecimal(rotation.yaw)}° ${oneDecimal(rotation.roll)}°`;
