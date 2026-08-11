/// <reference types="vite/client" />

// Ignition, and nothing else.
//
// Not the bare `new Bootstrapper().run()` the ticket asked for: boot resolves the
// canvas and decodes the sky before Main can exist, so the construction has to
// wait on that promise. Folding the `then` into Bootstrapper would make it
// import the class it exists to prepare for, which is the cycle this split was
// meant to remove.

import Bootstrapper from "@app/Bootstrapper";
import Main from "@app/Main";

new Bootstrapper().run().then((context) => {
  const main = new Main(context);

  main.init();

  // The one caller Main.dispose() has ever had (E8a). Vite re-executes this
  // module on an edit without tearing the previous one down, and Main now owns
  // listeners that are not attached to anything the reload replaces — a window
  // keydown handler and a click handler on every [data-action] button. Without
  // this they accumulate one set per edit, and a single press of SPACE toggles
  // the loop once for every time the file was saved.
  import.meta.hot?.dispose(() => main.dispose());
});
