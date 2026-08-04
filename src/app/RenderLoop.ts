// The requestAnimationFrame loop, the play flag and the frame-rate cap, which
// belong together.
//
// The statement order in start() and stop() is load-bearing and is preserved
// from Main verbatim: the side effects run first and the flag flips last. A
// caller that repaints on pause guards on `isPlaying` with the opposite
// polarity, so flipping the flag first would let the zeroing write in stop()
// trigger a paused repaint that the original ordering suppressed.

export interface RenderLoopOptions {
  onFrame: (timestamp: number) => void;
  onStart: () => void;
  onStop: () => void;
}

// Frames are admitted a hair before their deadline, and without this the cap
// costs frames it should not. A vsync is never exactly 1000/rate apart:
// consecutive rAF timestamps on a 60Hz display measure 16.6ms about as often as
// 16.7ms, so a strict comparison against a 16.667ms interval rejects the frame
// that was meant to render and the next one lands a whole vsync late. A 60 cap
// on a 60Hz display settles around 56fps that way, with a long gap every few
// frames — the drift correction below recovers the average but never the
// pacing. One millisecond is orders of magnitude above vsync jitter and still
// well under the shortest interval any display ships, so it can never admit a
// frame a whole vsync early.
const FRAME_DEADLINE_TOLERANCE_MS = 1;

class RenderLoop {
  private readonly onFrame: (timestamp: number) => void;
  private readonly onStart: () => void;
  private readonly onStop: () => void;
  private requestAnimationID: number;
  private playing: boolean;
  private frameInterval: number | null;
  private lastFrameAt: number;

  constructor(options: RenderLoopOptions) {
    this.onFrame = options.onFrame;
    this.onStart = options.onStart;
    this.onStop = options.onStop;
    this.requestAnimationID = 0;
    // Uncapped, which is the RENDER tab's MAX and its default. Nothing has to
    // push that at boot for the two to agree.
    this.frameInterval = null;
    this.lastFrameAt = 0;
    // Playing from construction, not from the first start(). The owner is built
    // and then configured, and the configuration path repaints through a guard
    // that reads this flag — so a loop that reported "paused" until start() ran
    // would paint frames the original never painted.
    this.playing = true;
  }

  public get isPlaying(): boolean {
    return this.playing;
  }

  public start() {
    this.onStart();
    this.requestAnimationID = window.requestAnimationFrame(this.step);
    this.playing = true;
  }

  public stop() {
    cancelAnimationFrame(this.requestAnimationID);
    this.onStop();
    this.playing = false;
  }

  public toggle() {
    if (this.playing) {
      this.stop();
      return;
    }

    this.start();
  }

  // null uncaps. The cap can only ever remove frames — rAF is the only clock
  // here — so 60 is a real cap on a 120Hz display and does nothing on a 60Hz
  // one, and MAX is whatever the display offers.
  //
  // Capping slows the spin, and that is accepted rather than a bug to chase.
  // CameraController.rotate() applies a fixed angle per *rendered* frame, which
  // is exactly why the CAMERA card labels that row °/f; at 30 the mesh turns at
  // half speed. Making rotation time-based changes how the engine looks at its
  // default setting and rewrites the SPIN RATE derivation, which is de-mock E1's
  // work and not a UI control's.
  public setFrameRateCap(fps: number | null) {
    this.frameInterval = fps === null ? null : 1000 / fps;
  }

  // An arrow property, and the one case R9 sanctions: it is handed to
  // requestAnimationFrame as a value and needs its `this`.
  //
  // The reschedule is unconditional — only onFrame is gated — so a suppressed
  // frame costs one comparison and never touches FPSMeter. That is what keeps
  // the readouts reporting the rate actually rendered rather than the rate the
  // display offered.
  private step = (timestamp: number) => {
    if (this.admitsFrame(timestamp)) {
      this.onFrame(timestamp);
    }

    this.requestAnimationID = window.requestAnimationFrame(this.step);
  };

  // Advances the cap's clock as well as answering, which is why it is not called
  // shouldRender().
  //
  // The anchor moves by whole intervals rather than to the arrival time, and
  // that is the difference between a 30fps cap and a 20fps one. A frame that
  // misses its deadline waits a whole extra vsync; anchoring on that late
  // arrival makes the next deadline late too, and the loop settles at one render
  // per three vsyncs. Stepping the anchor instead leaves it on the original
  // grid, so the very next vsync renders and the rate holds.
  private admitsFrame(timestamp: number): boolean {
    if (this.frameInterval === null) {
      return true;
    }

    const elapsed = timestamp - this.lastFrameAt + FRAME_DEADLINE_TOLERANCE_MS;

    if (elapsed < this.frameInterval) {
      return false;
    }

    this.lastFrameAt += Math.floor(elapsed / this.frameInterval) * this.frameInterval;

    return true;
  }
}

export default RenderLoop;
