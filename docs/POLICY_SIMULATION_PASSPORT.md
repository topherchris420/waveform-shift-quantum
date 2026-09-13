# Policy simulation passport

`policy-simulation-passport.v1` is an immutable JSON record of one deterministic run. It embeds the validated scenario, evidence registry, actors, starting balance sheets, exposures, collateral, facilities, markets, shocks, behavior and institutional assumptions, seed, complete result/timeline/events, model cards, build version, source commit when injected at build time, and generation timestamp.

## Identity and integrity

The lab canonicalizes plain JSON by recursively sorting object keys and preserving JavaScript's round-trip representation for every finite number. It computes:

- `inputHash`: SHA-256 of the canonical scenario;
- `outcomeHash`: SHA-256 of the canonical complete result;
- `identityHash`: SHA-256 of every passport field except the identity hash itself;
- `runId`: a stable prefix of the input hash.

Verification reparses the strict scenario, recomputes all hashes, and checks the model/canonical versions. This detects accidental or deliberate content changes. It is an integrity check, not a digital signature: a party that can replace the passport can recompute hashes. It does not establish authorship, authenticity, empirical validity, policy validity, or Federal Reserve approval.

## Exact replay

Replay first verifies the envelope, reruns the embedded scenario with the matching model version and JavaScript arithmetic, and compares the complete result hash. The timestamp is not part of the simulated result, so repeated passports may have different identity hashes while their deterministic outcome hashes match.

Exact replay assumes the recorded model implementation and compatible runtime arithmetic. Changes to model version, event order, numeric operations, or canonicalization are allowed to break equivalence and must be versioned. Robustness and falsification are `NOT_EVALUATED` in a single-run passport; dedicated research exports record those exercises.

Passport imports are bounded to 40 MB, reject unsafe object keys, and execute no imported code. Schema validation does not make an untrusted file confidential or authentic.
