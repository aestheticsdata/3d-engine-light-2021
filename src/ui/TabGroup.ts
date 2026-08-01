// Tab groups, driven entirely by an attribute on the shell root.
//
// The class sets no inline styles and hides nothing itself: it writes
// `attribute` (data-tab or data-mtab) on `root`, and CSS reacts with attribute
// selectors. That is what lets the desktop and mobile branches share one DOM
// tree — crossing the breakpoint re-lays out with no JS and no listener
// re-attached, because neither tab state depends on the viewport width.
//
// The two groups are independent on purpose, exactly as the design keeps its
// own `tab` and `mtab` separate: switching to RENDER on a phone must not move
// the desktop inspector when the window is widened again.

export interface TabGroupOptions {
  tablist: HTMLElement;
  root: HTMLElement;
  attribute: string;
  initial: string;
  onChange?: (id: string) => void;
}

class TabGroup {
  private readonly tabs: HTMLElement[];
  private readonly root: HTMLElement;
  private readonly attribute: string;
  private readonly onChange?: (id: string) => void;
  private _current: string;

  constructor(options: TabGroupOptions) {
    this.tabs = Array.from(
      options.tablist.querySelectorAll<HTMLElement>("[data-tab-id]"),
    );
    this.root = options.root;
    this.attribute = options.attribute;
    this.onChange = options.onChange;
    this._current = options.initial;

    // Inline arrows rather than bound class properties: the keydown handler
    // needs the tab's index, which this closure already has and an arrow
    // property would have to rebuild with an indexOf lookup on every keystroke.
    this.tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.tabId;

        if (id) {
          this.select(id);
        }
      });

      tab.addEventListener("keydown", (event: KeyboardEvent) => {
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            this.step(index, -1);
            break;
          case "ArrowRight":
            event.preventDefault();
            this.step(index, 1);
            break;
          case "Home":
            event.preventDefault();
            this.step(0, 0);
            break;
          case "End":
            event.preventDefault();
            this.step(this.tabs.length - 1, 0);
            break;
          default:
            break;
        }
      });
    });

    // Last statement of the constructor, and it has to stay last. Field
    // initializers run before the constructor body under
    // useDefineForClassFields, so selecting before `tabs`, `root` and
    // `attribute` are assigned would write undefined as the attribute value.
    this.select(options.initial);
  }

  public get current(): string {
    return this._current;
  }

  // An empty tablist is not a special case: this returns at the guard below,
  // `current` still reports the initial id, and no listener was ever bound — so
  // the keyboard paths that would divide by tabs.length are unreachable. That
  // is the same observable behaviour the old null-object branch produced, with
  // one code path instead of two.
  public select(id: string, moveFocus = false) {
    const target = this.tabs.find((tab) => tab.dataset.tabId === id);

    if (!target) {
      return;
    }

    this._current = id;
    this.root.setAttribute(this.attribute, id);

    this.tabs.forEach((tab) => {
      const isActive = tab === target;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      // Roving tabindex: only the active tab is in the tab order, so Tab moves
      // past the whole strip and the arrow keys move within it.
      tab.tabIndex = isActive ? 0 : -1;
    });

    if (moveFocus) {
      target.focus();
    }

    this.onChange?.(id);
  }

  private step(from: number, delta: number) {
    const next = (from + delta + this.tabs.length) % this.tabs.length;
    const id = this.tabs[next].dataset.tabId;

    if (id) {
      this.select(id, true);
    }
  }
}

export default TabGroup;
