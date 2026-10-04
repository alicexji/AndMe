# Generative rendering architecture

The Playground is migrating from a main-thread Canvas 2D renderer to PixiJS/WebGL one artwork at a time. Dissolving Blooms is the first migrated artwork; all other modes retain the Canvas renderer until they are deliberately ported.

```text
React controls + dataset ingestion
              |
              v
     preprocessing worker
  validation / ranges / features
              |
       transferable Float32Array
              |
              v
 fixed-step simulation (30 Hz)
              |
         interpolation
              |
              v
 PixiJS ParticleContainers (display Hz)
              |
          WebGL / GPU
```

## Boundaries

- React owns UI state, selected datasets, controls, and the raw-data tape. It does not own particle positions or animation frames.
- `artPreprocess.worker.ts` validates records and derives normalized visual features. Its output is a transferable typed buffer.
- `BloomSimulation` owns current and previous simulation states. It updates on a fixed timestep so simulation rate and render rate remain independent.
- `PixiBloomRenderer` owns Pixi lifecycle, particle pools, interpolation, and rendering. Particles are reused rather than recreated every frame.
- `PixiBloomCanvas` is the small React lifecycle adapter. It debounces worker requests and discards stale responses.

## Failure behavior

Invalid records are removed by the worker. Invalid feature buffers are rejected by the renderer. Individual frame failures are caught without terminating Pixi's ticker. Initialization or WebGL-context failure switches Dissolving Blooms back to the legacy Canvas renderer.

## Shader path

`PixiBloomRenderer.setPostProcessFilters()` is the initial extension boundary for Pixi filters and custom GLSL/WGSL effects. A future migration can replace particle textures with a custom `Mesh` and shader without coupling GPU resources to React or changing the worker protocol.
