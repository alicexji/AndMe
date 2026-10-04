# Generative rendering architecture

Dissolving Blooms uses PixiJS/WebGL2. Other Playground presets retain the Canvas 2D renderer.

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
 one instanced mesh / analytic Perlin-noise bloom shader
```

## Data and animation

React owns dataset selection, playback, controls, and the raw-data tape. API responses are snapshots replayed at the selected ingestion frequency, not streaming connections. Ingestion advances outside React state updater callbacks so development Strict Mode cannot replay its side effects.

`BloomFeatures.ts` normalizes against the complete source snapshot. Arrivals and expirations cannot change the scale of existing marks. Value, logarithmic value, rank, time, and sequence use the same stable reference. Exact source ID plus arrival time identifies each playback instance independently of Float32 precision.

`PixiBloomCanvas` submits work only when events, reference data, or mapping controls change. It allows one worker request in flight and coalesces newer input; stale results are discarded. Renderer controls do not trigger preprocessing.

`BloomSimulation` reuses state and interpolation buffers for surviving instances. Position and radius ease toward targets at 30 Hz and are interpolated at display refresh. Phase is integrated, avoiding orbit jumps when motion changes. Host resizing scales both interpolation states together.

## Rendering and removal

`BloomShader.ts` renders analytic contours, translucent interiors, and Perlin-noise erosion on an instanced quad. Derivative antialiasing maintains smooth edges at different radii and pixel densities. Screen blending creates luminous overlap without full-screen blur or trail buffers. Noise evolves using an integrated motion clock.

`PixiBloomRenderer` submits one mesh containing only visible blooms. Expired simulation states are deleted every frame, including when ingestion is paused. Density reductions retire older states over 400 ms before deletion. Offscreen bounds and effectively zero opacity are excluded from the draw. There are no alpha-zero particle objects left in a scene graph. A bounded reusable byte buffer holds at most 360 instances (180 active plus retirement capacity); only its visible prefix is uploaded and drawn.

Host visibility and document visibility stop rendering when the canvas is not being viewed. A ResizeObserver tracks the actual host, including responsive layout changes. GPU geometry, buffers, shader, observers, and ticker are released on destruction; asynchronous initialization also handles an already-unmounted host.

## Diagnostics and failure behavior

The development / `?perf` overlay reports FPS, p95 frame interval, visible bloom count, DPR, and CPU simulation plus WebGL submission time. It does not claim to measure GPU execution time. Hardware-specific tuning still requires a browser performance trace; headless rendering is not a substitute for device measurements.

Malformed feature buffers, initialization failure, context loss, or three consecutive rendering exceptions switch the component to the existing Canvas fallback. That legacy fallback has a different visual implementation and lower resolution.

## Verification

From `frontend/`, run `npm run test:blooms` (Node 22.13+ for built-in TypeScript stripping) and `npm run build`.

`tests/blooms.browser.mjs` runs deterministic browser checks using Chrome DevTools Protocol, without a browser automation dependency. It expects an isolated Chromium browser debugging endpoint at `127.0.0.1:9223` and the built-app test server at `127.0.0.1:5175` (`node tests/serve-blooms.mjs` after building). It stubs the earthquake API, checks real WebGL startup, captures an image to the OS temp directory, and verifies density retirement, expiry removal, offscreen suspension, resize, and repeated/early teardown.
