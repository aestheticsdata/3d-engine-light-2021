# Design primitive extraction — `3D Engine UI.dc.html` (1539 lines, read in full)

Verified by full read plus exhaustive grep. Totals: **37 distinct hex literals, 12 distinct rgba literals, 31 distinct font shorthands, 10 letter-spacing values, 5 line-heights, 6 radii forms, 1 blur value, 1 keyframe animation, 1 breakpoint, 0 box-shadows, 0 CSS transitions**.

---

## 1. Colors

Every literal below is present in the file. Counts are occurrences. Target file for **all** of this section: **`colors.css`** (the rgba overlay literals too — see note in section 6).

### 1.1 Page / canvas backgrounds

| Literal | Proposed token | Used for |
|---|---|---|
| `#05091A` (×4) | `--color-bg-app` | page background — `html, body` L15, root wrapper L31, desktop frame L34, mobile frame L674 |
| `#0A1330` (×36) | `--color-surface-sunken` | recessed/inset surface: viewport frame L166/L699, toolbar HUD chips L54/L60, secondary "COPY CODE" bg L71/L696, stat tiles L267–279/L754–766, scene-row visibility button L90/L793, shortcut pills L643–650, frame-time bar track L293/L1048, poly-budget bar track L359/L1060, scrollbar track L24, fps canvas fill L1268, inactive chip bg (`chip()` L1316), toggle inactive half (`toggleRow()` L1323–1324) |

### 1.2 Panel surfaces

| Literal | Proposed token | Used for |
|---|---|---|
| `#0B1637` (×36) | `--color-panel-bg` | every card/panel surface, toolbar strip L37/L45, brand block, status bar L657/L1104, right panel L450, mobile header L676. **Also doubles as `--color-on-accent`** — the foreground on yellow surfaces: primary button text L46/L688, toggle ON label (`toggleRow` L1323), active quick-toggle fg (`quick` L1338), selection-box label L219 |
| `#0E1B40` (×26) | `--color-panel-header-bg` | panel header strip (all), desktop tab strip L451, mobile tab-bar container L774 |
| `#122152` (×1) | `--color-tab-active-bg-mobile` | mobile active tab background only (`mTab()` L1391) |
| `#152A5C` (×10) | `--color-button-secondary-bg` | STEP / RESET / CAPTURE PNG / SAVE PRESET / LOAD L49–70, mobile action row L692–695, mobile RESET SCENE L1112 |
| `#1D3670` (×5) | `--color-button-secondary-bg-hover` | `style-hover="background:#1D3670"` on all desktop secondary buttons |
| `#172E62` (×1) | `--color-row-selected-bg` | selected scene-graph row (`objects[].bg` L1357) |
| `#142654` (×1) | `--color-row-hover-bg` | desktop scene-graph row hover L86 |
| `#1E3B7A` (×3) | `--color-chip-active-bg` | active chip (`chip(true)` L1315), active PERSPECTIVE/ORTHOGRAPHIC L1532–1533 |
| `#12285C` (×2) | `--color-badge-info-bg` | DENSITY badge L145 / L847 |

### 1.3 Borders

| Literal | Proposed token | Used for |
|---|---|---|
| `#1E3364` (×67) | `--color-border-panel` | the 1px border on every panel, every panel-header `border-bottom`, section divider rules L122/L476/L507/L560/L613, story footer `border-top` L149/L851, right-panel shortcuts `border-top` L640 |
| `#1B2E5C` (×23) | `--color-border-subtle` | stat tiles L267–279, shortcut pills L643–650, inactive chip border (`chip()` L1316), unselected swatch border L1495, card inner `border-top` L321/L354, inactive persp/ortho border L1532–1533; also the fps-chart gridline stroke L1271 |
| `#23386B` (×14) | `--color-border-muted` | toolbar HUD chip border L54/L60, COPY CODE border L71/L696, status-bar separators L659/L661/L663/L667/L1106/L1108, mobile fps chip L683, toolbar divider L52, range track fill L20, scrollbar thumb L25 |
| `#26406F` (×14) | `--color-border-control` | secondary button border, toggle outer border L552/L620/L951/L989 |
| `#142653` (×2) | `--color-border-row-mobile` | mobile pipeline/environment row `border-bottom` L949/L987 |
| `#2A4A8F` (×2) | `--color-border-badge-info` | DENSITY badge border L145/L847 |
| `#3A4E7E` (×10) | `--color-slate-500` | multi-role: HUD inline separators L247/L249/L733, PRESENT frame-time segment L297/L316/L1052, toggle inactive-half background + dim label (`toggleRow` L1323–1324), fps-chart axis label fill L1276 |
| `#2C4A8A` (×1) | `--color-zbuf-far` | far z-buffer bars (`i >= 19`, L1447) |
| `#35538F` (×1) | `--color-scrollbar-thumb-hover` | `::-webkit-scrollbar-thumb:hover` L26 |

### 1.4 Accent (yellow family)

| Literal | Proposed token | Used for |
|---|---|---|
| `#FFC81E` (×84) | `--color-accent` | brand mark L38/L677, all panel-header titles, all section titles, primary button bg, active chip border + fg, active tab fg + 2px underline, story rule L142/L844, selection-box brackets + label bg L215–219/L721–724, TRANSFORM frame-time segment L294/L301/L1049, poly-budget… (no), range thumb L21, link color L17, toggle ON bg, fps-chart line + last-sample dot L1295/L1299 |
| `#FFE07A` (×3) | `--color-accent-hover` | `a:hover` L18, range thumb hover L22, primary button hover L46 |
| `rgba(255,200,30,.92)` (×1) | `--color-accent-overlay` | active quick-toggle HUD chip bg (`quick()` L1337) |
| `rgba(255,200,30,.5)` (×2) | `--color-accent-overlay-border` | HUD shading-mode chip border L172/L703 |
| `rgba(255,200,30,.30)` (×1) | `--color-accent-fade-top` | fps chart area gradient stop 0 L1289 |
| `rgba(255,200,30,0)` (×1) | `--color-accent-fade-bottom` | fps chart area gradient stop 1 L1290 |

### 1.5 Text

