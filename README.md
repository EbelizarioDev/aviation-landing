# Aviation Landing

Seven aircraft, four skies, twenty-eight approaches. A browser landing simulator:
cockpit view, an instrument panel, and a side-profile minimap that tells you
whether you are high or low. No build step, no dependencies, no image or sound assets — every
pixel is drawn with canvas primitives.

## Run it

ES modules need to be served over HTTP:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` straight from the filesystem will not work.

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` | Nose up / nose down |
| `A` / `D` | Aileron: bank left / right |
| `Q` / `E` | Rudder: yaw left / right |
| `↑` / `↓` | More / less power |
| `F` / `V` | Flaps down / up one detent |
| `G` | Gear up/down (retractable aircraft only) |
| `X` | Spoilers (jets only) |
| `C` | Switch view: cockpit / chase camera |
| `Space` | Wheel brakes (hold, on the ground) |
| `B` | Reverse thrust (hold, on the ground) |
| `P` | Pause |
| `R` | Restart the level |
| `Esc` | Back to the menu |

In the menu: `↑`/`↓` choose the aircraft, `←`/`→` choose the weather, `ENTER`
flies. In the briefing, **`D` hands the controls to the instructor**, who flies
the whole approach and landing while narrating each step and highlighting the
instrument he is talking about. It awards nothing and gives you back a fresh
approach, so you can watch first and fly second. Each aircraft only exposes the systems it actually has: press `G` on the
C152 and it answers *"GEAR: FIXED ON THIS AIRCRAFT"* instead of doing nothing.
Pitch and throttle are on every aircraft, because without them nothing flies.

`C` only changes where you look from: the instrument panel and the minimap stay
in both views, so nothing you need to read ever disappears.

The aircraft flies a real lateral axis. A bank turns the flight path at
`g·tan(phi)/V`, so correcting a drift is a planning problem: ten degrees of bank
slides you 280 ft sideways in ten seconds. The rudder does not turn the aircraft
— it points the nose off the flight path, which is how you **de-crab** at the
flare: nose on the runway axis, sideslip holding the track. Banking also costs
glide path (the vertical lift component falls by `1 - cos(phi)`) and raises the
stall speed by `sqrt(1/cos(phi))`.

Below 50 ft the panel shows `FLARE`: raise the nose until the sink dies out.
Touching down at 700 fpm is a gear collapse even if you are perfectly aligned.

## The seven levels

| Level | Aircraft | Approach | What the level adds |
| --- | --- | --- | --- |
| 1 | Cessna 152 | 65 kt | Throttle and pitch, nothing else |
| 2 | Cessna 172S | 70 kt | Flaps: they slow you down and hold you up |
| 3 | Cessna 208B Grand Caravan | 90 kt | Turbine response with three tonnes of mass, and beta reverse |
| 4 | Beechcraft King Air 350 | 110 kt | Retractable gear and its limit speeds |
| 5 | Embraer E175 | 135 kt | Jet spool lag: ask for power five seconds early |
| 6 | Boeing 737-800 | 140 kt | Flaps 30, spoilers and reversers: stopping costs runway |
| 7 | Airbus A380-800 | 145 kt | Fifteen knots of crosswind on a wet runway |

Levels 2 and 3 start with the flaps up, levels 4 to 7 start clean (gear and
flaps up). Configuring the aircraft is part of the job.

## Weather, the difficulty axis

Weather is independent of the aircraft: four profiles, and any aircraft can fly
any of them — 28 cells, each one with its own best medal. A level carries a
default profile and the menu lets you overrule it.

| Profile | Crosswind | Gusts | Visibility | Runway |
| --- | --- | --- | --- | --- |
| Calm | 0 kt | none | 10 nm | dry |
| Windy | 12 kt | 5 kt | 10 nm | dry |
| Storm | 18 kt | 8 kt | 3 nm | wet (62% braking) |
| Snow | 8 kt | 4 kt | 2 nm | contaminated (35% braking) |

Gusts are deterministic and fade to nothing at the surface, so a bad touchdown
is never a gust's fault. Every one of the 28 cells is flown by the keyboard
playthrough in the test suite, which is what stops "harder" from meaning
"impossible". A profile whose crosswind is beyond the aircraft's
demonstrated limit is flagged in the briefing — the C152 in a storm is a bad
idea in real life, and the game says so instead of pretending otherwise.

## How a landing is graded

A landing fails when:

- the sink rate at touchdown is above **300 fpm** (gear collapse);
- it touches down **before the threshold** (undershoot);
- it touches down **past the touchdown zone**, 60% of the runway or 3000 ft,
  whichever is shorter (overrun);
- it is more than **74 ft off the centreline** (off the runway edge);
- the speed is more than **10 kt** off the aircraft's reference speed;
- the rollout runs off the end of the runway.

Otherwise points come from sink rate, speed, lateral offset, nose alignment with
the runway axis, and how close the touchdown was to where a stabilised approach
with a normal flare actually touches down (about 1600 ft past the threshold).
Alignment is scored, never fatal: touching down crabbed costs points and never
collapses the gear. 90 points is gold, 78 silver,
62 bronze.

## The physics, briefly

The aircraft is a point on a flight path, not a rigid body. What is modelled
honestly is the energy relationship:

```
gamma  = pitch - angle of attack     (negative gamma = descending)
VSI    = speed * sin(gamma)
dSpeed = thrust - drag - g * sin(gamma)
```

Nosing up raises the flight path and bleeds speed. Nosing down trades altitude
for speed. Below the stall speed the angle of attack saturates and the nose
drops on its own, which is exactly the trap the game is built around. Thrust
answers with the aircraft's real spool delay, and the 3° glide path crosses the
threshold at 50 ft the way a real ILS does — which is why the touchdown happens
around 950 ft of geometry plus the flare, and not on the threshold itself.

## Tests

```sh
npm test        # node --test test/
```

119 tests in nine groups: the physics and grading, the projection math, a render
smoke test that draws every view on every level and phase through a stub canvas
context, the camera view toggle, the lateral model and alignment grading, the weather profiles, the 28-cell matrix, the control map per aircraft, the instructor demo, and an
end-to-end playthrough that flies all
seven levels through the real keyboard input path and requires each to score a
medal.

## Layout

```
index.html            canvas + CSS, nothing else
src/aircraft.js       the seven-aircraft ladder, with real envelopes
src/levels.js         one level per aircraft: runway, setup, weather, briefing
src/weather.js        the four weather profiles, braking, gusts, visibility
src/autopilot.js      the demonstration pilot (and the one the tests fly)
src/instructor.js     the narration beats and their triggers
src/physics.js        flight model, glide path, touchdown grading
src/game.js           game states, input, control map, scoring, per-cell bests
src/main.js           canvas, keyboard and requestAnimationFrame wiring
src/render/scene.js     sky, ground, runway, approach lights, PAPI (shared)
src/render/cockpit.js   first person: the scene framed by the windshield
src/render/chase.js     third person: chase camera and the aircraft silhouette
src/render/panel.js     instruments: attitude, tapes, VSI, glideslope/localizer
src/render/minimap.js   the side profile with the glide path and your trend
src/render/projection.js pure perspective math
test/                 eight test groups
test/helpers/          canvas stub, autopilot, keyboard pilot
```
