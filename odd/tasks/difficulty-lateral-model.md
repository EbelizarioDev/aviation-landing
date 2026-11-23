# Difficulty and lateral flight model

Feature D: weather becomes an independent difficulty axis (4 profiles × 7
aircraft = 28 scenarios), the aircraft stops exposing controls it does not
have, and the lateral axis becomes real (bank, heading, sideslip) so the rudder
and the ailerons finally do something.

Supersedes nothing. Extends the landing sim in `aviation-landing-sim.md` (S1-S9
there stay valid unless a spec below says otherwise).

## Specs

S1 — Difficulty is an axis independent of the aircraft ladder. Four weather
profiles: **calm**, **windy**, **storm**, **snow/ice**. Every profile combines
with every aircraft, giving 28 scenarios, each with its own best medal.
Profile data replaces the per-level weather constants that live in `levels.js`
today.

S2 — Weather that changes the flight must be readable before it surprises you:
wind direction and speed, gust margin, visibility and braking condition are on
screen, and the snow or rain that explains them is drawn.

S3 — An aircraft exposes only the systems it has. A control with no effect on
the current aircraft must say so instead of failing silently. The C152 has fixed
gear, no spoilers and no reverse: those keys report "not on this aircraft".
Pitch and throttle are never removed from any aircraft — without them the
aircraft cannot fly a path or flare.

S4 — Lateral flight model: the aircraft state carries bank (phi), heading (psi)
and sideslip (beta). Ailerons bank, the aircraft turns because it is banked
(`dpsi/dt = g*tan(phi)/V`), and the rudder yaws against the bank to control
sideslip. The old abstract `steerDeg` crab angle is replaced, not kept
alongside. Crosswind is flown with a crab and landed with a de-crab.
Banking costs glide path: the vertical component of lift falls by `1
- cos(phi)`, so an uncorrected bank increases the sink rate.

S5 — Alignment is scored, never fatal. The closer the touchdown is to the
centreline and to the runway axis, the better the grade. Missing it lowers
points and never collapses the gear.

S6 — Control map: `Q`/`E` rudder, `A`/`D` aileron, `↑`/`↓` throttle, `W`/`S`
pitch. Flaps, gear, spoilers, brakes and reverse keep their current keys.

S7 — Every one of the 28 cells is landable: a keyboard-driven playthrough test
must score a medal on each. A cell whose crosswind exceeds the aircraft's
published `maxCrosswindKt` is allowed but flagged in the briefing as beyond the
demonstrated limit — realistic, not a bug.

S8 — The behaviour verified today keeps working: 3 degree path, stall,
per-aircraft spool, touchdown grading (hard / short / overrun / edge / speed)
and the medal scale. The lateral model replaces the crab abstraction; it does
not add a second, parallel way to move sideways.

S9 — All of the above is unit tested, including the lateral equations, the
weather profiles, the per-aircraft control map and the 28-cell matrix.

## Tasks

| ID | Spec | Work | Phase |
|----|------|------|-------|
| T1 | S4,S6,S9 | Lateral state (bank/heading/sideslip), turn coupling, aileron and rudder controls, input remap, lateral unit tests | 1 |
| T2 | S4,S5,S9 | De-crab at the flare, alignment as a scored factor in `classifyTouchdown`, recalibrate the 7 aircraft laterally, rewrite the playthrough autopilot | 1 |
| T3 | S1,S2,S9 | Four weather profiles as data, physics profile plumbing (wind, gust, visibility, braking), weather-aware rendering (rain, snow, haze) and wind readouts | 2 |
| T4 | S1,S7,S9 | 28-cell matrix: scenario data, two-axis selector, per-cell medals, per-cell landability test | 3 |
| T5 | S3,S9 | Per-aircraft control map: only the applicable controls in the help, and a visible "not on this aircraft" response | 4 |
| T6 | S8 | Update README, the panel's heading readout and the briefing checklist | throughout |

## Log

L1 — "Creo que podríamos reestructurar el como funciona casi todo. Por ejemplo, el Cessna 152, tiene un tren fijo, en ese caso, sería bueno poder moverle solamente los flaps y la aceleración. Otra idea que tuve es acerca de no solamente progresión pero también dificultad,de momento tenemos la progresión por niveles pero no una opción de dificultad como tal, estoy pensando en si cada vez que se sube el nivel de dificultad se cambien cosas clave del juego, por ejemplo más superficies de control (en fácil solamente mover el elevador y la potencia, en normal mover lo mismo pero con el agregado también del timón, en difícil mover los alerones) o que todas esas cosas ya se muevan de normal y que cada nivel de dificultad vaya aumentando las condiciones meteorólogicas, por ejemplo que cada una de las dificultades vaya cambiando de un día sin viento y completamente despejado hasta una tormenta eléctrica o nieve, condiciones muy complicadas, con viento cruzado real. Dime que es lo que piensas al respecto de esto?"

L2 — Scope decision D chosen by the user: weather axis + per-aircraft control feedback + 28-cell matrix + real lateral model.

L3 — "Timón Q/E, Alabeo A/D, Potencia Flechas" → control map S6. The user did not name a key for pitch; it is mapped to `W`/`S` because those two are the only free pair and pitch is not optional (S3). Flagged to the user for correction.

L4 — "Mientras más al centro estés, mejor calificación obtienes, no caer en el centro simplemente baja la calificación" → alignment is a scored factor (S5), overriding the earlier proposal that off-axis touchdown should fail the landing.

L5 — "4 perfiles, sumando nieve/hielo" → S1 is 4 profiles, 28 cells.

L6 — Design correction made while sizing the work: bank barely affects the glide path at approach bank angles. At 10 degrees of bank the vertical lift component falls 1.5 percent, about 11 fpm on a 740 fpm path; at 20 degrees it is 6 percent, about 45 fpm. The real new difficulty is turn planning and the de-crab at the flare, not lift loss. The spec says so rather than overselling the coupling.

L7 — Rejections kept on record: difficulty tiers that remove the elevator or throttle (they amputate the skill instead of scaling it, and the rudder's only real job in an approach is crosswind correction, which belongs to the weather axis).