| Literal | Proposed token | Used for |
|---|---|---|
| `#EAF0FF` (×84) | `--color-text-primary` | root color L31; every numeric value, slider value, stat value, HUD value; toggle OFF-active label |
| `#FFFFFF` (×4) | `--color-text-max` | story title L141/L843, selected+visible scene row label L1359, selected swatch border L1495 |
| `#BFD0F5` (×10) | `--color-text-button` | secondary button labels (desktop + mobile + RESET SCENE) |
| `#B9C8EC` (×13) | `--color-text-secondary` | story paragraph 1 L143/L845, HUD chip values L176–182/L705–716, mobile toggle-row label L950/L988, unselected+visible scene row label L1359 |
| `#8FA3CE` (×53) | `--color-text-tertiary` | stat row labels, frame-time legend labels, story paragraph 2, inactive chip fg (`chip()` L1316), inactive quick-toggle fg (`quick()` L1338), HUD footer text, shortcut pills, status bar text, mobile PRESENT stat row L1459 |
| `#7E93C4` (×8) | `--color-text-hud-label` | camera-readout keys `cam.pos` / `cam.rot` / `target` / `dist` L194–206, `fov` / `zoom` keys L233/L237/L710–711 |
| `#6F86B8` (×55) | `--color-text-muted` | field labels (NAME/POINTS/…), all slider labels, stat-tile captions, story footer labels, SHORTCUTS heading L641, inactive tab fg (`tabOn`/`mTab` L1385/L1392) |
| `#5A6E9E` (×35) | `--color-text-dim` | build string L41/L680, `fps` / `ms` units, every panel-header note, chip triangle counts, scene-row kind + tris, z-buffer axis labels, footer URL L666, mobile uptime L1109 |
| `#4E608E` (×2) | `--color-text-disabled` | hidden scene-row label + hidden visibility marker L1359/L1361 |
| `#7FA8FF` (×2) | `--color-text-info` | DENSITY badge label L146/L848 |

### 1.6 State colors

| Literal | Proposed token | Used for |
|---|---|---|
| `#6FE3A8` (×26) | `--color-state-ok` | REC blink dot L55/L684, RUNNING status L241/L658/L1105, SHADING + MATERIAL values L125–129/L828–832, COPY CODE fg + hover border L71/L696, FPS MAX L277/L764, RASTERIZE segment + legend L296/L311/L1051, poly-budget bar fill L360/L1061, visible marker L1361, near z-buffer bars L1447, Y axis L224/L228/L728 |
| `#FF9E4E` (×4) | `--color-state-warn` | FPS MIN L269/L756, CULLED value L348/L1466 |
| `#FF5A4E` (×3) | `--color-state-danger` / `--color-axis-x` | X axis bar + letter L223/L226/L727 |
| `#5B9BFF` (×9) | `--color-state-info` / `--color-axis-z` | Z axis L225/L228/L729, CLIP/CULL segment + legend L295/L306/L1050, mid z-buffer bars L1447 |
| `#6FE3A8` | `--color-axis-y` | alias of state-ok, axis gizmo Y |
| `rgba(111,227,168,.45)` (×1) | `--color-state-ok-border` | HUD status chip border L240 |

### 1.7 Chip / toggle / quick-toggle state pairs

From `chip(active)` L1313–1317:

| State | bg | border | fg |
|---|---|---|---|
| active | `#1E3B7A` → `--color-chip-active-bg` | `#FFC81E` → `--color-accent` | `#FFC81E` → `--color-accent` |
| inactive | `#0A1330` → `--color-surface-sunken` | `#1B2E5C` → `--color-border-subtle` | `#8FA3CE` → `--color-text-tertiary` |
| hover (desktop only) | — | `#FFC81E` (`style-hover="border-color:#FFC81E"`) | — |

From `toggleRow(label,key)` L1319–1326 — the ON/OFF segmented control paints **both halves**:

| State | ON half bg / fg | OFF half bg / fg |
|---|---|---|
| value = true | `#FFC81E` / `#0B1637` | `#0A1330` / `#3A4E7E` |
| value = false | `#0A1330` / `#3A4E7E` | `#3A4E7E` / `#EAF0FF` |

From `quick(label,key)` L1333–1341 — the viewport quick-toggle chips:

| State | bg | fg | border |
|---|---|---|---|
| on | `rgba(255,200,30,.92)` | `#0B1637` | `#FFC81E` |
| off | `rgba(5,9,26,.82)` | `#8FA3CE` | `rgba(255,255,255,.16)` |

Tab state, `tabOn()` L1383–1385 (desktop) / `mTab()` L1390–1392 (mobile):

| State | fg | bg (desktop) | bg (mobile) | 2px underline |
|---|---|---|---|---|
| active | `#FFC81E` | `#0B1637` | `#122152` | `#FFC81E` |
| inactive | `#6F86B8` | `transparent` | `transparent` | `transparent` |

Scene-graph row state, `objects.map` L1352–1364:

| State | bg | left mark (2px) | label fg | vis marker / fg |
|---|---|---|---|---|
| selected | `#172E62` | `#FFC81E` | `#FFFFFF` | `●` / `#6FE3A8` |
| unselected, visible | `transparent` | `transparent` | `#B9C8EC` | `●` / `#6FE3A8` |
| hidden | `transparent` | — | `#4E608E` | `○` / `#4E608E` |

### 1.8 HUD overlay backgrounds and borders

| Literal | Proposed token | Used for |
|---|---|---|
| `rgba(5,9,26,.82)` (×10) | `--color-hud-bg` | all desktop HUD chips, camera readout, bottom chips L172–245 |
| `rgba(5,9,26,.85)` (×7) | `--color-hud-bg-mobile` | all mobile HUD chips L703–731 (**darker/denser than desktop — deliberate, because mobile chips have no blur**) |
| `rgba(5,9,26,.7)` (×2) | `--color-hud-bg-gizmo` | axis gizmo box, both branches L222/L726 |
| `rgba(255,255,255,.14)` (×15) | `--color-hud-border` | default HUD chip border, both branches |
| `rgba(255,255,255,.16)` (×1) | `--color-hud-border-strong` | inactive quick-toggle border only (`quick()` L1339) |
| `rgba(255,255,255,.55)` (×2) | `--color-crosshair` | desktop crosshair L211–212 |
| `rgba(255,255,255,.5)` (×2) | `--color-crosshair-mobile` | mobile crosshair L718–719 |

### 1.9 Axis gizmo colors

| Axis | Literal | Token |
|---|---|---|
| X | `#FF5A4E` | `--color-axis-x` |
| Y | `#6FE3A8` | `--color-axis-y` |
| Z | `#5B9BFF` | `--color-axis-z` |

### 1.10 Z-buffer histogram bar colors (L1447)

| Bucket | Literal | Token |
|---|---|---|
| index `< 10` (near) | `#6FE3A8` | `--color-zbuf-near` |
| index `< 19` (mid) | `#5B9BFF` | `--color-zbuf-mid` |
| index `>= 19` (far) | `#2C4A8A` | `--color-zbuf-far` |

