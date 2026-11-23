// DOM glue: canvas, keyboard and the frame loop. All game rules live in
// game.js, the physics in physics.js, and each view in render/.

import { getAircraft } from './aircraft.js';
import { RUNWAY_HALF_WIDTH_FT } from './physics.js';
import { WEATHER, beyondCrosswindLimit, getWeather } from './weather.js';
import { cellKeyFor, controlsFor, createGame, selectedWeatherId } from './game.js';
import { VIEW, COLORS } from './render/layout.js';
import { drawCockpit } from './render/cockpit.js';
import { drawChase } from './render/chase.js';
import { drawPanel } from './render/panel.js';
import { drawMinimap } from './render/minimap.js';

const DT = 1 / 60;
const HANDLED = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'KeyF',
  'KeyV',
  'KeyG',
  'KeyX',
  'KeyB',
  'KeyC',
  'KeyN',
  'KeyP',
  'KeyR',
  'Enter',
  'Escape',
]);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const api = createGame({ storage: safeStorage() });
const game = api.game;
const LEVELS = api.levels;

window.addEventListener('keydown', (e) => {
  if (HANDLED.has(e.code)) e.preventDefault();
  api.press(e.code);
});
window.addEventListener('keyup', (e) => api.release(e.code));
window.addEventListener('blur', () => api.clearKeys());

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.2, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  let guard = 0;
  while (accumulator >= DT && guard++ < 8) {
    api.update(DT);
    accumulator -= DT;
  }
  render();
  requestAnimationFrame(frame);
}

function render() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (game.state) {
    const cues = {
      stall: game.state.stalled,
      flare: !game.state.onGround && game.state.altFt < 50,
    };
    if (game.view === 'chase') {
      drawChase(ctx, { state: game.state, aircraft: game.aircraft, level: game.level, weather: game.weather, t: game.t });
    } else {
      drawCockpit(ctx, { state: game.state, aircraft: game.aircraft, level: game.level, weather: game.weather, t: game.t });
    }
    drawMinimap(ctx, { state: game.state, aircraft: game.aircraft, level: game.level, weather: game.weather });
    drawPanel(ctx, { state: game.state, aircraft: game.aircraft, level: game.level, weather: game.weather, cues });
    if (game.phase === 'rollout') drawRolloutHint();
    drawNotice();
  } else {
    ctx.fillStyle = '#07090b';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  if (game.phase === 'menu') drawMenu();
  else if (game.phase === 'briefing') drawBriefing();
  else if (game.phase === 'result') drawResult();
  if (game.paused && (game.phase === 'flying' || game.phase === 'rollout')) drawPaused();
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function drawMenu() {
  dim(0.82);
  const weatherId = selectedWeatherId(game);
  const weather = getWeather(weatherId);

  text('AVIATION LANDING', VIEW.width / 2, 78, {
    size: 38,
    color: COLORS.marking,
    align: 'center',
  });
  text('Seven aircraft. Four skies. Land it properly.', VIEW.width / 2, 104, {
    size: 14,
    color: COLORS.dim,
    align: 'center',
  });

  // --- aircraft axis
  let y = 150;
  LEVELS.forEach((level, i) => {
    const aircraft = getAircraft(level.aircraft);
    const selected = i === game.levelIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(90,209,232,0.12)';
      ctx.fillRect(120, y - 18, VIEW.width - 240, 36);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 1;
      ctx.strokeRect(120.5, y - 17.5, VIEW.width - 241, 35);
    }
    text(`${level.n}`, 140, y + 5, {
      size: 16,
      color: selected ? COLORS.cyan : COLORS.dim,
      align: 'center',
    });
    text(aircraft.name, 164, y, { size: 16, color: selected ? COLORS.marking : COLORS.text });
    text(level.adds, 164, y + 13, { size: 10, color: COLORS.dim });
    const best = game.bests[cellKeyFor(level.n, weatherId)];
    text(best ? `${best.medal.toUpperCase()} ${best.points}` : '—', VIEW.width - 140, y + 2, {
      size: 13,
      color: best ? medalColor(best.medal) : COLORS.dim,
      align: 'right',
    });
    y += 42;
  });

  // --- weather axis
  const chipY = 462;
  const chipW = (VIEW.width - 260) / WEATHER.length - 10;
  text('WEATHER', 120, chipY - 14, { size: 11, color: COLORS.cyan });
  WEATHER.forEach((profile, i) => {
    const cx = 120 + i * (chipW + 10);
    const selected = profile.id === weatherId;
    ctx.fillStyle = selected ? 'rgba(242,177,52,0.16)' : 'rgba(10,14,18,0.85)';
    ctx.fillRect(cx, chipY, chipW, 62);
    ctx.strokeStyle = selected ? COLORS.amber : COLORS.panelEdge;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(cx + 0.5, chipY + 0.5, chipW - 1, 61);
    text(profile.name, cx + 10, chipY + 20, {
      size: 15,
      color: selected ? COLORS.amber : COLORS.text,
    });
    text(profile.tagline, cx + 10, chipY + 36, { size: 9, color: COLORS.dim });
    text(
      `${profile.crosswindKt} KT XW · ${profile.runway.toUpperCase()}`,
      cx + 10,
      chipY + 52,
      { size: 10, color: selected ? COLORS.amber : COLORS.dim },
    );
  });

  text('↑ ↓ aircraft    ← → weather    ENTER fly', VIEW.width / 2, VIEW.height - 26, {
    size: 14,
    color: COLORS.text,
    align: 'center',
  });
  if (beyondCrosswindLimit(getAircraft(LEVELS[game.levelIndex].aircraft), weather)) {
    text('this crosswind is beyond that aircraft\'s demonstrated limit', VIEW.width / 2, VIEW.height - 46, {
      size: 12,
      color: COLORS.red,
      align: 'center',
    });
  }
}

