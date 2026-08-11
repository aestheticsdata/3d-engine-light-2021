// The one place a console action is named, and the one place a click or a key
// turns into a call.
//
// Before this there were two dispatch paths that could not see each other: the
// toolbar bound its buttons directly, and shortcuts.ts described eight keys that
// nothing listened for. A chip could therefore print a key no handler bound, and
// a button could do something no chip documented. Both paths now end here, which
// is what makes that drift unrepresentable rather than merely discouraged.
//
// A miss throws, and it throws at BIND time as well as at call time: markup
// carrying data-action="stpeFrame" fails the boot it ships in rather than doing
// nothing the first time somebody presses it. A registry whose misses are silent
// is a registry that lets a typo reach production looking exactly like a
// disabled control.

// Every action the console can perform. The file half of the toolbar — capture,
// preset save and load, copy code — joins this union with E8b; it is deliberately
// absent rather than registered to a stub, so those buttons keep their honest
// placeholder affordance until they do something.
export type ActionId =
  | "togglePause"
  | "stepFrame"
  | "resetControls"
  | "toggleWireframe"
  | "toggleBackfaceCulling"
  | "toggleSky"
  | "toggleFloor"
  | "toggleGrid"
  | "selectPrimitive";

// Only the primitive picker's digit keys carry an argument, so it is optional
// rather than a parameter the other eight handlers would each have to ignore.
type ActionHandler = (argument?: number) => void;

interface BoundAction {
  node: HTMLElement;
  listener: () => void;
}

class ActionRegistry {
  private readonly handlers: Map<ActionId, ActionHandler>;
  private readonly bound: BoundAction[];

  constructor() {
    this.handlers = new Map();
    this.bound = [];
  }

  public register(id: ActionId, handler: ActionHandler) {
    this.handlers.set(id, handler);
  }

  public run(id: ActionId, argument?: number) {
    const handler = this.handlers.get(id);

    if (!handler) {
      throw new Error(`No handler is registered for action "${id}".`);
    }

    handler(argument);
  }

  // One listener per [data-action] node, which reaches both toolbar mounts at
  // once — the same "one selector, every mount" shape TransportBar and
  // FieldWriter already use, and the reason no caller has to know the toolbar
  // exists twice in the DOM.
  //
  // Deliberately not a single delegated listener on the app root, which is the
  // obvious alternative and is wrong here: the transport still binds its own
  // toggle mounts directly, so a delegated listener would fire alongside that
  // binding on any node carrying both and every RESET would run twice.
  //
  // Must run after every register() call, since an unregistered id is a boot
  // failure rather than a warning.
  public bindDomActions() {
    for (const node of document.querySelectorAll<HTMLElement>("[data-action]")) {
      const id = node.dataset.action as ActionId;

      if (!this.handlers.has(id)) {
        throw new Error(`Markup names the action "${id}", which nothing registered.`);
      }

      const listener = () => this.run(id);

      node.addEventListener("click", listener);
      this.bound.push({ node, listener });
    }
  }

  // Vite's HMR re-executes the module without tearing the old one down, so
  // without this every button would gain a second listener on each edit and
  // start firing twice.
  public dispose() {
    for (const entry of this.bound) {
      entry.node.removeEventListener("click", entry.listener);
    }

    this.bound.length = 0;
  }
}

export default ActionRegistry;
