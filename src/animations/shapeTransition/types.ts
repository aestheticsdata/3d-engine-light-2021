// The vocabulary the machine, its context and its three states all share.
//
// It sits in its own module for one reason: the façade imports the states and
// the states need the state names, so declaring the names on the façade would
// make the two files import each other.

import Mesh from "@primitives/Mesh";

export type ShapeTransitionState = "idle" | "entering" | "switching";

export interface TransitionPayload {
  mesh: Mesh;
}