function drawBriefing() {
  const aircraft = game.aircraft;
  const level = game.level;
  dim(0.88);
  const x = 110;
  const w = VIEW.width - 220;
  let y = 70;

  text(`LEVEL ${level.n}`, x, y, { size: 13, color: COLORS.cyan });
  y += 34;
  text(aircraft.name, x, y, { size: 32, color: COLORS.marking });
  y += 24;
  text(`${aircraft.role} · ${Math.round(aircraft.massT * 1000)} kg · ${aircraft.vrefKt} kt`, x, y, {
    size: 14,
    color: COLORS.dim,
  });

  const weather = game.weather;
  y += 28;
  text('WEATHER', x, y, { size: 11, color: COLORS.cyan });
  text(`${weather.name} — ${weather.tagline}`, x + 76, y, { size: 15, color: COLORS.amber });
  if (beyondCrosswindLimit(aircraft, weather)) {
    y += 20;
    text(
      `CROSSWIND BEYOND DEMONSTRATED LIMIT (${weather.crosswindKt} KT > ${aircraft.maxCrosswindKt} KT)`,
      x + 76,
      y,
      { size: 12, color: COLORS.red },
    );
  }

  y += 30;
  text('NEW', x, y, { size: 11, color: COLORS.cyan });
  text(level.adds, x + 48, y, { size: 16, color: COLORS.amber });

  y += 34;
  wrap(level.brief, x, y, w - 40, 22, { size: 15, color: COLORS.text });

  y += 76;
  text('WHY THIS ONE', x, y, { size: 11, color: COLORS.cyan });
  wrap(aircraft.teaches, x, y + 20, w - 40, 21, { size: 14, color: COLORS.text });

  y += 78;
  text('CHECKLIST', x, y, { size: 11, color: COLORS.cyan });
  y += 22;
  const checklist = [];
  const lastDetent = aircraft.flaps[aircraft.flaps.length - 1].label;
  if ((level.setup ?? 'landing') === 'landing') {
    checklist.push('Configured for landing: flaps and gear are already set.');
  } else {
    checklist.push(`Flaps ${lastDetent}  (F / V)`);
    if (aircraft.gear === 'retractable') checklist.push('Gear DOWN  (G)');
  }
  checklist.push(`Hold ${aircraft.vrefKt} kt and the 3° path all the way down.`);
  checklist.push('Below 50 ft, flare: raise the nose until the sink dies.');
  checklist.forEach((line, i) => {
    text('·', x + 4, y + i * 21, { size: 14, color: COLORS.green });
    text(line, x + 18, y + i * 21, { size: 14, color: COLORS.text });
  });

  y += checklist.length * 21 + 12;
  text('CONTROLS ON THIS AIRCRAFT', x, y, { size: 11, color: COLORS.cyan });
  const controls = controlsFor(aircraft);
  controls.forEach((control, i) => {
    const cy = y + 20 + i * 17;
    if (cy > VIEW.height - 42) return;
    text(control.key, x + 4, cy, { size: 12, color: COLORS.amber });
    text(control.action, x + 90, cy, { size: 12, color: COLORS.text });
  });

  text('ENTER fly    ESC back', x, VIEW.height - 40, { size: 14, color: COLORS.dim });
}

