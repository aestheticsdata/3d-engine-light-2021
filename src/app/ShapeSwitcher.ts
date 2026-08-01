// Which shape is on screen, which one is arriving, and which one was asked for
// while the last change was still animating.
//
// Three names rather than one, because a transition takes 1250ms and the user
// can click through the picker faster than that. `current` is what has finished
// arriving, `target` is what is arriving now, and `queued` is the most recent
// request made mid-flight — later requests overwrite it, so clicking through
// five primitives lands on the fifth and plays two animations, not five.

import ShapeTransitionMachine from "@animations/shapeTransitionMachine";
import Mesh from "@primitives/Mesh";
import { Data3D } from "@data/types";
import { MeshRenderRequest } from "@primitives/Surface3D";

export interface ShapeSwitcherOptions {
  objects3D: Data3D;
  transitionMachine: ShapeTransitionMachine;
  buildMesh: (primitive: string) => Mesh;
  // Runs before the mesh is built, so the panels repaint against the outgoing
  // shape's state — which is what lets the fade decide whether there is
  // anything to fade out of.
  onTransitionStart: (primitive: string) => void;
}

class ShapeSwitcher {
  private readonly objects3D: Data3D;
  private readonly primitiveNames: string[];
  private readonly transitionMachine: ShapeTransitionMachine;
  private readonly buildMesh: (primitive: string) => Mesh;
  private readonly onTransitionStart: (primitive: string) => void;
  private currentPrimitiveName: string | null;
  private targetPrimitiveName: string | null;
  private queuedPrimitiveName: string | null;

  constructor(options: ShapeSwitcherOptions) {
    this.objects3D = options.objects3D;
    this.primitiveNames = Object.keys(this.objects3D);
    this.transitionMachine = options.transitionMachine;
    this.buildMesh = options.buildMesh;
    this.onTransitionStart = options.onTransitionStart;
    this.currentPrimitiveName = null;
    this.targetPrimitiveName = null;
    this.queuedPrimitiveName = null;
  }

  public get names(): string[] {
    return this.primitiveNames;
  }

  public get current(): string | null {
    return this.currentPrimitiveName;
  }

  // An arrow property: it is handed to the primitive picker as a change
  // callback and would lose its `this` as a plain method.
  public request = (primitive: string) => {
    if (primitive === this.targetPrimitiveName) {
      return;
    }

    if (this.transitionMachine.isAnimating()) {
      this.queuedPrimitiveName = primitive;
      return;
    }

    this.startTransition(primitive, performance.now());
  };

  public update(timestamp: number) {
    this.transitionMachine.update(timestamp);
  }

  public syncQueue(now: number) {
    if (this.transitionMachine.isAnimating()) {
      return;
    }

    if (this.targetPrimitiveName) {
      this.currentPrimitiveName = this.targetPrimitiveName;
    }

    if (
      this.queuedPrimitiveName &&
      this.queuedPrimitiveName !== this.currentPrimitiveName
    ) {
      const nextPrimitive = this.queuedPrimitiveName;
      this.queuedPrimitiveName = null;
      this.startTransition(nextPrimitive, now);
      return;
    }

    this.queuedPrimitiveName = null;
  }

  // The live array the render loop reads every frame, not a copy.
  public getRenderables(): MeshRenderRequest[] {
    return this.transitionMachine.getRenderables();
  }

  public getActiveMeshes(): Mesh[] {
    return this.transitionMachine.getActiveMeshes();
  }

  public isAnimating(): boolean {
    return this.transitionMachine.isAnimating();
  }

  public syncClock(now: number) {
    this.transitionMachine.syncClock(now);
  }

  private startTransition(primitive: string, now: number) {
    this.onTransitionStart(primitive);

    const mesh = this.buildMesh(primitive);

    // Both conjuncts matter. `currentPrimitiveName` is only promoted from
    // `targetPrimitiveName` inside syncQueue, which runs from the render loop —
    // so on first load the name is still null while the machine may already
    // hold a mesh. Dropping either test flips first load between the entrance
    // and the switch animation.
    if (
      !this.currentPrimitiveName &&
      !this.transitionMachine.getActiveMeshes().length
    ) {
      this.transitionMachine.playInitialEntrance(mesh, now);
    } else {
      this.transitionMachine.switchTo(mesh, now);
    }

    this.targetPrimitiveName = primitive;
  }
}

export default ShapeSwitcher;
