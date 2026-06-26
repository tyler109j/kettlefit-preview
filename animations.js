// animations.js — stick-figure + bell-trajectory exercise demos
// Loads a keyframe SVG from data/animations/<id>.svg and renders a looping
// animation by interpolating joint positions across poses.
//
// Schema (input SVG):
//   <svg ...><animation id="..." cycleMs="2000" loop="true">
//     <pose t="0"> <joint name="head" x=".." y=".."/> ... </pose>
//     ...
//   </animation></svg>
//
// Output: a single <svg> element appended to a host, drawn with rAF.
// Public API:
//   Anim.start(el, exId)    // mount & start the animation for exercise id
//   Anim.stop()              // stop & remove from DOM
//   Anim.has(exId)           // true if we have a keyframe for this exercise

const Anim = (() => {
  const TRAIL_LEN = 14;          // frames of bell trail kept
  const TRAIL_OPACITY = 0.32;    // max opacity of trail
  const ACCENT = 'var(--accent)';// bell + trail color (theme-bound)
  const FIG = 'var(--text)';     // stick figure color
  const MUTED = 'var(--muted)';  // joints/limb fallback

  // Map: app exercise id -> svg file basename (no extension)
  const EX_MAP = {
    'kb_swing':            'kb_swing',
    'goblet_squat':        'goblet_squat',
    'kb_deadlift':         'kb_deadlift',
    'kb_rdl':              'kb_rdl',
    'kb_turkish_getup':    'kb_turkish_getup',
    'kb_clean_single':     'kb_clean_single',
    'kb_snatch':           'kb_snatch',
  };

  // Internal: parsed keyframes per file. Shape: {cycleMs, poses:[{t, joints:{name:{x,y}}}]}
  const cache = new Map();
  let activeRaf = null;
  let activeSvg = null;
  let activeContainer = null;

  function fileFor(exId) {
    const base = EX_MAP[exId];
    if (!base) return null;
    return `data/animations/${base}.svg`;
  }

  function has(exId) { return Boolean(EX_MAP[exId]); }

  async function fetchAndParse(exId) {
    if (cache.has(exId)) return cache.get(exId);
    const url = fileFor(exId);
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const anim = doc.querySelector('animation');
      if (!anim) return null;
      const cycleMs = parseInt(anim.getAttribute('cycleMs') || '2000', 10);
      const poses = [...anim.querySelectorAll('pose')].map(p => {
        const t = parseFloat(p.getAttribute('t') || '0');
        const joints = {};
        for (const j of p.querySelectorAll('joint')) {
          joints[j.getAttribute('name')] = {
            x: parseFloat(j.getAttribute('x')),
            y: parseFloat(j.getAttribute('y')),
          };
        }
        return { t, joints };
      }).sort((a, b) => a.t - b.t);
      const parsed = { cycleMs, poses };
      cache.set(exId, parsed);
      return parsed;
    } catch (e) {
      console.warn('animations: failed to load', exId, e);
      return null;
    }
  }

  // Find the two poses surrounding `phase` and lerp every joint between them.
  function lerpPose(parsed, phase) {
    const poses = parsed.poses;
    if (poses.length === 0) return {};
    if (poses.length === 1 || phase <= poses[0].t) return poses[0].joints;
    if (phase >= poses[poses.length - 1].t) return poses[poses.length - 1].joints;
    let a = poses[0], b = poses[poses.length - 1];
    for (let i = 0; i < poses.length - 1; i++) {
      if (phase >= poses[i].t && phase <= poses[i + 1].t) {
        a = poses[i]; b = poses[i + 1]; break;
      }
    }
    const span = (b.t - a.t) || 1;
    const u = (phase - a.t) / span;
    const out = {};
    for (const name of Object.keys(a.joints)) {
      const ja = a.joints[name], jb = b.joints[name] || ja;
      out[name] = {
        x: ja.x + (jb.x - ja.x) * u,
        y: ja.y + (jb.y - ja.y) * u,
      };
    }
    return out;
  }

  // Build the SVG element (empty; updated per frame)
  function buildSvg(viewBox = '0 0 200 280') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('class', 'kf-anim-svg');
    // Trail is appended first so figure draws over it.
    const trail = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    trail.setAttribute('class', 'kf-anim-trail');
    svg.appendChild(trail);
    const fig = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    fig.setAttribute('class', 'kf-anim-fig');
    svg.appendChild(fig);
    return svg;
  }

  function line(parent, x1, y1, x2, y2, stroke) {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
    ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    ln.setAttribute('stroke', stroke);
    ln.setAttribute('stroke-width', '3');
    ln.setAttribute('stroke-linecap', 'round');
    parent.appendChild(ln);
  }

  function circle(parent, cx, cy, r, fill) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy);
    c.setAttribute('r', r); c.setAttribute('fill', fill);
    parent.appendChild(c);
  }

  function drawFigure(figGroup, j) {
    if (!j.head) return;
    // Spine
    if (j.shoulder && j.hip) line(figGroup, j.shoulder.x, j.shoulder.y, j.hip.x, j.hip.y, FIG);
    // Arms (shoulder -> hand) — single limb if 'hand', or two if both hands
    if (j.shoulder && j.hand) line(figGroup, j.shoulder.x, j.shoulder.y, j.hand.x, j.hand.y, FIG);
    // Hips & thigh (hip -> knee)
    if (j.hip && j.knee) line(figGroup, j.hip.x, j.hip.y, j.knee.x, j.knee.y, FIG);
    // Shin (knee -> ankle)
    if (j.knee && j.ankle) line(figGroup, j.knee.x, j.knee.y, j.ankle.x, j.ankle.y, FIG);
    // Pelvis bar (hip -> hip-mirror) — simple visual anchor
    if (j.hip) line(figGroup, j.hip.x - 8, j.hip.y, j.hip.x + 8, j.hip.y, FIG);
    // Shoulder bar
    if (j.shoulder) line(figGroup, j.shoulder.x - 12, j.shoulder.y, j.shoulder.x + 12, j.shoulder.y, FIG);
    // Joints (small dots)
    for (const name of ['head','shoulder','hip','knee','ankle']) {
      if (j[name]) circle(figGroup, j[name].x, j[name].y, name === 'head' ? 6 : 3, MUTED);
    }
    // Head
    circle(figGroup, j.head.x, j.head.y, 9, FIG);
  }

  function drawBell(trailGroup, j) {
    if (!j.hand) return;
    // Trail dot fading into recent positions (we'll redraw these every frame
    // from a small ring buffer maintained in start()).
    // Hand dot (wrist)
    circle(trailGroup, j.hand.x, j.hand.y, 5, ACCENT);
  }

  // Public: mount + start. `el` is a host element (e.g. a div.card).
  async function start(el, exId) {
    stop(); // tear down any existing animation
    if (!has(exId)) return false;
    const parsed = await fetchAndParse(exId);
    if (!parsed) return false;

    const svg = buildSvg();
    el.innerHTML = '';
    el.appendChild(svg);
    activeSvg = svg;
    activeContainer = el;

    // Ring buffer of recent bell positions for the trail.
    const trail = [];

    let startTs = performance.now();
    function frame(now) {
      if (!activeSvg) return; // stopped
      const elapsed = (now - startTs) % parsed.cycleMs;
      const phase = elapsed / parsed.cycleMs;

      // Update trail buffer with current hand position.
      const poseNow = lerpPose(parsed, phase);
      if (poseNow.hand) {
        trail.unshift({ x: poseNow.hand.x, y: poseNow.hand.y });
        if (trail.length > TRAIL_LEN) trail.length = TRAIL_LEN;
      }

      // Clear + redraw
      const figG = svg.querySelector('.kf-anim-fig');
      const trailG = svg.querySelector('.kf-anim-trail');
      while (figG.firstChild) figG.removeChild(figG.firstChild);
      while (trailG.firstChild) trailG.removeChild(trailG.firstChild);

      // Trail: oldest at end, dimmest; newest brightest.
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        const t = 1 - (i / trail.length); // 1 newest, 0 oldest
        const op = TRAIL_OPACITY * t;
        const r = 4 + 2 * t;
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
        c.setAttribute('r', r); c.setAttribute('fill', ACCENT);
        c.setAttribute('opacity', op.toFixed(3));
        trailG.appendChild(c);
      }

      drawFigure(figG, poseNow);
      drawBell(figG, poseNow);

      activeRaf = requestAnimationFrame(frame);
    }
    activeRaf = requestAnimationFrame(frame);
    return true;
  }

  function stop() {
    if (activeRaf) cancelAnimationFrame(activeRaf);
    activeRaf = null;
    if (activeSvg && activeSvg.parentNode) {
      activeSvg.parentNode.removeChild(activeSvg);
    }
    activeSvg = null;
    if (activeContainer) {
      try { activeContainer.innerHTML = ''; } catch (e) {}
    }
    activeContainer = null;
  }

  return { start, stop, has };
})();

export default Anim;