function drawNotice() {
  if (!game.notice) return;
  const age = game.t - game.notice.at;
  if (age > 2.5) return;
  const alpha = age > 2 ? 1 - (age - 2) / 0.5 : 1;
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = 'rgba(8,12,16,0.85)';
  ctx.fillRect(VIEW.width / 2 - 170, 300, 340, 30);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(VIEW.width / 2 - 169.5, 300.5, 339, 29);
  text(game.notice.text, VIEW.width / 2, 320, {
    size: 14,
    color: COLORS.amber,
    align: 'center',
  });
  ctx.globalAlpha = 1;
}

function drawRolloutHint() {
  const y = VIEW.windshieldBottom - 30;
  const a = game.aircraft;
  const hint = [
    'HOLD SPACE: brakes',
    a.reverse ? 'B: reversers' : null,
    a.spoilers ? 'X: spoilers' : null,
  ]
    .filter(Boolean)
    .join('    ');
  ctx.fillStyle = 'rgba(8,12,16,0.7)';
  ctx.fillRect(0, y - 18, VIEW.width, 28);
  text(hint, VIEW.width / 2, y + 2, { size: 14, color: COLORS.amber, align: 'center' });
}

function drawResult() {
  const r = game.result;
  dim(0.86);
  const cx = VIEW.width / 2;
  const color = r.ok ? medalColor(r.medal) : COLORS.red;

  text(`${game.aircraft.name} · ${game.weather.name}`, cx, 62, {
    size: 13,
    color: COLORS.dim,
    align: 'center',
  });
  text(r.ok ? 'LANDED' : 'FAILED', cx, 108, {
    size: 44,
    color: r.ok ? COLORS.marking : COLORS.red,
    align: 'center',
  });
  text(r.label, cx, 142, { size: 17, color, align: 'center' });

  if (r.ok) {
    text(r.medal.toUpperCase(), cx, 200, { size: 32, color, align: 'center' });
    text(`${r.points} / 100`, cx, 228, { size: 15, color: COLORS.dim, align: 'center' });
  }

  const rows = [
    [
      'Sink at touchdown',
      `${r.fpm} fpm`,
      r.fpm > 300 ? COLORS.red : r.fpm > 200 ? COLORS.amber : COLORS.green,
    ],
    [
      'Speed at touchdown',
      `${r.speedKt} kt (${r.speedDev > 0 ? '+' : ''}${r.speedDev})`,
      Math.abs(r.speedDev) > 10 ? COLORS.red : Math.abs(r.speedDev) > 6 ? COLORS.amber : COLORS.green,
    ],
    [
      'Touchdown point',
      `${r.pastThresholdFt} ft past threshold`,
      r.pastThresholdFt < 0 || r.pastThresholdFt > r.tdzFt ? COLORS.red : COLORS.green,
    ],
    [
      'Off centreline',
      `${Math.abs(r.lateralFt)} ft`,
      Math.abs(r.lateralFt) > RUNWAY_HALF_WIDTH_FT ? COLORS.red : COLORS.green,
    ],
    ['Rollout end', `${r.endFt} ft of ${r.runwayFt} ft`, r.endFt > r.runwayFt ? COLORS.red : COLORS.green],
  ];
  let y = 268;
  rows.forEach(([label, value, c]) => {
    text(label, 260, y, { size: 14, color: COLORS.dim });
    text(value, VIEW.width - 260, y, { size: 15, color: c, align: 'right' });
    y += 28;
  });

  text('ENTER retry    N next    ESC menu', cx, VIEW.height - 40, {
    size: 14,
    color: COLORS.text,
    align: 'center',
  });
}

function drawPaused() {
  dim(0.7);
  text('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10, {
    size: 34,
    color: COLORS.marking,
    align: 'center',
  });
  text('P to resume    R restart    ESC menu', VIEW.width / 2, VIEW.height / 2 + 24, {
    size: 14,
    color: COLORS.dim,
    align: 'center',
  });
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function dim(alpha) {
  ctx.fillStyle = `rgba(4,6,8,${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function text(str, x, y, { size = 14, color = COLORS.text, align = 'left' } = {}) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

function wrap(str, x, y, maxWidth, lineHeight, style) {
  const words = str.split(' ');
  let line = '';
  let dy = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    ctx.font = `600 ${style.size}px ui-monospace, monospace`;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      text(line, x, y + dy, style);
      line = word;
      dy += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) text(line, x, y + dy, style);
  return dy + lineHeight;
}

function medalColor(medal) {
  switch (medal) {
    case 'gold':
      return '#f2c94c';
    case 'silver':
      return '#c8d2da';
    case 'bronze':
      return '#c98b5a';
    default:
      return COLORS.amber;
  }
}

function safeStorage() {
  try {
    const probe = '__aviation_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

requestAnimationFrame(frame);
