// workout_preview.js
// Reproduces renderActiveWorkout() from js/app.js so the animation card appears
// in its real workout-screen context. Same CSS, same Anim module, same SVGs.
//
// This is preview-only — the layout files (workout_preview.html) are served
// from the kettlefit-preview GitHub Pages site, but the DOM tree we build here
// matches what renderActiveWorkout() produces in the live app, character for
// character (modulo a few minor omissions that don't affect where the anim
// card sits or what it looks like).

import Anim from './animations.js?v=preview1';

// Mirror the h() helper used in app.js. Minimal implementation is enough.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const root = () => document.getElementById('root');

// Minimal idle countdown ring (200×200, full progress). Mirrors what
// renderIdleRing() produces via Charts.countdownRing in production.
function buildIdleRing() {
  const size = 200, stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  const track = document.createElementNS(svgNS, 'circle');
  track.setAttribute('cx', size / 2); track.setAttribute('cy', size / 2);
  track.setAttribute('r', r); track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--border)');
  track.setAttribute('stroke-width', stroke);
  svg.appendChild(track);
  const arc = document.createElementNS(svgNS, 'circle');
  arc.setAttribute('cx', size / 2); arc.setAttribute('cy', size / 2);
  arc.setAttribute('r', r); arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', 'var(--border)');
  arc.setAttribute('stroke-width', stroke);
  arc.setAttribute('stroke-dasharray', c);
  arc.setAttribute('stroke-dashoffset', 0);
  arc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  arc.setAttribute('stroke-linecap', 'round');
  svg.appendChild(arc);
  return svg;
}

// Sample exercise records — same shape as real workout.exercises entries.
const SAMPLES = {
  kb_swing:         { id: 'kb_swing',         name: 'Kettlebell Swing',         sets: 5, reps: '15–20',  weight: '24 kg' },
  goblet_squat:     { id: 'goblet_squat',     name: 'Goblet Squat',             sets: 4, reps: '8–10',   weight: '20 kg' },
  kb_deadlift:      { id: 'kb_deadlift',      name: 'Kettlebell Deadlift',      sets: 4, reps: '8',      weight: '32 kg' },
  kb_rdl:           { id: 'kb_rdl',           name: 'Romanian Deadlift',        sets: 3, reps: '10',     weight: '24 kg' },
  kb_turkish_getup: { id: 'kb_turkish_getup', name: 'Turkish Get-up',           sets: 2, reps: '3/side', weight: '16 kg' },
  kb_clean_single:  { id: 'kb_clean_single',  name: 'Single-arm Clean',         sets: 4, reps: '8/side', weight: '20 kg' },
  kb_snatch:        { id: 'kb_snatch',        name: 'Snatch',                   sets: 5, reps: '10/side',weight: '16 kg' },
  kb_press:         { id: 'kb_press',         name: 'Strict Press',             sets: 4, reps: '6',      weight: '20 kg' },
  kb_row:           { id: 'kb_row',           name: 'Bent-over Row',            sets: 3, reps: '10/side',weight: '24 kg' },
};

// Render the same DOM tree renderActiveWorkout() builds. The animation card
// uses Anim.has()/Anim.start() exactly like production.
function renderActiveWorkout(exId) {
  const r = root(); r.innerHTML = '';
  const ex = SAMPLES[exId] || SAMPLES.kb_swing;
  const sampleSetIdx = 1;     // "Set 2 of 5" with 1 dot done
  const sampleSetsDone = 1;

  // sticky header (matches app-header markup in production)
  r.appendChild(h('div', { class: 'app-header' },
    h('div', {},
      h('div', { class: 'label' }, 'Exercise 3 of 7')),
    h('button', { class: 'btn ghost sm inline' }, 'Log & Finish')
  ));

  const screen = h('div', { class: 'screen center' });

  // why + technique + substitute row
  screen.appendChild(h('div', { class: 'chip-row mb8', style: 'justify-content:center' },
    h('button', { class: 'btn ghost sm inline' }, 'ⓘ Why?'),
    h('button', { class: 'btn ghost sm inline' }, '? Technique'),
    h('button', { class: 'btn ghost sm inline' }, '⇄ Substitute')
  ));

  // exercise name + set/target meta lines
  screen.appendChild(h('div', { class: 'aw-exercise-name' }, ex.name));
  screen.appendChild(h('div', { class: 'aw-meta' }, `Set ${sampleSetIdx + 1} of ${ex.sets}`));
  screen.appendChild(h('div', { class: 'aw-target' }, `${ex.weight} • ${ex.reps} reps`));

  // progress dots
  const dots = h('div', { class: 'aw-progress' });
  for (let i = 0; i < ex.sets; i++) {
    let cls = 'aw-dot';
    if (i < sampleSetsDone) cls += ' done';
    else if (i === sampleSetIdx) cls += ' cur';
    dots.appendChild(h('div', { class: cls }));
  }
  screen.appendChild(dots);

  // timer ring wrap + idle ring
  const ringWrap = h('div', { class: 'timer-ring-wrap' });
  ringWrap.appendChild(buildIdleRing());
  ringWrap.appendChild(h('div', { class: 'timer-num' },
    h('div', { class: 't' }, 'Ready'),
    h('div', { class: 'muted small' }, 'rest timer')));
  screen.appendChild(ringWrap);

  // rest-log card (simplified — full picker would require ui.js helpers)
  const restCard = h('div', { class: 'rest-log-card' });
  restCard.appendChild(h('div', { class: 'rest-log-head' }, `Log your set — ${ex.name}`));
  restCard.appendChild(h('div', { class: 'field' },
    h('label', {}, 'Reps completed'),
    h('div', { class: 'muted small' }, '(full picker in app — simplified here)')));
  restCard.appendChild(h('div', { class: 'field' },
    h('label', {}, 'RPE (rate of perceived exertion)'),
    h('div', { class: 'muted small' }, '7')));
  restCard.appendChild(h('button', { class: 'btn sm mt8' }, '✓ Log set'));
  restCard.appendChild(h('div', { class: 'muted small mt8', style: 'text-align:center' },
    'Saved automatically when rest ends.'));
  screen.appendChild(restCard);

  // === Animation card — exact same code path as renderActiveWorkout ===
  if (Anim.has(ex.id)) {
    const animCard = h('div', { class: 'card kf-anim-card' });
    screen.appendChild(animCard);
    setTimeout(() => Anim.start(animCard, ex.id), 0);
  } else {
    // Visually demonstrate what users see for un-animated exercises.
    const placeholder = h('div', { class: 'card kf-anim-card',
      style: 'color:var(--muted); font-size:.85rem; text-align:center;' },
      '(no animation for this exercise yet)');
    screen.appendChild(placeholder);
  }

  // Complete Set button
  screen.appendChild(h('button', { class: 'btn mt16' }, '✓ Complete Set'));

  // bottom controls
  screen.appendChild(h('div', { class: 'chip-row mt12', style: 'justify-content:center' },
    h('button', { class: 'btn ghost sm inline' }, 'Edit set'),
    h('button', { class: 'btn ghost sm inline' }, 'Skip exercise')));

  r.appendChild(screen);
}

// Wire up the switcher
const buttons = document.querySelectorAll('.preview-switcher button');
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    Anim.stop(); // cancel any in-flight RAF before re-rendering
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderActiveWorkout(btn.dataset.ex);
  });
});

// Initial render
renderActiveWorkout('kb_swing');