### 1.11 Frame-time segment colors

| Segment | Bar literal | Legend/row literal | Token |
|---|---|---|---|
| TRANSFORM | `#FFC81E` | `#FFC81E` | `--color-ft-transform` |
| CLIP / CULL | `#5B9BFF` | `#5B9BFF` | `--color-ft-clip` |
| RASTERIZE | `#6FE3A8` | `#6FE3A8` | `--color-ft-raster` |
| PRESENT | `#3A4E7E` | `#3A4E7E` desktop L316, **`#8FA3CE` mobile L1459** | `--color-ft-present` (+ note) |

**Inconsistency to resolve in the ticket:** the PRESENT swatch/segment is `#3A4E7E` everywhere except the mobile STATS stat-row text colour, which is `#8FA3CE`. Pick one (`#8FA3CE` reads better as text at 11px on `#0B1637`; keep `#3A4E7E` for the bar segment) and say so explicitly.

### 1.12 Swatch palette (L1494–1496)

Fixed 5-entry base-colour palette, in order:

| # | Literal | Token |
|---|---|---|
| 1 | `#E01B1B` (also `state.color` default L1174) | `--color-swatch-red` |
| 2 | `#FFC81E` | `--color-swatch-yellow` (= accent) |
| 3 | `#6FE3A8` | `--color-swatch-green` (= state-ok) |
| 4 | `#5B9BFF` | `--color-swatch-blue` (= state-info) |
| 5 | `#EAF0FF` | `--color-swatch-white` (= text-primary) |

Swatch border: selected `#FFFFFF`, unselected `#1B2E5C`, border width **2px** both branches.

---

## 2. Typography → `typography.css`

### 2.1 Families and loaded weights

Loaded L11–13 (preconnect ×2 + one `css2` stylesheet):
```
family=Space+Grotesk:wght@400;500;700
family=JetBrains+Mono:wght@400;500;700
display=swap
```

| Token | Value |
|---|---|
| `--font-sans` | `'Space Grotesk', system-ui, sans-serif` (root stack, L31) |
| `--font-mono` | `'JetBrains Mono', monospace` |
| `--font-weight-regular` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-bold` | `700` |

Root also sets `-webkit-font-smoothing: antialiased` (L31) and `color: #EAF0FF`.

**Repo constraint to flag:** the design pulls both families from Google Fonts. The repo is offline-friendly Vite; the tokens ticket should decide self-hosted vs `@import` and record it — the mono face is load-bearing (every number is tabular-ish mono, so a fallback swap visibly reflows HUD chips).

### 2.2 Size scale

| Token | px | Where |
|---|---|---|
| `--text-2xs` | `7px` | axis gizmo X/Y/Z letters (mono 700) |
| `--text-xs` | `8px` | chip tri counts, stat-tile captions, toggle ON/OFF desktop, scene-row kind, shortcut pills, z-buffer axis, build string, selection label, fps-canvas label |
| `--text-sm` | `9px` | the workhorse: all panel-header titles, section titles, field labels, stat labels, HUD text, tab labels |
| `--text-base` | `10px` | desktop values, desktop buttons, mobile field labels, mobile chips, mobile tabs |
| `--text-md` | `11px` | mobile values, desktop toolbar fps/frame value, desktop brand, mobile buttons |
| `--text-lg` | `11.5px` | **desktop story paragraph only** (L143–144) |
| `--text-xl` | `12px` | mobile brand wordmark, mobile header fps, mobile scene-row id |
| `--text-2xl` | `13px` | desktop fps stat-tile value; mobile story paragraph |
| `--text-3xl` | `14px` | mobile fps stat-tile value |
| `--text-4xl` | `22px` | desktop story title |
| `--text-5xl` | `26px` | mobile story title |

### 2.3 Line-heights

| Token | Value | Where |
|---|---|---|
| `--leading-none` | `1` | almost everything (all labels, values, chips) |
| `--leading-tight` | `1.05` | story titles (22px / 26px) |
| `--leading-snug` | `1.2` | desktop slider labels (`500 9px/1.2`) — allows 2-line wrap in the 66px column |
| `--leading-hud` | `1.3` | desktop camera readout rows |
| `--leading-relaxed` | `1.55` | story paragraphs, both branches |

### 2.4 Letter-spacing — the tracking cluster

Ten distinct values, all in `em`. They cluster tightly in `.06–.16` and are effectively "how loud is this all-caps label":

| Token | Value | Count | Role |
|---|---|---|---|
| `--tracking-tight` | `-.01em` | 2 | story titles only (22/26px display) |
| `--tracking-normal` | `.04em` | 1 | desktop shape-chip label (8px mono) |
| `--tracking-chip` | `.06em` | 3 | quick-toggle chips, selection label |
| `--tracking-xs` | `.08em` | 4 | HUD mode chip, mobile brand build, mobile toggle-row label |
| `--tracking-sm` | `.09em` | 40 | stat row labels, frame-time legend, slider labels, toggle rows |
| `--tracking-md` | `.1em` | 40 | build string, secondary buttons, mobile field/slider labels, stat-tile captions, mobile tabs, mobile pause |
| `--tracking-lg` | `.11em` | 10 | desktop shape-info field labels, DENSITY badge label |
| `--tracking-xl` | `.12em` | 6 | desktop primary button, desktop tab labels, mobile brand, mobile RESET SCENE |
| `--tracking-2xl` | `.14em` | 10 | desktop brand wordmark, right-panel section titles, SHORTCUTS heading |
| `--tracking-3xl` | `.16em` | 24 | **panel header titles, all branches — the single most identity-carrying value** |

Gaps in the sequence (`.05`, `.07`, `.13`, `.15`) are unused; do not add them.

### 2.5 Distinct font shorthands (all 31, deduplicated)

Space Grotesk:

