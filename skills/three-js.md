---
name: three-js
description: Three.js scenes and games that run on integrated GPUs
triggers: three.js, threejs, 3d, webgl, low-poly, low poly, 3d game
---
Build Three.js scenes tuned for weak GPUs (Intel Iris Xe class) — smooth beats pretty.

SETUP: import Three from a single ESM CDN import (or local file). WebGLRenderer({antialias:true, powerPreference:'high-performance'}), renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)), handle window resize (camera.aspect + renderer.setSize).

PERF RULES (learned the hard way on this machine):
- Low-poly aesthetic: MeshStandardMaterial with flatShading:true, geometry segment counts LOW (box, cone, icosahedron detail 0-1). It looks stylish AND runs fast.
- One directional light + one ambient/hemisphere light. Shadows: single 1024px shadow map, shadow.camera tight around the play area; consider updating shadows every other frame.
- Reuse geometries and materials across meshes; use InstancedMesh for repeated props (trees, rocks, particles).
- NEVER allocate in the render loop — no new Vector3() per frame; keep scratch vectors module-level.
- Cap and clamp delta time; move everything by dt so lag doesn't change physics.
- Fog (scene.fog) hides a short draw distance and adds mood for free.
- Object pools for bullets/particles/damage numbers — create once, recycle.

GAME LOOP: clock.getDelta() clamped to 0.05; states MENU/PLAYING/OVER; keyboard via a held-keys Set; camera follows player with lerp (never snap).

JUICE (cheap on GPU): scale-pop on hit, camera shake via small random offsets that decay, emissive material pulse, particles as tiny instanced cubes with gravity.

VERIFY: open it and check the console; if it exists, log renderer.info.render.calls once — over ~150 draw calls means batch or instance something.
