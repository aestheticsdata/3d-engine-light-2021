// The product id and build string, in one place. Both branches of the brand
// block render these, so the version must not be typed into markup twice — and
// a hardcoded literal would quietly go stale the first time package.json is
// bumped.
//
// __APP_VERSION__ is replaced at build time by the `define` in vite.config.js,
// which reads package.json. Declared for TypeScript in vite-env.d.ts.

export const APP_ID = "HALCYON";

export const BUILD = __APP_VERSION__;

// Desktop shows the word BUILD and separates with two spaces, as the design
// draws it; mobile drops the word and uses one space to fit the 52px header.
export const BUILD_LABEL_DESKTOP = `${APP_ID}  BUILD ${BUILD}`;

export const BUILD_LABEL_MOBILE = `${APP_ID} ${BUILD}`;
