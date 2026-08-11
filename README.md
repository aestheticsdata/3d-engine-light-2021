# Halcyon

- 100% TypeScript
- Vite bundler

https://halcyon.1991computer.com/

---

## 📐 How it Works: The Math Behind the Render

This engine implements a software renderer from scratch without using WebGL or external 3D libraries. Here is the mathematical breakdown of the core files:

### 0. **Linear Algebra Basics**

To understand 3D rendering, you must grasp how we represent and manipulate space using algebra.

#### **Vectors**

A **Vector** is an array of numbers. In this 3D engine, we primarily use them to represent **Positions**: discrete points in 3D space `(x, y, z)`, such as the vertices of a cube.

#### **Matrix-Vector Multiplication**

This is the engine of movement. To transform (rotate, scale, move) a point, we don't usually change its coordinates manually (e.g., `x = x + 2`). Instead, we multiply the point by a **Transformation Matrix**.

If $V$ is our point and $M$ is our rotation matrix, the new position is calculated as:
$$ V*{new} = M \times V*{old} $$

This operation involves taking the **dot product** of the matrix rows with the vector. It sounds complex, but it essentially mixes the old x, y, and z values based on the matrix's "recipe" to cook up the new position.

#### **Homogeneous Coordinates (Why 4D?)**

In `Point3D.ts`, you will notice we use 4 components `[x, y, z, 1]` instead of just 3. Why?

Standard 3x3 matrices can basic linear transformations like Rotation and Scaling, but they **cannot represent Translation** (moving an object from A to B) because translation requires _addition_, not just multiplication.

By adding a 4th dimension `w` (usually set to 1):

1.  We can upgrade to **4x4 Matrices**.
2.  This "hack" allows us to perform Translation using matrix multiplication, just like rotation.
3.  It unifies all math into a single pipeline, making the code cleaner and faster.

### 1. **Perspective Projection (`Point3D.ts`)**

The engine converts 3D world coordinates `(x, y, z)` into 2D screen coordinates `(x, y)`.
This is the fundamental operation that creates the illusion of depth on a flat screen.

#### **The Principle: Similar Triangles**

Imagine you're looking through a window at a distant object. The window is your **projection plane** (the screen), and your eye is the **camera**. The farther an object is, the smaller it appears—this is perspective.

Mathematically, this follows from **similar triangles**. If the focal length (distance from camera to screen) is $fl$, and an object is at depth $z$, then its projected size is proportional to:

$$\text{scale} = \frac{fl}{fl + z}$$

This ratio ensures that:
- Objects at $z = 0$ (on the screen plane) have `scale = 1` (no change)
- Objects farther away ($z > 0$) have `scale < 1` (appear smaller)
- Objects closer ($z < 0$) have `scale > 1` (appear larger)

#### **The Formula:**

```
scale = fl / (fl + z + zOffset)
x2d = vpX + (x3d * scale)
y2d = vpY + (y3d * scale)
```

#### **Parameters Explained:**

| Parameter | Description |
|-----------|-------------|
| `fl` (focal length) | Controls the "field of view". A small `fl` creates a wide-angle, fish-eye effect. A large `fl` flattens the perspective (telephoto look). Default: `300` |
| `zOffset` | Pushes the entire scene forward or backward. Useful for zooming without changing `fl`. |
| `vpX`, `vpY` | The **vanishing point**—where parallel lines converge. Set to the center of the canvas (`width/2`, `height/2`). |

#### **Visual Intuition:**

```
        Camera (Eye)
             |
             | fl (focal length)
             |
    ---------+--------- Projection Plane (Screen)
             |
             | z (depth)
             |
           Object
```

The `scale` factor shrinks X and Y coordinates proportionally based on Z depth, creating the classic "railroad tracks converging in the distance" effect.

### 2. **3D Transformations (`Matrix3D.ts`)**

Rotations are handled using **4x4 Matrices**. Every point in the mesh is multiplied by these matrices to calculate its new position in 3D space.

For example, the **Rotation Matrix for Z-axis (Roll)** looks like this:

```
[ cos(θ), -sin(θ),  0,  0 ]
[ sin(θ),  cos(θ),  0,  0 ]
[   0   ,    0   ,  1,  0 ]
[   0   ,    0   ,  0,  1 ]
```

The `transformPt` method performs the matrix-vector multiplication for Pitch (X), Yaw (Y), and Roll (Z).

### 3. **Back-Face Culling (`Triangle.ts`)**

To ensure solid objects look solid, the engine hides triangles facing away from the camera. This is done by checking the **winding order** of the projected 2D vertices.

It calculates the **2D Cross Product** of two edge vectors ($V1 = B-A$ and $V2 = C-A$):

```
Cross = (V1x * V2y) - (V1y * V2x)
```

- If `Cross > 0`, the triangle is facing the camera (visible).
- If `Cross < 0`, the triangle acts as a back-face and is not rendered.

