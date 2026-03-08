export interface StateMachineUpdate<C, S extends string> {
  readonly context: C;
  readonly state: S;
  readonly elapsed: number;
  readonly delta: number;
  progress(duration: number): number;
  transition(nextState: S, payload?: unknown): void;
}

export interface StateMachineController<C, S extends string> {
  readonly context: C;
  readonly state: S;
  transition(nextState: S, payload?: unknown): void;
}

export interface StateDefinition<C, S extends string> {
  onEnter?: (
    context: C,
    controller: StateMachineController<C, S>,
    payload?: unknown,
  ) => void;
  onUpdate?: (context: C, update: StateMachineUpdate<C, S>) => void;
  onExit?: (
    context: C,
    controller: StateMachineController<C, S>,
    nextState: S,
  ) => void;
}

interface StateMachineOptions<C, S extends string> {
  context: C;
  initialState: S;
  states: Record<S, StateDefinition<C, S>>;
  startTime?: number;
}

class StateMachine<C, S extends string> {
  private readonly context: C;
  private readonly states: Record<S, StateDefinition<C, S>>;
  private currentState: S;
  private currentStateStartedAt: number;
  private lastUpdatedAt: number;

  constructor(options: StateMachineOptions<C, S>) {
    this.context = options.context;
    this.states = options.states;
    this.currentState = options.initialState;
    this.currentStateStartedAt = options.startTime ?? 0;
    this.lastUpdatedAt = options.startTime ?? 0;

    this.states[this.currentState].onEnter?.(
      this.context,
      this.createController(),
      undefined,
    );
  }

  public get state(): S {
    return this.currentState;
  }

  public transition(nextState: S, payload?: unknown, now?: number) {
    if (nextState === this.currentState) {
      return;
    }

    const transitionTime = now ?? this.lastUpdatedAt;
    const previousState = this.currentState;

    this.states[previousState].onExit?.(
      this.context,
      this.createController(previousState),
      nextState,
    );

    this.currentState = nextState;
    this.currentStateStartedAt = transitionTime;
    this.lastUpdatedAt = transitionTime;

    this.states[nextState].onEnter?.(
      this.context,
      this.createController(),
      payload,
    );
  }

  public update(now: number) {
    const delta = Math.max(0, now - this.lastUpdatedAt);
    this.lastUpdatedAt = now;

    this.states[this.currentState].onUpdate?.(
      this.context,
      this.createUpdate(now, delta),
    );
  }

  public rebaseTime(now: number) {
    const elapsedGap = now - this.lastUpdatedAt;
    this.currentStateStartedAt += elapsedGap;
    this.lastUpdatedAt = now;
  }

  private createController(state: S = this.currentState): StateMachineController<C, S> {
    return {
      context: this.context,
      state,
      transition: (nextState: S, payload?: unknown) =>
        this.transition(nextState, payload, this.lastUpdatedAt),
    };
  }

  private createUpdate(now: number, delta: number): StateMachineUpdate<C, S> {
    return {
      context: this.context,
      state: this.currentState,
      elapsed: Math.max(0, now - this.currentStateStartedAt),
      delta,
      progress: (duration: number) => {
        if (duration <= 0) {
          return 1;
        }

        return Math.min(1, Math.max(0, (now - this.currentStateStartedAt) / duration));
      },
      transition: (nextState: S, payload?: unknown) =>
        this.transition(nextState, payload, now),
    };
  }
}

export default StateMachine;
