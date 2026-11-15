// Marswalk Radar: 3D walk view. A chase camera over the HiRISE DEM with a visor-style HUD.
// Spatial data are anchored to the terrain (slope mask, contours, route, stops, Curiosity track, return limit).
// Time series (RAD, REMS) stay in the HUD: they are historical series by hour, not measurements of the spot
// under the astronaut. Reads only data/processed/gale_radar/ (contract: web/README.md). No external requests.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const TILE = 64;                    // terrain tile size in grid cells (frustum culling unit)
const LOD_STRIDES = [1, 2, 4, 8];   // a tile is drawn with every 1, 2, 4 or 8 grid cells (4 m to 32 m)…
const LOD_DIST = [650, 1400, 2800]; // …depending on its distance to the camera, in metres
const SKIRT_M = 10;                 // depth of the tile skirts that hide seams between detail levels
const CAMS = {                      // chase camera presets: distance (m) and pitch above the horizon (rad)
  close: { dist: 9, pitch: 0.2 },
  follow: { dist: 30, pitch: 0.3 },
  high: { dist: 420, pitch: 0.82 },
};
const APPROACH_M = 150;             // the site record starts to open this far from a stop (along the route)
const STEEP_SHARE = 0.75;           // "steep section" = slope above this share of the limit
const HAZARD_SEARCH_M = 120;        // callout for the nearest cell above the slope limit within this radius
const TRACK_NEAR_M = 20, TRACK_FAR_M = 70, TRACK_CALLOUT_M = 80;
const TAPE_PX_PER_DEG = 4;
const COLORS = { next: 0x00E5FF, visited: 0xB388FF, pickup: 0xFFFFFF, context: 0x7C8794 };
const PING = { RAD: 'v3-rad', REMS: 'v3-temp', EVA: 'v3-time', TERRAIN: 'v3-terrain', SCIENCE: 'v3-tg' };   // log category → instrument

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, f) => a + (b - a) * f;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (rad) => ((rad * 180) / Math.PI + 360) % 360;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image ${url}.`));
    img.src = url;
  });
}

export async function createView3D(ctx) {
  const { PKG, site, route, track, stops, rad, weather, images, state, fn, actions, k } = ctx;
  const { fmtHM, fmtInt, fmtSigned, fmtDist, esc } = fn;
  const root = $('view3d'), canvas = $('v3-canvas');

  // ---------------------------------------------------------------- data
  const grid = site.grids.terrain_2m, rg = site.grids.routing_4m;
  const W = grid.width_m, H = grid.height_m;
  const gw = rg.width_px, gh = rg.height_px, cx = rg.px_x_m, cy = rg.px_y_m;
  const enc = site.layers.elevation.encoding;
  const elevUrl = PKG + site.layers.elevation.file;
  const [elevRes, photoImg] = await Promise.all([fetch(elevUrl), loadImage(PKG + site.layers.hirise.file)]);
  if (!elevRes.ok) throw new Error(`Could not load ${elevUrl} (HTTP ${elevRes.status}).`);
  const raw = new Uint16Array(await elevRes.arrayBuffer());
  if (raw.length !== gw * gh) throw new Error(`${elevUrl} has ${raw.length} cells, site.json says ${gw * gh}.`);
  const zBase = enc.min;                                   // world z = elevation − zBase (keeps float32 precise)
  const elev = new Float32Array(gw * gh);
  for (let i = 0; i < elev.length; i++) elev[i] = enc.offset + enc.scale * raw[i] - zBase;

  function zAt(x, y) {                                     // bilinear between cell centres, metres above zBase
    const fc = clamp(x / cx - 0.5, 0, gw - 1.001), fr = clamp(gh - y / cy - 0.5, 0, gh - 1.001);
    const c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r, i = r * gw + c;
    return lerp(lerp(elev[i], elev[i + 1], u), lerp(elev[i + gw], elev[i + gw + 1], u), v);
  }
  function normalAt(x, y, out) {
    const e = 4;
    return out.set(-(zAt(x + e, y) - zAt(x - e, y)) / (2 * e), -(zAt(x, y + e) - zAt(x, y - e)) / (2 * e), 1).normalize();
  }

  // cells above the slope limit on the 4 m grid (from the package mask, not recomputed)
  const hazard = new Uint8Array(gw * gh);
  {
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    c2.drawImage(images.hazard, 0, 0, gw, gh);
    const px = c2.getImageData(0, 0, gw, gh).data;
    for (let i = 0; i < hazard.length; i++) hazard[i] = px[i * 4 + 3] > 40 ? 1 : 0;
  }

  const P = route.points, N = P.length, totalDist = P[N - 1].dist_m;
  const routeStops = stops.filter((s) => s.order !== null && s.order !== undefined).sort((a, b) => a.order - b.order);
  const scienceCount = routeStops.filter((s) => s.role === 'science').length;
  const stopTag = (s) => (s.role === 'science' ? `${s.order} · ` : '');

  // ---------------------------------------------------------------- renderer and scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x07090C, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 15000);
  camera.up.set(0, 0, 1);

  const FOG = new THREE.Color(0.45, 0.305, 0.215), VOID = new THREE.Color(0.03, 0.03, 0.036);
  const texOf = (img, isData, aniso = 4) => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.NoColorSpace;
    if (isData) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    else t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  };

  // Terrain: tinted HiRISE image lit by the package hillshade, with contour lines, a 10 m grid around the
  // astronaut, the red slope mask and the amber return isochrone. The tint is a style, not measured colour.
  const terrainMat = new THREE.ShaderMaterial({
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2, side: THREE.DoubleSide,
    uniforms: {
      tHill: { value: texOf(images.hill) }, tPhoto: { value: texOf(photoImg) },
      tHazard: { value: texOf(images.hazard, false, 2) }, tReturn: { value: texOf(images.ret, true) },
      uRetSize: { value: new THREE.Vector2(gw, gh) }, uSize: { value: new THREE.Vector2(W, H) },
      uAstro: { value: new THREE.Vector2() }, uLevel: { value: 1e6 }, uRetMax: { value: k.retMaxMin + 1 }, uZBase: { value: zBase },
      uPulse: { value: 0 }, uPulseK: { value: 0 }, uFogK: { value: 1 / 4300 },
      uFog: { value: FOG }, uVoid: { value: VOID },
    },
    vertexShader: /* glsl */`
      uniform vec2 uSize;
      varying vec2 vUv; varying vec3 vWorld; varying vec3 vN; varying float vDist;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;   // tiles are only translated
        vUv = vWorld.xy / uSize;
        vN = normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tHill, tPhoto, tHazard, tReturn;
      uniform vec2 uRetSize, uSize, uAstro;
      uniform float uLevel, uRetMax, uZBase, uPulse, uPulseK, uFogK;
      uniform vec3 uFog, uVoid;
      varying vec2 vUv; varying vec3 vWorld; varying vec3 vN; varying float vDist;
      const vec3 SUN_DIR = vec3(-0.620, 0.620, 0.481);    // from the NW like the package hillshade, lower for relief
      const vec3 RED = vec3(1.0, 0.231, 0.188);
      const vec3 AMBER = vec3(1.0, 0.702, 0.0);
      const vec3 CYAN = vec3(0.0, 0.898, 1.0);
      const vec3 ICE = vec3(0.62, 0.86, 0.95);
      float gridLine(float v, float px) {                 // antialiased line at every integer of v, px wide
        float fw = max(fwidth(v), 1e-5);
        float d = abs(fract(v - 0.5) - 0.5) / fw;
        return (1.0 - smoothstep(px * 0.5, px * 0.5 + 1.0, d)) * (1.0 - smoothstep(0.18, 0.5, fw));
      }
      float ret(vec2 ij) { return texture2D(tReturn, (ij + 0.5) / uRetSize).r; }
      float differs(vec2 uv, float beyond) {
        float r = texture2D(tReturn, uv).r;
        return r < 0.998 ? abs(step(uLevel, r * 510.0) - beyond) : 0.0;
      }
      void main() {
        float hill = texture2D(tHill, vUv).r;
        float photo = texture2D(tPhoto, vUv).r;
        float lit = clamp((hill - 0.5) / 0.42, 0.0, 1.0);    // 2 m relief detail from the package hillshade
        float alb = smoothstep(0.02, 0.60, photo);
        vec3 n = normalize(vN);
        float sunAmt = max(dot(n, SUN_DIR), 0.0) * (0.5 + 0.85 * lit);
        vec3 albedo = mix(vec3(0.19, 0.105, 0.075), vec3(0.92, 0.60, 0.41), alb);
        vec3 col = albedo * (vec3(1.22, 0.96, 0.78) * sunAmt * 0.95 + vec3(0.085, 0.115, 0.185) * (0.5 + 0.5 * n.z));

        float elevM = vWorld.z + uZBase;
        float d = distance(vWorld.xy, uAstro);
        float pr = d - uPulse;
        float ring = exp(-pr * pr / (2.0 * pow(2.0 + uPulse * 0.015, 2.0))) * uPulseK;
        float wake = pr < 0.0 ? exp(pr / 70.0) * uPulseK : 0.0;

        float c10 = gridLine(elevM / 10.0, 1.0), c50 = gridLine(elevM / 50.0, 1.6);
        float down = (cameraPosition.z - vWorld.z) / max(vDist, 1.0);           // sine of the depression angle
        float graze = smoothstep(500.0, 2200.0, vDist) * (1.0 - smoothstep(0.12, 0.45, down));
        col += ICE * (c10 * 0.13 + c50 * 0.26) * (1.0 + wake * 2.5) * (1.0 - 0.75 * graze);   // quieter towards the horizon
        float g = max(gridLine(vWorld.x / 10.0, 1.0), gridLine(vWorld.y / 10.0, 1.0));
        col += CYAN * g * (1.0 - smoothstep(40.0, 130.0, d)) * 0.13;

        float hz = texture2D(tHazard, vUv).a;
        col = mix(col, RED * (0.78 + 0.22 * lit), hz * 0.66);
        col += RED * hz * wake * 0.5;

        // return time in minutes (same contour logic as the radar shader); skipped while no cell is beyond the limit
        vec2 st = vUv * uRetSize - 0.5;
        float cellsPerPx = max(fwidth(st.x), fwidth(st.y));
        vec2 du = dFdx(vUv) * 1.3, dv = dFdy(vUv) * 1.3;
        if (uLevel < uRetMax) {
          vec2 i0 = floor(st);
          vec2 f = st - i0;
          float a = ret(i0), b = ret(i0 + vec2(1.0, 0.0)), c = ret(i0 + vec2(0.0, 1.0)), e = ret(i0 + vec2(1.0, 1.0));
          float nearest = texture2D(tReturn, vUv).r;
          float reach = nearest < 0.998 ? 1.0 : 0.0;
          float ok = max(max(a, b), max(c, e)) < 0.998 ? 1.0 : 0.0;
          float mb = mix(mix(a, b, f.x), mix(c, e, f.x), f.y) * 510.0;
          float m = ok > 0.5 ? mb : nearest * 510.0;
          float beyond = step(uLevel, m) * reach;
          col = mix(col, AMBER, beyond * 0.16);
          float thin = max(max(differs(vUv + du, beyond), differs(vUv - du, beyond)), max(differs(vUv + dv, beyond), differs(vUv - dv, beyond))) * reach;
          float wide = (1.0 - smoothstep(1.0, 2.4, abs(mb - uLevel) / max(length(vec2(dFdx(mb), dFdy(mb))), 1e-4))) * step(cellsPerPx, 0.6) * ok * reach;
          col = mix(col, AMBER, max(thin * step(0.6, cellsPerPx), wide));
        }

        col += CYAN * ring * 0.5;
        col = mix(col, uFog, 1.0 - exp(-pow(vDist * uFogK, 2.0)));
        float edge = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
        col = mix(uVoid, col, smoothstep(0.0, 70.0, edge));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  // Terrain mesh: tiles with vertices at cell centres. Each tile has four index sets (every 1, 2, 4 or 8 cells),
  // chosen by distance to the camera, and a skirt along its border that hides the seams between levels.
  const tiles = [];
  {
    const indexCache = new Map();
    const indexFor = (rows, cols, stride) => {
      const key = `${rows}x${cols}/${stride}`;
      if (!indexCache.has(key)) {
        const idx = [];
        const at = (r, c) => r * (cols + 1) + c;
        const T = (rows + 1) * (cols + 1), B = T + cols + 1, L = B + cols + 1, R = L + rows + 1;   // skirt vertex blocks
        const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
        for (let r = 0; r < rows; r += stride) for (let c = 0; c < cols; c += stride) {
          const r2 = Math.min(rows, r + stride), c2 = Math.min(cols, c + stride);
          quad(at(r, c), at(r2, c), at(r2, c2), at(r, c2));
        }
        for (let c = 0; c < cols; c += stride) {
          const c2 = Math.min(cols, c + stride);
          quad(at(0, c), at(0, c2), T + c2, T + c);
          quad(at(rows, c), at(rows, c2), B + c2, B + c);
        }
        for (let r = 0; r < rows; r += stride) {
          const r2 = Math.min(rows, r + stride);
          quad(at(r, 0), at(r2, 0), L + r2, L + r);
          quad(at(r, cols), at(r2, cols), R + r2, R + r);
        }
        indexCache.set(key, new THREE.BufferAttribute(new Uint16Array(idx), 1));
      }
      return indexCache.get(key);
    };
    for (let r0 = 0; r0 < gh - 1; r0 += TILE) for (let c0 = 0; c0 < gw - 1; c0 += TILE) {
      const rows = Math.min(TILE, gh - 1 - r0), cols = Math.min(TILE, gw - 1 - c0);
      const grid = (rows + 1) * (cols + 1), total = grid + 2 * (cols + 1) + 2 * (rows + 1);
      const pos = new Float32Array(total * 3), nor = new Int8Array(total * 3);
      const ox = (c0 + cols / 2 + 0.5) * cx, oy = (gh - r0 - rows / 2 - 0.5) * cy;   // tile centre: lets three sort tiles front to back
      let n = 0;
      for (let r = r0; r <= r0 + rows; r++) for (let c = c0; c <= c0 + cols; c++) {
        const w = Math.max(0, c - 1), e = Math.min(gw - 1, c + 1), up = Math.max(0, r - 1), dn = Math.min(gh - 1, r + 1);
        const nx = -(elev[r * gw + e] - elev[r * gw + w]) / ((e - w) * cx), ny = -(elev[up * gw + c] - elev[dn * gw + c]) / ((dn - up) * cy);
        const inv = 127 / Math.hypot(nx, ny, 1);
        nor[n] = Math.round(nx * inv); nor[n + 1] = Math.round(ny * inv); nor[n + 2] = Math.round(inv);
        pos[n++] = (c + 0.5) * cx - ox; pos[n++] = (gh - r - 0.5) * cy - oy; pos[n++] = elev[r * gw + c];
      }
      let m = grid;
      const skirt = (r, c) => {                             // copy of a border vertex, dropped below the surface
        const s = (r * (cols + 1) + c) * 3, d = m++ * 3;
        pos[d] = pos[s]; pos[d + 1] = pos[s + 1]; pos[d + 2] = pos[s + 2] - SKIRT_M;
        nor[d] = nor[s]; nor[d + 1] = nor[s + 1]; nor[d + 2] = nor[s + 2];
      };
      for (let c = 0; c <= cols; c++) skirt(0, c);
      for (let c = 0; c <= cols; c++) skirt(rows, c);
      for (let r = 0; r <= rows; r++) skirt(r, 0);
      for (let r = 0; r <= rows; r++) skirt(r, cols);
      const pa = new THREE.BufferAttribute(pos, 3), na = new THREE.BufferAttribute(nor, 3, true);
      const geos = LOD_STRIDES.map((stride) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', pa); g.setAttribute('normal', na); g.setIndex(indexFor(rows, cols, stride));
        return g;
      });
      geos[0].computeBoundingSphere();
      for (const g of geos) g.boundingSphere = geos[0].boundingSphere;
      const mesh = new THREE.Mesh(geos[0], terrainMat);
      mesh.position.set(ox, oy, 0);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      tiles.push({ mesh, geos, x: ox, y: oy, z: geos[0].boundingSphere.center.z, lod: 0 });
    }
  }

  // sky: a dusk-toned gradient that the terrain fog blends into (stylised, not a measured sky)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false,
    uniforms: { uFog: { value: FOG }, uVoid: { value: VOID } },
    vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uFog, uVoid; varying vec3 vDir;
      void main() {
        float h = normalize(vDir).z;
        vec3 mid = vec3(0.215, 0.150, 0.128), zen = vec3(0.048, 0.050, 0.068);
        vec3 col = h >= 0.0 ? mix(mix(uFog, mid, smoothstep(0.0, 0.16, h)), zen, smoothstep(0.10, 0.75, h))
                            : mix(uFog, uVoid, smoothstep(0.0, 0.05, -h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.scale.setScalar(6000); sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xFFF1E0, 0x3A2A22, 1.2));
  const sun = new THREE.DirectionalLight(0xFFE2C4, 2.4);     // same direction as the package hillshade (NW, 45°)
  sun.position.set(-1, 1, 1.4);
  scene.add(sun);

  // ---------------------------------------------------------------- lines draped on the terrain
  const lineMats = [];
  function addLine(flat, opts, order) {
    const geo = new LineGeometry();
    geo.setPositions(flat);
    const mat = new LineMaterial({ worldUnits: false, transparent: true, depthWrite: false, ...opts });
    lineMats.push(mat);
    const line = new Line2(geo, mat);
    if (opts.dashed) line.computeLineDistances();
    line.frustumCulled = false;
    line.renderOrder = order;
    scene.add(line);
    return line;
  }
  function drape(xy, lift, maxStep = 6) {                   // xy pairs → xyz on the terrain, subdivided
    const out = [];
    for (let i = 0; i < xy.length; i += 2) {
      if (i > 0) {
        const ax = xy[i - 2], ay = xy[i - 1], n = Math.ceil(Math.hypot(xy[i] - ax, xy[i + 1] - ay) / maxStep);
        for (let j = 1; j < n; j++) { const x = lerp(ax, xy[i], j / n), y = lerp(ay, xy[i + 1], j / n); out.push(x, y, zAt(x, y) + lift); }
      }
      out.push(xy[i], xy[i + 1], zAt(xy[i], xy[i + 1]) + lift);
    }
    return out;
  }

  const trackLines = [];
  {
    let cur = [];
    const flush = () => {
      if (cur.length >= 4) trackLines.push(addLine(drape(cur, 0.5), { color: 0xFFFFFF, opacity: 0.55, linewidth: 1.5, dashed: true, dashSize: 4, gapSize: 4 }, 1));
      cur = [];
    };
    for (const p of track.points) { if (p.break_before) flush(); cur.push(p.x, p.y); }
    flush();
  }
  const routeFwd = [], routeRev = [];
  for (let i = 0; i < N; i++) routeFwd.push(P[i].x, P[i].y, zAt(P[i].x, P[i].y) + 0.6);
  for (let i = N - 1; i >= 0; i--) routeRev.push(P[i].x, P[i].y, zAt(P[i].x, P[i].y) + 0.6);
  addLine(routeFwd, { color: 0x34C759, opacity: 0.38, linewidth: 2.5 }, 2);
  const aheadGhost = addLine(routeRev, { color: 0x34C759, opacity: 0.16, linewidth: 2, depthTest: false }, 2);   // hint behind ridges
  const aheadLine = addLine(routeRev, { color: 0x34C759, opacity: 1, linewidth: 4 }, 3);

  // ---------------------------------------------------------------- stop beacons
  const beamGeo = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);   // x across, z up 0..1
  function ringPoints(x, y, r, lift) {
    const out = [];
    for (let i = 0; i <= 56; i++) { const a = (i / 56) * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; out.push(px, py, zAt(px, py) + lift); }
    return out;
  }
  const beacons = stops.map((s) => {
    const z = zAt(s.x, s.y);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0.8 } },
      vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
        void main() {
          float x = (vUv.x - 0.5) * 2.0;
          float a = (exp(-x * x * 9.0) * 0.55 + exp(-x * x * 120.0)) * pow(1.0 - vUv.y, 1.5) * uAlpha;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(s.x, s.y, z);
    beam.renderOrder = 4;
    scene.add(beam);
    const ring = addLine(ringPoints(s.x, s.y, 5, 0.5), { color: 0xFFFFFF, opacity: 0.95, linewidth: 2 }, 4);
    const el = document.createElement('div');
    el.className = 'v3-lbl';
    el.innerHTML = '<div class="box"><span class="nm"></span><span class="sub num"></span></div><i class="stem"></i>';
    $('v3-labels').appendChild(el);
    const pip = document.createElement('div');
    pip.className = 'v3-pip';
    pip.innerHTML = '<i></i><span></span>';
    if (s.role !== 'context') $('v3-pips').appendChild(pip);
    return { s, z, beam, beamMat, ring, el, nm: el.querySelector('.nm'), sub: el.querySelector('.sub'), pip, pipLbl: pip.querySelector('span'), cls: '' };
  });
  // one pulsing ring that moves to the current target stop
  const pulseRing = addLine(ringPoints(0, 0, 5, 0), { color: 0x00E5FF, opacity: 0.6, linewidth: 1.5 }, 4);

  const mkLabel = (cls, html) => {
    const el = document.createElement('div');
    el.className = `v3-lbl ${cls}`;
    el.innerHTML = `<div class="box">${html}</div><i class="stem"></i>`;
    el.hidden = true;
    $('v3-labels').appendChild(el);
    return el;
  };
  const hazardLbl = mkLabel('hazard', `<span class="nm">Slope &gt; ${k.slopeLimit}°</span><span class="sub num"></span>`);
  const roverLbl = mkLabel('rover', '<span class="nm">Curiosity track</span><span class="sub num"></span>');
  const youLbl = mkLabel('you', '<span class="nm">You</span><span class="sub">simulated position</span>');
  const hazardSub = hazardLbl.querySelector('.sub'), roverSub = roverLbl.querySelector('.sub');
  const setText = (node, prop, value) => { if (node[prop] !== value) node[prop] = value; };   // no DOM write when nothing changed

  // ---------------------------------------------------------------- astronauts (crew of 2, an assumption of the scenario)
  function makeAstronaut(accent) {
    const fig = new THREE.Group();                          // y-up figure, forward = −z, feet at y = 0
    const suit = new THREE.MeshStandardMaterial({ color: 0xE8ECF1, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x39414D, roughness: 0.9 });
    const visor = new THREE.MeshStandardMaterial({ color: 0xB98A2E, roughness: 0.25, metalness: 0.8, emissive: 0x4A3208 });
    const glow = new THREE.MeshBasicMaterial({ color: accent });
    const add = (geo, mat, x, y, z, parent = fig) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    add(new THREE.CapsuleGeometry(0.27, 0.42, 4, 12), suit, 0, 1.22, 0);            // torso
    add(new THREE.BoxGeometry(0.5, 0.66, 0.26), suit, 0, 1.3, 0.27);                // life-support pack
    add(new THREE.BoxGeometry(0.3, 0.05, 0.02), glow, 0, 1.5, 0.405);               // pack light, faces the chase camera
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.08, 16), dark, 0, 1.6, 0);          // neck ring
    add(new THREE.SphereGeometry(0.235, 24, 16), suit, 0, 1.8, 0);                  // helmet
    add(new THREE.SphereGeometry(0.205, 24, 16), visor, 0, 1.8, -0.07);             // visor
    add(new THREE.BoxGeometry(0.22, 0.14, 0.06), dark, 0, 1.3, -0.27);              // chest unit
    const limb = (x, y, len, r, mid, endGeo, endY, endZ) => {   // swings about a pivot at the hip or shoulder
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      add(new THREE.CapsuleGeometry(r, len, 4, 10), suit, 0, mid, 0, pivot);
      add(endGeo, dark, 0, endY, endZ, pivot);
      fig.add(pivot);
      return pivot;
    };
    const boot = () => new THREE.BoxGeometry(0.2, 0.12, 0.34), glove = () => new THREE.SphereGeometry(0.1, 12, 8);
    const legL = limb(-0.15, 0.92, 0.52, 0.125, -0.515, boot(), -0.86, -0.04), legR = limb(0.15, 0.92, 0.52, 0.125, -0.515, boot(), -0.86, -0.04);
    const armL = limb(-0.39, 1.5, 0.42, 0.095, -0.28, glove(), -0.6, 0), armR = limb(0.39, 1.5, 0.42, 0.095, -0.28, glove(), -0.6, 0);
    fig.rotation.x = Math.PI / 2;                           // y-up figure into the z-up world; forward becomes +y (north)
    const group = new THREE.Group();
    group.add(fig);
    scene.add(group);
    return { group, fig, legL, legR, armL, armR, phase: Math.random() * 6 };
  }
  const lead = makeAstronaut(0x00E5FF), buddy = makeAstronaut(0xFFB300);

  const shadowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const mkGround = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; scene.add(m); return m; };
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const leadShadow = mkGround(new THREE.CircleGeometry(1.25, 24), shadowMat), buddyShadow = mkGround(new THREE.CircleGeometry(1.25, 24), shadowMat);
  const youRing = mkGround(new THREE.RingGeometry(1.9, 2.03, 64), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
  const UP = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3();
  function settle(mesh, x, y, lift) {                       // lay a flat mesh on the local terrain plane
    normalAt(x, y, nrm);
    mesh.quaternion.setFromUnitVectors(UP, nrm);
    mesh.position.set(x, y, zAt(x, y)).addScaledVector(nrm, lift);
  }
  function pose(a, x, y, hdg, stride, dt) {
    a.group.position.set(x, y, zAt(x, y));
    a.group.rotation.z = -hdg;
    a.phase += dt * 7.5 * stride;
    const sw = Math.sin(a.phase) * 0.55 * stride;
    a.legL.rotation.x = sw; a.legR.rotation.x = -sw;
    a.armL.rotation.x = -sw * 0.7; a.armR.rotation.x = sw * 0.7;
    a.fig.position.y = Math.abs(Math.cos(a.phase)) * 0.04 * stride;
  }

  // ---------------------------------------------------------------- event log (deterministic by EVA time)
  const timeAtDist = (d) => {
    const dd = clamp(d, 0, totalDist);
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P[mid].dist_m <= dd) lo = mid; else hi = mid - 1; }
    const a = P[lo], b = P[Math.min(N - 1, lo + 1)], span = b.dist_m - a.dist_m;
    return span > 0 ? lerp(a.t_min, b.t_min, (dd - a.dist_m) / span) : a.t_min;
  };
  const trackPts = track.points;
  function nearestTrack(x, y) {
    let best = Infinity, bi = -1;
    for (let i = 0; i < trackPts.length; i++) { const dx = trackPts[i].x - x, dy = trackPts[i].y - y, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bi = i; } }
    return { d: Math.sqrt(best), p: trackPts[bi] };
  }
  const tc = (v) => (v === null || !Number.isFinite(v) ? 'no valid data' : `${v.toFixed(0).replace('-', '−')} °C`);
  const ev = rad.solar_event;

  const events = [];
  {
    const add = (t, cat, tone, text, replay = false) => events.push({ t, cat, tone, text, replay });
    const first = routeStops[0], last = routeStops[routeStops.length - 1];
    add(0, 'EVA', '', `EVA start at ${first.name}, ${site.scenario.start_lmst} LMST. Modelled route: ${fmtDist(totalDist)}, ${scienceCount} science stops, pickup at ${last.name}.`);
    routeStops.forEach((s, i) => {
      if (s.role === 'start') return;
      const prev = routeStops[i - 1], next = routeStops[i + 1];
      if (s.dist_m - APPROACH_M > prev.dist_m + 40) add(timeAtDist(s.dist_m - APPROACH_M), 'SCIENCE', 'next', `Approaching ${s.name}: ${APPROACH_M} m by route.`);
      if (s.role === 'pickup') add(s.arrive_t_min, 'EVA', 'ring', `Pickup point reached: ${s.name}. Estimated EVA ${fmtHM(s.arrive_t_min)} of ${fmtHM(k.evaBudget)}, return margin ${Math.floor(route.summary.min_return_margin_min)} min or more on the whole route.`);
      else {
        add(s.arrive_t_min, 'SCIENCE', 'next', `At ${s.name}, stop ${s.order} of ${scienceCount}. ${Math.round(s.dwell_min)} min on site (assumed).`);
        if (next) add(s.depart_t_min, 'SCIENCE', '', `Leaving ${s.name}. Next: ${next.name}, ${fmtDist(next.dist_m - s.dist_m)} by route.`);
      }
    });
    // steep sections of the modelled route
    const thr = STEEP_SHARE * k.slopeLimit;
    let sec = null;
    const closeSec = () => {
      if (sec && sec.end - sec.start >= 12) add(timeAtDist(sec.start - 40), 'TERRAIN', 'ring', `Steep section ahead: up to ${sec.max.toFixed(1)}° over ${Math.round(sec.end - sec.start)} m (limit ${k.slopeLimit}°, derived from the DEM).`);
      sec = null;
    };
    for (const p of P) {
      if (p.slope_deg >= thr) {
        if (sec && p.dist_m - sec.end > 25) closeSec();
        if (!sec) sec = { start: p.dist_m, end: p.dist_m, max: p.slope_deg };
        sec.end = p.dist_m; sec.max = Math.max(sec.max, p.slope_deg);
      }
    }
    closeSec();
    // Curiosity's track: joining it after having been away
    let onTrack = false;
    for (const p of P) {
      const n = nearestTrack(p.x, p.y);
      if (!onTrack && n.d < TRACK_NEAR_M) { onTrack = true; if (p.t_min > 0.5) add(p.t_min, 'ROVER', '', `Crossing Curiosity's track, driven on sol ${n.p.sol}. Historical rover reference, not proof that a person can pass.`); }
      else if (onTrack && n.d > TRACK_FAR_M) onTrack = false;
    }
    // elevation milestones
    for (let i = 1, step = 100, nextUp = step; i < N; i++) {
      if (P[i].z - P[0].z >= nextUp) { add(P[i].t_min, 'TERRAIN', '', `Climbed ${nextUp} m since the start. Elevation ${fmtInt(P[i].z)} m (HiRISE DEM).`); nextUp += step; }
    }
    // time budget
    if (k.evaBudget / 2 < k.evaTotal) add(k.evaBudget / 2, 'EVA', 'ring', `Half of the EVA budget used: ${site.scenario.eva_duration_h / 2} h of ${site.scenario.eva_duration_h} h (assumed budget).`);
    const tRing = k.evaBudget - k.retMaxMin;
    if (tRing > 0 && tRing < k.evaTotal) add(tRing, 'EVA', 'ring', 'Return limit is now on the map. Beyond the amber line, the estimated walk to the pickup is longer than the time left.');
    // REMS, one entry per LMST hour (text follows the selected sol)
    for (let hour = Math.floor(k.startLmstMin / 60) + 1; hour * 60 - k.startLmstMin < k.evaTotal; hour++) {
      add(hour * 60 - k.startLmstMin, 'REMS', 'ground', () => {
        const sol = weather.sols[state.solIdx];
        return `${String(hour).padStart(2, '0')}:00 LMST, REMS sol ${sol.sol}: ground ${tc(fn.valueAt(sol.hourly, 'ground_c', hour))}, air ${tc(fn.valueAt(sol.hourly, 'air_c', hour))} (historical).${sol.warmest_ground_hour_lmst === hour ? ' Warmest ground hour of this sol.' : ''}`;
      });
    }
    // RAD replay: threshold crossings and the peak on the EVA clock
    add(0, 'RAD', 'hazard', `Replay on: the RAD series of ${ev.date} runs on the EVA clock. Historical scenario, not a prediction.`, true);
    let above = false, peak = { v: 0, t: 0 };
    for (let t = 0; t <= k.evaTotal; t += 0.5) {
      const v = fn.radRateAt(t, true);
      if (v > peak.v) peak = { v, t };
      if (!above && v > rad.alert.threshold) { above = true; add(t, 'RAD', 'hazard', `RAD rate above ${fmtInt(rad.alert.threshold)} µGy/day: illustrative alert at ${rad.alert.factor} × the reference (assumed).`, true); }
      else if (above && v < rad.alert.threshold) { above = false; add(t, 'RAD', '', 'RAD rate back under the illustrative alert level.', true); }
    }
    if (peak.v > rad.alert.threshold) add(peak.t + 0.01, 'RAD', 'hazard', `Replay peak: ${fmtInt(peak.v)} µGy/day, measured by Curiosity RAD on ${ev.date}. Astronaut exposure is not modelled.`, true);
    events.sort((a, b) => a.t - b.t);
    events.forEach((e, i) => { e.id = i; });
  }

  // ---------------------------------------------------------------- HUD: static parts
  const el = {};
  for (const id of ['rad', 'rad-arc', 'rad-ticks', 'rad-v', 'rad-src', 'rad-budget', 'replay', 'tg-arc', 'ta-arc', 'temp-ticks',
    'ground-v', 'air-v', 'sol', 'uv', 'press', 'rh', 'eva-arc', 'eva-ticks', 'left-v', 'margin', 'margin-v', 'back-v',
    'slope-v', 'slope-bar', 'slope-ahead', 'ahead-v', 'elev-v', 'climb-v', 'terrain-note', 'tg', 'tg-head', 'tg-name', 'tg-dist',
    'tg-eta-k', 'tg-eta', 'tg-dz', 'tg-prog', 'tg-bar', 'tg-prog-v', 'tg-rec', 'tg-photo-btn', 'tg-photo', 'tg-credit', 'tg-note',
    'feed', 'tape', 'pips', 'tape-clip', 'bearing-v', 'walk-pip', 'loading']) el[id] = $(`v3-${id}`);

  const GA = { c: 60, r: 50, a0: 135, sweep: 270 };         // gauge arc: 270° opening at the bottom
  const polar = (r, f) => { const a = ((GA.a0 + GA.sweep * f) * Math.PI) / 180; return [GA.c + r * Math.cos(a), GA.c + r * Math.sin(a)]; };
  const tick = (f, r0, r1, cls) => { const [x1, y1] = polar(r0, f), [x2, y2] = polar(r1, f); return `<line class="${cls}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`; };
  const tickLabel = (f, txt) => {                          // outside the arc, anchored away from it
    const [x, y] = polar(60, f), anchor = x < 46 ? 'end' : x > 74 ? 'start' : 'middle';
    return `<text x="${(x + (anchor === 'end' ? -1.5 : anchor === 'start' ? 1.5 : 0)).toFixed(1)}" y="${(y + (anchor === 'middle' ? -2 : y > 80 ? 7 : 3)).toFixed(1)}" text-anchor="${anchor}">${txt}</text>`;
  };
  const setArc = (node, f) => node.setAttribute('stroke-dasharray', `${(clamp(f, 0, 1) * 100).toFixed(2)} 100`);

  const RAD_LO = Math.log10(50), RAD_HI = Math.log10(10000);
  const radFrac = (v) => (Math.log10(Math.max(50, v)) - RAD_LO) / (RAD_HI - RAD_LO);
  {
    let minor = '';
    for (const dec of [10, 100, 1000]) for (let m = 1; m <= 9; m++) { const v = dec * m; if (v >= 50 && v <= 10000) minor += tick(radFrac(v), 54.5, m === 1 ? 59 : 57, 'tk'); }
    el['rad-ticks'].innerHTML = minor + tick(1, 54.5, 59, 'tk')
      + tick(radFrac(rad.reference.value), 43, 57.5, 'tk ref') + tick(radFrac(rad.alert.threshold), 43, 59.5, 'tk alert')
      + tickLabel(radFrac(100), '100') + tickLabel(radFrac(1000), '1k') + tickLabel(1, '10k');
  }
  const tFrac = (c) => (c - k.tMin) / (k.tMax - k.tMin);
  {
    let minor = '';
    for (let c = k.tMin; c <= k.tMax; c += 10) minor += tick(tFrac(c), 54.5, c === 0 ? 59.5 : 57, c === 0 ? 'tk ref' : 'tk');
    el['temp-ticks'].innerHTML = minor + tickLabel(tFrac(0), '0') + tickLabel(0, String(k.tMin).replace('-', '−')) + tickLabel(1, `${k.tMax}`);
  }
  {
    let minor = '';
    for (let m = 0; m <= k.evaBudget; m += 30) minor += tick(m / k.evaBudget, 54.5, m % 60 === 0 ? 59 : 57, 'tk');
    el['eva-ticks'].innerHTML = minor + tick(k.evaTotal / k.evaBudget, 43, 59.5, 'tk ring') + tickLabel(0, '0') + tickLabel(1, `${site.scenario.eva_duration_h} h`);
  }
  el['terrain-note'].textContent = `Slope and elevation derived from the HiRISE DEM. Obstacles under ~4–6 m are not resolved. Margin uses an assumed walking speed.`;

  weather.sols.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `sol ${s.sol} · ${s.date_utc_approx}`; el.sol.appendChild(o); });
  el.sol.addEventListener('change', () => actions.setSol(Number(el.sol.value)));
  el.replay.addEventListener('click', () => actions.toggleReplay());
  el['tg-photo-btn'].addEventListener('click', () => { if (shownStop) actions.openPhoto(shownStop); });

  {                                                         // compass tape: −180° … 540° so any view fits
    let html = '';
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -180; d <= 540; d += 5) {
      const x = (d + 180) * TAPE_PX_PER_DEG, m = ((d % 360) + 360) % 360;
      html += `<i class="${m % 15 === 0 ? 'maj' : ''}" style="left:${x}px"></i>`;
      if (m % 15 === 0) html += `<b class="${names[m] ? 'cd' : ''}" style="left:${x}px">${names[m] || String(m).padStart(3, '0')}</b>`;
    }
    el.tape.innerHTML = html;
  }

  // ---------------------------------------------------------------- camera
  const q = new URLSearchParams(location.search);
  const cam = { preset: CAMS[q.get('cam')] ? q.get('cam') : 'follow', dist: 0, pitch: 0, tDist: 0, tPitch: 0, yaw: 0, tYaw: 0, heading: null, lift: 0, intro: 0 };
  function setPreset(name, snap) {
    cam.preset = name; cam.tDist = CAMS[name].dist; cam.tPitch = CAMS[name].pitch; cam.tYaw = 0;
    cam.yaw = wrapPi(cam.yaw);
    if (snap) { cam.dist = cam.tDist; cam.pitch = cam.tPitch; cam.yaw = 0; }
    for (const b of $('seg-cam').children) b.classList.toggle('on', b.dataset.cam === name);
  }
  setPreset(cam.preset, true);
  $('seg-cam').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPreset(b.dataset.cam, reducedMotion.matches); });

  const pointers = new Map();
  let pinch = 0;
  const freeLook = () => { for (const b of $('seg-cam').children) b.classList.remove('on'); };
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      cam.tYaw -= dx * 0.006; cam.yaw -= dx * 0.006;
      cam.tPitch = clamp(cam.tPitch + dy * 0.005, 0.03, 1.5); cam.pitch = cam.tPitch;
      freeLook();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) { cam.tDist = clamp(cam.tDist * (pinch / d), 4, 2500); freeLook(); }
      pinch = d;
    }
  });
  const drop = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.tDist = clamp(cam.tDist * Math.exp(e.deltaY * 0.0012), 4, 2500); freeLook(); }, { passive: false });
  canvas.addEventListener('dblclick', () => setPreset(cam.preset, false));

  // ---------------------------------------------------------------- per-frame state
  const v3 = new THREE.Vector3(), focus = new THREE.Vector3(), probe = new THREE.Vector3();
  const size = { w: 1, h: 1 };
  const last = { x: null, y: null, rev: -1, hudKey: '', feedKey: '', feedIds: new Set(), t: 0, probeX: -1e9, probeY: -1e9 };
  const near = { hazard: null, rover: null };
  let time = 0, stride = 0, shownStop = null, pulseTarget = null, frameNo = 0;
  let hudRects = [];                                         // screen areas the terrain labels must keep clear
  function measureHud() {
    const o = root.getBoundingClientRect();
    hudRects = ['v3-feed', 'v3-tg', 'v3-env', 'v3-eva', 'v3-compass', 'v3-cam', 'stage-wrap', 'radar-controls', 'legend', 'alert-banner']
      .map((id) => $(id).getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x0: r.left - o.left - 8, x1: r.right - o.left + 8, y0: r.top - o.top - 8, y1: r.bottom - o.top + 8 }));
  }

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    size.w = w; size.h = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }

  function toScreen(x, y, z) {                              // → { x, y } in px, or null when behind the camera
    v3.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    if (v3.z > -camera.near) return null;
    v3.applyMatrix4(camera.projectionMatrix);
    return { x: (v3.x * 0.5 + 0.5) * size.w, y: (-v3.y * 0.5 + 0.5) * size.h };
  }

  function probeSurroundings(pos) {                         // nearest slope-limit cell and nearest track point
    const c0 = Math.floor(pos.x / cx), r0 = Math.floor(gh - pos.y / cy), span = Math.ceil(HAZARD_SEARCH_M / cx);
    let best = HAZARD_SEARCH_M * HAZARD_SEARCH_M, hit = null;
    for (let r = Math.max(0, r0 - span); r <= Math.min(gh - 1, r0 + span); r++) for (let c = Math.max(0, c0 - span); c <= Math.min(gw - 1, c0 + span); c++) {
      if (!hazard[r * gw + c]) continue;
      const x = (c + 0.5) * cx, y = (gh - r - 0.5) * cy, d2 = (x - pos.x) ** 2 + (y - pos.y) ** 2;
      if (d2 < best) { best = d2; hit = { x, y }; }
    }
    near.hazard = hit ? { ...hit, z: zAt(hit.x, hit.y) + 2, d: Math.sqrt(best) } : null;
    const n = nearestTrack(pos.x, pos.y);
    near.rover = n.d <= TRACK_CALLOUT_M ? { x: n.p.x, y: n.p.y, z: zAt(n.p.x, n.p.y) + 2, d: n.d, sol: n.p.sol } : null;
  }

  function updateFeed(snap, jumped) {
    const vis = events.filter((e) => e.t <= snap.t && (!e.replay || state.replay)).slice(-4);
    const key = vis.map((e) => e.id).join(',') + `|${state.solIdx}|${state.replay}`;
    if (key === last.feedKey) return;
    last.feedKey = key;
    el.feed.innerHTML = vis.map((e, i) => {
      const fresh = !jumped && !last.feedIds.has(e.id) && i === vis.length - 1;
      const text = typeof e.text === 'function' ? e.text() : e.text;
      return `<div class="v3-ev ${e.tone}${fresh ? ' in' : ''}" style="--age:${vis.length - 1 - i}"><span class="tm num">${fmtHM(k.startLmstMin + e.t)}</span><span class="cat">${e.cat}</span><span class="tx">${esc(text)}</span></div>`;
    }).join('');
    const newest = vis[vis.length - 1];
    if (newest && !jumped && !last.feedIds.has(newest.id) && PING[newest.cat]) {
      const node = $(PING[newest.cat]);
      node.classList.remove('ping');
      void node.offsetWidth;                                // restart the animation
      node.classList.add('ping');
    }
    last.feedIds = new Set(vis.map((e) => e.id));
  }

  function updateHud(snap) {
    const { pos, t } = snap;
    const sol = snap.sol, b = rad.illustrative_budget;
    // radiation
    el['rad-v'].textContent = snap.rate >= 1000 ? fmtInt(snap.rate) : snap.rate.toFixed(1);
    setArc(el['rad-arc'], radFrac(snap.rate));
    el.rad.classList.toggle('over', snap.over);
    root.classList.toggle('rad-alert', snap.over);
    el['rad-src'].innerHTML = state.replay
      ? `<b>Historical scenario ${esc(ev.date)}</b> on the EVA clock (measured by Curiosity RAD). Not a prediction.`
      : `<b>Measured by Curiosity RAD</b> · median ${esc(rad.reference.from)} → ${esc(rad.reference.to)} (historical)`;
    el['rad-budget'].innerHTML = `<b>Illustrative EVA budget</b> ${b.value_uGy} µGy`
      + (state.replay ? ` · replay so far <b>${fn.radDose(t).toFixed(0)} µGy</b>` : ', not a human dose')
      + ' · Actual astronaut exposure: <b>not modelled</b>';
    el.replay.setAttribute('aria-pressed', String(state.replay));
    el.replay.textContent = state.replay ? 'Stop replay' : `Replay ${ev.date}`;
    // weather
    const num = (v, digits, unit) => (v === null || !Number.isFinite(v) ? '<em>no valid data</em>' : `${v.toFixed(digits).replace('-', '−')}<small>${unit}</small>`);
    el['ground-v'].innerHTML = snap.ground === null ? '<em>n/a</em>' : `${snap.ground.toFixed(0).replace('-', '−')}<small>°C</small>`;
    el['air-v'].innerHTML = snap.air === null ? 'air <em>n/a</em>' : `air <b>${snap.air.toFixed(0).replace('-', '−')} °C</b>`;
    setArc(el['tg-arc'], snap.ground === null ? 0 : tFrac(snap.ground));
    setArc(el['ta-arc'], snap.air === null ? 0 : tFrac(snap.air));
    el.uv.innerHTML = num(fn.valueAt(sol.hourly, 'uv_w_m2', snap.hour), 1, 'W/m²');
    el.press.innerHTML = num(fn.valueAt(sol.hourly, 'pressure_pa', snap.hour), 0, 'Pa');
    el.rh.innerHTML = num(fn.valueAt(sol.hourly, 'rh_pct', snap.hour), 1, '%');
    if (Number(el.sol.value) !== state.solIdx) el.sol.value = state.solIdx;
    // time and terrain
    el['left-v'].textContent = fmtHM(snap.remaining);
    setArc(el['eva-arc'], t / k.evaBudget);
    el['margin-v'].innerHTML = snap.margin === null ? 'n/a' : `${fmtSigned(Math.floor(snap.margin)).replace('+', '')}<small>min</small>`;
    el.margin.classList.toggle('neg', snap.margin !== null && snap.margin < 0);
    el['back-v'].textContent = snap.back === null ? 'pickup not reachable from this cell' : `estimated walk to pickup ${snap.back} min`;
    el['slope-v'].innerHTML = `${pos.slope.toFixed(1)}<small>°</small>`;
    el['ahead-v'].innerHTML = `${snap.ahead.toFixed(1)}<small>°</small>`;
    el['slope-bar'].style.width = `${clamp(pos.slope / k.slopeLimit, 0, 1) * 100}%`;
    el['slope-ahead'].style.left = `calc(${clamp(snap.ahead / k.slopeLimit, 0, 1) * 100}% - 1px)`;
    el['elev-v'].innerHTML = `${fmtInt(pos.z)}<small>m</small>`;
    el['climb-v'].textContent = `${fmtSigned(pos.z - P[0].z)} m since the start`;
    // target card
    const tgt = snap.tgt, s = tgt.stop, isPickup = s.role === 'pickup';
    const ordinal = isPickup ? 'PICKUP' : `${s.order} OF ${scienceCount}`;
    const left = Math.max(0, s.dist_m - pos.dist);
    el['tg-head'].textContent = tgt.done ? 'AT PICKUP · ROUTE COMPLETE' : tgt.dwelling ? `AT STOP · ${ordinal}` : `NEXT STOP · ${ordinal}`;
    el['tg-name'].textContent = s.name;
    el.tg.classList.toggle('pickup', isPickup);
    el['tg-dist'].innerHTML = tgt.dwelling ? '0<small>m</small>' : `${fmtInt(left)}<small>m</small>`;
    if (tgt.done) { el['tg-eta-k'].textContent = 'Arrived LMST'; el['tg-eta'].textContent = fmtHM(k.startLmstMin + s.arrive_t_min); }
    else if (tgt.dwelling) { el['tg-eta-k'].textContent = 'Departs in'; el['tg-eta'].innerHTML = `${Math.ceil(s.depart_t_min - t)}<small>min</small>`; }
    else { el['tg-eta-k'].textContent = 'ETA est.'; el['tg-eta'].innerHTML = `${Math.ceil(s.arrive_t_min - t)}<small>min</small>`; }
    el['tg-dz'].innerHTML = `${fmtSigned(tgt.dwelling ? 0 : s.z - pos.z)}<small>m</small>`;
    const approaching = !tgt.dwelling && left <= APPROACH_M;
    el['tg-prog'].hidden = !approaching;
    if (approaching) { const f = 1 - left / APPROACH_M; el['tg-bar'].style.width = `${f * 100}%`; el['tg-prog-v'].textContent = `${Math.round(f * 100)} %`; }
    const open = tgt.dwelling;
    if (el['tg-rec'].hidden === open) el['tg-rec'].hidden = !open;
    if (open && shownStop !== s) {
      shownStop = s;
      const p = s.photos[0], note = (s.science_note || '').trim();
      el['tg-photo-btn'].hidden = !p;
      if (p) {
        el['tg-photo'].src = PKG + p.file;
        el['tg-photo'].alt = `Curiosity Navcam image near ${s.name}`;
        el['tg-credit'].textContent = `Curiosity Navcam · sol ${p.sol} · ${p.credit}`;
      }
      el['tg-note'].innerHTML = (note ? `<b>Objective:</b> ${esc(note)}${s.science_source ? ` <em>(${esc(s.science_source)})</em>` : ''}` : '<b>Objective: pending</b>')
        + (p ? `<br>Photo taken ${esc(p.date_utc)}, about ${p.stop_match_error_m} m from the stop (historical).` : '')
        + (s.curiosity_sol_nearby ? ` Curiosity was near here on sol ${s.curiosity_sol_nearby}.` : '');
    }
    if (!open) shownStop = null;
  }

  function frame(snap, dt) {
    if (!snap || document.hidden) return;
    const calm = reducedMotion.matches;
    time += dt;
    // The scene follows the clock every frame; `snap` (HUD numbers, target stop) is refreshed by main.js at ~10 Hz.
    const t = state.t, pos = fn.sampleT(t), hdg = state.heading ?? snap.hdg;
    const moved = last.x === null ? 0 : Math.hypot(pos.x - last.x, pos.y - last.y);
    const jumped = last.x === null || moved > 80 || Math.abs(t - last.t) > 12;
    last.x = pos.x; last.y = pos.y; last.t = t;

    // astronauts
    const walking = moved > 1e-4 && !jumped;
    stride += ((walking ? 1 : 0) - stride) * (1 - Math.exp(-dt / 0.18));
    pose(lead, pos.x, pos.y, hdg, calm ? 0 : stride, dt);
    const bp = fn.sampleD(Math.min(totalDist, pos.dist + 3.2));
    const side = totalDist - pos.dist > 3.2 ? 1.1 : 1.7;    // walks ahead and to the left; stands beside at the pickup
    const bx = bp.x - Math.cos(hdg) * side, by = bp.y + Math.sin(hdg) * side;
    pose(buddy, bx, by, hdg, calm ? 0 : stride, dt);
    settle(leadShadow, pos.x, pos.y, 0.1); settle(buddyShadow, bx, by, 0.1); settle(youRing, pos.x, pos.y, 0.14);
    const az = zAt(pos.x, pos.y);

    // camera: follows the path direction (long look-ahead, low-pass) plus the user's orbit offset
    const pa = fn.sampleD(Math.max(0, pos.dist - 8)), pb = fn.sampleD(Math.min(totalDist, pos.dist + 40));
    const want = Math.hypot(pb.x - pa.x, pb.y - pa.y) > 2 ? Math.atan2(pb.x - pa.x, pb.y - pa.y) : (cam.heading ?? hdg);
    const ease = (tau) => (calm || jumped ? 1 : 1 - Math.exp(-dt / tau));
    cam.heading = cam.heading === null || jumped ? want : cam.heading + wrapPi(want - cam.heading) * ease(1.1);
    const tau = cam.intro > 0 ? 0.5 : 0.28;                 // slower while the camera drops in from above
    cam.intro = Math.max(0, cam.intro - dt);
    const glide = (tc) => (calm ? 1 : 1 - Math.exp(-dt / tc));   // zoom and orbit never snap on a time jump
    cam.dist += (cam.tDist - cam.dist) * glide(tau);
    cam.pitch += (cam.tPitch - cam.pitch) * glide(tau);
    cam.yaw += (cam.tYaw - cam.yaw) * glide(0.28);
    const bearing = cam.heading + cam.yaw, fx = Math.sin(bearing), fy = Math.cos(bearing);
    const leadM = Math.min(cam.dist * 0.3, 14);
    focus.set(pos.x + fx * leadM, pos.y + fy * leadM, az + 1.5);
    const back = cam.dist * Math.cos(cam.pitch);
    camera.position.set(focus.x - fx * back, focus.y - fy * back, focus.z + cam.dist * Math.sin(cam.pitch));
    let lift = Math.max(0, zAt(camera.position.x, camera.position.y) + 1.6 - camera.position.z);
    for (let i = 1; i <= 6; i++) {                           // keep the line of sight above the terrain
      const f = i / 7;
      probe.lerpVectors(camera.position, focus, f);
      lift = Math.max(lift, (zAt(probe.x, probe.y) + 1 - probe.z) / (1 - f));
    }
    cam.lift += (lift - cam.lift) * ease(0.3);
    camera.position.z += cam.lift;
    camera.near = clamp(cam.dist * 0.03, 0.3, 6);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    for (const tl of tiles) {                                // level of detail by distance
      const d = Math.hypot(tl.x - camera.position.x, tl.y - camera.position.y, tl.z - camera.position.z);
      const lod = d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : d < LOD_DIST[2] ? 2 : 3;
      if (lod !== tl.lod) { tl.lod = lod; tl.mesh.geometry = tl.geos[lod]; }
    }

    // terrain uniforms
    const u = terrainMat.uniforms;
    u.uAstro.value.set(pos.x, pos.y);
    u.uLevel.value = snap.level;
    const ph = (time % 5.2) / 2.6;
    if (calm || ph >= 1) u.uPulseK.value = 0;
    else { u.uPulse.value = (1 - (1 - ph) ** 3) * 340; u.uPulseK.value = (1 - ph) ** 1.3; }
    aheadLine.geometry.instanceCount = aheadGhost.geometry.instanceCount = N - 1 - pos.i;

    // beacons and their labels
    if (Math.hypot(pos.x - last.probeX, pos.y - last.probeY) > 6) { last.probeX = pos.x; last.probeY = pos.y; probeSurroundings(pos); }
    const tgt = snap.tgt;
    if (frameNo++ % 20 === 0) measureHud();
    const placed = hudRects.slice();
    const place = (node, pt, w, h, force) => {               // greedy declutter: HUD first, then by importance and distance
      if (!pt || pt.x < 0 || pt.x > size.w || pt.y < 0 || pt.y > size.h) { setText(node, 'hidden', true); return; }
      const box = { x0: pt.x - w / 2, x1: pt.x + w / 2, y0: pt.y - h - 22, y1: pt.y + 4 };
      if (!force && placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) { setText(node, 'hidden', true); return; }
      placed.push(box);
      setText(node, 'hidden', false);
      node.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px)`;
    };
    place(youLbl, cam.dist > 110 ? toScreen(pos.x, pos.y, az + 2.5) : null, 120, 34, true);
    const order = beacons.map((bcn) => ({ bcn, d: Math.hypot(bcn.s.x - pos.x, bcn.s.y - pos.y), isTarget: !tgt.done && bcn.s === tgt.stop }))
      .sort((a, b2) => (b2.isTarget - a.isTarget) || (a.d - b2.d));
    for (const { bcn, d, isTarget } of order) {
      const s = bcn.s, cls = fn.stopClass(s, t);
      if (bcn.cls !== cls) {
        bcn.cls = cls;
        bcn.beamMat.uniforms.uColor.value.setHex(COLORS[cls]);
        bcn.beamMat.uniforms.uAlpha.value = cls === 'context' ? 0.3 : cls === 'visited' ? 0.5 : 0.85;
        bcn.ring.material.color.setHex(COLORS[cls]);
        bcn.pip.className = `v3-pip ${cls}`;
      }
      const dCam = Math.hypot(s.x - camera.position.x, s.y - camera.position.y);
      bcn.beam.rotation.z = Math.atan2(camera.position.y - s.y, camera.position.x - s.x) + Math.PI / 2;
      bcn.beam.scale.set(Math.max(3, dCam * 0.028), 1, s.role === 'pickup' ? 130 : 90);
      setText(bcn.el, 'className', `v3-lbl ${cls}${isTarget ? ' target' : ''}`);
      const name = `${stopTag(s)}${s.name}`, sub = d < 3 ? 'you are here' : `${fmtDist(d)} · Δz ${fmtSigned(s.z - pos.z)} m`;
      setText(bcn.nm, 'textContent', name); setText(bcn.sub, 'textContent', sub);
      const far = (cls === 'context' || cls === 'visited') && d > 1500;
      const up = clamp(dCam * 0.05, 3.5, 70);
      place(bcn.el, far ? null : toScreen(s.x, s.y, bcn.z + up), 30 + Math.max(name.length * 6.6, sub.length * 6.2), 34, false);
      if (isTarget) {                                        // the two terrain callouts come right after the target
        const me = toScreen(pos.x, pos.y, az + 1);           // …and never cover the crew
        if (me) placed.push({ x0: me.x - 70, x1: me.x + 70, y0: me.y - 90, y1: me.y + 40 });
        if (near.hazard) setText(hazardSub, 'textContent', `${fmtDist(near.hazard.d)} away`);
        place(hazardLbl, near.hazard ? toScreen(near.hazard.x, near.hazard.y, near.hazard.z) : null, 100, 34, false);
        if (near.rover) setText(roverSub, 'textContent', `sol ${near.rover.sol} · historical`);
        place(roverLbl, near.rover ? toScreen(near.rover.x, near.rover.y, near.rover.z) : null, 128, 34, false);
      }
    }
    if (tgt.done) { hazardLbl.hidden = true; roverLbl.hidden = true; }
    if (!tgt.done && pulseTarget !== tgt.stop) {
      pulseTarget = tgt.stop;
      pulseRing.geometry.setPositions(ringPoints(pulseTarget.x, pulseTarget.y, 5, 0.5));
      pulseRing.material.color.setHex(tgt.stop.role === 'pickup' ? 0xFFFFFF : 0x00E5FF);
    }
    pulseRing.visible = !tgt.done && !calm;
    if (pulseRing.visible) {
      const f = (time % 2.4) / 2.4, sc = 1 + f * 1.6;
      pulseRing.scale.set(sc, sc, 1);
      pulseRing.position.set(pulseTarget.x * (1 - sc), pulseTarget.y * (1 - sc), 0);   // scale about the stop
      pulseRing.material.opacity = 0.6 * (1 - f);
    }

    // compass tape: the tape shows the view bearing; pips are bearings from the astronaut
    const clipW = el['tape-clip'].clientWidth, half = clipW / 2, lim = half / TAPE_PX_PER_DEG - 3;
    const bDeg = deg(bearing);
    el.tape.style.transform = `translateX(${(half - 14 - (bDeg + 180) * TAPE_PX_PER_DEG).toFixed(1)}px)`;   // 14 px: inset of the tape window
    setText(el['bearing-v'], 'textContent', `${String(Math.round(bDeg) % 360).padStart(3, '0')}°`);
    const pipAt = (node, rad2) => {
      const rel = (wrapPi(rad2 - bearing) * 180) / Math.PI, off = Math.abs(rel) > lim;
      node.style.transform = `translateX(${(half + clamp(rel, -lim, lim) * TAPE_PX_PER_DEG).toFixed(1)}px)`;
      node.classList.toggle('off', off);
      node.classList.toggle('left', off && rel < 0);
    };
    pipAt(el['walk-pip'], hdg);
    for (const { bcn, d, isTarget } of order) {
      const s = bcn.s;
      if (s.role === 'context') continue;
      const show = !tgt.done && d > 5 && (isTarget || (s.role === 'pickup' && t < s.arrive_t_min));
      setText(bcn.pip, 'hidden', !show);
      if (!show) continue;
      pipAt(bcn.pip, Math.atan2(s.x - pos.x, s.y - pos.y));
      bcn.pip.classList.toggle('target', isTarget);
      setText(bcn.pipLbl, 'textContent', isTarget ? `${s.name} · ${fmtDist(d)}` : '');
    }

    // HUD numbers (only when the simulation state changed)
    const hudKey = `${snap.rev}|${state.solIdx}|${state.replay}`;
    if (hudKey !== last.hudKey) { last.hudKey = hudKey; updateHud(snap); updateFeed(snap, jumped); }

    renderer.render(scene, camera);
  }

  function enter() {                                        // called when the 3D view is shown: drop in from above
    resize();
    last.x = null;
    if (reducedMotion.matches || cam.tDist > 300) return;
    cam.dist = Math.max(cam.tDist, 650); cam.pitch = 1.0; cam.intro = 2.2;
  }

  resize();
  el.loading.hidden = true;
  return { frame, resize, enter, setPreset: (name) => { if (CAMS[name]) setPreset(name, true); }, setTrackVisible: (on) => { for (const l of trackLines) l.visible = on; } };
}