| Shorthand | Tracking | Where |
|---|---|---|
| `700 26px/1.05` | `-.01em` | mobile story title L843 |
| `700 22px/1.05` | `-.01em` | desktop story title L141 |
| `700 12px/1` | `.12em` | mobile brand L679 |
| `700 11px/1` | `.14em` | desktop brand L40 |
| `700 11px/1` | `.1em` | mobile pause button L688 |
| `700 11px/1` | `.12em` | mobile RESET SCENE L1112 |
| `700 10px/1` | `.12em` | desktop primary button L47 |
| `700 10px/1` | `.1em` | mobile tab label L776 |
| `700 9px/1` | `.16em` | panel header title (both branches) |
| `700 9px/1` | `.14em` | right-panel section title, SHORTCUTS heading |
| `700 9px/1` | `.12em` | desktop tab label L452–454 |
| `500 11px/1` | `.08em` | mobile toggle-row label L950/L988 |
| `500 10px/1` | `.1em` | desktop STEP/RESET L49–50; mobile field + slider labels |
| `500 10px/1` | `.09em` | mobile stat rows L1076 |
| `500 9px/1` | `.11em` | desktop shape-info labels, DENSITY label |
| `500 9px/1` | `.1em` | desktop RENDER LOOP / FRAME HUD chip labels L56/L61 |
| `500 9px/1` | `.09em` | desktop stat rows, frame-time legend, toggle rows |
| `500 9px/1.2` | `.09em` | desktop slider label (66px column) |
| `500 9px/1` | `.1em` | desktop CAPTURE PNG / SAVE PRESET / LOAD L68–70 |
| `500 8px/1` | `.1em` | stat-tile captions MIN/AVG/MAX/DROPPED (both) |
| `400 13px/1.55` | — | mobile story paragraphs L845–846 |
| `400 11.5px/1.55` | — | desktop story paragraphs L143–144 |

JetBrains Mono:

| Shorthand | Tracking | Where |
|---|---|---|
| `700 14px/1` | — | mobile fps tile values L756–768 |
| `700 13px/1` | — | desktop fps tile values L269–281 |
| `700 12px/1` | — | mobile header fps number L685 |
| `700 11px/1` | — | desktop toolbar fps + frame values L57/L62; mobile DENSITY value L849 |
| `700 10px/1` | — | mobile toggle ON/OFF L952–953/L990–991; desktop DENSITY value L147 |
| `700 10px/1` | `.06em` | mobile quick-toggle chips L742 |
| `700 9px/1` | `.08em` | desktop HUD mode chip L173 |
| `700 9px/1` | — | mobile HUD mode chip L703 |
| `700 9px/1` | `.06em` | desktop quick-toggle chips L188 |
| `700 8px/1` | — | scene-row visibility marker L90; desktop toggle ON/OFF L553–554 |
| `700 8px/1` | `.06em` | selection-box label L219 |
| `700 7px/1` | — | axis gizmo letters L226–228 |
| `500 12px/1` | — | mobile scene-row id L791 |
| `500 11px/1` | — | mobile values (shape info, sliders, stat rows) |
| `500 10px/1` | — | desktop values (shape info, sliders, stat rows, scene-row id), desktop tex/mode/persp chips, mobile tex/mode/view chips, mobile status bar status |
| `500 9px/1` | — | desktop HUD bottom chips, mobile HUD chips, desktop status bar status, desktop tex/mode chips |
| `500 9px/1.3` | — | desktop camera-readout values L195–207 |
| `500 8px/1` | — | desktop scene-row kind L87 |
| `500 8px/1` | `.04em` | desktop shape-chip label L469 |
| `400 13px` | — | *(none — mobile paragraphs are SG)* |
| `400 10px/1` | — | mobile scene-row tris, mobile story footer values, mobile status bar |
| `400 9px/1` | — | panel-header notes, HUD chip values, shortcut-adjacent meta, desktop story footer values, mobile z-buffer axis |
| `400 9px/1.3` | — | desktop camera-readout keys L194–206 |
| `400 8px/1` | — | desktop chip tri counts, z-buffer axis labels, shortcut pills, brand build string |
| `400 8px/1` | `.1em` | desktop build string L41 |
| `400 8px/1` | `.08em` | mobile build string L680 |
| `500 8px` (canvas) | — | fps chart axis labels, `g.font = "500 8px 'JetBrains Mono', monospace"` L1277 — **must be duplicated in TS, not CSS** |

---

## 3. Spacing → `spacing.css`

Every distinct gap/padding/margin value in the file forms a dense 1px-step scale from 1–12 plus 14. There is no 13px and no value above 14px except the fixed component sizes in section 5.

| Token | px | Representative uses |
|---|---|---|
| `--space-0` | `0` | `padding:0` reset, `height:0` |
| `--space-px` | `1px` | shape-info column gap L101 (`gap:1px`) |
| `--space-0-5` | `2px` | z-buffer bar gap L375/L1090, mobile action-row `padding-bottom` L691, slider row `padding:2px 0` L480 |
| `--space-1` | `3px` | camera-readout row gap L192, mobile brand column gap L678, shortcut pill `padding:3px 6px` |
| `--space-1-5` | `4px` | all desktop chip grid gaps, frame-time legend gap L299, geometry card gap L333, scene-graph container `padding:4px` L84, stat-tile `padding:4px 6px`, toolbar divider `margin:0 4px` L52, mobile HUD right-column gap L704 |
| `--space-2` | `5px` | HUD chip cluster gaps L171/L186/L231/L714, story footer gap L149, mobile scene-graph container `padding:5px` L787, mobile stat-tile `padding:5px 7px`, mobile slider column gap L889, desktop DENSITY badge `padding:5px 9px`, `margin:5px 0` divider |
| `--space-2-5` | `6px` | toolbar item gap L45, desktop stat-tile row gap L266, `margin-bottom:6px` on section titles, mobile grid gaps (`gap:6px` everywhere), mobile action-row gap L691, mobile z-buffer column gap L1089, scene-row `padding:0 6px` |
| `--space-3` | `7px` | brand gap L37, toolbar HUD chip inner gap L54/L60, scene-row gap L86, frame-time legend row gap L300, frame-time card gap L292, mobile slider block `padding:7px 0`, mobile DENSITY badge `padding:7px 10px`, desktop camera-readout `padding:7px 9px`, desktop shape-info `padding:7px 8px`, mobile framerate card gap L751 |
| `--space-4` | `8px` | **desktop page padding + every desktop grid gap** L34/L36/L75/L164/L256/L257/L368; panel-header `padding:0 8px`; telemetry card `padding:8px`; slider row gap L480; mobile HUD offsets (`top:8px;left:8px`); mobile swatch row gap L910; mobile status-bar gap L1104 |
| `--space-4-5` | `9px` | brand gap L37 (9px), right-panel content gap L457, mobile panel-header `padding:0 9px`, mobile card `padding:9px`, mobile scene-row gap L789, mobile header gap L676, mobile fps chip `padding:0 9px`, shortcuts `padding-top:9px` |
| `--space-5` | `10px` | **mobile page padding + mobile stack gap** L674/L781/L868/L931/L980/L1036; desktop status-bar gap + `padding:0 10px`; desktop button `padding:0 10px`; desktop HUD inset `top:10px;left:10px`; camera-readout row gap L193; story content gap L140; story footer `padding-top:10px`; mobile z-buffer `padding:10px` |
| `--space-5-5` | `11px` | mobile story content gap L842, mobile budgets card gap L1042, mobile card side padding `9px 11px 12px`, mobile story footer `padding-top:11px` |
| `--space-6` | `12px` | desktop primary button `padding:0 12px`, desktop story `padding:12px 12px 14px`, mobile card bottom padding `…12px`, mobile pause `padding:0 12px` |
| `--space-7` | `14px` | mobile story card `padding:14px`, mobile action-button `padding:0 14px`, desktop story bottom padding `…14px` |

