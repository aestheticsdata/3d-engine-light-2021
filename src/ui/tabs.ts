// Tab groups, driven entirely by an attribute on the shell root.
//
// The module sets no inline styles and hides nothing itself: it writes
// `attribute` (data-tab or data-mtab) on `root`, and CSS reacts with attribute
// selectors. That is what lets the desktop and mobile branches share one DOM
// tree — crossing the breakpoint re-lays out with no JS and no listener
// re-attached, because neither tab state depends on the viewport width.
//
// The two groups are independent on purpose, exactly as the design keeps its
// own `tab` and `mtab` separate: switching to RENDER on a phone must not move
// the desktop inspector when the window is widened again.

interface TabGroupOptions {
  tablist: HTMLElement;
  root: HTMLElement;
  attribute: string;
  initial: string;
  onChange?: (id: string) => void;
}

export const createTabGroup = (options: TabGroupOptions) => {
  const { tablist, root, attribute, initial, onChange } = options;
  const tabs = Array.from(
    tablist.querySelectorAll<HTMLElement>("[data-tab-id]"),
  );

  if (tabs.length === 0) {
    return {
      select: (_id: string, _moveFocus?: boolean) => {},
      current: () => initial,
    };
  }

  let current = initial;

  const select = (id: string, moveFocus = false) => {
    const target = tabs.find((tab) => tab.dataset.tabId === id);
    if (!target) {
      return;
    }

    current = id;
    root.setAttribute(attribute, id);

    tabs.forEach((tab) => {
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

    onChange?.(id);
  };

  const step = (from: number, delta: number) => {
    const next = (from + delta + tabs.length) % tabs.length;
    const id = tabs[next].dataset.tabId;
    if (id) {
      select(id, true);
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.tabId;
      if (id) {
        select(id);
      }
    });

    tab.addEventListener("keydown", (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          step(index, -1);
          break;
        case "ArrowRight":
          event.preventDefault();
          step(index, 1);
          break;
        case "Home":
          event.preventDefault();
          step(0, 0);
          break;
        case "End":
          event.preventDefault();
          step(tabs.length - 1, 0);
          break;
        default:
          break;
      }
    });
  });

  select(initial);

  return { select, current: () => current };
};

export default createTabGroup;
