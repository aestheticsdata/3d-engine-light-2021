// Where the key light is, as a unit vector — twice, because there are two
// frames and the difference between them is the whole design decision.
//
// The light is fixed in the WORLD, not in the viewer. The draft of E3a
// (COS-241) put it in eye space, from a tree where the camera turned nothing
// and there was no ground: azimuth and elevation were read straight off the
// screen, and orbiting could not move the highlight because there was nothing
// to orbit. E1c made the camera move the world and E5a gave that world a floor
// and a horizon, so a light welded to the viewer would now leave the highlight
// motionless while the ground swings past underneath it — which reads as
// shading painted into the texture rather than a light in the room.
//
// The forcing argument is downstream. E5b casts a ground shadow, and a shadow is
// cast onto a plane in world coordinates; a light with no fixed relation to that
// plane cannot cast a coherent one. Choosing eye space here would mean E5b
// throwing this away and deriving a world light of its own.
//
// So the direction is built in the world and rotated into eye space once per
// frame, against the same matrix the vertices are rotated by. That is what makes
// the light and the geometry agree by construction rather than by two
// conventions being kept in step.
//
// Both vectors point FROM the surface TOWARD the light, which is the sense the
// Lambert dot product wants.

// The world frame is the one every vertex is authored in: x right, y DOWN
// (canvas convention, inherited from convert3D2D's `centerY + y * scale`), z
// away from the eye. So "up" is negative y, and GROUND_Y is a positive number
// below the origin.
const DEGREES_TO_RADIANS = Math.PI / 180;

export type Vec3 = [number, number, number];

// Elevation lifts the light off the ground plane; azimuth swings it around the
// vertical. Azimuth 0 puts it on +x — from the right — and increases
// counter-clockwise seen from above, so it travels right, front, left. The two
// shipped defaults (135, 42) therefore give the upper-left key tilted toward the
// viewer that the console has always drawn as a mock, which is the constraint
// that fixed the sign of z rather than any argument from first principles.
//
// Elevation is measured from the ground plane E5a built, not from the screen
// plane the draft measured it from. At 90 the light is directly overhead in the
// world, which is a different picture from the headlight the draft's 90 gave.
export const worldLightDirection = (azimuthDegrees: number, elevationDegrees: number): Vec3 => {
  const azimuth = azimuthDegrees * DEGREES_TO_RADIANS;
  const elevation = elevationDegrees * DEGREES_TO_RADIANS;
  const horizontal = Math.cos(elevation);

  return [horizontal * Math.cos(azimuth), -Math.sin(elevation), -horizontal * Math.sin(azimuth)];
};

// The camera's rotation, applied to a direction — so column 3 is skipped rather
// than ignored by accident: a translation moves points and cannot move a
// direction, and adding it would make the light swing whenever the orbit target
// does.
//
// Pass CameraRig.viewMatrix(), never meshMatrix(). Two reasons, and both are
// bugs if it goes the other way: the mesh matrix carries the turntable spin, so
// the light would chase the shape around and the shading would never move; and
// since E4a it carries the SCALE factor, so the returned vector would stop being
// a unit vector and every Lambert term would be quietly multiplied by the scale.
// The view matrix's linear part is pure rotation, which is what lets this skip
// the renormalising divide.
export const toEyeSpace = (world: Vec3, cameraTransform: number[][]): Vec3 => [
  cameraTransform[0][0] * world[0] + cameraTransform[0][1] * world[1] + cameraTransform[0][2] * world[2],
  cameraTransform[1][0] * world[0] + cameraTransform[1][1] * world[1] + cameraTransform[1][2] * world[2],
  cameraTransform[2][0] * world[0] + cameraTransform[2][1] * world[1] + cameraTransform[2][2] * world[2],
];
