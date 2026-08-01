// Ignition, and nothing else.
//
// Not the bare `new Bootstrapper().run()` the ticket asked for: boot resolves the
// canvas and decodes the sky before Main can exist, so the construction has to
// wait on that promise. Folding the `then` into Bootstrapper would make it
// import the class it exists to prepare for, which is the cycle this split was
// meant to remove.

import Bootstrapper from "@app/Bootstrapper";
import Main from "@app/Main";

new Bootstrapper().run().then((context) => new Main(context).init());
