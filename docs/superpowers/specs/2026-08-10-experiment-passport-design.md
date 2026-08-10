# Experiment Passport Reproducibility Design

**Date:** 2026-08-10  
**Status:** Approved  
**Scope:** Browser-only Experiment Passport generation, measurement analysis, deterministic replay, and portable artifact export

## Purpose

Upgrade TARGET LOCK from a ranked model-comparison search into a reproducible falsification machine. A selected candidate must become a complete, auditable Experiment Passport that states the hypothesis, equations, parameter search, expected separation, measurement requirements, platform assumptions, noise budget, decision rule, provenance, and exact software artifacts required to rerun the analysis.

The primary action, **REPRODUCE THIS EXPERIMENT**, must rerun the seeded sweep in the browser, verify the scientific and result digests, analyze any uploaded measurements, and only then assemble a deterministic download bundle. The implementation remains a static Vite application: no backend, account, upload service, or network connection is required.

## Product Principles

1. **Reproduction is an executed check, not an export label.** The UI may show `REPRODUCED` only after a fresh seeded replay matches the recorded scientific specification and result digest.
2. **Prediction and observation remain separate.** Simulated sweep rows are labeled synthetic. Uploaded measurements are labeled observational and retain their original bytes and provenance.
3. **Consistency is not confirmation.** A measurement can falsify the proposed model, exclude the baseline while remaining model-consistent, or remain inconclusive. The UI must never call consistency proof.
4. **Scientific identity excludes incidental metadata.** Session timestamps and UI state do not affect the scientific specification or result hashes.
5. **The bundle is portable and inspectable.** It contains human-readable JSON, CSV, Markdown, SHA-256 checksums, and a self-contained Jupyter notebook.
6. **The app fails closed.** Missing provenance, malformed evidence, failed replay, or failed hashing prevents a fully verified result.

## Architecture

The existing `runTargetLock` search remains the candidate-selection engine. New focused modules wrap its winning `ExperimentCard` in an immutable passport pipeline:

- **Passport builder:** converts a target-lock request, winning card, sweep trace, equations, platform assumptions, and decision rule into a versioned `ExperimentPassport`.
- **Canonical serializer:** produces stable UTF-8 JSON with sorted object keys, explicit omission rules, and portable numeric normalization.
- **Hashing service:** uses the browser Web Crypto API to compute SHA-256 digests for the scientific specification, sweep result, every artifact member, the root manifest, and final ZIP bytes.
- **Replay engine:** reruns the exact sampler and model comparison from the recorded seed, bounds, algorithm version, iteration count, modes, and confidence threshold.
- **Measurement importer:** accepts strict raw-shot or summary-statistics CSV, validates it without mutating state, retains the original bytes, and emits normalized observations.
- **Verdict evaluator:** applies the frozen decision rule and control gates to normalized observational data.
- **Notebook generator:** emits a valid `.ipynb` containing portable Python implementations of the sampler, equations, canonicalization rules, digest verification, and verdict calculation.
- **Deterministic ZIP writer:** emits a standards-compliant, uncompressed ZIP with fixed member ordering, timestamps, permissions, encoding, and metadata. It requires no runtime dependency.
- **Passport workspace UI:** extends the current Experiment Card experience with the passport chain, evidence import, replay progress, verification state, bundle action, and quick downloads.

The source commit is injected at build time. Local builds resolve `git rev-parse HEAD`; hosted builds may supply a deployment commit variable. An unknown commit remains visible and prevents a fully verified badge.

## Experiment Passport Contract

The passport presents and serializes these sections in this order:

1. **Hypothesis:** falsifiable statement, observable, proposed effect, and epistemic classification.
2. **Baseline:** Standard-QM equation, symbol definitions, assumptions, and numerical prediction.
3. **Proposed prediction:** Woodyard-model equation, symbol definitions, validity domain, assumptions, and numerical prediction.
4. **Parameter region:** exact bounds or discrete choices for every sampled parameter, sampler identifier/version, PRNG identifier/version, seed, iteration count, supported modes, platform constraint, and sensitivity constraint.
5. **Expected separation:** signed delta, absolute delta, percentage deviation, and canonical units.
6. **Required precision:** selected `nSigma`, required one-sigma uncertainty, required shot count, and integration feasibility.
7. **Candidate platform:** apparatus identifier, label, supported modes, readout channel, integration assumptions, and source basis.
8. **Noise budget:** single-shot, statistical, systematic, and combined uncertainty with the formula and shot budget used.
9. **Falsification rule:** machine-readable thresholds, explicit natural-language rule, required controls, and inconclusive cases.
10. **Reproducibility:** scientific-specification digest, result digest, software commit, schema/algorithm versions, seed, and replay state. Member, manifest, and final bundle hashes are joined into the complete Passport view after packaging rather than embedded in `passport.json`, which prevents circular artifact identity.
11. **Artifacts:** deterministic filenames, media types, byte sizes, download roles, and the associated `manifest.json` entry for every generated member.

