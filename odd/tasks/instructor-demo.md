# Instructor demo

A guided demonstration: the instructor takes the controls, flies the approach and
lands while narrating each step, so a player who does not know what a flare or a
vertical speed is can watch one before trying it.

The pilot is not new code. `test/helpers/autopilot.js` already flew the level in
the test suite; it moves to `src/autopilot.js` and the demo drives it.

## Specs

S1 — From the briefing, `D` starts a demo: the instructor flies the whole
approach and the landing, in real time, with the real physics and the real
instruments. The player only watches.

S2 — The instructor narrates in the first person, in ordered steps, each shown
while the aircraft is in that part of the approach, and the instrument the step
is about is highlighted on the panel.

S3 — The demo cannot be steered. Keys other than pause and back do nothing while
the instructor has the controls.

S4 — The demo awards nothing: no medal, no points, no cell record. It ends by
returning to the briefing.

S5 — The demonstration pilot must look like a competent pilot: smooth throttle,
no oscillation, within a few knots of reference speed. The test autopilot's
bang-bang throttle is not acceptable on screen.

S6 — The player's own approach is unchanged: same physics, same grading, same
controls.

## Narration script

First person, present tense, short beats. Each beat names the thing the pilot is
doing and the number that matters, never a recipe to memorise.

| # | Fires when | Instrument | Caption |
|---|---|---|---|
| 1 | demo starts | none | "I have the controls. Two miles out, already set up: flaps full, gear down." |
| 2 | immediately after | path | "That three degree path is my aim point. At 65 knots it means about 340 feet per minute of descent." |
| 3 | 10 s in, or above 600 ft | speed | "Pitch is my path, power is my speed. Nose up bleeds speed, nose down buys it back." |
| 4 | above 500 ft | path | "Two diamonds: the vertical one is the glide path, the horizontal one is the centreline." |
| 5 | below 300 ft | vsi | "Three hundred feet. The wind is pushing us right, so I hold a crab into it." |
| 6 | below 50 ft | vsi | "Fifty feet. Now I flare: nose up until the sink decays to about 150 feet per minute." |
| 7 | touchdown | none | "Down. Timely, not gentle — under 300 feet per minute or the gear collapses." |
| 8 | rollout | power | "Brakes and reversers. Stopping is part of the landing, not an afterthought." |

Written in English because the whole interface is English; the captions are
interface copy and must match the panel labels a player reads.

## Tasks

| ID | Spec | Work |
|----|------|------|
| T1 | S5 | Move the autopilot to `src/autopilot.js` with a smooth throttle target, tests re-export it |
| T2 | S1,S3,S4 | Demo mode in the game orchestrator: instructor controls, no medals, back to briefing |
| T3 | S2 | Ordered narration cues and instrument highlighting |
| T4 | S5,S6 | Tests: the demo lands, the captions fire in order, keys are inert, speed stays near reference |

## Log

L1 — "Acabo de leer que usaste un autopilot para el test. Deberíamos de agregar una opción con la que pudiéramos ver como se aterriza antes de tener que hacerlo, como un pequeño tutorial para alguien que no tenga ni idea de que es un flare o la velocidad vertical. No sé como implementarlo, dame ideas"

L2 — "Podríamos fingir que el instructor tiene los controles del avión, así estamos viendo como el desciende y aterriza mientras nos narra sus pasos."

L3 — Scope decision from L2: the demo is the instructor flying and narrating, not a pause-and-prompt tutorial and not instrument tooltips. Recorded as S1-S6. Guided practice and `?` callouts stay unbuilt for now.
