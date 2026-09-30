# Experiment workbench

`/experiments` turns the existing Reality Split engine into a bounded, replayable experiment. It compares standard quantum mechanics with the proposed scalar-field coupling, using the same initial state and propagator. Other workstations remain separate domains; this result makes no claim about resource or financial networks.

## Protocol `two-site-coupling-sweep.v1`

Both branches start at site A. Bare site energies are 1, drive angular frequency is 1.5, duration is 12, and the coarse timestep is 0.02. These are the existing engine's simulation units (the propagator uses ℏ = 1); duration is not a calibrated laboratory time in seconds.

The standard branch has g = 0. The proposed branch uses the sampled g, static fields φA = −contrast/2 and φB = contrast/2, with an antisymmetric sinusoidal drive. Every sample is a fresh trajectory; results do not depend on navigation, elapsed wall time, or a random seed.

| Input | Accepted range |
| --- | --- |
| Maximum coupling | 0–2 |
| Static field contrast | 0–2 |
| Inter-site mixing | 0.05–1 |
| Drive amplitude | 0–1 |
| Samples | Integer 2–41; interface presets use 21 |

Sampling is linear, inclusive of zero and the selected maximum. Each sample is also run at timestep 0.01. Strict validation occurs before any computation, including for imported files.

## Readouts and checks

- **Maximum separation:** largest absolute difference in site-B population over the coarse trajectory.
- **Mean separation:** arithmetic mean over the 600 post-step coarse frames. The initial frame is excluded, matching the existing engine.
- **Peak time:** earliest sampled time of the maximum; zero if no separation occurs.
- **Zero-coupling control:** the first sample's maximum separation must be ≤ 10⁻¹².
- **Probability conservation:** maximum absolute deviation of either branch's norm from 1, across both coarse and fine trajectories, must be ≤ 10⁻¹⁰.
- **Half-timestep agreement:** largest absolute site-B population difference between coarse and fine trajectories at matching times, across both branches, must be ≤ 10⁻³ for every coupling.

A failed check stays visible and is preserved in exports. Passing one half-timestep comparison is a numerical diagnostic, not a convergence proof. Separation between model predictions is neither measurement evidence nor statistical significance. The highest point on a discrete sweep is not a global optimum.

## Records and replay

The versioned JSON includes classification (`simulation-only`), full protocol, input specification, sampled results, check outcomes, creation time, and build source commit. SHA-256 covers the body using the shared `scientific-e13.v1` canonicalizer (13 significant digits); it excludes only the top-level digest. The CSV is a convenience export of the result table; use JSON for replay and provenance.

Import accepts at most 100,000 bytes. The app rejects unknown fields, unsupported schemas or protocols, non-finite or out-of-range inputs, bad digests, missing rows, altered checks, and mismatched results. Replay compares every numeric result to a fresh run at absolute tolerance 10⁻¹⁰. Checks must match exactly. Small cross-runtime floating-point differences are tolerated; larger differences are rejected rather than silently replaced.

A source-commit mismatch is disclosed even when results agree. A digest detects accidental or unrehashed modification; anyone can compute a new digest. Recomputing catches fabricated results but does not authenticate an author, establish historical source provenance, or prove physical validity. An imported record can pass replay while containing failed numerical checks—inspect both statuses.

Settings edits do not alter the completed record. Until another run completes, the chart and downloads retain the old run and a stale-settings notice appears. An invalid import leaves the previous result intact. Presets are starting points, not stored findings.

## Development

The workbench is lazy-loaded at its own route and needs no server or credentials. `src/experiments/engine.ts` owns validation, computation, serialization, and replay; the view consumes this interface. Tests exercise controls, deterministic results, invalid workload bounds, corruption, rehashed fabricated results, protocol mismatches, and CSV output.

Run `npm run verify` for lint, TypeScript, the invariant suite, and production compilation. The pre-existing shared UI components currently emit eight ESLint fast-refresh warnings. They do not fail verification.
