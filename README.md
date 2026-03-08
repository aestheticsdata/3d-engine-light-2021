# 3d-engine-light-2021

- 100% TypeScript
- Vite bundler

http://1991computer.com/3dengine/

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

## Deployment

This project is deployed using an **atomic release strategy** based on
timestamped releases and a `current` symlink.

The deployment flow is:

- local build with Vite
- upload of the `dist/` folder via `rsync`
- atomic switch of the active release using a symlink
- optional rollback to a previous release

This setup avoids downtime and makes rollbacks trivial.

---

## One-time server setup (ks-b)

⚠️ **The following steps must be done once on the server before the first deploy.**

### 1. Create deployment directories

```bash
sudo mkdir -p /var/www/1991computer/3dengine/releases
sudo ln -s /var/www/1991computer/3dengine/releases \
          /var/www/1991computer/3dengine/current
sudo chown -R debian:debian /var/www/1991computer/3dengine
```

### 2. Configure nginx

```nginx
location /3dengine/ {
    alias /var/www/1991computer/3dengine/current/;
    index index.html;
    try_files $uri $uri/ /3dengine/index.html;
}
```

and reload nginx after deploy:

```bash
sudo nginx -t && sudo systemctl reload nginx
```