Composite paddings worth naming as recipes rather than tokens (each is a two/three-value shorthand assembled from the scale above):
`0 5px`, `0 6px`, `0 7px`, `0 8px`, `0 9px`, `0 10px`, `0 12px`, `0 14px`, `2px 0`, `3px 6px`, `4px 6px`, `5px 7px`, `5px 9px`, `5px 11px 9px`, `7px 0`, `7px 8px`, `7px 9px`, `7px 10px`, `8px 11px 10px`, `9px 0 3px`, `9px 10px`, `9px 11px 12px`, `10px 11px 12px`, `12px 12px 14px`.

Negative margins (crosshair centring only, do not tokenise): `-.5px`, `-6px` (range thumb), `-10px`, `-12px`.
`margin-top:auto` is used 4× as a push-to-bottom idiom (story footer L149, frame-time footer L321, geometry footer L354, shortcuts block L640).

---

## 4. Radii → `radius.css`

| Token | Value | Count | Used for |
|---|---|---|---|
| `--radius-xs` | `1px` | 8 | brand mark square L38/L677, frame-time legend swatches L301–316, selection-box label L219, range thumb L21 |
| `--radius-sm` | `2px` | 63 | **the default** — chips, toggles, HUD chips, stat tiles, scene rows, badges, bars, shortcut pills, swatches, range track |
| `--radius-md` | `3px` | 19 | buttons (primary, secondary, COPY CODE, mobile quick toggles), toolbar HUD chips, poly-budget bar desktop |
| `--radius-lg` | `4px` | 35 | **all panels/cards/toolbar/status bar**, scrollbar thumb, mobile poly-budget bar |
| `--radius-full` | `50%` | 2 | REC blink dot L55/L684 |
| `--radius-bar-top` | `1px 1px 0 0` | 2 | z-buffer histogram bars L377/L1092 |

---

## 5. Sizes → `sizing.css`

### 5.1 Layout shells

| Token | Desktop | Mobile |
|---|---|---|
| `--size-frame-w` | `1440px` (L34) | `100%` (L674) |
| `--size-frame-h` | `900px` (L34) | `min-height:100vh` |
| `--size-page-pad` | `8px` | `10px` |
| `--size-stack-gap` | `8px` | `10px` |
| `--size-sidebar-w` | `264px` (L37/L77) | n/a (stacks) |
| `--size-inspector-w` | `296px` (L450) | n/a (tab-switched) |
| `--size-viewport-h` | `530px` fixed (L166) | `aspect-ratio: 16/10` (L699) |
| `--size-toolbar-h` | `40px` (L36) | n/a — split into 52px header + 40px scroll row |
| `--size-statusbar-h` | `24px` (L657) | auto, `padding:9px 10px`, `flex-wrap:wrap` (L1104) |

### 5.2 Component heights/widths (full inventory)

Heights present: `1, 2, 3(range track), 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 46, 48, 52, 56, 64, 66, 76, 190, 530, 900` px.
Widths present: `1, 2, 6, 7, 8, 9, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 38, 52, 62, 66, 84, 88, 148, 190, 264, 296, 1440` px.

| Token | Value | Component |
|---|---|---|
| `--size-panel-header` | `24px` desktop sidebar (L80/L97/L136) · `22px` desktop telemetry cards (L260/L288/L329/L370/L389/L418) · `26px` mobile (all) |
| `--size-button` | `26px` desktop · `40px` mobile action row · `36px` mobile pause · `48px` mobile RESET SCENE |
| `--size-tab` | `26px` desktop tab strip (L451) · `44px` mobile tab bar (L776) |
| `--size-chip-shape` | `44px` desktop (L468) · `56px` mobile (L875) |
| `--size-chip-mode` | `26px` desktop (L542) · `44px` mobile (L938) |
| `--size-chip-tex` | `24px` desktop (L513) · `40px` mobile (L907) |
| `--size-chip-view` | `24px` desktop (L594) · `40px` mobile (L1014) |
| `--size-chip-proj` | `24px` desktop (L598–599) · `40px` mobile (L1018–1019) |
| `--size-chip-quick` | `24px` desktop HUD (L188) · `46px` mobile grid (L742) |
| `--size-hud-chip` | `22px` (both branches) · `20px` for mobile secondary HUD chips (L706/L709/L715/L716) |
| `--size-toggle-w` / `--size-toggle-h` | `62 × 19` desktop (L552/L620) · `88 × 32` mobile (L951/L989) |
| `--size-toggle-row` | `26px` desktop (L550/L618) · `48px` mobile (L949/L987) |
| `--size-slider-track-row` | `15px` desktop input height (L482) · `26px` mobile input height (L894) |
| `--size-slider-label-col` | `66px` desktop (`flex:0 0 66px`, ×16) · `46px` mobile BASE label only (L911); mobile sliders use a label row instead of a column |
| `--size-slider-value-col` | `44px` desktop (`flex:0 0 44px`, ×15) · n/a mobile |
| `--size-row-info` | `19px` desktop shape-info row (L102) · `24px` mobile (L805) |
| `--size-row-scene` | `26px` desktop (L86) · `44px` mobile (L789) |
| `--size-row-stat` | auto desktop (`gap:4px`) · `28px` mobile (L1075) |
| `--size-scene-kind-col` | `26px` desktop (L87) · `28px` mobile (L790) |
| `--size-vis-button` | `14 × 14` desktop (L90) · `30 × 30` mobile (L793) |
| `--size-gizmo` | `66 × 66` desktop (L222) · `52 × 52` mobile (L726) |
| `--size-gizmo-axis` | `34px` desktop X/Y, `24px` Z (L223–225) · `26px` mobile X/Y, `18px` Z (L727–729) |
| `--size-swatch-w/h` | `22 × 18` desktop (L519) · `38 × 32` mobile (L913) |
| `--size-brand-mark` | `16 × 16` desktop (L38) · `18 × 18` mobile (L677) |
| `--size-rec-dot` | `6 × 6` both (L55/L684) |
| `--size-legend-swatch` | `7 × 7` desktop only (L301–316) |
| `--size-ft-bar` | `12px` desktop (L293) · `14px` mobile (L1048) |
| `--size-budget-bar` | `6px` desktop, radius 3px (L359) · `8px` mobile, radius 4px (L1060) |
| `--size-fps-canvas` | `flex:1` (fills card) desktop · `64px` fixed mobile (L752) |
| `--size-zbuf-h` | `flex:1` desktop (L375) · `76px` fixed mobile (L1090) |
| `--size-selection-box` | `190 × 190` px desktop (L214) · `22.4% × 35.8%` mobile (L720) — both anchored `left:39.2%; top:31.9%` |
| `--size-selection-corner` | `14 × 14`, 2px stroke desktop (L215) · `12 × 12`, 2px mobile (L721) |
| `--size-selection-label` | `16px` tall, `padding:0 5px`, `top:-20px` desktop only (L219); mobile has no label |
| `--size-crosshair` | `24px` desktop (L211) · `20px` mobile (L718) |
| `--size-camera-readout-minw` | `148px` desktop only (L192) |
| `--size-mobile-fps-chip` | `30px` (L683) |
| `--size-mobile-pause-minw` | `84px` (L688) |
| `--size-divider-v` | `20px` toolbar (L52) · `11px` status bar (L659) · `10px` HUD desktop (L247) · `9px` HUD mobile (L733) |
| `--size-scrollbar` | `8px` (L23) |
| `--size-range-track` | `3px` (L20) |
| `--size-range-thumb` | `9 × 15`, `margin-top:-6px` (L21) |
| `--size-story-rule` | `2px × 28px` both branches (L142/L844) |
| `--size-border-hairline` | `1px` — every border, every divider |
| `--size-border-mark` | `2px` — tab underline, scene-row left mark, selection corners, swatch border |

