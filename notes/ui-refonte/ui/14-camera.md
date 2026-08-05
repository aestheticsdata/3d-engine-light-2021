# Camera stats widget

The camera card reports position, rotation, distance, clip planes and FOV/aspect. The mockup's camera model does not exist in this engine, and resolving that mismatch — not the layout — is the substance of this ticket. Card shell, header and stat rows come from the primitives ticket.

**Design source** — `3D Engine UI.dc.html` desktop L388–L415, mobile L1469–L1475 (`statGroups` CAMERA rows).

## The mismatch

The design derives an orbit camera from the pitch / yaw / zoom sliders (L1377–L1381):

```
dist = 12 - (zoom / 100) * 6
rad  = Math.PI / 180
camX = dist * Math.sin(yaw * rad) * Math.cos(pitch * rad)
camZ = dist * Math.cos(yaw * rad) * Math.cos(pitch * rad)
camY = 1.2 + dist * Math.sin(pitch * rad)
```

Every premise of that formula is false here:

- **There is no camera transform.** `Point3D.convert3D2D()` (src/primitives/Point3D.ts) is a bare perspective divide: `scale = fl / (fl + z + zOffset)`, `x' = vpX + x * scale`, `y' = vpY + y * scale`. `fl` is `DEFAULT_FOCAL_LENGTH = 300` (src/index.ts L20) and never changes; `vpX` / `vpY` are the canvas half-dimensions (512 / 320), cached per point at construction.
- **Zoom is not a distance.** `sliderToZoomOffset()` maps the 0–100 slider linearly onto `zOffset` from `ZOOM_ZOFFSET_FAR = 260` to `ZOOM_ZOFFSET_NEAR = -220` (src/index.ts L21–L25, L46–L55), and `zOffset` is applied to the *object's* z, not to a camera.
- **Pitch / yaw / roll are rates, not angles.** `rotateMesh()` (src/index.ts L423–L440) applies, every frame, `((pitch - centerY) / 110) * (rotationSpeed / 100)` of pitch, `(-(yaw - centerX) / 110) * (rotationSpeed / 100)` of yaw and `(roll / 500) * (rotationSpeed / 100)` of roll, accumulating into the mesh. Those numbers are **degrees**, not radians: `Matrix3D.setAngle()` does `agl = agl * (Math.PI / 180)` internally. Pitch and yaw are zero at the canvas centre (`centerY = 320`, `centerX = 512`, src/index.ts L181–L182); roll is zero at 0 and has no centre offset. The defaults are 400 / 400 / 200 (L26–L28), deliberately off-centre so the shape spins at rest. Slider ranges are pitch/yaw 0–800 and roll −1000–1200 (src/index.html L96, L100, L104). No absolute orientation is stored anywhere.
- **There are no clip planes and no projection switch.** Nothing corresponds to `0.1 / 1000`, and the engine is always perspective.

This is settled by the epic's transform decision: the UI epic keeps the engine's rotation *rates* and does not change renderer behaviour. Absolute angles and a real camera rig move to de-mock ticket E1. So this card ships real, engine-truthful values and relabels two rows. Printing "POSITION 4.2 3.1 -6.8" while nothing on screen corresponds to it is worse than an em dash — it invites someone to "fix" a camera that does not exist.

## Desktop

Card sits second in the second telemetry row at `flex:1`.

- `.panel--fill` + `.panel__header--card` (22px). `.panel__title` `CAMERA`, `.panel__note` `PERSPECTIVE`.
- Body: `.panel__body--pad-4` (8px) plus `flex:1`.
- Rows (5): `.stat-list` + `.stat-row`, which already supply the 4px gap, the label type and the value type. No per-row colour modifier — every value is `--color-text-primary`.

## Mobile

`statGroups` CAMERA card in the STATS tab (L1469–L1475), third of the four `statGroups` cards. Entirely the primitives' mobile stat-card recipe: `.panel__header--card` (26px, 9px padding), `.panel__body--pad-stats` (8px 11px 10px), five `.stat-row` at `--size-row-stat` (28px) with the mobile label/value type. Title `CAMERA`, note `PERSPECTIVE`. Do not re-derive the padding, the row height or the type here.

The one thing this ticket adds at the breakpoint is overflow behaviour. The POSITION value (`0.0 0.0 -320.0`, 14 characters) is among the longest in the mobile stats stack, second only to SYSTEM's `1024 × 640 × 32`. Give `.stat-row__value` `min-width:0` and `white-space:nowrap`, keep it right-aligned, and let the label truncate rather than the number; verify at 360px and again at 320px. Display-only card, no touch targets.

