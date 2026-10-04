# Generative rendering architecture

All seven Playground presets use a shared PixiJS/WebGL2 renderer. The legacy Canvas renderer is retained only as a loading and error fallback.

```text
API snapshot + playback arrivals
              |
      preprocessing worker
 stable snapshot normalization + exact instance keys
              |
  transferable feature buffer + keys
              |
  persistent simulation states (30 Hz)
  interpolate position, phase, and radius
              |
 compact visible instances into reusable GPU buffer
              |
 one instanced mesh / preset-specific analytic shader
```

## Data and animation

React owns dataset selection, playback, controls, and the raw-data tape. API responses are snapshots replayed at the selected ingestion frequency, not streaming connections. Ingestion advances outside React state updater callbacks so development Strict Mode cannot replay its side effects.

`BloomFeatures.ts` normalizes against the complete source snapshot. Arrivals and expirations cannot change the scale of existing marks. Value, logarithmic value, rank, time, and sequence use the same stable reference. Exact source ID plus arrival time identifies each playback instance independently of Float32 precision.

`PixiBloomCanvas` submits work only when events, reference data, or mapping controls change. It allows one worker request in flight and coalesces newer input; stale results are discarded. Renderer controls do not trigger preprocessing.

`BloomSimulation` reuses state and interpolation buffers for surviving instances. Position and radius ease toward targets at 30 Hz and are interpolated at display refresh. Phase is integrated, avoiding orbit jumps when motion changes. Host resizing scales both interpolation states together.

## Rendering and removal

`BloomShader.ts` renders three expanding blue wavefronts and an advected Perlin-noise pressure field on each instanced quad. Primary normalized values set maximum wave reach (48?150 CSS pixels); the secondary feature controls atmospheric intensity and drift. Origins snap to the fixed 32px white-dot lattice using `BloomGrid.ts`. Positions are a generative survey layout, not real geographic coordinates. Cool blue/cyan fields develop localized warm cores when secondary values are strong. Waves erode and fade with distance from their originating dot. The background is pure black and the page grain overlay is disabled while this artwork is mounted. Derivative antialiasing maintains smooth edges at different radii and pixel densities. The CSS dot overlay remains sharp at display resolution. Screen blending creates luminous overlap without full-screen blur or trail buffers. Noise evolves using an integrated motion clock.

`PixiBloomRenderer` submits one mesh containing only visible marks. Expired simulation states are deleted every frame, including when ingestion is paused. Density reductions retire older states over 400 ms before deletion. Offscreen bounds and effectively zero opacity are excluded from the draw. There are no alpha-zero particle objects left in a scene graph. Buffers are sized by preset: 360 instances for individual shapes, 1,080 for layered strips, and 10,800 for particle clusters. Only the visible prefix is uploaded and drawn; spare capacity is raw storage, not invisible scene objects.

Host visibility and document visibility stop rendering when the canvas is not being viewed. A ResizeObserver tracks the actual host, including responsive layout changes. GPU geometry, buffers, shader, observers, and ticker are released on destruction; asynchronous initialization also handles an already-unmounted host.

## Diagnostics and failure behavior

The development / `?perf` overlay reports FPS, p95 frame interval, visible mark count, DPR, and CPU simulation plus WebGL submission time. It does not claim to measure GPU execution time. Hardware-specific tuning still requires a browser performance trace; headless rendering is not a substitute for device measurements.

Malformed feature buffers, initialization failure, context loss, or three consecutive rendering exceptions switch the component to the existing Canvas fallback. That legacy fallback has a different visual implementation and lower resolution.

## Verification

From `frontend/`, run `npm run test:blooms` (Node 22.13+ for built-in TypeScript stripping) and `npm run build`.

`tests/blooms.browser.mjs` runs deterministic browser checks using Chrome DevTools Protocol, without a browser automation dependency. It expects an isolated Chromium browser debugging endpoint at `127.0.0.1:9223` and the built-app test server at `127.0.0.1:5175` (`node tests/serve-blooms.mjs` after building). It stubs the earthquake API, checks real WebGL startup, captures an image to the OS temp directory, and verifies density retirement, expiry removal, offscreen suspension, resize, and repeated/early teardown.

The atmospheric layer extends to 1.62 times wave reach, with a broader falloff, crosswind advection, and slowly deforming pressure cells. Ring half-width is 0.68 CSS pixels before antialiasing. Pale-blue source glows grow with normalized magnitude and pulse according to the launch and travel of each outgoing wave.

Broad-field rendering caps shader resolution at 1.5? above 55 visible sources and 1.25? above 90, preserving fill-rate headroom. The CSS dot grid stays at native display resolution.

## Other presets

`PresetShaders.ts` contains the six additional GPU styles. Constructive Matrix uses antialiased geometric distance fields, Particle Weather uses small instanced particle quads, Signal Strata and Segmented Currents use 96-segment narrow strips, Living Notation uses analytic glyphs, and Chromatic Ledger uses antialiased tiles and rings. Paper palettes use normal blending; particle light uses screen blending. All six render at up to 2x display density, without the legacy 15ms frame skip or frame-dependent quality reductions.

The shared `PixiBloomRenderer` and `PixiBloomCanvas` retain their original filenames for compatibility but now take a preset mode. All modes use the same preprocessing worker, stable source scaling, persistent interpolated states, visibility suspension, and retirement/expiry lifecycle. Mode changes destroy the previous renderer and worker before initializing the next. The shader palette and geometry preserve each preset's visual family, while omitting the old frame-dependent accumulation trails.

The browser suite checks all presets through the real React controls and renders each at a dense feed size, asserting GPU startup and zero remaining instances after expiry. Screenshots are written to the OS temporary directory for visual inspection. On the local isolated browser check, all six additional presets were around 60 FPS at 2x DPR; this is a device-specific measurement, not a universal performance guarantee.