### 5.3 Flex ratios (not tokens, but load-bearing)

`flex:1.15` — FRAMERATE card and Z-BUFFER card get 15% more width than their row siblings (L259/L369).
`flex:1.1` — DROPPED stat tile (L279).
`flex:0 0 auto` ×9 — panel headers and the sidebar's non-growing cards.
`min-height:0` ×11 and `min-width:0` ×1 — required for the nested flex scroll containers to actually clip.

---

## 6. Elevation → `elevation.css`

| Token | Value | Count | Notes |
|---|---|---|---|
| `--blur-hud` | `blur(3px)` | 6 | the **only** blur in the file. Applied to the four desktop HUD info chips (L172/L175/L178/L181), the desktop quick-toggle chips (L188), and the desktop camera readout (L192). **Never applied on mobile** — mobile compensates with a denser background (`.85` vs `.82` alpha). Preserve that asymmetry. |
| `--elevation-hud-bg` | `rgba(5,9,26,.82)` | 10 | desktop HUD surface |
| `--elevation-hud-bg-mobile` | `rgba(5,9,26,.85)` | 7 | mobile HUD surface |
| `--elevation-hud-bg-gizmo` | `rgba(5,9,26,.7)` | 2 | axis gizmo, both branches |
| `--elevation-hud-border` | `rgba(255,255,255,.14)` | 15 | HUD hairline |

There are **zero `box-shadow` declarations and zero `transition` declarations** in the entire file. Depth is expressed purely as background-value steps (`#05091A` → `#0A1330` → `#0B1637` → `#0E1B40` → `#152A5C`) plus a 1px border. Do not add shadows.

Recommendation: keep the raw rgba literals in `colors.css` as `--color-hud-*` and have `elevation.css` reference them in composed recipes (`--elevation-hud: var(--color-hud-bg)` + `--blur-hud`), so there is one home per literal.

Two `z-index` values exist: `z-index:6` on the sticky mobile header (L676) — the only stacking context declared. Everything else relies on source order and `position:absolute` inside the viewport. Consider `--layer-sticky: 6`.

---

## 7. Motion → `motion.css`

Exactly one animation in the file.

```css
@keyframes recblink { 0%, 45% { opacity: 1 } 55%, 100% { opacity: .15 } }
```
(L27, global `<style>`). Applied twice, identically: `animation: recblink 1.6s infinite` — desktop RENDER LOOP dot (L55) and mobile header fps dot (L684).

| Token | Value | Notes |
|---|---|---|
| `--duration-blink` | `1.6s` | the REC pulse period |
| `--opacity-blink-min` | `.15` | trough opacity |

Shape of the curve: full opacity 0–45%, hard step region 45–55%, dim 55–100%. It is a **step-ish square wave, not a sine** — the 45/55 stops are what make it read as a hardware LED. Keep the stops exactly.

There are no easing functions declared anywhere, so `--ease-*` tokens are speculative. If the rebuild adds hover/tab transitions (the design has hover *states* via `style-hover` but no animation between them), define at most `--duration-fast: 120ms` and `--ease-standard: cubic-bezier(.2,0,0,1)` and note in the ticket that these are **new, not extracted**.

Hover states declared in the design (via the `style-hover` attribute, which must become real `:hover` rules in CSS):

| Selector target | Hover declaration | Count |
|---|---|---|
| secondary toolbar buttons | `background:#1D3670` | 5 |
| primary pause button | `background:#FFE07A` | 1 |
| all chips (shape/tex/mode/view) + quick toggles | `border-color:#FFC81E` | 5 |
| COPY CODE | `border-color:#6FE3A8` | 1 |
| desktop scene-graph row | `background:#142654` | 1 |
| range thumb | `background:#FFE07A` | L22 |
| link | `color:#FFE07A` | L18 |
| scrollbar thumb | `background:#35538F` | L26 |

Non-visual timing constants in the state class (for reference, these belong in TS, not tokens): `setInterval(…, 130)` simulation tick (L1193), 90-sample FPS history window (L1191/L1231), 28-bucket z-buffer histogram (L1186), `dpr = 2` hardcoded in `drawFps` (L1263).

---

## 8. Breakpoint → `breakpoints.css`

The design switches branches by a **single JS threshold**, not a media query:

```js
this.onResize = () => {
  const n = window.innerWidth < 900;
  if (n !== this.state.narrow) this.setState({ narrow: n });
};
```
(L1206–1211)

Resolved at L1388–1389:
```js
const vpMode = this.props.viewportMode ?? 'auto';
const isMobile = vpMode === 'mobile' || (vpMode === 'auto' && s.narrow);
```
and returned as `isMobile` / `isDesktop: !isMobile` (L1399), which drive the two top-level `sc-if` branches at L33 and L673.