## Data

| Field | Value shown | Source today |
| --- | --- | --- |
| Header note | `PERSPECTIVE` | Real, constant — `convert3D2D()` is always a perspective divide and there is no projection control. |
| POSITION | `0.0 0.0 <-(300 + zOffset)>` e.g. `0.0 0.0 -320.0` at the default slider | Real, derived. Moving the object by `zOffset` is mathematically identical to moving the eye, so the equivalent camera sits `fl + zOffset` units back on -Z. Updates live with the zoom slider. |
| ROTATION → relabel **SPIN RATE** | `<p>°/f <y>°/f <r>°/f` to 2 decimals | Real, derived — the three per-frame rates from `rotateMesh()`, already in degrees per frame: `((pitch - 320) / 110) * (speed / 100)`, `(-(yaw - 512) / 110) * (speed / 100)`, `(roll / 500) * (speed / 100)`. No radian conversion — `Matrix3D.setAngle()` takes degrees. Keeping the label `ROTATION` would be a lie; the row is a rate. |
| DISTANCE | `<300 + zOffset>.toFixed(1) + ' u'` | Real, derived. Engine units, not metres — drop the mock's `m` suffix. Range 560 u (slider 0) to 80 u (slider 100). |
| NEAR / FAR | `1 / 5000` | Real since COS-236 (de-mock E2), which gave the camera a view volume; the row shipped relabelled **FOCAL / OFFSET** until then, because there were no clip planes to print and focal + z-offset were the two numbers that actually defined the projection. Far is inert by construction — 5000 against a maximum reachable depth of ~4719 — and near is not: it is what clips the near cap of a shape at high zoom instead of letting it project mirrored. |
| FOV / ASPECT | `93.7° / 1.60` | Real, derived and constant. Vertical FOV `2 * Math.atan((canvas.height / 2) / 300)` = 93.7° — specify vertical, since horizontal would be 119.3°. Aspect `canvas.width / canvas.height` = 1024 / 640 = 1.60, which happens to match the mock's hardcoded 1.60 exactly. Read both from the canvas, do not hardcode. |

Constraint to record: the canvas is fixed at 1024×640 (src/index.html L57). `BackgroundRenderer` and `ShapeTransitionMachine` receive `{width, height}` at construction and `Point3D` caches `vpX`/`vpY` per point, so aspect and FOV cannot change at runtime and can be computed once at boot.

This card carries no triangle number and must not grow one. The **drawn count** (what `Surface3D.render` returns) belongs to the viewport and the toolbar; the **registry count** belongs to SHAPE INFO and GEOMETRY.

RESET, owned by the toolbar ticket, restores the zoom, pitch, yaw, roll and rotation-speed sliders, so every row on this card must return to its default reading after a Reset. Verify that as part of the toolbar ticket's enumerated criteria.

## Files

- `src/index.html` — desktop card markup and the mobile `statGroups` CAMERA card
- `src/ui/telemetry/CameraWidget.ts` — new; owns the derived position / spin-rate / distance / focal / FOV values
- `src/index.ts` — expose `zOffset`, `focal`, the pitch / yaw / roll slider values and `rotationSpeed` to the widget; feed it from the existing 90ms display gate
- `src/styles/components/cameraStats.css` — new; the mobile value overflow rule only. Card shell, header and stat rows come from the primitives ticket.
- `src/styles/main.css` — import

## Done when

- [ ] Desktop card renders 5 `.stat-row` under a 22px header noting `PERSPECTIVE`
- [ ] Mobile `statGroups` CAMERA card renders 5 rows at 28px with no value truncation at 360px or 320px width
- [ ] POSITION and DISTANCE change live with the zoom slider and match `300 + zOffset`
- [ ] SPIN RATE reaches exactly `0.00°/f` on pitch at slider 320 and on yaw at slider 512, and on roll at slider 0, and scales with the rotation-speed slider
- [ ] SPIN RATE prints degrees per frame with no `180 / Math.PI` factor anywhere in the widget
- [ ] FOV / ASPECT is computed from the canvas dimensions and the focal length, not hardcoded, and reads `93.7° / 1.60`
- [ ] The two relabelled rows (SPIN RATE, FOCAL / OFFSET) and the dropped `m` suffix are noted in a code comment pointing at the design line numbers — both relabels have since been reverted, ROTATION by COS-237 and NEAR / FAR by COS-236, and only the `m` suffix survives as a deviation
- [ ] `cameraStats.css` declares no card, header or stat-row recipe
- [ ] No raw hex/px outside the token files