Equations are stored as structured records containing a stable identifier, LaTeX display form, plain-text form, symbol table, assumptions, and implementation version. Arbitrary uploaded code or equations are not executed.

## Deterministic Identity and Hashes

Three identities are intentionally distinct:

- **Scientific specification hash:** canonical inputs, equations, sampler definition, parameter region, platform/noise assumptions, and decision rule. It answers, “Was the same experiment requested?”
- **Result hash:** canonical, ordered, portable sweep rows plus the selected candidate. It answers, “Did the same computation produce the same scientific result?”
- **Bundle hash:** SHA-256 over the final deterministic ZIP bytes. It answers, “Is this the exact same downloadable artifact?”

Every payload member is hashed before the root manifest is created. `manifest.json` lists those payload hashes and carries a root manifest digest calculated over its canonical payload without the root-digest field. `checksums.sha256` lists the payload hashes plus the hash of the final manifest bytes; like conventional checksum files, it omits itself to avoid self-reference. The final ZIP hash covers every member, including `checksums.sha256`. The ZIP cannot contain its own final byte hash without a circular dependency, so that hash is displayed after assembly and included in the downloaded filename.

Portable scientific numbers use a versioned canonical decimal representation at a declared precision. Browser replay must match canonical rows and the result digest exactly. The generated Python notebook independently recomputes floating-point values, checks them against the recorded tolerance, converts them to the same canonical representation, and verifies the same result digest. This avoids treating irrelevant platform-specific last-bit differences as a failed scientific reproduction.

ZIP creation fixes member order, DOS timestamp, flags, permissions, compression method, and filenames. Given the same scientific specification and identical uploaded measurement bytes, it produces identical ZIP bytes.

## Measurement Import

The workspace accepts both raw-shot and summary-statistics CSV files. Uploads never leave the browser.

### Raw-shot CSV

Required columns:

```csv
condition,value,unit
signal,0.503421,probability
signal,0.503188,probability
zero_response,0.500012,probability
```

Optional columns are `run_id`, `timestamp`, and `note`. Unknown columns are retained in the original file but ignored by the evaluator. The importer calculates count, mean, sample standard deviation, and standard error for each condition.

### Summary-statistics CSV

Required columns:

```csv
condition,mean,standard_error,systematic_uncertainty,n,unit
signal,0.503210,0.000050,0.000020,10000,probability
zero_response,0.500010,0.000040,0.000020,10000,probability
```

The importer rejects missing required fields, duplicate condition summaries, unsupported units, invalid or non-finite numbers, negative uncertainty, and non-positive sample counts. It also rejects inputs over the configured byte and row limits before parsing.

Normalized evidence records the input kind, canonical condition names, statistics, combined uncertainty, import warnings, original-file SHA-256, and normalized-data SHA-256. Summary-only evidence is accepted but visibly marked as lower-auditability because individual observations cannot be rechecked.

## Verdict Rule

For the signal condition, let `m` be the measured mean, `sigmaTotal = sqrt(standardError^2 + systematicUncertainty^2)`, `q` the baseline prediction, `w` the proposed-model prediction, and `n` the pre-registered confidence threshold.

- `zBaseline = abs(m - q) / sigmaTotal`
- `zModel = abs(m - w) / sigmaTotal`

Before either directional verdict is eligible, the actual uncertainty must meet the passport's required precision and every required machine-readable control must be present and pass its registered tolerance.

- **MODEL FALSIFIED:** `zModel >= n` and `zBaseline < n`.
- **MODEL-CONSISTENT / BASELINE EXCLUDED:** `zBaseline >= n` and `zModel < n`.
- **INCONCLUSIVE:** insufficient precision; missing or failed controls; both predictions compatible; both predictions excluded; zero/invalid combined uncertainty; or no observational data.

The verdict record includes both z-scores, uncertainty calculation, control results, threshold, reason code, and human-readable explanation. It never modifies the scientific specification or simulated result digests.

## Interaction Design