| Token | Value | Meaning |
|---|---|---|
| `--breakpoint-md` | `900px` | desktop branch at `>= 900px`, mobile branch at `<= 899px` |

The `viewportMode` prop (`auto` / `desktop` / `mobile`, L1119) is a design-tool preview override with no production equivalent — the rebuild uses the media query alone.

**Caveat the tokens ticket must state:** a CSS media query condition cannot read a custom property (`@media (max-width: var(--breakpoint-md))` does not work). `--breakpoint-md` in `breakpoints.css` is documentation/JS-consumable only; the literal `900px` must be repeated in each `@media` block. Either accept the duplication with a comment pointing at the token, or generate the queries from a Sass/PostCSS-free single source — this repo has no preprocessor, so accept the duplication.

Also note the desktop branch is a **fixed 1440×900 frame** (L34), not fluid. The rebuild must decide whether desktop is fluid above 900px (recommended: fluid, with `264px` / `296px` sidebars fixed and the centre column flexing) and record the decision, because the viewport itself cannot flex — the canvas is hard-coded `1024×640` and that size is baked into `BackgroundRenderer` and `ShapeTransitionMachine` at construction.

---

## 9. Desktop vs mobile size pairs

Every component whose measurements differ between branches. These become either token pairs (`--size-x` overridden inside the `@media`) or single tokens with a media-query override.

| Component | Desktop | Mobile | Ratio / note |
|---|---|---|---|
| Page padding | `8px` | `10px` | L34 / L674 |
| Stack gap | `8px` | `10px` | L34 / L674 |
| Panel header height | `24px` sidebar, `22px` telemetry | `26px` uniform | mobile unifies to one value |
| Panel header padding | `0 8px` | `0 9px` | |
| Panel body padding | `7px 8px` / `8px` | `9px` / `9px 11px 12px` / `10px 11px 12px` | mobile adds asymmetric bottom pad |
| Header/toolbar | one `40px` strip | `52px` sticky header + `40px` scroll row | mobile splits the toolbar in two |
| Brand mark | `16 × 16` | `18 × 18` | |
| Brand wordmark | `700 11px/1 .14em` | `700 12px/1 .12em` | |
| Brand build string | `400 8px/1 .1em` | `400 8px/1 .08em` | |
| Primary button | `26px` h, `0 12px` pad, `700 10px .12em` | `36px` h, `min-width 84px`, `0 12px`, `700 11px .1em` | |
| Secondary button | `26px` h, `0 10px` pad | `40px` h, `0 14px` pad | 26→40 for touch |
| FPS chip | `26px` h, `0 10px` (inside toolbar) | `30px` h, `0 9px` (inside header) | |
| Tab strip | `26px` h, 3 tabs, `700 9px .12em` | `44px` h, 5 tabs, `700 10px .1em` | mobile adds SCENE + STATS tabs |
| Shape chip | `44px`, 4-col `gap:4px`, label `500 8px .04em`, tris `400 8px` | `56px`, 4-col `gap:6px`, label `500 9px`, tris `400 9px` | |
| Mode chip | `26px`, 3-col `gap:4px`, `500 9px` | `44px`, 3-col `gap:6px`, `500 10px` | |
| Texture chip | `24px`, 2-col `gap:4px`, `500 9px` | `40px`, 2-col `gap:6px`, `500 10px` | |
| View chip | `24px`, 5-col `gap:4px`, `500 8px` | `40px`, 5-col `gap:6px`, `500 10px` | |
| Persp/Ortho button | `24px`, `gap:4px`, `500 9px` | `40px`, `gap:6px`, `500 10px` | |
| Quick toggle | `24px` h HUD chip, `0 10px`, `700 9px .06em`, blur 3px, radius 2px | `46px` h, 5-col grid `gap:6px`, `700 10px .06em`, no blur, radius 3px | **moves out of the viewport onto its own grid row** |
| ON/OFF toggle | `62 × 19`, halves `700 8px` | `88 × 32`, halves `700 10px` | |
| Toggle row | `26px` h, label `500 9px .09em` `#8FA3CE`, no divider | `48px` h, label `500 11px .08em` `#B9C8EC`, `border-bottom 1px #142653` | |
| Slider row | horizontal: label `0 0 66px` + input `flex:1 height:15px` + value `0 0 44px` right-aligned | stacked: label/value row above, input `width:100% height:26px`, block `padding:7px 0`, inner `gap:5px` | **layout changes, not just size** |
| Slider label / value type | `500 9px/1.2 .09em` / `500 10px/1` | `500 10px/1 .1em` / `500 11px/1` | |
| Shape-info row | `19px` h, container `gap:1px`, label `500 9px .11em`, value `500 10px` | `24px` h, container `gap:3px`, label `500 10px .1em`, value `500 11px` | |
| Scene-graph row | `26px` h, `gap:7px`, `0 6px` pad; kind col `26px @ 8px`; id `500 10px` + ellipsis; tris `400 9px`; vis `14 × 14 @ 700 8px`; container pad `4px` | `44px` h, `gap:9px`, `0 8px` pad; kind col `28px @ 9px`; id `500 12px` no ellipsis; tris `400 10px`; vis `30 × 30 @ 700 10px`; container pad `5px` | |
| Story title | `700 22px/1.05 -.01em` | `700 26px/1.05 -.01em` | |
| Story paragraph | `400 11.5px/1.55` | `400 13px/1.55` | |
| Story content | pad `12px 12px 14px`, `gap:10px`, footer `margin-top:auto` + `padding-top:10px` | pad `14px`, `gap:11px`, footer `padding-top:11px`, no `margin-top:auto` | |
| Density badge | pad `5px 9px`, `gap:6px`, label `500 9px .11em`, value `700 10px` | pad `7px 10px`, `gap:7px`, label `500 10px .1em`, value `700 11px` | |
| Story rule | `2px × 28px` | `2px × 28px` | identical — do not vary |
| Viewport | `flex:0 0 530px` fixed | `width:100%; aspect-ratio:16/10` | |
| HUD inset | `10px` from edges | `8px` from edges | |
| HUD chip | `22px` h, `0 8px`, blur 3px, bg `.82` | `22px`/`20px` h, `0 8px`/`0 7px`, no blur, bg `.85` | |
| HUD second row offset | `top:40px; left:10px` | `top:36px; left:8px` | |
| Camera readout | full 4-row panel, `min-width:148px`, `padding:7px 9px`, `gap:3px`, keys+values | collapsed to 3 stacked chips top-right (`frameMs`, `camPos`, `fov`+`zoom`), `gap:4px` | **content reduced, not just resized** |
| Crosshair | `24px` arms, `rgba(255,255,255,.55)` | `20px` arms, `rgba(255,255,255,.5)` | |
| Selection box | `190 × 190px`, corners `14 × 14`, `+` label chip | `22.4% × 35.8%`, corners `12 × 12`, **no label** | same anchor `39.2% / 31.9%` |
| Axis gizmo | `66 × 66`, axes `34/34/24`, X/Y/Z letters `700 7px` | `52 × 52`, axes `26/26/18`, **no letters** | Z rotation `215deg` in both |
| HUD bottom-right | 3 chips (fov, zoom, status), `gap:5px` | 1 chip (selectedId + tris), `0 9px`, `gap:7px` | |
| HUD bottom-centre | present (`selectedId` / tris / "drag orbit · scroll zoom"), `22px`, `0 10px`, `gap:8px` | **absent** | |
| HUD separator | `1 × 10px` `#3A4E7E` | `1 × 9px` `#3A4E7E` | |
| FPS canvas | `flex:1` inside card, `min-height:0` | `height:64px` fixed | |
| FPS stat tile | flex row `gap:6px`, pad `4px 6px`, value `700 13px`, `margin-top:3px`, DROPPED tile `flex:1.1` | 4-col grid `gap:6px`, pad `5px 7px`, value `700 14px`, `margin-top:4px`, label "DROP" not "DROPPED" | |
| Frame-time bar | `12px` h | `14px` h | |
| Poly budget bar | `6px` h, radius `3px` | `8px` h, radius `4px` | |
| Z-buffer chart | `flex:1` h, axis labels `400 8px`, 3 labels (`0.1` / `depth` / `1000.0`) | `76px` h, axis labels `400 9px`, 2 labels (`0.1` / `1000.0`) | 28 bars, `gap:2px`, `min-height:2px` in both |
| Telemetry stat row | no fixed height, card `gap:4px`, label `500 9px .09em`, value `500 10px` | `28px` h, label `500 10px .09em`, value `500 11px` | desktop = 6 separate cards; mobile = `statGroups` loop of 4 uniform cards |
| Status bar | `24px` h single row, `0 10px`, `gap:10px`, text `400 9px`, 4 segments + URL + uptime | wrapping, `9px 10px` pad, `gap:8px`, text `400 10px`, 3 segments only | mobile drops `selectedId`, `projLabel`, `units: metres`, URL |
| Reset control | `RESET` button in toolbar (`26px`) | dedicated full-width `RESET SCENE` bar (`48px`, `700 11px .12em`) at page bottom | |

