// Resolve an element or throw, in one place.
//
// Six widgets each spell out their own "find my node or throw", and Main runs
// nineteen consecutive getElementById calls behind a single twenty-clause
// guard — so adding a row to any panel means editing Main's constructor, and a
// missing id reports the whole guard rather than the node that is actually
// absent. A scope closes both: each panel resolves against its own root, and
// the throw names the selector it could not find.
//
// `require` returns T with no `| null` on purpose. That is the entire value of
// the class: a caller writes the happy path and the absent case becomes a
// startup crash naming the culprit, rather than a `!` assertion or an
// optional-chain that quietly does nothing three widgets later.

class DOMScope {
  private readonly root: ParentNode;

  constructor(root: ParentNode) {
    this.root = root;
  }

  public require<T extends HTMLElement>(selector: string, message: string): T {
    const node = this.root.querySelector<T>(selector);

    if (!node) {
      throw new Error(`${message} — no element matches ${selector}.`);
    }

    return node;
  }

  public find<T extends HTMLElement>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }
}

export default DOMScope;
