# Aviation Landing

Seven aircraft, one approach each. A browser landing simulator: cockpit view,
an instrument panel, and a side-profile minimap that tells you whether you are
high or low. No build step, no dependencies, no image or sound assets — every
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
| `↑` / `↓` (or `W` / `S`) | Nose up / nose down |
| `←` / `→` (or `A` / `D`) | Crab left / right |
| `E` / `Q` | More / less power |
| `F` / `V` | Flaps down / up one detent |
| `G` | Gear up/down (retractable aircraft only) |
| `X` | Spoilers (jets only) |
| `Space` | Wheel brakes (hold, on the ground) |
| `B` | Reverse thrust (hold, on the ground) |
| `P` | Pause |
| `R` | Restart the level |
| `Esc` | Back to the menu |

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

## How a landing is graded

A landing fails when:

- the sink rate at touchdown is above **300 fpm** (gear collapse);
- it touches down **before the threshold** (undershoot);
- it touches down **past the touchdown zone**, 60% of the runway or 3000 ft,
  whichever is shorter (overrun);
- it is more than **74 ft off the centreline** (off the runway edge);
- the speed is more than **10 kt** off the aircraft's reference speed;
- the rollout runs off the end of the runway.

Otherwise points come from sink rate, speed, lateral offset and how close the
touchdown was to where a stabilised approach with a normal flare actually
touches down (about 1600 ft past the threshold). 90 points is gold, 78 silver,
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

54 tests in four groups: the physics and grading, the projection math, a render
smoke test that draws all three views on every level and phase through a stub
canvas context, and an end-to-end playthrough that flies all seven levels
through the real keyboard input path and requires each to score a medal.

## Layout

```
index.html            canvas + CSS, nothing else
src/aircraft.js       the seven-aircraft ladder, with real envelopes
src/levels.js         one level per aircraft: runway, wind, setup, briefing
src/physics.js        flight model, glide path, touchdown grading
src/game.js           game states, input, scoring, best results (DOM-free)
src/main.js           canvas, keyboard and requestAnimationFrame wiring
src/render/cockpit.js   windshield: runway in perspective, approach lights, PAPI
src/render/panel.js     instruments: attitude, tapes, VSI, glideslope/localizer
src/render/minimap.js   the side profile with the glide path and your trend
src/render/projection.js pure perspective math
test/                 the four test groups
```
