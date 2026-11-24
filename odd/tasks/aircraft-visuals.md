# Aircraft visuals: one cockpit and one exterior per airframe

Seven aircraft, two views each. Today all seven share a generic silhouette and a
single windshield frame, so the aircraft you fly is invisible except for its numbers.

## Specs

**S1.** Every one of the seven aircraft has its own cockpit view and its own
third-person model. Not seven variants of one drawing: seven drawings.

**S2.** Recognisable, not a copy. The user said "no es necesario que sea una copia
exacta". What must be true is that a pilot can tell which aircraft they are in
before reading any label: proportions, window shape, controls, engine count and
where the engines sit.

**S3.** Readability beats fidelity. At 1280x720 the instruments stay the loudest
thing on screen and every needle stays legible. Shared panel geometry stays the
single source of truth, so the instructor demo can still highlight an instrument
by name in every aircraft.

**S4.** No external assets, no dependencies, no build step. Everything is drawn
with Canvas 2D primitives, procedurally, from data.

**S5.** Cockpit differences that must be present: windshield and window shape,
glareshield depth, yoke versus side-stick, throttle quadrant and pedestal,
engine-instrument count matching the engines, analog dials versus glass display,
and for airliners the overhead panel and the centre pedestal.

**S6.** Exterior differences that must be present: engine count and placement
(nose, wing, tail), high wing versus low wing, gear type (fixed, retractable,
twin-axle bogie), tail type (conventional, T-tail), fuselage length and fineness,
and per-aircraft livery colours.

**S7.** The drawn aircraft still tells the truth about state: bank rolls the
silhouette, pitch moves the horizon, gear and flaps show what is extended, and
wheels touch the ground only when the wheels are down.

**S8.** Nothing existing regresses: `C` still toggles view, panel, minimap and the
instructor demo behave as before, and the 119 tests stay green.

**S9.** Tests prove each aircraft draws without `NaN` or `undefined` in approach,
flare, touchdown, rollout and go-around, and that no two aircraft share the same
visual signature (engines, gear, tail, palette).

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | S2,S3,S4 | Visual framework: per-aircraft module registry, shared primitives, `c152` as the reference cockpit and model | done |
| T2 | S1,S5 | `c172` cockpit and model | done |
| T3 | S1,S5 | `c208` cockpit and model | done |
| T4 | S1,S5 | `b350` cockpit and model | done |
| T5 | S1,S5 | `e175` cockpit and model | done |
| T6 | S1,S5 | `b738` cockpit and model | done |
| T7 | S1,S5 | `a388` cockpit and model | done |
| T8 | S7,S9 | Tests across five flight states per aircraft, README update | done |

## Log

L1 — "Creo que el tutorial así como está es suficiente, ahora lo que quiero es que
vayas generando cada uno de los modelos de los aviones, con esto me refiero a su
cabina realista (no es necesario que sea una copia exacta), y su modelo en tercera
persona."

L2 — "No hagas commits hasta que no te diga que vamos a terminar la sesión." All
work is left in the working tree; the commit column stays empty until then.

L3 — Delegation to writers was refused three times by admission (surfaces
parsed as prose, then a lone writer, then "writer bootstrap requires the original
safe project root" because the session cwd is the home directory, not the repo).
The six modules were written inline instead.

L4 — Design decision taken without asking: instrument *styles* differ per
aircraft, instrument *geometry* does not. The graded panel keeps one layout and
one set of regions, so the instructor demo can still highlight an instrument in
any airframe, and readability never depends on which aircraft you picked.

L5 — Three defects were caught by the new tests rather than by eye, which is the
whole reason the stub now records numeric arguments and style assignments:
`disc()` silently received a colour as `radiusY` (NaN radius) in the C152 prop;
every `vignette()` call passed its height where `BOTTOM` was meant, drawing 22 px
past the windshield; and the three fixed-gear aircraft retracted their wheels
because they read `state.gearDown` like the retractable ones.

L6 — The chase span was 64 px for a trainer and 124 px for the A380, which is too
small to tell a T-tail from a conventional one. It is now 150 px and 280 px
(`SPAN_BASE_PX` and `SPAN_PER_MASS_PX` in chase.js), and the model's vertical
anchor is derived from that span so the tail end never runs under the panel.

L7 — "la vista está como si estuvieras viendo desde arriba el avión". Correct, and
it was a design error, not a tuning error: the models were drawn as 2-D silhouettes
in plan view, so no amount of proportion work could make them look like a view from
behind. A 24 ft aircraft seen from 70 ft behind and 24 ft above is foreshortened to
roughly a third of its length; that has to come from a projection.

L8 — `src/render/models/frame3d.js` is the new model format: vertices in feet and
flat faces, projected through the chase camera, painter-sorted, with an automatic
screen anchor so the airframe stays inside the windshield. The C152 is the first
migration: measured silhouette 260 px wide by 82 px tall (ratio 3.19), against
241 x 190 before, which is what a plan view looked like.

L9 — "la vista se queda estática volteando hacia el frente ... no tiene utilidad
mover los alerones". The eye rolls with the aircraft, so the world must roll the
other way: `makeCamera` now takes `rollWithBank` and `project()` rotates about the
windshield centre. The horizon is drawn as a rolled polygon rather than two rects,
otherwise banking exposes an uncovered corner. The chase view keeps rolling the
silhouette instead, which is the equivalent statement from outside.
