// The requestAnimationFrame loop and the play flag, which belong together.
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

class RenderLoop {
  private readonly onFrame: (timestamp: number) => void;
  private readonly onStart: () => void;
  private readonly onStop: () => void;
  private requestAnimationID: number;
  private playing: boolean;

  constructor(options: RenderLoopOptions) {
    this.onFrame = options.onFrame;
    this.onStart = options.onStart;
    this.onStop = options.onStop;
    this.requestAnimationID = 0;
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

  // An arrow property, and the one case R9 sanctions: it is handed to
  // requestAnimationFrame as a value and needs its `this`.
  private step = (timestamp: number) => {
    this.onFrame(timestamp);
    this.requestAnimationID = window.requestAnimationFrame(this.step);
  };
}

export default RenderLoop;
