# ARFR experiment integrity

ARFR is a deterministic, normalized-unit simulation, not evidence that a physical device works.

## Timing and measurements

The interactive simulation advances fixed `config.dt` steps using elapsed wall time. Display refresh rate does not set simulation speed. Pause/resume and tab visibility changes reset the wall-time accumulator; catch-up is capped at four steps per frame. Under sustained overload, simulated time can lag wall time rather than locking the interface in an unbounded catch-up loop.

The disturbance-recovery preset schedules its impulse at 35% of the configured simulation duration. Pausing also pauses that schedule; reset or a different preset cancels it.

Mean position error is the arithmetic mean across completed steps. Peak lock quality is the maximum across those steps. At initialization, with no completed steps, mean error is the initial measurement and peak quality is zero. Split/merge flags persist for the entire run even when the bounded visual event log rolls over. A restart clears all cumulative measurements.

## Passport v2

New exports use `arfr-experiment-passport.v2`. Their canonical identity includes:

- Full current configuration, including timestep, grid, bounds, threshold, particle count, source configuration and morphing settings.
- Source commit supplied by the existing Vite build provenance mechanism.
- Elapsed simulation time, completed step count and cumulative statistics.
- Final source geometry, controller/medium configuration, route and result summary.

The export timestamp is excluded from the identity. Configuration and results are copied before asynchronous hashing so subsequent simulation activity cannot mutate the exported record. The verifier rejects unknown schema/canonical-number versions, malformed inputs and modified hashed content. It verifies **content integrity**, not authorship or physical validity. The existing scientific-e13 canonicalization intentionally rounds numbers to 13 significant digits; hashes are not bitwise floating-point fingerprints.

A v2 passport is a **result snapshot**, not an exact replay archive. Interactive parameter edits, disturbance history and variable stepping schedules are not logged. The current configuration alone cannot reconstruct such a session. V1 passports remain readable JSON but are not accepted by the v2 verifier; they lack required provenance fields.

## Validation

Configuration validation rejects non-finite values throughout numerical settings, fractional particle counts, invalid routes, invalid controller limits and grids above 250,000 cells. It bounds source arrays to 64 entries and checks run step counts before execution. These guards catch invalid inputs; they do not establish convergence or validate the phenomenological model.

## Verification

`npm test` covers scientific invariants and regression cases for cumulative exports, topology history, canonical integrity, input validation and equal stepping at 30/60/144 Hz. CI also runs lint, application TypeScript checking and the production build.
