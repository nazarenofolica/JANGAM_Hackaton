// Marswalk Radar — tactical tablet viewer for a simulated EVA at Gale Crater.
// Reads only data/processed/gale_radar/ (contract: web/README.md). No external requests.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createView3D } from './view3d.js';

const PKG = '../data/processed/gale_radar/';
const RANGES = [250, 500, 1000];
const SPEEDS = [10, 30, 60, 300];
const VIEWS = ['radar', 'overview', '3d'];
const MINI_RADAR_PX = 150;      // the radar becomes a corner instrument in the 3D view
const LOOKAHEAD_M = 12;        // heading = direction to the route point this far ahead
const AHEAD_WINDOW_M = 200;    // "max slope ahead" window
const HEADING_TAU_S = 0.5;     // low-pass on the heading (the grid route turns in 45 deg steps)

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, f) => a + (b - a) * f;
const fmtHM = (min) => {
  const m = Math.max(0, Math.floor(min + 1e-6));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const fmtInt = (v) => Math.round(v).toLocaleString('en-US').replace('-', '−');
const fmtSigned = (v, digits = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

// ------------------------------------------------------------------ loading

async function getJSON(rel) {
  const url = PKG + rel;
  let res;
  try { res = await fetch(url); } catch (e) { throw new Error(`Could not fetch ${url} (${e.message}).`); }
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}).`);
  try { return await res.json(); } catch (e) { throw new Error(`${url} is not valid JSON (${e.message}).`); }
}

function loadTexture(rel) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(PKG + rel, resolve, undefined,
      () => reject(new Error(`Could not load image ${PKG + rel}.`)));
  });
}

function fatal(err) {
  console.error(err);
  $('fatal-msg').textContent = err && err.message ? err.message : String(err);
  $('fatal').hidden = false;
}

// ------------------------------------------------------------------ main

async function start() {
  if (location.protocol === 'file:') {
    throw new Error('Opened from the file system: ES modules and the data package need an HTTP server.');
  }
  const site = await getJSON('site.json');
  const [route, track, stops, rad, weather] = await Promise.all([
    getJSON(site.files.route), getJSON(site.files.curiosity_track), getJSON(site.files.stops),
    getJSON(site.files.radiation), getJSON(site.files.weather),
  ]);
  const [texHill, texHazard, texReturn] = await Promise.all([
    loadTexture(site.layers.hillshade.file), loadTexture(site.layers.hazard.file),
    loadTexture(site.layers.return_time.file),
  ]);

  const grid = site.grids.terrain_2m;
  const rgrid = site.grids.routing_4m;
  const W = grid.width_m, H = grid.height_m;
  const scenario = site.scenario;
  const evaBudget = scenario.eva_duration_h * 60;
  const evaTotal = route.summary.eva_total_min;
  const [lh, lm] = scenario.start_lmst.split(':').map(Number);
  const startLmstMin = lh * 60 + lm;
  const slopeLimit = scenario.hazard_slope_deg;

  // ---------------------------------------------------------------- route sampling
  const P = route.points;
  const N = P.length;
  const totalDist = P[N - 1].dist_m;

  function segByT(t) {            // largest i with P[i].t_min <= t
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P[mid].t_min <= t) lo = mid; else hi = mid - 1; }
    return Math.min(lo, N - 2);
  }
  function segByD(d) {            // largest i with P[i].dist_m <= d
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P[mid].dist_m <= d) lo = mid; else hi = mid - 1; }
    return Math.min(lo, N - 2);
  }
  function sampleAt(i, f) {
    const a = P[i], b = P[i + 1];
    return { i, x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f),
      slope: lerp(a.slope_deg, b.slope_deg, f), dist: lerp(a.dist_m, b.dist_m, f) };
  }
  function sampleT(t) {
    const i = segByT(t), a = P[i], b = P[i + 1];
    const span = b.t_min - a.t_min;
    return sampleAt(i, span > 0 ? clamp((t - a.t_min) / span, 0, 1) : 0);
  }
  function sampleD(d) {
    const i = segByD(d), a = P[i], b = P[i + 1];
    const span = b.dist_m - a.dist_m;
    return sampleAt(i, span > 0 ? clamp((d - a.dist_m) / span, 0, 1) : 0);
  }
  function headingAt(pos) {       // compass bearing in radians (0 = north, clockwise), or null
    let a = pos, b = sampleD(Math.min(totalDist, pos.dist + LOOKAHEAD_M));
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) { a = sampleD(Math.max(0, pos.dist - LOOKAHEAD_M)); b = pos; }
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.hypot(dx, dy) < 0.5 ? null : Math.atan2(dx, dy);
  }
  function maxSlopeAhead(pos) {
    let m = pos.slope;
    for (let i = pos.i + 1; i < N && P[i].dist_m <= pos.dist + AHEAD_WINDOW_M; i++) m = Math.max(m, P[i].slope_deg);
    return m;
  }

  // ---------------------------------------------------------------- return-time grid (CPU copy)
  const retW = rgrid.width_px, retH = rgrid.height_px;
  const ret = new Uint8Array(retW * retH);
  {
    const cv = document.createElement('canvas');
    cv.width = retW; cv.height = retH;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(texReturn.image, 0, 0);
    const px = ctx.getImageData(0, 0, retW, retH).data;
    for (let i = 0; i < ret.length; i++) ret[i] = px[i * 4];
  }
  let retMaxMin = 0;
  for (let i = 0; i < ret.length; i++) if (ret[i] < 255 && ret[i] * 2 > retMaxMin) retMaxMin = ret[i] * 2;

  function returnMinutes(x, y) {  // minutes to walk to the pickup, or null if not reachable
    const c = clamp(Math.floor(x / rgrid.px_x_m), 0, retW - 1);
    const r = clamp(Math.floor(retH - y / rgrid.px_y_m), 0, retH - 1);
    let v = ret[r * retW + c];
    if (v === 255) {              // route points sit on reachable cells; tolerate a 1-cell rounding miss
      v = 255;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = clamp(r + dr, 0, retH - 1), cc = clamp(c + dc, 0, retW - 1);
        v = Math.min(v, ret[rr * retW + cc]);
      }
    }
    return v === 255 ? null : v * 2;
  }
  function nearestBeyond(x, y, level) {   // distance (m) to the nearest reachable cell with return time > level
    let best = Infinity;
    for (let r = 0; r < retH; r++) {
      const cy = (retH - r - 0.5) * rgrid.px_y_m, dy = cy - y, dy2 = dy * dy;
      if (dy2 >= best) continue;
      const row = r * retW;
      for (let c = 0; c < retW; c++) {
        const v = ret[row + c];
        if (v === 255 || v * 2 <= level) continue;
        const dx = (c + 0.5) * rgrid.px_x_m - x, d2 = dx * dx + dy2;
        if (d2 < best) best = d2;
      }
    }
    return Math.sqrt(best);
  }

  // ---------------------------------------------------------------- three.js scene
  const canvas = $('radar-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0x070A0E, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);

  for (const t of [texHill, texHazard]) {
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  texReturn.colorSpace = THREE.NoColorSpace;
  texReturn.magFilter = texReturn.minFilter = THREE.NearestFilter;
  texReturn.generateMipmaps = false;

  // One shader for the whole ground: tinted relief + red slope mask + amber return isochrone.
  const terrainMat = new THREE.ShaderMaterial({
    depthTest: false,
    uniforms: {
      tHill: { value: texHill }, tHazard: { value: texHazard }, tReturn: { value: texReturn },
      uRetSize: { value: new THREE.Vector2(retW, retH) },
      uLevel: { value: 1e6 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tHill, tHazard, tReturn;
      uniform vec2 uRetSize;
      uniform float uLevel;
      varying vec2 vUv;
      const vec3 RED = vec3(1.0, 0.231, 0.188);
      const vec3 AMBER = vec3(1.0, 0.702, 0.0);
      float ret(vec2 ij) { return texture2D(tReturn, (ij + 0.5) / uRetSize).r; }
      float differs(vec2 uv, float beyond) {              // 1 if a reachable cell at uv is on the other side of the level
        float r = texture2D(tReturn, uv).r;
        return r < 0.998 ? abs(step(uLevel, r * 510.0) - beyond) : 0.0;
      }
      void main() {
        float h = texture2D(tHill, vUv).r;
        float t = clamp((h - 0.2) / 0.8, 0.0, 1.0);
        vec3 col = mix(vec3(0.020, 0.030, 0.045), vec3(0.30, 0.37, 0.45), t * t);
        col = mix(col, RED, texture2D(tHazard, vUv).a * 0.7);

        // return time in minutes: bilinear between cell centres, never across unreachable (255) cells
        vec2 st = vUv * uRetSize - 0.5;
        vec2 i0 = floor(st);
        vec2 f = st - i0;
        float a = ret(i0), b = ret(i0 + vec2(1.0, 0.0)), c = ret(i0 + vec2(0.0, 1.0)), d = ret(i0 + vec2(1.0, 1.0));
        float nearest = texture2D(tReturn, vUv).r;
        float reach = nearest < 0.998 ? 1.0 : 0.0;
        float ok = max(max(a, b), max(c, d)) < 0.998 ? 1.0 : 0.0;
        float mb = mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 510.0;
        float m = ok > 0.5 ? mb : nearest * 510.0;
        float beyond = step(uLevel, m) * reach;
        col = mix(col, AMBER, beyond * 0.13);                               // veil: beyond the return range
        // Line: no contour where the neighbourhood touches unreachable cells (their value is a flag, not minutes).
        float clean = ok * reach * (1.0 - step(0.001, fwidth(ok) + fwidth(reach)));
        float cellsPerPx = max(fwidth(st.x), fwidth(st.y));
        // zoomed out: edge of the veil, found by comparing with the cells ~1.3 px away on screen
        vec2 du = dFdx(vUv) * 1.3, dv = dFdy(vUv) * 1.3;
        float thin = max(max(differs(vUv + du, beyond), differs(vUv - du, beyond)), max(differs(vUv + dv, beyond), differs(vUv - dv, beyond))) * reach;
        float wide = (1.0 - smoothstep(1.0, 2.2, abs(mb - uLevel) / max(fwidth(mb), 1e-4))) * step(cellsPerPx, 0.6);
        col = mix(col, AMBER, max(thin * step(0.6, cellsPerPx), wide * clean));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(W, H), terrainMat);
  terrain.position.set(W / 2, H / 2, 0);
  terrain.renderOrder = 0;
  scene.add(terrain);

  const lineMats = [];
  function makeLine(xy, opts, order) {
    const pos = new Float32Array((xy.length / 2) * 3);
    for (let i = 0, j = 0; i < xy.length; i += 2, j += 3) { pos[j] = xy[i]; pos[j + 1] = xy[i + 1]; pos[j + 2] = 1; }
    const geo = new LineGeometry();
    geo.setPositions(pos);
    const mat = new LineMaterial({ worldUnits: false, depthTest: false, transparent: true, ...opts });
    mat.userData.px = opts.linewidth;
    lineMats.push(mat);
    const line = new Line2(geo, mat);
    if (opts.dashed) line.computeLineDistances();
    line.frustumCulled = false;
    line.renderOrder = order;
    scene.add(line);
    return line;
  }

  // Curiosity historical track: white, dashed, 60 %
  const trackLines = [];
  {
    let cur = [];
    const flush = () => { if (cur.length >= 4) trackLines.push(makeLine(cur, { color: 0xffffff, opacity: 0.6, linewidth: 1.6, dashed: true }, 1)); cur = []; };
    for (const p of track.points) { if (p.break_before) flush(); cur.push(p.x, p.y); }
    flush();
  }
  // Modelled route: full line dimmed (already walked) + bright line for what is left.
  const routeXY = []; for (const p of P) routeXY.push(p.x, p.y);
  const routeRev = []; for (let i = N - 1; i >= 0; i--) routeRev.push(P[i].x, P[i].y);
  makeLine(routeXY, { color: 0x34C759, opacity: 0.35, linewidth: 3 }, 2);
  const routeAhead = makeLine(routeRev, { color: 0x34C759, opacity: 1, linewidth: 4 }, 3);

  // Astronaut marker (constant size on screen)
  const astro = new THREE.Group();
  {
    const tri = (s) => { const sh = new THREE.Shape(); sh.moveTo(0, 11 * s); sh.lineTo(7.5 * s, -8 * s); sh.lineTo(0, -4 * s); sh.lineTo(-7.5 * s, -8 * s); sh.closePath(); return new THREE.ShapeGeometry(sh); };
    const outline = new THREE.Mesh(tri(1.45), new THREE.MeshBasicMaterial({ color: 0x070A0E, depthTest: false }));
    const body = new THREE.Mesh(tri(1), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
    outline.renderOrder = 5; body.renderOrder = 6;
    astro.add(outline, body);
    astro.position.z = 2;
    scene.add(astro);
  }

  // ---------------------------------------------------------------- state
  const q = new URLSearchParams(location.search);
  const qNum = (k, d) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  const state = {
    t: clamp(qNum('t', 0), 0, evaTotal),
    playing: q.get('play') !== '0',
    speed: SPEEDS.includes(qNum('speed', 60)) ? qNum('speed', 60) : 60,
    range: RANGES.includes(qNum('range', 250)) ? qNum('range', 250) : 250,
    view: VIEWS.includes(q.get('view')) ? q.get('view') : 'radar',
    replay: q.get('replay') === '1',
    solIdx: 0,
    heading: null,
    snapHeading: true,
    size: 0,
  };
  { const want = qNum('sol', NaN); const k = weather.sols.findIndex((s) => s.sol === want); if (k >= 0) state.solIdx = k; }

  // ---------------------------------------------------------------- stops (HTML markers over the canvas)
  const routeStops = stops.filter((s) => s.order !== null && s.order !== undefined).sort((a, b) => a.order - b.order);
  const scienceCount = routeStops.filter((s) => s.role === 'science').length;
  const stopTag = (s) => (s.role === 'start' ? 'S' : s.role === 'pickup' ? 'P' : s.role === 'science' ? String(s.order) : '');
  const stopEls = stops.map((s) => {
    const el = document.createElement('div');
    el.className = 'stop';
    el.innerHTML = `<div class="glyph"></div><div class="lbl"><div class="nm">${esc(s.name)}</div><div class="sub"></div></div>`;
    $('markers').appendChild(el);
    const edge = document.createElement('div');
    edge.className = 'edge';
    edge.innerHTML = '<div class="tip"></div>';
    const elbl = document.createElement('div');
    elbl.className = 'elbl';
    edge.hidden = elbl.hidden = true;
    $('edge-arrows').append(edge, elbl);
    return { s, el, sub: el.querySelector('.sub'), edge, elbl };
  });
  function stopClass(s, t) {
    if (s.role === 'context') return 'context';
    if (s.role === 'pickup') return 'pickup';
    return t >= s.arrive_t_min ? 'visited' : 'next';
  }
  function currentTarget(t) {      // { stop, dwelling } — the stop being worked or the next one; null stop when done
    for (const s of routeStops) {
      if (s.role === 'start') continue;
      if (t < s.arrive_t_min) return { stop: s, dwelling: false };
      if (s.depart_t_min !== undefined && t < s.depart_t_min) return { stop: s, dwelling: true };
    }
    return { stop: routeStops[routeStops.length - 1], dwelling: true, done: true };
  }

  // ---------------------------------------------------------------- static UI
  $('lg-slope').textContent = slopeLimit;
  $('tr-note').textContent = `Limit ${slopeLimit}° (assumed). Obstacles under ~4–6 m are not resolved.`;
  $('wn-margin-note').textContent = 'Margin = time left − estimated walk to the pickup rover (derived). Walking speed is an assumption, not validated for suited astronauts.';
  $('wn-margin-note').title = 'Walking speed is an exploratory assumption (hiking curve scaled to ' + scenario.base_speed_kmh + ' km/h), not validated for suited astronauts on Mars.';

  // range rings
  {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = $('rings');
    for (const r of [25, 50, 75, 100]) {
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', r === 100 ? 99.6 : r); svg.appendChild(c);
    }
    for (const [x1, y1, x2, y2] of [[-100, 0, -6, 0], [6, 0, 100, 0], [0, -100, 0, -6], [0, 6, 0, 100]]) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); svg.appendChild(l);
    }
    for (const r of [25, 50, 75, 100]) {
      const tx = document.createElementNS(NS, 'text');
      const k = Math.SQRT1_2 * r;
      tx.setAttribute('x', k + (r === 100 ? -2.5 : 1.5)); tx.setAttribute('y', k + (r === 100 ? -2.5 : 5));
      if (r === 100) tx.setAttribute('text-anchor', 'end'); tx.dataset.frac = r / 100; svg.appendChild(tx);
    }
  }
  function updateRingLabels() {
    for (const tx of $('rings').querySelectorAll('text')) tx.textContent = fmtDist(state.range * Number(tx.dataset.frac)).replace('.00', '').replace(/(\.\d)0 km/, '$1 km');
  }

  // timeline marks
  {
    const marks = $('tl-marks');
    routeStops.forEach((s, k) => {
      const a = (s.arrive_t_min / evaTotal) * 100;
      const dep = s.depart_t_min !== undefined ? s.depart_t_min : s.arrive_t_min;
      const bar = document.createElement('div');
      bar.className = 'tl-dwell'; bar.dataset.k = k;
      bar.style.left = `${a}%`; bar.style.width = `max(3px, ${((dep - s.arrive_t_min) / evaTotal) * 100}%)`;
      if (s.role === 'pickup') bar.style.transform = 'translateX(-100%)';
      const lab = document.createElement('div');
      lab.className = 'tl-mark' + (k === 0 ? ' first' : k === routeStops.length - 1 ? ' last' : ''); lab.dataset.k = k;
      lab.style.left = `${(((s.arrive_t_min + dep) / 2) / evaTotal) * 100}%`;
      lab.textContent = s.role === 'start' ? 'START' : s.role === 'pickup' ? 'PICKUP' : `${s.order}`;
      lab.title = bar.title = `${s.name} · arrive ${fmtHM(s.arrive_t_min)} EVA (estimated)`;
      marks.append(bar, lab);
    });
    $('tl-input').max = evaTotal;
  }

  // REMS chart
  const allTemps = weather.sols.flatMap((s) => s.hourly.flatMap((h) => [h.air_c, h.ground_c])).filter((v) => Number.isFinite(v));
  const tMin = Math.floor(Math.min(...allTemps) / 10) * 10, tMax = Math.ceil(Math.max(...allTemps) / 10) * 10;
  const RC = { x0: 34, x1: 318, y0: 6, y1: 58 };
  const rx = (hour) => RC.x0 + (hour / 24) * (RC.x1 - RC.x0);
  const ry = (c) => RC.y1 - ((c - tMin) / (tMax - tMin)) * (RC.y1 - RC.y0);
  const hhmmToHours = (s) => { const [a, b] = s.split(':').map(Number); return a + b / 60; };
  const win = weather.eva_window_lmst;
  function seriesPath(hourly, key) {
    let d = '', pen = false;
    for (const h of hourly) {
      const v = h[key];
      if (!Number.isFinite(v)) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${rx(h.hour).toFixed(1)},${ry(v).toFixed(1)}`; pen = true;
    }
    return d;
  }
  function tempAt(hourly, key, hour) {
    const a = hourly.find((h) => h.hour === Math.floor(hour)), b = hourly.find((h) => h.hour === Math.floor(hour) + 1) || a;
    if (!a || !Number.isFinite(a[key])) return null;
    return Number.isFinite(b[key]) ? lerp(a[key], b[key], hour - Math.floor(hour)) : a[key];
  }
  function drawRems() {
    const sol = weather.sols[state.solIdx];
    const last = (key) => [...sol.hourly].reverse().find((h) => Number.isFinite(h[key]));
    const la = last('air_c'), lg = last('ground_c');
    const wx0 = rx(hhmmToHours(win.start)), wx1 = rx(hhmmToHours(win.end));
    const zero = tMin < 0 && tMax > 0 ? `<line x1="${RC.x0}" x2="${RC.x1}" y1="${ry(0)}" y2="${ry(0)}" stroke="#243242" stroke-dasharray="2 3"/><text x="${RC.x0 - 4}" y="${ry(0) + 3}" text-anchor="end">0</text>` : '';
    let gy = lg ? ry(lg.ground_c) + 3 : 0, ay = la ? ry(la.air_c) + 3 : 0;
    if (Math.abs(gy - ay) < 9) { if (gy < ay) { gy -= 4; ay += 5; } else { ay -= 4; gy += 5; } }
    $('rems-chart').innerHTML = `
      <rect x="${wx0}" y="${RC.y0}" width="${wx1 - wx0}" height="${RC.y1 - RC.y0}" fill="rgba(230,237,243,.08)"/>
      <text x="${(wx0 + wx1) / 2}" y="${RC.y0 + 8}" text-anchor="middle">EVA window ${esc(win.start)}–${esc(win.end)}</text>
      <line x1="${RC.x0}" x2="${RC.x1}" y1="${RC.y1}" y2="${RC.y1}" stroke="#243242"/>
      ${zero}
      <text x="${RC.x0 - 4}" y="${RC.y0 + 4}" text-anchor="end">${tMax}</text>
      <text x="${RC.x0 - 4}" y="${RC.y1 + 1}" text-anchor="end">${String(tMin).replace('-', '−')}</text>
      <text x="2" y="${RC.y0 + 4}">°C</text>
      ${[0, 6, 12, 18, 24].map((h) => `<text x="${rx(h)}" y="${RC.y1 + 11}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`).join('')}
      <text x="${RC.x1 + 8}" y="${RC.y1 + 11}">h LMST</text>
      <path d="${seriesPath(sol.hourly, 'air_c')}" fill="none" stroke="#8AB4F8" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <path d="${seriesPath(sol.hourly, 'ground_c')}" fill="none" stroke="#FF9F6B" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      ${lg ? `<text x="${RC.x1 + 4}" y="${gy}" style="fill:#FF9F6B">ground</text>` : ''}
      ${la ? `<text x="${RC.x1 + 4}" y="${ay}" style="fill:#8AB4F8">air</text>` : ''}
      <g id="rems-cursor"></g>`;
    $('rems-label').textContent = 'Historical REMS observations at Gale Crater';
    $('rems-label').title = `${weather.label}. ${weather.hour_axis}. Wind: ${weather.wind}.`;
  }
  {
    const sel = $('sel-sol');
    weather.sols.forEach((s, k) => { const o = document.createElement('option'); o.value = k; o.textContent = `sol ${s.sol} · ${s.date_utc_approx}`; sel.appendChild(o); });
    sel.value = state.solIdx;
    sel.addEventListener('change', () => setSol(Number(sel.value)));
  }
  function setSol(i) { state.solIdx = clamp(i, 0, weather.sols.length - 1); $('sel-sol').value = state.solIdx; drawRems(); refresh(); }

  // RAD
  const ev = rad.solar_event;
  const peakIdx = ev.hourly.reduce((best, h, k) => (h.value > ev.hourly[best].value ? k : best), 0);
  const REPLAY_PEAK_EVA_H = 2;                           // the event peak lands 2 h into the EVA (assumption of the replay)
  const replayStart = Math.max(0, peakIdx - REPLAY_PEAK_EVA_H);
  function radRate(t, replay = state.replay) {           // µGy/day at EVA minute t
    if (!replay) return rad.reference.value;
    const p = replayStart + t / 60, k = Math.min(ev.hourly.length - 1, Math.floor(p));
    const a = ev.hourly[k].value, b = ev.hourly[Math.min(ev.hourly.length - 1, k + 1)].value;
    return lerp(a, b, p - Math.floor(p));
  }
  function radDose(t) {                                  // µGy accumulated at the detector since EVA start
    let sum = 0;
    for (let m = 0; m < t; m += 1) sum += radRate(Math.min(t, m + 0.5)) * (Math.min(1, t - m) / 1440);
    return sum;
  }
  const KC = { x0: 2, x1: 198, y0: 4, y1: 30 };
  function drawRad() {
    const thr = rad.alert.threshold;
    const pts = [];
    for (let m = 0; m <= evaBudget; m += 10) pts.push([m, radRate(m)]);
    const top = Math.max(thr * 1.5, ...pts.map((p) => p[1])) * 1.05;
    const kx = (m) => KC.x0 + (m / evaBudget) * (KC.x1 - KC.x0), ky = (v) => KC.y1 - (v / top) * (KC.y1 - KC.y0);
    $('rad-chart').innerHTML = `
      <line x1="${KC.x0}" x2="${KC.x1}" y1="${KC.y1}" y2="${KC.y1}" stroke="#243242"/>
      <line x1="${KC.x0}" x2="${KC.x1}" y1="${ky(thr)}" y2="${ky(thr)}" stroke="#FF3B30" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
      <text x="${KC.x1}" y="${ky(thr) - 2}" text-anchor="end" style="fill:#FF8A80">alert ${fmtInt(thr)} (3× ref, assumed)</text>
      <path d="${pts.map((p, k) => `${k ? 'L' : 'M'}${kx(p[0]).toFixed(1)},${ky(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="#E6EDF3" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <text x="${KC.x0}" y="39">EVA 0 h</text><text x="${KC.x1}" y="39" text-anchor="end">${scenario.eva_duration_h} h</text>
      <g id="rad-cursor" data-top="${top}"></g>`;
    const btn = $('btn-replay');
    btn.setAttribute('aria-pressed', String(state.replay));
    btn.textContent = state.replay ? `Stop replay ${ev.date}` : `Replay ${ev.date}`;
    $('rad-l1').innerHTML = state.replay
      ? `<b>Historical scenario ${esc(ev.date)}</b> on the EVA clock (measured). Not a prediction.`
      : `<b>Measured by Curiosity RAD</b> · median ${esc(rad.reference.from)} → ${esc(rad.reference.to)} (historical).`;
    $('rad-l1').title = state.replay ? `${ev.label} Peak ${fmtInt(ev.peak_value)} µGy/day at ${ev.peak_time_utc} UTC, placed ${REPLAY_PEAK_EVA_H} h into the EVA.` : `${rad.reference.label}. ${rad.quantity}.`;
  }
  function toggleReplay() { state.replay = !state.replay; drawRad(); refresh(); }
  $('btn-replay').addEventListener('click', toggleReplay);

  // info panel
  {
    const s = route.summary, v = route.validation;
    const li = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const row = (k, val, kind) => `<tr><td>${esc(k)}</td><td class="num">${esc(val)}</td><td><em>${esc(kind)}</em></td></tr>`;
    $('info-body').innerHTML = `
      <h3>What this screen is</h3>
      <p>A <b>simulated EVA</b>: the astronaut position advances along the modelled route with a clock you can play, pause and scrub. Nothing here is a sensor feed. Every value is either measured by a NASA mission, derived from those data by a documented calculation, or an assumption — and labelled as such.</p>
      <h3>Scenario (assumptions)</h3>
      <table>
        ${row('Route', `${scenario.start} → ${scenario.stops.length} science stops → ${scenario.pickup} (one way, rover pickup)`, 'assumed')}
        ${row('Crew', `${scenario.crew} on foot`, 'assumed')}
        ${row('Base walking speed', `${scenario.base_speed_kmh} km/h on flat ground`, 'assumed')}
        ${row('Time at each science stop', `${scenario.dwell_min_per_stop} min`, 'assumed')}
        ${row('EVA budget · start', `${scenario.eva_duration_h} h · ${scenario.start_lmst} LMST`, 'assumed')}
        ${row('Slope limit', `${scenario.hazard_slope_deg}°`, 'assumed')}
      </table>
      <h3>Modelled route (derived)</h3>
      <table>
        ${row('Distance', `${fmtDist(s.distance_m)} (straight line ${fmtDist(s.straight_line_m)})`, 'derived')}
        ${row('Estimated time', `${s.walking_time_min} min walking + ${s.dwell_time_min} min at stops = ${s.eva_total_min} of ${s.eva_budget_min} min`, 'derived')}
        ${row('Smallest return margin', `${s.min_return_margin_min} min`, 'derived')}
        ${row('Elevation gain / loss', `+${Math.round(s.elevation_gain_m)} m / −${Math.round(s.elevation_loss_m)} m`, 'derived')}
        ${row('Steepest slope on the route', `${s.max_slope_deg}° (limit ${scenario.hazard_slope_deg}°)`, 'derived')}
        ${row('Path check', `${v.path_check.ok ? 'passed' : 'FAILED'}: ${v.path_check.blocked_cells_on_path} blocked cells, ${v.path_check.corner_cuts} corner cuts`, 'verified')}
      </table>
      <h3>Comparison with Curiosity (historical reference)</h3>
      <p>${Math.round(v.share_within_corridor * 100)} % of the modelled route lies within ${v.curiosity_corridor_m} m of Curiosity's track (mean distance ${v.mean_distance_to_curiosity_m} m). Curiosity drove ${fmtDist(v.curiosity_driven_m_same_endpoints)} between the same end points. ${esc(v.note)}</p>
      <h3>Radiation</h3>
      <p>${esc(rad.quantity)} (${esc(rad.units.replace('u', 'µ'))}). ${esc(rad.not)} ${esc(rad.illustrative_budget.label)} ${esc(rad.alert.label)}. Actual astronaut exposure: ${esc(rad.actual_astronaut_exposure)}.</p>
      <h3>Weather</h3>
      <p>${esc(weather.label)}. ${esc(weather.hour_axis)}. Quality: ${esc(weather.quality)}. Wind: ${esc(weather.wind)}.</p>
      <h3>Assumptions</h3>${li(site.assumptions)}
      <h3>Warnings</h3>${li(site.warnings)}
      <h3>Sources</h3>
      <table>${site.sources.map((x) => `<tr><td>${esc(x.data)}</td><td>${esc(x.provider)}</td><td class="num">downloaded ${esc(x.downloaded)}</td></tr>`).join('')}</table>
      <p class="fine">Package ${esc(site.id)} · schema ${esc(site.schema_version)} · generated ${esc(site.generated_utc)} · coordinates: ${esc(site.crs.local_frame)} (${esc(site.crs.body)}, ${esc(site.crs.model)}).</p>`;
  }

  // modals
  for (const m of document.querySelectorAll('.modal')) {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; });
  }
  $('btn-info').addEventListener('click', () => { $('info-modal').hidden = false; });
  if (q.get('panel') === 'info') $('info-modal').hidden = false;
  const photo = { stop: null, k: 0 };
  function showPhoto() {
    const s = photo.stop, p = s.photos[photo.k];
    $('ph-title').textContent = s.name;
    $('ph-img').src = PKG + p.file;
    $('ph-img').alt = `Curiosity Navcam image near ${s.name}, sol ${p.sol}`;
    $('ph-caption').textContent = `Curiosity Navcam (${p.instrument}) · sol ${p.sol} · ${p.date_utc} UTC · taken about ${p.stop_match_error_m} m from the stop · photo ${photo.k + 1} of ${s.photos.length} · Credit: ${p.credit}`;
    $('ph-prev').disabled = $('ph-next').disabled = s.photos.length < 2;
  }
  function openPhoto(s) { if (s && s.photos.length) { photo.stop = s; photo.k = 0; showPhoto(); $('photo-modal').hidden = false; } }
  $('st-photo-btn').addEventListener('click', () => openPhoto(shownStop));
  $('ph-prev').addEventListener('click', () => { const n = photo.stop.photos.length; photo.k = (photo.k + n - 1) % n; showPhoto(); });
  $('ph-next').addEventListener('click', () => { photo.k = (photo.k + 1) % photo.stop.photos.length; showPhoto(); });

  // controls
  function syncControls() {
    for (const b of $('seg-range').children) { b.classList.toggle('on', Number(b.dataset.range) === state.range); b.disabled = state.view === 'overview'; }
    for (const b of $('seg-view').children) b.classList.toggle('on', b.dataset.view === state.view);
    for (const b of $('seg-speed').children) b.classList.toggle('on', Number(b.dataset.speed) === state.speed);
    $('btn-play').textContent = state.playing ? '❚❚' : '▶';
    $('btn-play').title = state.playing ? 'Pause the simulation' : 'Play the simulation';
    $('app').classList.toggle('overview', state.view === 'overview');
    $('app').classList.toggle('v3d', state.view === '3d');
    $('view3d').hidden = state.view !== '3d';
    updateRingLabels();
  }

  // 3D walk view: built on first use (it loads the elevation grid and the HiRISE image)
  let view3d = null, view3dLoading = false;
  function ensure3D() {
    if (view3d || view3dLoading) return;
    view3dLoading = true;
    createView3D({
      PKG, site, route, track, stops, rad, weather, state,
      images: { hill: texHill.image, hazard: texHazard.image, ret: texReturn.image },
      fn: { sampleT, sampleD, valueAt: tempAt, radRateAt: radRate, radDose, stopClass, fmtHM, fmtInt, fmtSigned, fmtDist, esc },
      actions: { setSol, toggleReplay, openPhoto },
      k: { evaBudget, evaTotal, startLmstMin, slopeLimit, retMaxMin, tMin, tMax },
    }).then((v) => {
      view3d = v;
      v.setTrackVisible($('chk-rover').checked);
      layout(); refresh();
      if (state.view === '3d') v.enter();
    }).catch((err) => {
      console.error(err);
      view3dLoading = false;
      $('v3-loading').hidden = false;
      $('v3-loading').textContent = `The 3D view could not start: ${err && err.message ? err.message : err}`;
    });
  }
  $('seg-range').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.range = Number(b.dataset.range); syncControls(); refresh(); } });
  $('seg-view').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { const was = state.view; state.view = b.dataset.view; if (state.view === '3d') ensure3D(); syncControls(); layout(); refresh(); if (state.view === '3d' && was !== '3d' && view3d) view3d.enter(); } });
  $('btn-layers').addEventListener('click', () => { const on = $('app').classList.toggle('legend-open'); $('btn-layers').setAttribute('aria-pressed', String(on)); });
  $('seg-speed').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.speed = Number(b.dataset.speed); syncControls(); } });
  function togglePlay() {
    if (!state.playing && state.t >= evaTotal) { state.t = 0; state.snapHeading = true; }
    state.playing = !state.playing; syncControls();
  }
  $('btn-play').addEventListener('click', togglePlay);
  $('tl-input').addEventListener('input', (e) => { state.t = clamp(Number(e.target.value), 0, evaTotal); state.snapHeading = true; refresh(); });
  $('chk-rover').addEventListener('change', (e) => { for (const l of trackLines) l.visible = e.target.checked; if (view3d) view3d.setTrackVisible(e.target.checked); refresh(); });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('select, input[type="checkbox"]')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'Escape') for (const m of document.querySelectorAll('.modal')) m.hidden = true;
  });

  // ---------------------------------------------------------------- layout
  function layout() {
    const area = $('radar-area');
    const size = state.view === '3d' ? MINI_RADAR_PX : Math.max(240, Math.floor(Math.min(area.clientWidth - 388, area.clientHeight - 52)));
    state.size = size;
    const wrap = $('stage-wrap');
    wrap.style.width = wrap.style.height = `${size}px`;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(size, size, false);
    for (const m of lineMats) m.linewidth = m.userData.px * pr;
    if (view3d) view3d.resize();
  }
  window.addEventListener('resize', () => { layout(); refresh(); });

  // ---------------------------------------------------------------- per-frame update
  const v3 = new THREE.Vector3();
  const ringCache = { level: null, x: 0, y: 0, dist: null };
  let lastStopId = null, shownStop = null;
  let snap = null, snapRev = 0;                            // what the 3D view draws; rebuilt by refresh()

  function refresh() {
    const t = state.t;
    const pos = sampleT(t);
    const remaining = evaBudget - t;
    const overview = state.view === 'overview';

    // heading (kept for the marker even in Overview)
    const target = headingAt(pos);
    if (state.heading === null || state.snapHeading) { if (target !== null) state.heading = target; state.snapHeading = false; }
    const hdg = state.heading ?? 0;

    // camera
    const half = overview ? (H / 2) * 1.03 : state.range;
    const mpp = (2 * half) / state.size;
    camera.left = -half; camera.right = half; camera.top = half; camera.bottom = -half;
    if (overview) { camera.up.set(0, 1, 0); camera.position.set(W / 2, H / 2, 1000); camera.lookAt(W / 2, H / 2, 0); }
    else { camera.up.set(Math.sin(hdg), Math.cos(hdg), 0); camera.position.set(pos.x, pos.y, 1000); camera.lookAt(pos.x, pos.y, 0); }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // scene objects
    astro.position.x = pos.x; astro.position.y = pos.y;
    astro.rotation.z = -hdg;
    astro.scale.setScalar(mpp);
    routeAhead.geometry.instanceCount = N - 1 - pos.i;
    for (const l of trackLines) { l.material.dashSize = 7 * mpp; l.material.gapSize = 6 * mpp; }
    // The grid stores even minutes; contouring at an odd level keeps the line between two cell values.
    const level = 2 * Math.floor(remaining / 2) + 1;
    terrainMat.uniforms.uLevel.value = level;
    renderer.render(scene, camera);

    // north badge + readouts
    $('north-rot').style.transform = `rotate(${overview ? 0 : -hdg}rad)`;
    $('north-n').style.transform = `rotate(${overview ? 0 : hdg}rad)`;
    $('rd-heading').textContent = overview ? 'north up' : `${String(Math.round(((hdg * 180) / Math.PI + 360) % 360) % 360).padStart(3, '0')}°`;
    $('rd-range').textContent = overview ? `${(H / 1000).toFixed(1)} km tall` : fmtDist(state.range).replace('.00', '');

    // return limit readout (the amber line)
    if (level > retMaxMin) {
      $('rd-ring').innerHTML = `Not drawn yet: every mapped cell is within return range (farthest is ${retMaxMin} min from the pickup; ${Math.floor(remaining)} min left).`;
    } else {
      if (ringCache.level !== level || Math.hypot(ringCache.x - pos.x, ringCache.y - pos.y) > 20) {
        Object.assign(ringCache, { level, x: pos.x, y: pos.y, dist: nearestBeyond(pos.x, pos.y, level) });
      }
      const d = ringCache.dist;
      $('rd-ring').innerHTML = !Number.isFinite(d) ? 'Outside the mapped area.'
        : (!overview && d > state.range)
          ? `Amber line is <b class="num">${fmtDist(d)}</b> from here, beyond this range. Open <b>Overview</b> to see it.`
          : `Amber line: nearest point <b class="num">${fmtDist(d)}</b> from here.`;
    }

    // stops
    const tgt = currentTarget(t);
    const R = state.size / 2;
    let edgeLabelled = false;
    for (const o of stopEls) {
      const s = o.s, cls = stopClass(s, t);
      v3.set(s.x, s.y, 0).project(camera);
      const sx = v3.x * R, sy = -v3.y * R;                 // px from the stage centre
      const rr = Math.hypot(sx, sy);
      const straight = Math.hypot(s.x - pos.x, s.y - pos.y);
      const inside = overview ? true : rr <= R - 8;
      const isTarget = !tgt.done && s === tgt.stop;
      o.el.className = `stop ${cls}${isTarget ? ' target' : ''}`;
      o.el.hidden = !inside;
      const tag = stopTag(s);
      o.el.querySelector('.nm').textContent = tag && s.role === 'science' ? `${tag} · ${s.name}` : s.name;
      if (inside) {
        o.el.style.transform = `translate(${(R + sx).toFixed(1)}px, ${(R + sy).toFixed(1)}px)`;
        o.sub.textContent = straight < 3 ? 'you are here' : `${fmtDist(straight)} · Δz ${fmtSigned(s.z - pos.z)} m`;
        o.sub.hidden = overview && !isTarget;              // Overview: keep labels short, they sit close together
      }
      const showEdge = !inside && s.role !== 'context' && (cls !== 'visited' || isTarget);
      o.edge.hidden = o.elbl.hidden = !showEdge;
      if (showEdge) {
        const ang = Math.atan2(sx, -sy);                   // clockwise from "up"
        o.edge.className = `edge ${cls}`; o.elbl.className = `elbl ${cls}`;
        o.edge.style.transform = `rotate(${ang}rad) translateY(${-(R - 4)}px)`;
        const lr = R - 34;
        o.elbl.style.left = `${R + Math.sin(ang) * lr}px`; o.elbl.style.top = `${R - Math.cos(ang) * lr}px`;
        o.elbl.hidden = edgeLabelled;                       // label only the first upcoming stop: they all lie ahead
        edgeLabelled = true;
        o.elbl.textContent = `${tag && s.role === 'science' ? tag + ' · ' : ''}${s.name} · ${fmtDist(straight)}`;
        o.edge.title = s.name;
      }
    }

    // header + timeline
    $('hdr-lmst').textContent = fmtHM(startLmstMin + t);
    $('hdr-eva').textContent = `${fmtHM(t)} / ${fmtHM(evaBudget)}`;
    const frac = (t / evaTotal) * 100;
    $('tl-fill').style.width = `${frac}%`; $('tl-thumb').style.left = `${frac}%`;
    if (document.activeElement !== $('tl-input')) $('tl-input').value = t;
    $('tl-time').innerHTML = `${fmtHM(t)} / ${fmtHM(evaTotal)}<small>estimated EVA</small>`;
    for (const el of $('tl-marks').children) {
      const s = routeStops[Number(el.dataset.k)];
      el.classList.remove('next', 'visited', 'pickup'); el.classList.add(stopClass(s, t));
    }

    // card 1 — terrain
    const ahead = maxSlopeAhead(pos);
    $('tr-slope').innerHTML = `${pos.slope.toFixed(1)}<small>°</small>`;
    $('tr-ahead').innerHTML = `${ahead.toFixed(1)}<small>°</small>`;
    $('tr-elev').innerHTML = `${fmtInt(pos.z)}<small>m</small>`;
    $('tr-bar').style.width = `${clamp(pos.slope / slopeLimit, 0, 1) * 100}%`;
    $('tr-bar-ahead').style.left = `calc(${clamp(ahead / slopeLimit, 0, 1) * 100}% - 2px)`;

    // card 2 — window
    const back = returnMinutes(pos.x, pos.y);
    const margin = back === null ? null : remaining - back;
    $('wn-elapsed').innerHTML = `${fmtHM(t)}<small>h:min</small>`;
    $('wn-remaining').innerHTML = `${fmtHM(remaining)}<small>h:min</small>`;
    $('wn-margin').innerHTML = margin === null ? 'n/a' : `${fmtSigned(Math.floor(margin)).replace('+', '')}<small>min</small>`;
    $('wn-margin').parentElement.classList.toggle('neg', margin !== null && margin < 0);
    $('wn-margin').title = back === null ? 'This cell is not reachable in the return-time grid' : `Estimated walk back to the pickup from here: ${back} min (grid step 2 min)`;

    const sol = weather.sols[state.solIdx];
    const hour = (startLmstMin + t) / 60;
    const air = tempAt(sol.hourly, 'air_c', hour), ground = tempAt(sol.hourly, 'ground_c', hour);
    const cx = rx(hour);
    $('rems-cursor').innerHTML = `<line x1="${cx}" x2="${cx}" y1="${RC.y0}" y2="${RC.y1}" stroke="#E6EDF3" vector-effect="non-scaling-stroke"/>`
      + (air !== null ? `<circle cx="${cx}" cy="${ry(air)}" r="2.6" fill="#8AB4F8" stroke="#111821"/>` : '')
      + (ground !== null ? `<circle cx="${cx}" cy="${ry(ground)}" r="2.6" fill="#FF9F6B" stroke="#111821"/>` : '');
    const tc = (v) => (v === null ? 'no valid data' : `${v.toFixed(0).replace('-', '−')} °C`);
    $('rems-now').innerHTML = `Sol ${sol.sol} · ${fmtHM(startLmstMin + t)} LMST · air <b>${tc(air)}</b> · ground <b>${tc(ground)}</b> · measured hourly medians`;
    $('rems-now').title = `Sol ${sol.sol} (${sol.date_utc_approx}). Wind: ${weather.wind}.`;

    const rate = radRate(t), over = rate > rad.alert.threshold;
    $('rad-rate').textContent = rate >= 1000 ? fmtInt(rate) : rate.toFixed(1);
    $('rad-rate').parentElement.classList.toggle('over', over);
    const top = Number($('rad-cursor').dataset.top);
    const kxNow = KC.x0 + (t / evaBudget) * (KC.x1 - KC.x0), kyNow = KC.y1 - (rate / top) * (KC.y1 - KC.y0);
    $('rad-cursor').innerHTML = `<line x1="${kxNow}" x2="${kxNow}" y1="${KC.y0}" y2="${KC.y1}" stroke="#8C9BAB" vector-effect="non-scaling-stroke"/><circle cx="${kxNow}" cy="${kyNow}" r="2.6" fill="${over ? '#FF3B30' : '#E6EDF3'}" stroke="#111821"/>`;
    const b = rad.illustrative_budget;
    $('rad-l2').innerHTML = `<b>Illustrative EVA budget:</b> ${b.value_uGy} µGy (rate × ${b.eva_hours} h)`
      + (state.replay ? ` · replay so far <b>${radDose(t).toFixed(0)} µGy</b>` : '. Not a human dose.');
    const banner = $('alert-banner');
    banner.hidden = !over;
    if (over) banner.innerHTML = `<b>ILLUSTRATIVE ALERT</b> · RAD rate ${fmtInt(rate)} µGy/day is above ${fmtInt(rad.alert.threshold)} µGy/day (${rad.alert.factor} × reference, an assumption). Historical replay of ${esc(ev.date)}, not a prediction. Astronaut exposure is not modelled.`;

    // card 3 — next stop
    const s = tgt.stop;
    const isPickup = s.role === 'pickup';
    const ordinal = isPickup ? 'PICKUP' : `${s.order} OF ${scienceCount}`;
    $('st-head').textContent = tgt.done ? 'AT PICKUP · ROUTE COMPLETE' : tgt.dwelling ? `AT STOP · ${ordinal}` : `NEXT STOP · ${ordinal}`;
    $('card-stop').classList.toggle('at-pickup', isPickup);
    $('st-name').textContent = s.name;
    $('st-dist').innerHTML = tgt.dwelling ? '0<small>m</small>' : `${fmtInt(Math.max(0, s.dist_m - pos.dist))}<small>m</small>`;
    if (tgt.done) { $('st-eta-k').textContent = 'Arrived'; $('st-eta').innerHTML = `${fmtHM(startLmstMin + s.arrive_t_min)}<small>LMST</small>`; }
    else if (tgt.dwelling) { $('st-eta-k').textContent = 'Departs in'; $('st-eta').innerHTML = `${Math.ceil(s.depart_t_min - t)}<small>min</small>`; }
    else { $('st-eta-k').textContent = 'ETA estimated'; $('st-eta').innerHTML = `${Math.ceil(s.arrive_t_min - t)}<small>min</small>`; }
    $('st-dz').innerHTML = `${fmtSigned(tgt.dwelling ? 0 : s.z - pos.z)}<small>m</small>`;
    if (lastStopId !== s.id) {
      lastStopId = s.id;
      shownStop = s;
      const p = s.photos[0];
      $('st-photo-btn').hidden = !p;
      if (p) {
        $('st-photo').src = PKG + p.file;
        $('st-photo').alt = `Curiosity Navcam image near ${s.name}`;
        $('st-credit').textContent = `Curiosity Navcam · sol ${p.sol} · ${p.credit}`;
      }
      const note = (s.science_note || '').trim();
      $('st-note').innerHTML = (note
        ? `<b>Objective:</b> ${esc(note)}${s.science_source ? ` <em>(${esc(s.science_source)})</em>` : ''}`
        : '<b>Objective: pending</b>')
        + (p ? `<br>Photo taken ${esc(p.date_utc)} (historical). Tap to enlarge.` : '');
    }

    snap = { rev: ++snapRev, t, pos, hdg, remaining, level, ahead, back, margin, sol, hour, air, ground, rate, over, tgt };
  }

  // ---------------------------------------------------------------- loop
  let lastNow = performance.now(), lastRefresh = 0, stale = false;
  function frame(now) {
    const dt = Math.min(0.25, (now - lastNow) / 1000);
    lastNow = now;
    let dirty = false;
    if (state.playing) {
      state.t = Math.min(evaTotal, state.t + (dt * state.speed) / 60);
      if (state.t >= evaTotal) { state.playing = false; syncControls(); }
      dirty = true;
    }
    if (state.heading !== null) {                         // ease the heading towards the route direction
      const target = headingAt(sampleT(state.t));
      if (target !== null) {
        let d = target - state.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 1e-3) { state.heading += d * (1 - Math.exp(-dt / HEADING_TAU_S)); dirty = true; }
      }
    }
    // In the 3D view the scene follows state.t every frame; the radar, the cards and the HUD numbers go at ~10 Hz.
    if (dirty || stale) {
      if (state.view !== '3d' || now - lastRefresh > 95) { refresh(); lastRefresh = now; stale = false; }
      else stale = true;
    }
    if (state.view === '3d' && view3d) view3d.frame(snap, dt);
    requestAnimationFrame(frame);
  }

  drawRems();
  drawRad();
  if (state.view === '3d') ensure3D();
  syncControls();
  layout();
  refresh();
  document.documentElement.dataset.ready = '1';
  requestAnimationFrame(frame);
}

window.addEventListener('error', (e) => { if (!document.documentElement.dataset.ready) fatal(e.error || new Error(e.message)); });
start().catch(fatal);