After TARGET LOCK selects a candidate, the existing Experiment Card expands into an Experiment Passport workspace. It shows the hypothesis-to-threshold chain, provenance state, measurement drop zone, evidence auditability, and one visually dominant action:

**REPRODUCE THIS EXPERIMENT**

Pressing it executes five visible stages:

1. Replay seeded sweep.
2. Verify predictions and result digest.
3. Analyze uploaded measurements, if present.
4. Hash artifact members and root manifest.
5. Assemble and hash the deterministic bundle.

The final state reports computational reproduction separately from the observational verdict. `REPRODUCED` means the seeded computation matched its recorded digests. It does not imply that the proposed model survived or was supported by measurement.

Quick-download controls remain available for individual passport, sweep, measurement, notebook, and checksum files. They are secondary to the single-bundle action and use the exact bytes included in the bundle.

## Bundle Layout

```text
README.md
manifest.json
passport.json
sweep.csv
measurements/original.csv
measurements/normalized.csv
notebook/reproduce.ipynb
checksums.sha256
```

When no observation is uploaded, the bundle omits the two measurement files and records evidence state `NO_OBSERVATIONAL_DATA` in the passport, manifest, README, and notebook output. The bundle remains computationally reproducible.

`README.md` explains the epistemic labels, exact reproduction steps, expected digests, decision rule, file inventory, and how to run the notebook from the extracted bundle. The notebook uses Python standard-library code for parsing, canonicalization, hashing, and computation so it does not require package downloads beyond an existing Jupyter installation.

## Failure Handling and Resource Limits

- Parsing is transactional: invalid evidence does not replace previously accepted evidence.
- Replay, hashing, artifact generation, and ZIP assembly form an atomic pipeline. Any failure clears the verified state and prevents a verified download.
- Web Crypto unavailability produces a blocking provenance error rather than a weak fallback hash.
- Missing source commit produces an `UNVERIFIED_SOFTWARE_PROVENANCE` state.
- File-size and row-count limits are checked before expensive work. Long sweeps yield between chunks so the page remains responsive.
- Object URLs are revoked after use and large imported buffers are released when evidence is replaced or cleared.
- User-provided spreadsheet text is escaped in generated CSV to prevent formula injection when opened in office software.
- ZIP paths are generated from a fixed allowlist; upload filenames never become archive paths.

## Test Strategy

Implementation follows red-green-refactor cycles. Required automated coverage includes:

1. Known canonical-JSON and SHA-256 fixtures.
2. Stable seeded sampler and sweep replay, including an altered-input digest mismatch.
3. Complete passport-field coverage and separation of scientific identity from incidental metadata.
4. Raw-shot parsing, summary parsing, invalid schemas, invalid numbers, unsupported units, duplicate summaries, and configured limits.
5. Every verdict branch and exact threshold boundary, including precision and control gates.
6. Artifact-member hashes, manifest-root calculation, checksum formatting, deterministic ordering, CRC correctness, and byte-identical ZIP generation.
7. Valid notebook JSON, embedded reference vectors, portable canonical values, and digest assertions.
8. Reproduction state transitions: idle, replaying, verified, failed, and measurement verdict states where supported by the current test stack.
9. Existing physics, target-lock, and experiment-card regression suites.
10. Full `npm test`, `npm run lint`, and `npm run build` verification.

## Non-Goals

- Running a Python kernel inside the browser.
- Uploading measurements to a server or storing them across browsers.
- Claiming that a model-consistent result proves the proposed model.
- Supporting arbitrary spreadsheet layouts or automatic unit conversion.
- Replacing peer review, apparatus calibration, preregistration, or independent experimental replication.
- Refactoring unrelated laboratory views or changing the underlying Woodyard equations beyond exposing their current versioned definitions.

## Acceptance Criteria

- A TARGET LOCK winner can be compiled into a passport containing every approved hypothesis-to-artifact field.
- The giant action performs a fresh replay before enabling a verified bundle.
- Identical inputs and measurement bytes yield matching scientific, result, payload-member, manifest, and ZIP hashes.
- A changed seed, search input, model output, threshold, platform assumption, or measurement byte changes the appropriate digest.
- Raw and summary measurements produce auditable normalized evidence and deterministic three-way verdicts.
- Another person can extract the ZIP, run `notebook/reproduce.ipynb`, reproduce the recorded sweep within the declared numeric tolerance, and verify the result digest.
- Separate quick downloads are byte-identical to their corresponding ZIP members.
- No new runtime dependency or backend service is introduced.
