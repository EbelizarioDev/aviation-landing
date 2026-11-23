# Aviation Landing Sim

Small browser game: one landing approach per level, cockpit view, seven aircraft.
No build step, no external assets, no dependencies. Canvas 2D + ES modules.

## Specs

S1 — The game is a landing simulator: each level is a single approach and touchdown,
scored by precision (vertical speed, touchdown zone, speed, alignment). Fail states are
a hard touchdown, an undershoot, an overrun, or leaving the runway edge.

S2 — The landing is flown from the cockpit: a windshield view plus an instrument panel,
with a small minimap that shows the aircraft descending toward the runway.

S3 — Levels are aircraft: level 1 is a Cessna 152 trainer and the last level is an
Airbus A380.

S4 — Level 3 is a Cessna 208B Grand Caravan; the aircraft that were levels 3..6 shift
down to levels 4..7.

S5 — Graphics need no polish but must be fully understandable: no external assets,
canvas primitives only, and every state a pilot must read is visible at a glance —
aircraft, altitude, speed, vertical speed, glidepath deviation, distance to threshold.

S6 — Energy model drives the gameplay: nosing up bleeds speed, speed below the aircraft's
stall speed collapses lift, thrust spools up with a per-aircraft delay, flaps and gear
add drag.

S7 — Touchdown evaluation: above 300 fpm is a hard landing (gear collapse, fail); touching
down short of the threshold is an undershoot fail; touching down past the touchdown zone
is an overrun fail; inside the zone, within 10 kt of the aircraft's reference speed and
aligned with the centreline is a scored landing with a medal.

S8 — Pure math (glide slope, required sink rate, touchdown classification, thrust spool,
stall) is unit tested with `node --test`.

## Tasks

| ID | Spec | Work | Route | Commit |
|----|------|------|-------|--------|
| T1 | S3,S4,S6,S8 | Aircraft data for the seven-model ladder + physics core + unit tests | inline | `f2ef552` |
| T2 | S2,S5 | Cockpit windshield renderer: projected runway, approach lights, PAPI, horizon | inline | `d57f4fc` |
| T3 | S2,S5 | Instrument panel: attitude, speed/altitude tapes, VSI, glideslope/localizer | inline | `d57f4fc` |
| T4 | S2,S5 | Side-profile minimap with the 3° glidepath and deviation colouring | inline | `d57f4fc` |
| T5 | S1,S7 | Game loop, input, level orchestration, touchdown scoring, screens | inline | `e5ca8b9` |
| T6 | S5 | README with controls + final verification run | inline | `52819a9` |

All six tasks done. 54 tests green (`npm test`): physics and grading, projection
math, a render smoke test over every level and phase, and a keyboard-driven
playthrough of all seven levels that requires a medal on each.

## Log

L1 — "Me gustaría hacer un pequeño juego de aviación para pasar el tiempo ¿Qué tanto sabes de eso?"

L2 — "Sería bueno ver el aterrizaje desde la cabina y tal vez en una pantalla pequeña ver como el avión va decendiendo de camino a la pista. Tipo un minimapa, además me gustaría que fueran más de un modelo como a forma de niveles, por ejemplo en el nivel 1, un Cessna 152 como avion entrenador y ya para el último nivel (que no se cual sería) un Airbus A380 o algo así"

L3 — "Me parece bien, los gráficos no necesitan ser nada del otro mundo, pero que sean totalmente entendibles si es importante. Agrega otro nivel 3 (recorre los demás hacia abajo) en el cual sea una Cessna Grand Caravan."

L4 — Design accepted ("Me parece bien") on the proposal: cockpit windshield + instrument panel + side-profile minimap; physics of energy (nose up bleeds speed, stall collapses lift, per-aircraft thrust spool); touchdown evaluation at 300 fpm hard / short / over touchdown zone / aligned; seven levels adding one system each.

L5 — Decision: implement inline in one session, no subagents. Reason: the requirement is a single coherent visual language across three renderers; parallel writers would fragment legibility, which is the top stated requirement.

L6 — Decision: repo-local git identity (`sistemas <sistemas@localhost>`) because the environment has no global git user configured.

L7 — Implementation decisions recorded while building:
- The 3° path crosses the threshold at 50 ft (real ILS geometry), so a stabilised approach touches down ~950 ft past the threshold plus the flare. This replaced an earlier model that put the path at zero at the threshold and made every level grade as an overrun.
- Touchdown zone is 60% of the runway capped at 3000 ft, because the flare pushes the real touchdown to 1400-2100 ft.
- Stall now drops the nose: without it a stalled aircraft mushed down at 4° and was not a real consequence.
- Runway width is 45 m everywhere, and the same constant draws the runway, positions the localizer diamond and decides the off-edge failure.
- Closed-loop autopilots found two real bugs: `createState` did not seed `groundSpeedKt` (NaN lateral drift) and `finish()` crashed when the approach flew past the runway without a touchdown record.
- Approach lengths trimmed to 2.0-4.5 nm after the playthrough measured 3-4 minutes per attempt, too long for the stated "pass the time" purpose. Now ~2 minutes.
- Levels 2-7 start unconfigured (flaps up, gear up on retractable) so configuring is part of the work.