**Touch-target audit:** mobile interactive heights are `30` (fps chip — display only), `36` (pause), `40` (action buttons, tex/view/proj chips), `44` (tabs, scene rows, mode chips), `46` (quick toggles), `48` (toggle rows, RESET SCENE), `56` (shape chips), plus the `32px`-tall / `88px`-wide ON-OFF toggle and `30 × 30` visibility button. Two fall under 44px: the `32px` toggle control and the `30 × 30` visibility button — worth flagging in the widget tickets to pad their hit area to 44px without changing the painted size.

---

## 10. Token file assignment summary

| Group | File | Contents |
|---|---|---|
| Colors (§1.1–1.12, all 37 hex + 12 rgba) | `src/styles/tokens/colors.css` | backgrounds, panel surfaces, borders, accent family, text ramp, state colors, chip/toggle/tab/row state pairs, HUD overlays, axis, z-buffer, frame-time segments, swatch palette |
| Typography (§2) | `src/styles/tokens/typography.css` | `--font-sans`, `--font-mono`, 3 weights, 11 `--text-*` sizes, 5 `--leading-*`, 10 `--tracking-*` |
| Spacing (§3) | `src/styles/tokens/spacing.css` | `--space-0` … `--space-7` (0,1,2,3,4,5,6,7,8,9,10,11,12,14) |
| Radii (§4) | `src/styles/tokens/radius.css` | `--radius-xs/sm/md/lg/full/bar-top` |
| Sizes (§5) | `src/styles/tokens/sizing.css` | layout shells, all component heights/widths, desktop values as defaults, mobile as `@media` overrides |
| Elevation (§6) | `src/styles/tokens/elevation.css` | `--blur-hud`, HUD overlay recipes, `--layer-sticky` |
| Motion (§7) | `src/styles/tokens/motion.css` | `@keyframes recblink`, `--duration-blink`, `--opacity-blink-min`, plus any new `--duration-fast` / `--ease-standard` (flag as new) |
| Breakpoint (§8) | `src/styles/tokens/breakpoints.css` | `--breakpoint-md: 900px` (documentation-only, literal repeated in `@media`) |

All eight imported at the top of `/Users/cosmokaat/dev/halcyon/src/styles/main.css`, before the existing `reset.css` import is re-ordered to sit first.

## 11. Notes the tokens ticket must carry

- The `@keyframes recblink` block cannot live in a custom property; it goes in `motion.css` next to its duration token.
- `--breakpoint-md` cannot be consumed by a media-query condition; the literal `900px` is duplicated in each `@media` with a comment.
- The fps chart draws with canvas 2D (`drawFps`, L1258–1301) and therefore cannot read CSS custom properties. Its five colors (`#0A1330` fill, `#1B2E5C` gridline, `#3A4E7E` label, `#FFC81E` line/dot, `rgba(255,200,30,.30)`→`rgba(255,200,30,0)` gradient) and its font string (`500 8px 'JetBrains Mono', monospace`) must be mirrored as TS constants. Either read them once via `getComputedStyle(document.documentElement).getPropertyValue('--color-accent')` at init, or keep a single exported `chartTokens` object — say which, so the values do not drift.
- `#0B1637` serves two semantic roles (panel surface, and foreground-on-accent). Define both `--color-panel-bg` and `--color-on-accent` pointing at the same literal so future theming can split them.
- `#3A4E7E` serves four roles (separator, PRESENT segment, toggle inactive half, chart label). Same treatment.
- Desktop hover states exist only as `style-hover` attributes in the design file; they must become real `:hover` rules, and should be wrapped in `@media (hover: hover)` so they do not stick on touch.
- No `box-shadow`, no `transition`, no `filter` other than the `FILTERS` map applied to the viewport image (L1163–1170) — that map is design-only mock (six CSS filters keyed by shading mode) and has no engine equivalent.