### 4. **Depth Sorting / Painter's Algorithm (`Mesh.ts`)**

To handle overlapping geometry properly (so valid back-faces don't draw on top of front-faces), the engine uses the **Painter's Algorithm**.

Triangles are sorted by their average Z-depth before rendering:

```typescript
// Average depth of the 3 vertices
depth = (A.z + B.z + C.z) / 3;
```

The renderer then draws triangles from **farthest to nearest**, ensuring closer elements cover the ones behind them.

### 5. **Texture Mapping & UVs (`Triangle.ts` & `builder.ts`)**

The engine supports mapping images onto triangles using **UV coordinates**.
Since the standard Canvas 2D API (`drawImage`) assumes a rectangular image, we cannot simply skew it into a triangle.

Instead, we use a 2D **Affine Transform Matrix** to map the texture space to the screen space.
For a given triangle, we solve for a matrix that transforms the texture coordinates $(u, v)$ to the screen coordinates $(x, y)$.

**The Challenge: Perspective Distortion**
Affine mapping preserves parallel lines, but in 3D perspective, lines converge. This means using a single affine transform for a large face creates "warping" artifacts ("affine texture swimming") where the texture looks skewed incorrectly.

**The Solution: Subdivision**
To minimize this, we use `addTexturedQuadSubdiv` in `builder.ts`.
This breaks a large quad into a grid of many small triangles (e.g., 12x12).
Each small triangle is still affinely mapped, but because they are so small, the perspective error is barely noticeable.

### 6. **Animation State Machine (`StateMachine.ts` & `shapeTransitionMachine.ts`)**

Shape transitions are handled separately from the continuous 3D rotation.
Rotation still happens every frame on the active mesh geometry, but entrance / exit motion is driven by a small generic state machine.

This split is intentional:

- the 3D engine keeps doing what it already does well: project, cull, sort, and draw triangles
- the animation system only decides **which mesh is visible**, **which state it is in**, and **which screen-space offset should be applied**
- new transitions can be added without mixing animation timing logic into the renderer

#### **The generic machine**

`src/animations/StateMachine.ts` is a reusable finite state machine with timed updates.
Each state can define:

- `onEnter(context, controller, payload)`
- `onUpdate(context, update)`
- `onExit(context, controller, nextState)`

At runtime, the machine stores:

- the current state
- a mutable context object shared by all states
- the moment the current state started
- the last update timestamp

The `update(now)` call computes elapsed time and exposes helpers such as:

- `progress(duration)` to normalize time from `0` to `1`
- `transition(nextState, payload)` to move to another state

This makes it suitable for many UI or canvas animations where motion is time-based and state-driven.

#### **The shape transition machine**

`src/animations/shapeTransitionMachine.ts` is a concrete implementation built on top of the generic machine.
It manages three states:

- `idle`: one mesh is centered on screen
- `entering`: a mesh comes from above and stops in the middle
- `switching`: the current mesh exits left while the next mesh enters from above

Its context stores:

- `currentMesh`
- `incomingMesh`
- `outgoingMesh`
- `renderables`
- transition timing and travel distances

Each frame, the machine outputs a list of render instructions:

```ts
type MeshRenderRequest = {
  mesh: Mesh;
  offsetX?: number;
  offsetY?: number;
};
```

Those offsets are applied at draw time in `Triangle.render(...)`, which means the animation moves the rendered result on screen without changing the existing rotation pipeline.

#### **How it is used in this project**

In `src/index.ts`:

1. `Main` creates one `ShapeTransitionMachine`
2. the default primitive is started with `playInitialEntrance(...)`
3. when the `<select>` changes, `switchTo(...)` is called with the new mesh
4. on every animation frame, `transitionMachine.update(timestamp)` refreshes the current state
5. the renderer consumes `transitionMachine.getRenderables()` and draws every mesh with its current offset

This means the rendering loop stays simple:

```ts
this.transitionMachine.update(timestamp);
const renderables = this.transitionMachine.getRenderables();
renderables.forEach((renderable) => this.rotateMesh(renderable.mesh));
this.surface3D.render(renderables);
```

#### **How to create another animation**

To add another state-driven animation:

1. Create a new file in `src/animations/`
2. Define a state union such as `"idle" | "fadeIn" | "fadeOut"`
3. Create a context object with the data the states need
4. Declare state handlers with `onEnter`, `onUpdate`, and optional `onExit`
5. Use `progress(duration)` plus easing / interpolation helpers to compute motion
6. Expose a small public API such as `play()`, `hide()`, `update(now)`, and `getRenderables()`
7. Call it from `src/index.ts` inside the main animation loop

The important design rule is:

- keep the generic timing / transition logic inside the state machine
- keep rendering decisions in the specialized animation wrapper
- keep mesh projection / triangle drawing inside the renderer

With that separation, you can add new canvas animations without coupling them to the math and rendering internals.

---

## Code conventions

This codebase is 100% OOP TypeScript. Behaviour lives in a class: one class per file,
the file basename identical to the class name, fields declared at the top and assigned
in the constructor, visibility always explicit, and a bare `export default X;` as the
last line — never `export default class`, never `export const createX = () => ({…})`.
Inert data tables and single pure derivations stay plain `const`s, because the line is
behaviour rather than file type. The full ruleset is twenty rules (R1–R20), each cited
to a real `file:line` in this repo, in
**[notes/oop-refonte/reference/house-style.md](notes/oop-refonte/reference/house-style.md)**
— read it before adding a module. The rulings behind it, including what makes a file
exempt, are in
[notes/oop-refonte/reference/decisions.md](notes/oop-refonte/reference/decisions.md).
The style is enforced mechanically: `pnpm run lint` is Biome with two native rules plus
eight Grit plugins in `biome-plugins/`, every one an error across `src/` with no inline
suppression, and `pnpm run lint:rules` re-proves the plugins against fixtures so a rule
that silently stops matching fails the build.

---

## Styles

Styling is split into a **token layer** and everything that consumes it. Every colour,
size, type step and spacing value in the console UI is a CSS custom property; nothing
downstream hardcodes one.

### One file per token type

`src/styles/tokens/` holds one file per kind of token, each a single `:root` block that
opens with a two-line comment stating what it owns and what it must not own:

| File | Owns |
| -- | -- |
| `breakpoints.css` | the single layout breakpoint |
| `colors.css` | every colour — surfaces, borders, accent, text ramp, state, charts, HUD |
| `typography.css` | families, weights, and the size / leading / tracking ramps |
| `spacing.css` | the gap and padding scale |
| `radius.css` | corner radii |
| `sizing.css` | fixed component and shell dimensions |
| `elevation.css` | HUD backgrounds, the one blur, placeholder opacity, stacking layers |
| `motion.css` | durations, easings, and the `recblink` keyframes |

They are imported at the top of `src/styles/main.css`, in this order:

```css
@import url(reset.css);
@import url(tokens/breakpoints.css);
@import url(tokens/colors.css);
@import url(tokens/typography.css);
@import url(tokens/spacing.css);
@import url(tokens/radius.css);
@import url(tokens/sizing.css);
@import url(tokens/elevation.css);
@import url(tokens/motion.css);
```

**`reset.css` stays first.** Token files are not purely custom properties — `motion.css`
carries `@keyframes`, and any of them may grow element-level rules later — while the reset
uses very broad selectors. Ordering reset → tokens → components → layout means nothing a
token file adds can be clobbered by the reset. All `@import` rules must remain above every
other rule in `main.css`.

### Naming prefixes

`--color-*` · `--font-*` / `--text-*` / `--tracking-*` / `--leading-*` · `--space-*` ·
`--radius-*` · `--size-*` · `--elevation-*` / `--blur-*` · `--layer-*` · `--opacity-*` ·
`--breakpoint-*` · `--duration-*` / `--ease-*`

A new value is **added to a token file**, never written inline. Raw hex and raw px are
legal only inside `src/styles/tokens/*.css` and `src/ui/chartTokens.ts`, for the media-query
literals, and for one-off geometry the design itself uses inline (percentage anchors,
negative centring offsets, flex ratios).

### One name, two values

There are **no `*-mobile` token names.** A token keeps a single name and changes value inside
`@media (max-width: 899px)`. Only `sizing.css` carries such a block; colours, type, spacing,
radii, elevation and motion are identical on both branches.

The breakpoint is **exclusive at 900**: desktop is `min-width: 900px`, mobile is
`max-width: 899px`. Never `max-width: 900px` — at exactly 900px the app is desktop, in the
layout and in every token value.

Where a literal appears only in the mobile branch it is still named by *role*, not by branch
(`--color-hud-bg-dense`, `--color-crosshair-dim`): those are separate values with separate
jobs, not per-branch copies of one value.

### Two known duplications

Both are deliberate and documented where they occur:

1. **The `899px` / `900px` media literals.** A media query condition cannot read a custom
   property, so `--breakpoint-md` is documentation and a value for JS; the literal is repeated
   in each `@media` block.
2. **`src/ui/chartTokens.ts` mirrors five colours** from `colors.css`. Canvas 2D cannot read
   custom properties, and reading `getComputedStyle` per frame would cost a layout read and
   would not work before the stylesheet resolves. Change one, change the other.

---

## Deployment

This project is deployed using an **atomic release strategy** based on
timestamped releases and a `current` symlink.

The deployment flow is:

- local build with Vite
- upload of the `dist/` folder via `rsync`
- atomic switch of the active release using a symlink
- optional rollback to a previous release

This setup avoids downtime and makes rollbacks trivial.
