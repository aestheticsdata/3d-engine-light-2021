// One writer for every value the UI displays.
//
// setField writes to *every* node carrying [data-field="<name>"], not the first
// one. That is the whole point: several values appear twice in the DOM because
// the desktop and mobile branches present them differently (the camera readout
// is a 4-row panel on desktop and three stacked chips on mobile, for instance),
// and both nodes exist at once since the two branches are one DOM tree plus
// media queries. Writing to all of them keeps the pair in sync without any
// caller having to know which branch is showing.
//
// Known field names, owned by the tickets that introduce them:
//   shell        buildDesktop, buildMobile, fps, trisDrawn
//   status bar   statusLabel, selectedId, shadingMode, texLabel
//   viewport     resolution, camPos, camRot, camTarget, camDist, fov, zoom
//   frame time   frameMs
//   system       uptime

export const setField = (name: string, value: string | number) => {
  const text = String(value);

  document
    .querySelectorAll<HTMLElement>(`[data-field="${name}"]`)
    .forEach((node) => {
      node.textContent = text;
    });
};

export default setField;
