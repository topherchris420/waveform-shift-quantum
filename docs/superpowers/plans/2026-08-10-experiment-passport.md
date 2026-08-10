# Experiment Passport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every successful TARGET LOCK result into a browser-only, cryptographically verifiable Experiment Passport that replays the exact sweep, evaluates uploaded real measurements, and exports a deterministic single-file reproduction bundle.

**Architecture:** Preserve `runTargetLock` as the compatibility API while adding a detailed replay result containing ordered sweep rows and winner provenance. Build the passport, evidence verdict, notebook, manifest, checksums, and ZIP through focused pure modules under `src/lib/passport/`; the Discovery panel owns orchestration because it already owns the complete Target Lock request and selected card.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Web Crypto, browser File/Blob APIs, generated Python 3/Jupyter notebook, dependency-free stored-ZIP writer.

---

## File Map

- `src/lib/passport/types.ts` — versioned passport, evidence, verdict, artifact, and reproduction contracts.
- `src/lib/passport/canonical.ts` — portable numbers, canonical JSON, UTF-8, and SHA-256.
- `src/lib/passport/equations.ts` — structured equations for each sweep mode.
- `src/lib/passport/passport.ts` — passport compilation from a detailed replay.
- `src/lib/passport/measurement.ts` and `verdict.ts` — strict evidence ingestion and decisions.
- `src/lib/passport/notebook.ts`, `files.ts`, `zip.ts`, and `reproduce.ts` — portable artifact pipeline.
- `src/lib/download.ts` — shared browser byte download helper.
- `src/quantum/components/ExperimentPassportWorkspace.tsx` — evidence, replay, verdict, hashes, and downloads.
- Focused tests under `src/test/passport*.test.ts`.

Modify `anomalyEngine.ts`, `targetLock.ts`, `catalyst.ts`, `DiscoveryModePanel.tsx`, `ExperimentCardView.tsx`, `vite.config.ts`, `src/vite-env.d.ts`, and `README.md`. Do not move Target Lock state into `QuantumLab`, rewrite Catalyst, or add a package.

### Task 1: Canonical identity and real software provenance

**Files:**
- Create: `src/lib/passport/canonical.ts`
- Create: `src/test/passportCanonical.test.ts`
- Modify: `src/lib/catalyst.ts:125-154`
- Modify: `vite.config.ts:1-18`
- Modify: `src/vite-env.d.ts:1`

- [ ] **Step 1: Write the failing canonicalization and hashing tests**

```ts
import { describe, expect, it } from 'vitest';
import { canonicalJson, canonicalNumber, sha256Bytes, sha256Text, utf8 } from '../lib/passport/canonical';

describe('passport canonical identity', () => {
  it('sorts keys and uses one portable numeric form', () => {
    expect(canonicalNumber(-0)).toBe('0');
    expect(canonicalNumber(1.25)).toBe('1.250000000000e+0');
    expect(canonicalJson({ z: -0, a: [1.25, true, null] })).toBe(
      '{a:[1.250000000000e+0,true,null],z:0}'
    );
  });
  it('omits only explicitly named keys', () => {
    expect(canonicalJson({ createdAt: 'session', value: 2 }, { omitKeys: ['createdAt'] }))
      .toBe('{value:2.000000000000e+0}');
    expect(() => canonicalJson({ value: undefined })).toThrow(/undefined/);
  });
  it('matches the published SHA-256 abc fixture', async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    await expect(sha256Text('abc')).resolves.toBe(expected);
    await expect(sha256Bytes(utf8('abc'))).resolves.toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/test/passportCanonical.test.ts`
Expected: FAIL because `../lib/passport/canonical` does not exist.

- [ ] **Step 3: Implement the canonical primitives**

```ts
export const CANONICAL_NUMBER_VERSION = 'scientific-e13.v1';
export interface CanonicalOptions { omitKeys?: readonly string[] }

export function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError('Canonical JSON rejects non-finite numbers');
  if (Object.is(value, -0) || value === 0) return '0';
  return value.toExponential(12);
}

function encode(value: unknown, omitted: ReadonlySet<string>): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return canonicalNumber(value);
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => encode(item, omitted)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((key) => !omitted.has(key)).sort().map((key) => {
        const child = (value as Record<string, unknown>)[key];
        if (child === undefined) throw new TypeError(`Canonical JSON rejects undefined at ${key}`);
        return `${JSON.stringify(key)}:${encode(child, omitted)}`;
      }).join(',')}}`;
  }
  throw new TypeError(`Canonical JSON rejects ${typeof value}`);
}

export function canonicalJson(value: unknown, options: CanonicalOptions = {}): string {
  return encode(value, new Set(options.omitKeys ?? []));
}
export const utf8 = (text: string) => new TextEncoder().encode(text);
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', source);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export const sha256Text = (text: string) => sha256Bytes(utf8(text));
```

- [ ] **Step 4: Reuse the helpers in Catalyst and inject the real commit**

```ts
// catalyst.ts: delete the two local helper bodies, preserving public names
import { canonicalJson as canonicalizeJson, sha256Text as sha256 } from './passport/canonical';
export { canonicalizeJson, sha256 };
```

```ts
// vite.config.ts
import { execFileSync } from 'node:child_process';
function sourceCommit(): string {
  const supplied = process.env.VITE_SOURCE_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (supplied?.trim()) return supplied.trim();
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}
// Add inside defineConfig:
define: { __SOURCE_COMMIT__: JSON.stringify(sourceCommit()) },
```

```ts
// src/vite-env.d.ts
/// <reference types=vite/client />
declare const __SOURCE_COMMIT__: string;
```

Replace Catalyst's hardcoded commit with `__SOURCE_COMMIT__`.

- [ ] **Step 5: Verify GREEN and regressions**

Run: `npm test -- src/test/passportCanonical.test.ts`
Expected: PASS, 3 tests.

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit with Lore trailers**

Stage `src/lib/passport/canonical.ts`, its test, `catalyst.ts`, `vite.config.ts`, and `src/vite-env.d.ts`. Commit with intent `Make scientific identity portable across runtimes`, confidence `high`, scope risk `narrow`, and the focused/full test evidence.

### Task 2: Auditable Target Lock replay trace

**Files:**
- Modify: `src/lib/anomalyEngine.ts:1-61`
- Modify: `src/lib/targetLock.ts:36-296`
- Modify: `src/test/targetLock.test.ts`
- Create: `src/test/passportReplay.test.ts`

- [ ] **Step 1: Write failing sampler and detailed-replay tests**

```ts
// Add to targetLock.test.ts
import { PARAMETER_REGION, PRNG_ID, SAMPLER_ID } from '../lib/anomalyEngine';
it('publishes a versioned region without changing the seed-42 fixture', () => {
  expect(PRNG_ID).toBe('mulberry32.v1');
  expect(SAMPLER_ID).toBe('indexed-parameter-region.v1');
  expect(PARAMETER_REGION.g).toEqual({ min: 0.1, max: 3, decimals: 3 });
  expect(sampleParameters(42, 0)).toEqual({
    g: 0.707, delta: 0.908, phiA: 1.99, phiB: -1.916,
    alpha: 0.321, gamma: 2.109, omega_w: 11.56,
  });
});
```

```ts
// src/test/passportReplay.test.ts
import { describe, expect, it } from 'vitest';
import { ANY_PLATFORM_ID } from '../lib/platforms';
import { runTargetLock, runTargetLockDetailed, runTargetLockDetailedAsync } from '../lib/targetLock';

const request = { platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 42,
  iterations: 40, modes: ['two_site', 'scalar_kernel'] as const, nSigma: 5 };

describe('Target Lock replay trace', () => {
  it('preserves compatibility and emits stable ordered rows', () => {
    const detailed = runTargetLockDetailed(request);
    expect(detailed.result).toEqual(runTargetLock(request));
    expect(detailed.trace.length).toBeGreaterThanOrEqual(request.iterations);
    expect(detailed.trace.map((row) => row.sequence))
      .toEqual(detailed.trace.map((_, index) => index));
    expect(runTargetLockDetailed(request)).toEqual(detailed);
  });
  it('connects every card to its sample and platform', () => {
    const detailed = runTargetLockDetailed(request);
    for (const card of detailed.result.cards) {
      const source = detailed.selections[card.id];
      expect(detailed.trace.some((row) => row.sampleIndex === source.sampleIndex &&
        row.platformId === card.platform.id && row.decision === source.decision)).toBe(true);
    }
  });
  it('yields between bounded chunks without changing the result', async () => {
    let yields = 0;
    const asyncRun = await runTargetLockDetailedAsync(request, {
      chunkSize: 7, yieldControl: async () => { yields += 1; },
    });
    expect(asyncRun).toEqual(runTargetLockDetailed(request));
    expect(yields).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/test/targetLock.test.ts src/test/passportReplay.test.ts`
Expected: FAIL for the new sampler metadata and `runTargetLockDetailed` exports.

- [ ] **Step 3: Publish one sampler definition and consume it**

```ts
export const PRNG_ID = 'mulberry32.v1';
export const SAMPLER_ID = 'indexed-parameter-region.v1';
export interface ParameterRange { min: number; max: number; decimals: number }
export const PARAMETER_REGION = {
  g: { min: 0.1, max: 3.0, decimals: 3 },
  delta: { min: 0.05, max: 1.0, decimals: 3 },
  phiA: { min: -2.0, max: 2.0, decimals: 3 },
  phiB: { min: -2.0, max: 2.0, decimals: 3 },
  alpha: { min: 0.1, max: 3.0, decimals: 3 },
  gamma: { min: 0.3, max: 3.0, decimals: 3 },
  omega_w: { min: 5.0, max: 25.0, decimals: 2 },
} as const satisfies Record<keyof AnomalyParameters, ParameterRange>;

const draw = (rng: () => number, range: ParameterRange) =>
  Number((range.min + rng() * (range.max - range.min)).toFixed(range.decimals));
```

Use `draw(rng, PARAMETER_REGION.<field>)` in `sampleParameters`; keep seed mixing and the two discarded draws unchanged.

- [ ] **Step 4: Add detailed replay contracts**

```ts
export type SweepDecision = 'unstable' | 'degenerate_field' | 'degenerate_output' |
  'below_sensitivity' | 'unsupported_mode' | 'below_systematic_floor' |
  'integration_limited' | 'accepted';

export interface SweepTraceRow {
  sequence: number;
  sampleIndex: number;
  mode: SweepMode;
  platformId: string | null;
  parameters: AnomalyParameters;
  standardPrediction: number | null;
  modelPrediction: number | null;
  delta: number | null;
  significance: number | null;
  requiredShots: number | null;
  testability: Testability | null;
  modelValidity: ModelValidity | null;
  decision: SweepDecision;
}

export interface TargetLockSelection {
  cardId: string; rank: number; sampleIndex: number; platformId: string;
  mode: SweepMode; decision: 'accepted' | 'integration_limited';
}
export interface TargetLockDetailedResult {
  result: TargetLockResult;
  trace: SweepTraceRow[];
  selections: Record<string, TargetLockSelection>;
}
```

Add `sampleIndex` to private `ScoredCandidate`. Assign mode before early rejection. Append one row for sample-level rejections and one for each platform evaluation with `sequence = trace.length`. Store non-finite shot counts as `null` in trace rows so canonical JSON stays valid.

- [ ] **Step 5: Preserve the old API as a wrapper**

```ts
export function runTargetLock(request: TargetLockRequest): TargetLockResult {
  return runTargetLockDetailed(request).result;
}
export function runTargetLockDetailed(request: TargetLockRequest): TargetLockDetailedResult {
  const runner = createTargetLockRunner(request);
  while (!runner.done) runner.step();
  return runner.finish();
}
export async function runTargetLockDetailedAsync(request: TargetLockRequest,
  options: { chunkSize?: number; yieldControl?: () => Promise<void> } = {}) {
  const runner = createTargetLockRunner(request);
  const chunkSize = options.chunkSize ?? 50;
  const yieldControl = options.yieldControl ?? (() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve())));
  while (!runner.done) {
    for (let count = 0; count < chunkSize && !runner.done; count += 1) runner.step();
    if (!runner.done) await yieldControl();
  }
  return runner.finish();
}
```

`createTargetLockRunner` owns the former loop accumulator, exposes one-index `step()`, and runs unchanged ranking/dedupe/card/guidance logic once in `finish()`. Keep all legacy outputs compatible. Do not hash inside this physics layer.

- [ ] **Step 6: Verify GREEN and commit**

Run: `npm test -- src/test/targetLock.test.ts src/test/passportReplay.test.ts`
Expected: PASS. Then run `npm test`; expected: all tests PASS.

Stage the four Task 2 files. Commit with intent `Expose why Target Lock chose each experiment`, constraint that ranking/card output is compatible, directive that sampler/ranking changes require new version fixtures, confidence `high`, scope risk `moderate`, and both test commands in `Tested:`.

### Task 3: Compile the complete scientific Passport

**Files:**
- Create: `src/lib/passport/types.ts`
- Create: `src/lib/passport/equations.ts`
- Create: `src/lib/passport/passport.ts`
- Create: `src/test/passportCompiler.test.ts`

- [ ] **Step 1: Write the failing passport contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { ANY_PLATFORM_ID } from '../lib/platforms';
import { runTargetLockDetailed } from '../lib/targetLock';
import { compilePassport } from '../lib/passport/passport';

const replay = () => runTargetLockDetailed({
  platformId: ANY_PLATFORM_ID, sensitivityLimit: 0, seed: 21, iterations: 80, nSigma: 5,
});

describe('Experiment Passport compiler', () => {
  it('covers the hypothesis-to-artifact scientific chain', async () => {
    const run = replay();
    const compiled = await compilePassport(run, run.result.cards[0].id, 'abc123');
    expect(compiled.passport.hypothesis.statement).toContain('Woodyard');
    expect(compiled.passport.baseline.equation.latex).not.toBe('');
    expect(compiled.passport.proposed.equation.latex).not.toBe('');
    expect(compiled.passport.parameterRegion.seed).toBe(21);
    expect(compiled.passport.expectedDelta.signed).toBe(run.result.cards[0].delta);
    expect(compiled.passport.noiseBudget.total).toBe(run.result.cards[0].uncertainty.total);
    expect(compiled.passport.falsification.thresholdSigma).toBe(5);
    expect(compiled.passport.software.commit).toBe('abc123');
    expect(compiled.passport.artifacts.map((item) => item.path)).toContain('notebook/reproduce.ipynb');
  });

  it('is stable across fresh runs and excludes card timestamps from identity', async () => {
    const aRun = replay();
    const a = await compilePassport(aRun, aRun.result.cards[0].id, 'abc123');
    const bRun = replay();
    const b = await compilePassport(bRun, bRun.result.cards[0].id, 'abc123');
    expect(a.scientificDigest).toBe(b.scientificDigest);
    expect(a.resultDigest).toBe(b.resultDigest);
    expect(JSON.stringify(a.passport)).not.toContain('createdAt');
  });

  it('marks unknown software provenance as unverified', async () => {
    const run = replay();
    const compiled = await compilePassport(run, run.result.cards[0].id, 'unknown');
    expect(compiled.passport.software.provenance).toBe('unverified');
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/test/passportCompiler.test.ts`
Expected: FAIL because the Passport modules do not exist.

- [ ] **Step 3: Define the versioned domain and equation catalog**

```ts
// types.ts — keep these records JSON-safe (no Date, Map, Set, Infinity, or undefined)
export type EvidenceState = 'no_observational_data' | 'raw' | 'summary';
export type ObservationalVerdict = 'model_falsified' |
  'model_consistent_baseline_excluded' | 'inconclusive';
export interface EquationSpec {
  id: string; version: string; latex: string; plain: string;
  symbols: Record<string, string>; assumptions: string[];
}
export interface ControlRule {
  id: 'zero_response'; condition: 'zero_response'; expected: 'baseline'; maxZ: number;
}
export interface ArtifactDescriptor { path: string; mediaType: string; role: string }
export interface PlatformSnapshot { id: string; label: string; observable: string;
  readoutChannel: string; singleShotResolution: number; systematicFloor: number;
  practicalShots: number; integrationTime: string; systematics: string[];
  supportedModes: string[]; basis: string }
export interface ParameterBound { min: number; max: number; decimals: number }
export interface ExperimentPassport {
  schemaVersion: 'experiment-passport.v1'; id: string;
  hypothesis: { statement: string; observable: string; unit: string; status: 'testable_prediction' };
  baseline: { equation: EquationSpec; prediction: number; status: 'established_physics' };
  proposed: { equation: EquationSpec; prediction: number; status: 'proposed_model'; validity: string };
  parameterRegion: { sampler: string; prng: string;
    bounds: Record<'g' | 'delta' | 'phiA' | 'phiB' | 'alpha' | 'gamma' | 'omega_w', ParameterBound>;
    seed: number;
    iterations: number; modes: string[]; platformId: string; sensitivityLimit: number };
  expectedDelta: { signed: number; absolute: number; percent: number; unit: string };
  precision: { thresholdSigma: number; requiredOneSigma: number; requiredShots: number | null };
  platform: PlatformSnapshot;
  noiseBudget: { singleShot: number; statistical: number; systematic: number;
    total: number; shots: number; formula: string };
  falsification: { thresholdSigma: number; rule: string; controls: ControlRule[] };
  software: { commit: string; provenance: 'verified' | 'unverified';
    canonicalVersion: string; samplerVersion: string; modelVersion: string };
  reproducibility: { scientificDigest: string; resultDigest: string; seed: number };
  evidenceState: EvidenceState;
  artifacts: ArtifactDescriptor[];
}
export interface CompiledPassport {
  passport: ExperimentPassport; scientificDigest: string; resultDigest: string;
  selectedCardId: string;
}
```

In `equations.ts`, export `equationsFor(mode)` with explicit entries for `two_site`, `scalar_kernel`, and `teleportation`. Use the exact implementation equations: baseline `g = 0` two-site Hamiltonian versus `H = H0 + gφσz`; normalized `P_loc = χP_B / ∫χP_B` with `χ = exp(αL)`; and Bennett/Werner fidelity for teleportation. Include all fixed constants used by `kernelRegionSeparation` in its assumptions.

- [ ] **Step 4: Implement deterministic passport compilation**

```ts
export async function compilePassport(
  detailed: TargetLockDetailedResult,
  cardId: string,
  sourceCommit = __SOURCE_COMMIT__,
): Promise<CompiledPassport> {
  const card = detailed.result.cards.find((item) => item.id === cardId);
  const selection = detailed.selections[cardId];
  if (!card || !selection) throw new Error(`Card ${cardId} is not part of this Target Lock replay`);

  const scientific = buildScientificSpecification(detailed.result.request, card, selection);
  const scientificDigest = await sha256Text(canonicalJson(scientific));
  const resultDigest = await sha256Text(canonicalJson({
    trace: detailed.trace, selection,
    selectedPrediction: { standard: card.standardPrediction, model: card.modelPrediction,
      delta: card.delta, significance: card.significance },
  }));
  const passport: ExperimentPassport = {
    ...scientific,
    schemaVersion: 'experiment-passport.v1',
    id: `PASS-${scientificDigest.slice(0, 16).toUpperCase()}`,
    software: { commit: sourceCommit,
      provenance: sourceCommit === 'unknown' ? 'unverified' : 'verified',
      canonicalVersion: CANONICAL_NUMBER_VERSION, samplerVersion: SAMPLER_ID,
      modelVersion: 'Woodyard-2026.v1' },
    reproducibility: { scientificDigest, resultDigest, seed: detailed.result.request.seed },
    evidenceState: 'no_observational_data',
    artifacts: ARTIFACT_DESCRIPTORS,
  };
  return { passport, scientificDigest, resultDigest, selectedCardId: cardId };
}
```

`buildScientificSpecification` must copy the card's platform/noise values, convert infinite shots to `null`, attach `PARAMETER_REGION`, use `equationsFor(card.experimentType)`, declare canonical unit `probability`, and register one required `zero_response` control expected to match the baseline within the selected `nSigma`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- src/test/passportCompiler.test.ts src/test/passportReplay.test.ts`
Expected: PASS. Then run `npm test`; expected: all tests PASS.

Stage the four Task 3 files. Commit with intent `Turn a winning regime into a falsifiable Passport`, constraint that incidental timestamps never enter identity, confidence `high`, scope risk `moderate`, and both verification commands in `Tested:`.

### Task 4: Import real measurements and issue a pre-registered verdict

**Files:**
- Create: `src/lib/passport/measurement.ts`
- Create: `src/lib/passport/verdict.ts`
- Create: `src/test/passportMeasurement.test.ts`
- Create: `src/test/passportVerdict.test.ts`
- Modify: `src/lib/passport/types.ts`

- [ ] **Step 1: Write failing raw/summary import tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseMeasurementCsv } from '../lib/passport/measurement';

describe('measurement import', () => {
  it('normalizes raw signal and control shots', () => {
    const csv = 'condition,value,unit\nsignal,0.49,probability\nsignal,0.51,probability\n' +
      'zero_response,0.50,probability\nzero_response,0.50,probability\n';
    const evidence = parseMeasurementCsv(csv, { expectedUnit: 'probability', defaultSystematic: 0.001 });
    expect(evidence.kind).toBe('raw');
    expect(evidence.auditability).toBe('full');
    expect(evidence.conditions.signal.mean).toBeCloseTo(0.5, 12);
    expect(evidence.conditions.signal.n).toBe(2);
  });
  it('accepts summary rows but marks lower auditability', () => {
    const csv = 'condition,mean,standard_error,systematic_uncertainty,n,unit\n' +
      'signal,0.5,0.01,0.001,100,probability\n' +
      'zero_response,0.5,0.01,0.001,100,probability\n';
    expect(parseMeasurementCsv(csv, { expectedUnit: 'probability', defaultSystematic: 0 }).auditability)
      .toBe('summary_only');
  });
  it.each([
    ['condition,value,unit\nsignal,NaN,probability', /finite/],
    ['condition,value,unit\nsignal,0.5,radians', /unit/],
    ['condition,mean,standard_error,systematic_uncertainty,n,unit\n' +
      'signal,0.5,-1,0,10,probability', /uncertainty/],
  ])('rejects invalid evidence transactionally', (csv, message) => {
    expect(() => parseMeasurementCsv(csv, { expectedUnit: 'probability', defaultSystematic: 0 }))
      .toThrow(message);
  });
});
```

- [ ] **Step 2: Write failing three-way verdict tests**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateEvidence } from '../lib/passport/verdict';

const decision = { baseline: 0.5, model: 0.6, thresholdSigma: 5,
  requiredPrecision: 0.02, controls: [{ id: 'zero_response' as const,
    condition: 'zero_response' as const, expected: 'baseline' as const, maxZ: 5 }] };
const condition = (mean: number) => ({ condition: 'signal', mean, standardError: 0.005,
  systematicUncertainty: 0.001, totalUncertainty: Math.hypot(0.005, 0.001),
  n: 100, unit: 'probability' });
const withSignal = (mean: number, control = true) => ({ kind: 'summary' as const,
  auditability: 'summary_only' as const, originalText: '', warnings: [], conditions: {
    signal: condition(mean), ...(control ? { zero_response: { ...condition(0.5),
      condition: 'zero_response' } } : {}) } });

describe('observational verdict', () => {
  it('falsifies only when model is excluded and baseline is not', () => {
    expect(evaluateEvidence(decision, withSignal(0.5)).verdict).toBe('model_falsified');
  });
  it('reports model-consistent without calling it confirmation', () => {
    expect(evaluateEvidence(decision, withSignal(0.6)).verdict)
      .toBe('model_consistent_baseline_excluded');
  });
  it('is inconclusive when controls are missing', () => {
    expect(evaluateEvidence(decision, withSignal(0.5, false)).reason)
      .toBe('missing_controls');
  });
  it('is inconclusive when both predictions are excluded', () => {
    expect(evaluateEvidence(decision, withSignal(0.8)).reason).toBe('both_excluded');
  });
});
```

- [ ] **Step 3: Run both files and verify RED**

Run: `npm test -- src/test/passportMeasurement.test.ts src/test/passportVerdict.test.ts`
Expected: FAIL because the importer and evaluator do not exist.

- [ ] **Step 4: Implement bounded transactional CSV normalization**

Add to `types.ts`:

```ts
export interface NormalizedCondition { condition: string; mean: number; standardError: number;
  systematicUncertainty: number; totalUncertainty: number; n: number; unit: string }
export interface MeasurementEvidence { kind: 'raw' | 'summary';
  auditability: 'full' | 'summary_only'; originalText: string; warnings: string[];
  conditions: Record<string, NormalizedCondition> }
```

Implement `parseMeasurementCsv(text, options)` with constants `MAX_MEASUREMENT_BYTES = 2_000_000` and `MAX_MEASUREMENT_ROWS = 50_000`. A small RFC-4180 state machine must handle comma, CRLF/LF, escaped quotes, and quoted cells. Detect the exact raw header set `condition,value,unit` (optional `run_id,timestamp,note`) or exact summary requirements from the spec. Reject duplicate summary conditions, missing `signal`, raw groups with fewer than two rows, non-finite values, negative uncertainty, non-positive integer `n`, unknown conditions, unsupported units, and limits before returning a value.

For raw groups compute:

```ts
const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
  (values.length - 1);
const standardError = Math.sqrt(variance) / Math.sqrt(values.length);
const totalUncertainty = Math.hypot(standardError, options.defaultSystematic);
```

For summary rows compute `Math.hypot(standard_error, systematic_uncertainty)`. Preserve `originalText` exactly. Export `normalizedEvidenceCsv(evidence)` and prefix any cell beginning with `=`, `+`, `-`, or `@` with an apostrophe before CSV escaping.

- [ ] **Step 5: Implement the frozen decision rule**

```ts
export function evaluateEvidence(decision: DecisionInput,
  evidence: MeasurementEvidence | null): VerdictRecord {
  if (!evidence) return inconclusive('no_observational_data');
  const signal = evidence.conditions.signal;
  if (!signal) return inconclusive('missing_signal');
  if (!(signal.totalUncertainty > 0)) return inconclusive('invalid_uncertainty');
  if (signal.totalUncertainty > decision.requiredPrecision)
    return inconclusive('insufficient_precision');
  for (const rule of decision.controls) {
    const control = evidence.conditions[rule.condition];
    if (!control) return inconclusive('missing_controls');
    const expected = rule.expected === 'baseline' ? decision.baseline : decision.model;
    if (Math.abs(control.mean - expected) / control.totalUncertainty >= rule.maxZ)
      return inconclusive('failed_controls');
  }
  const zBaseline = Math.abs(signal.mean - decision.baseline) / signal.totalUncertainty;
  const zModel = Math.abs(signal.mean - decision.model) / signal.totalUncertainty;
  if (zModel >= decision.thresholdSigma && zBaseline < decision.thresholdSigma)
    return record('model_falsified', 'model_excluded', zBaseline, zModel);
  if (zBaseline >= decision.thresholdSigma && zModel < decision.thresholdSigma)
    return record('model_consistent_baseline_excluded', 'baseline_excluded', zBaseline, zModel);
  if (zBaseline >= decision.thresholdSigma && zModel >= decision.thresholdSigma)
    return inconclusive('both_excluded', zBaseline, zModel);
  return inconclusive('both_compatible', zBaseline, zModel);
}
```

`VerdictRecord` must carry verdict, reason, both z-scores (or `null`), threshold, total uncertainty, control results, and wording that uses “model-consistent,” never “confirmed.”

- [ ] **Step 6: Verify GREEN and commit**

Run the two focused files, then `npm test`; both commands must pass. Stage the five Task 4 files. Commit with intent `Keep real evidence auditable and epistemically honest`, constraint that uploads remain local and strict, confidence `high`, scope risk `moderate`, and both test commands in `Tested:`.

### Task 5: Generate portable notebook and human-readable payload files

**Files:**
- Create: `src/lib/passport/notebook.ts`
- Create: `src/lib/passport/files.ts`
- Create: `src/test/passportArtifacts.test.ts`

- [ ] **Step 1: Write failing artifact-member tests**

```ts
import { describe, expect, it } from 'vitest';
import { runTargetLockDetailed } from '../lib/targetLock';
import { compilePassport } from '../lib/passport/passport';
import { buildPayloadFiles } from '../lib/passport/files';

describe('Passport payload files', () => {
  it('emits a self-contained no-evidence payload', async () => {
    const replay = runTargetLockDetailed({ platformId: 'any', sensitivityLimit: 0,
      seed: 9, iterations: 30, nSigma: 5 });
    const compiled = await compilePassport(replay, replay.result.cards[0].id, 'abc123');
    const files = buildPayloadFiles({ compiled, replay, evidence: null, verdict: null });
    expect([...files.keys()]).toEqual([
      'README.md', 'passport.json', 'sweep.csv', 'notebook/reproduce.ipynb',
    ]);
    expect(new TextDecoder().decode(files.get('README.md'))).toContain('NO_OBSERVATIONAL_DATA');
    const notebook = JSON.parse(new TextDecoder().decode(files.get('notebook/reproduce.ipynb')));
    expect(notebook.nbformat).toBe(4);
    expect(notebook.cells.map((cell: { source: string[] }) => cell.source.join('')).join('\n'))
      .toContain(compiled.resultDigest);
  });

  it('preserves uploaded bytes and normalized evidence as separate members', async () => {
    const fixture = await artifactFixtureWithEvidence();
    expect(new TextDecoder().decode(fixture.files.get('measurements/original.csv')))
      .toBe(fixture.evidence.originalText);
    expect(fixture.files.has('measurements/normalized.csv')).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/test/passportArtifacts.test.ts`
Expected: FAIL because `notebook.ts` and `files.ts` do not exist.

- [ ] **Step 3: Implement deterministic text members**

`buildPayloadFiles` must construct one ordered `Map<string, Uint8Array>` and be the only source used later by ZIP and quick downloads:

```ts
export function buildPayloadFiles(input: PayloadInput): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  files.set('README.md', utf8(readmeFor(input)));
  files.set('passport.json', utf8(`${JSON.stringify(input.compiled.passport, null, 2)}\n`));
  files.set('sweep.csv', utf8(sweepTraceCsv(input.replay.trace)));
  if (input.evidence) {
    files.set('measurements/original.csv', utf8(input.evidence.originalText));
    files.set('measurements/normalized.csv', utf8(normalizedEvidenceCsv(input.evidence)));
  }
  files.set('notebook/reproduce.ipynb', utf8(generateNotebook(input)));
  return files;
}
```

`sweepTraceCsv` has a fixed header and one row per ordered trace entry. Encode nullable numbers as empty cells, finite numbers with `canonicalNumber`, parameters as individual columns, and decisions as stable identifiers. `readmeFor` must contain file inventory, exact Jupyter command, scientific/result digests, epistemic disclaimer, evidence/verdict state, and checksum instructions.

- [ ] **Step 4: Generate the self-contained standard-library notebook**

`generateNotebook` must return stable JSON with `nbformat: 4`, `nbformat_minor: 5`, Python 3 kernelspec, and fixed cell IDs. Build cells with a helper:

```ts
const codeCell = (id: string, source: string) => ({ cell_type: 'code', execution_count: null,
  id, metadata: {}, outputs: [], source: source.split(/(?<=\n)/) });
const markdownCell = (id: string, source: string) => ({ cell_type: 'markdown',
  id, metadata: {}, source: source.split(/(?<=\n)/) });
```

The Python source may import only `csv`, `hashlib`, `json`, `math`, `pathlib`, and `struct`. It must contain and invoke:

- `mulberry32(seed)` with unsigned 32-bit masking and JS `Math.imul` behavior;
- `sample_parameters(seed, index)` using `seed*7919 + index*104729`, two discarded draws, and the passport bounds;
- `two_site_prediction(parameters)` matching `twoSiteModel` with `EA=EB=1`;
- `scalar_kernel_prediction(parameters, grid_size=320)` matching the tanh field, analytic Laplacian, Gaussian Born density, normalized `χP_B`, and positive-divergence integration in `kernelRegionSeparation`;
- `teleportation_prediction(parameters)` matching the current Werner/decoherence comparison;
- platform resolution, required shots, rejection, ranking, and dedupe logic matching `runTargetLockDetailed`;
- `canonical_number` and recursive `canonical_json` matching `scientific-e13.v1`;
- measurement verdict recomputation when measurement files exist;
- member verification from `manifest.json` and `checksums.sha256`.

The final cell must rerun the recorded request, compare every regenerated canonical trace row to `sweep.csv`, assert the scientific and result digests, verify payload/member checksums, print the observational verdict separately, and finish with exactly `REPRODUCED: scientific and result digests match`.

Embed the first sample and winning row as reference vectors so an incorrect PRNG or scalar-kernel port fails before the full sweep. Never copy stored predictions into the regenerated trace as a substitute for recalculation.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- src/test/passportArtifacts.test.ts src/test/passportCompiler.test.ts`
Expected: PASS. Then run `npm test`; expected: all tests PASS.

Stage the three Task 5 files. Commit with intent `Make every Passport independently rerunnable`, constraint that generated Python is standard-library-only, directive that notebook equations must follow `resolvePredictions` rather than raw scalar `compareModels`, confidence `medium`, scope risk `moderate`, and both test commands in `Tested:`.

### Task 6: Deterministic ZIP and replay-before-download pipeline

**Files:**
- Create: `src/lib/passport/zip.ts`
- Create: `src/lib/passport/reproduce.ts`
- Create: `src/test/passportZip.test.ts`
- Modify: `src/lib/passport/types.ts`

- [ ] **Step 1: Write failing ZIP and full-pipeline tests**

```ts
import { describe, expect, it } from 'vitest';
import { utf8 } from '../lib/passport/canonical';
import { createStoredZip } from '../lib/passport/zip';

describe('deterministic stored ZIP', () => {
  it('uses the standard CRC-32 and produces byte-identical output', () => {
    const entries = [{ path: 'a.txt', bytes: utf8('abc') }];
    const a = createStoredZip(entries);
    const b = createStoredZip(entries);
    expect(a).toEqual(b);
    expect(new DataView(a.buffer, a.byteOffset).getUint32(0, true)).toBe(0x04034b50);
    expect(new DataView(a.buffer, a.byteOffset).getUint32(14, true)).toBe(0x352441c2);
  });
  it('rejects traversal, duplicate, and unsorted paths', () => {
    expect(() => createStoredZip([{ path: '../x', bytes: utf8('x') }])).toThrow(/path/);
    expect(() => createStoredZip([{ path: 'b', bytes: utf8('b') },
      { path: 'a', bytes: utf8('a') }])).toThrow(/sorted/);
  });
});
```

Add a pipeline test using the Task 5 fixture:

```ts
it('replays before packaging and creates identical bundle bytes', async () => {
  const input = await reproductionFixture();
  const stages: string[] = [];
  const a = await reproduceExperiment({ ...input, onStage: (stage) => stages.push(stage) });
  const b = await reproduceExperiment(input);
  expect(stages).toEqual(['replay', 'verify', 'evidence', 'hash', 'bundle']);
  expect(a.computationalStatus).toBe('reproduced');
  expect(a.bundleBytes).toEqual(b.bundleBytes);
  expect(a.bundleHash).toBe(b.bundleHash);
  expect(a.filename).toContain(a.bundleHash.slice(0, 16));
  expect(a.members.has('manifest.json')).toBe(true);
  expect(a.members.has('checksums.sha256')).toBe(true);
});

it('changes only evidence/bundle identity when one uploaded byte changes', async () => {
  const input = await reproductionFixture();
  const a = await reproduceExperiment(input);
  const b = await reproduceExperiment({ ...input, evidence:
    { ...input.evidence!, originalText: `${input.evidence!.originalText}\n` } });
  expect(a.passport.scientificDigest).toBe(b.passport.scientificDigest);
  expect(a.passport.resultDigest).toBe(b.passport.resultDigest);
  expect(a.bundleHash).not.toBe(b.bundleHash);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/test/passportZip.test.ts`
Expected: FAIL because the ZIP and reproduction modules do not exist.

- [ ] **Step 3: Implement the fixed-metadata stored ZIP writer**

```ts
export interface ZipEntry { path: string; bytes: Uint8Array }
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
```

`createStoredZip(entries)` must validate unique ascending allowlisted paths matching `/^[A-Za-z0-9._/-]+$/` with no empty, absolute, backslash, or `..` segment. Encode filenames as UTF-8, set general-purpose flag `0x0800`, method `0`, DOS date `0x0021` and time `0`, external mode `0o100644 << 16`, and write local headers (`0x04034b50`), central records (`0x02014b50`), and EOCD (`0x06054b50`) using little-endian `DataView`. Reject any member or archive over 32-bit ZIP limits. Concatenate through one pre-sized `Uint8Array`; do not use current time or platform metadata.

- [ ] **Step 4: Implement non-circular manifest/checksums assembly**

In `reproduce.ts`:

```ts
async function packageMembers(payload: Map<string, Uint8Array>, ids: DigestIds) {
  const payloadEntries = await Promise.all([...payload].map(async ([path, bytes]) => ({
    path, mediaType: mediaTypeFor(path), size: bytes.byteLength,
    sha256: await sha256Bytes(bytes),
  })));
  const manifestCore = { schemaVersion: 'experiment-bundle.v1', ...ids,
    payloads: payloadEntries };
  const rootDigest = await sha256Text(canonicalJson(manifestCore));
  const manifestBytes = utf8(`${JSON.stringify({ ...manifestCore, rootDigest }, null, 2)}\n`);
  const manifestHash = await sha256Bytes(manifestBytes);
  const checksums = [...payloadEntries.map((item) => `${item.sha256}  ${item.path}`),
    `${manifestHash}  manifest.json`].join('\n') + '\n';
  const members = new Map(payload);
  members.set('manifest.json', manifestBytes);
  members.set('checksums.sha256', utf8(checksums));
  const sorted = [...members].sort(([a], [b]) => a.localeCompare(b))
    .map(([path, bytes]) => ({ path, bytes }));
  const bundleBytes = createStoredZip(sorted);
  return { members, rootDigest, bundleBytes,
    bundleHash: await sha256Bytes(bundleBytes) };
}
```

The checksum file intentionally omits itself. The final bundle hash covers every ZIP member and is returned/displayed, never embedded inside the ZIP.

- [ ] **Step 5: Implement the five-stage replay gate**

```ts
export const REPRODUCTION_STAGES = ['replay', 'verify', 'evidence', 'hash', 'bundle'] as const;
export async function reproduceExperiment(input: ReproduceInput): Promise<ReproductionResult> {
  input.onStage?.('replay');
  const recorded = await compilePassport(input.recordedReplay, input.cardId, input.sourceCommit);
  const freshReplay = await runTargetLockDetailedAsync(input.recordedReplay.result.request);
  const fresh = await compilePassport(freshReplay, input.cardId, input.sourceCommit);

  input.onStage?.('verify');
  if (fresh.scientificDigest !== recorded.scientificDigest)
    throw new Error('Scientific specification digest mismatch');
  if (fresh.resultDigest !== recorded.resultDigest)
    throw new Error('Sweep result digest mismatch');

  input.onStage?.('evidence');
  const verdict = evaluateEvidence(decisionFrom(recorded.passport), input.evidence);
  const passport = { ...recorded.passport,
    evidenceState: input.evidence?.kind ?? 'no_observational_data' };

  input.onStage?.('hash');
  const payload = buildPayloadFiles({ compiled: { ...recorded, passport },
    replay: input.recordedReplay, evidence: input.evidence, verdict });
  input.onStage?.('bundle');
  const packaged = await packageMembers(payload, {
    passportId: passport.id, scientificDigest: recorded.scientificDigest,
    resultDigest: recorded.resultDigest,
  });
  const shortHash = packaged.bundleHash.slice(0, 16);
  return { computationalStatus: 'reproduced', fullyVerified:
      passport.software.provenance === 'verified', passport, verdict, ...packaged,
    filename: `${passport.id}-${shortHash}.zip` };
}
```

Catch nothing in this pure function: failures must reject and callers must clear their previous verified result. Add JSON-safe result/manifest contracts to `types.ts`; no `Infinity`, `Date`, `Blob`, `Map`, or callback is serialized.

- [ ] **Step 6: Verify GREEN and commit**

Run: `npm test -- src/test/passportZip.test.ts src/test/passportArtifacts.test.ts`
Expected: PASS. Then run `npm test`; expected: all tests PASS.

Stage the three Task 6 files plus `types.ts`. Commit with intent `Make the download prove a fresh replay`, constraint that archive identity has no circular self-hash, confidence `high`, scope risk `moderate`, and both test commands in `Tested:`.

### Task 7: Add the Experiment Passport workspace and giant action

**Files:**
- Create: `src/lib/download.ts`
- Create: `src/lib/passport/uiState.ts`
- Create: `src/quantum/components/ExperimentPassportWorkspace.tsx`
- Create: `src/test/passportWorkspace.test.ts`
- Create: `src/test/fixtures/passport.ts`
- Modify: `src/quantum/components/DiscoveryModePanel.tsx:14-312`
- Modify: `src/quantum/components/ExperimentCardView.tsx:24-285`

- [ ] **Step 1: Write failing UI-state and rendered-contract tests**

```ts
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { reproductionReducer } from '../lib/passport/uiState';
import { ExperimentPassportWorkspace } from '../quantum/components/ExperimentPassportWorkspace';
import { passportUiFixture } from './fixtures/passport';

describe('Passport workspace', () => {
  it('renders the complete chain and dominant reproduction action', () => {
    const fixture = passportUiFixture();
    const html = renderToStaticMarkup(<ExperimentPassportWorkspace {...fixture} />);
    for (const text of ['HYPOTHESIS', 'BASELINE EQUATION', 'WOODYARD PREDICTION',
      'PARAMETER REGION', 'NOISE BUDGET', 'FALSIFICATION THRESHOLD',
      'REPRODUCE THIS EXPERIMENT']) expect(html).toContain(text);
  });
  it('clears stale verified output when a new run starts or fails', () => {
    const success = reproductionReducer({ phase: 'idle', output: null, error: null },
      { type: 'succeeded', output: passportUiFixture().output });
    expect(reproductionReducer(success, { type: 'started' }).output).toBeNull();
    expect(reproductionReducer(success, { type: 'failed', error: 'digest mismatch' }).output)
      .toBeNull();
  });
});
```

Place the reusable deterministic fixture in `src/test/fixtures/passport.ts`; it must call real compilers, not hand-build a partial Passport.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/test/passportWorkspace.test.ts`
Expected: FAIL because the workspace/state modules do not exist.

- [ ] **Step 3: Implement safe shared downloads and state transitions**

```ts
// src/lib/download.ts
export function downloadBytes(filename: string, bytes: Uint8Array, mediaType: string): void {
  const blob = new Blob([bytes], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}
```

`uiState.ts` defines phases `idle | replay | verify | evidence | hash | bundle | reproduced | failed`, actions `started | stage | succeeded | failed | reset`, and a pure reducer. `started`, `failed`, and `reset` always set `output: null`; `failed` retains only a sanitized error string.

- [ ] **Step 4: Build the Passport workspace**

`ExperimentPassportWorkspace` receives `{ recordedReplay, cardId }`. Compile the display passport in an effect keyed by card ID and replay request. Render the eleven approved Passport sections using existing instrument/card styles and epistemic tags. Add a local-only `<input type=file accept=.csv,text/csv>`; call `file.text()`, parse transactionally, and preserve prior accepted evidence on parse failure.

The dominant full-width button runs:

```ts
dispatch({ type: 'started' });
try {
  const output = await reproduceExperiment({ recordedReplay, cardId, evidence,
    sourceCommit: __SOURCE_COMMIT__, onStage: (stage) => dispatch({ type: 'stage', stage }) });
  dispatch({ type: 'succeeded', output });
} catch (error) {
  dispatch({ type: 'failed', error: error instanceof Error ? error.message : 'Reproduction failed' });
}
```

Show the five active/completed stages, computational status separately from observational verdict, software provenance warning, scientific/result/root/bundle hashes, and evidence auditability. Label outputs exactly `MODEL FALSIFIED`, `MODEL-CONSISTENT / BASELINE EXCLUDED`, or `INCONCLUSIVE`; never use “confirmed.”

After success, the primary click downloads `output.bundleBytes`. Quick links call `downloadBytes` with the exact `output.members.get(path)` bytes for Passport, sweep, original/normalized measurements when present, notebook, manifest, and checksums.

- [ ] **Step 5: Wire the detailed replay into Discovery Mode**

Replace `result` state with `detailed` state and derive `const result = detailed?.result ?? null`. Make `handleSearch` async, call `runTargetLockDetailedAsync` once, and store it; remove the 30 ms timeout because the chunked runner now yields deliberately. Keep seed increment, selection, Catalyst compilation, loading, guidance, and candidate rendering unchanged, and clear `isSearching` in `finally`.

Render below the selected `ExperimentCardView`:

```tsx
{selectedCard && detailed && (
  <ExperimentPassportWorkspace
    key={`${selectedCard.id}:${detailed.result.request.seed}`}
    recordedReplay={detailed}
    cardId={selectedCard.id}
  />
)}
```

In `ExperimentCardView`, delete its local `download` helper and call `downloadBytes` with UTF-8 bytes for legacy card JSON/CSV. Do not route Passport state through `QuantumLab`.

- [ ] **Step 6: Verify GREEN, responsive build, and commit**

Run: `npm test -- src/test/passportWorkspace.test.ts src/test/passportZip.test.ts`
Expected: PASS.

Run: `npm run lint` and `npm run build`
Expected: both exit 0; no React hook errors or TypeScript errors.

Manually run `npm run dev`, execute TARGET LOCK at desktop and narrow mobile widths, upload one raw and one summary fixture, run the giant action, confirm progress/labels, download the bundle and every quick file, and verify quick bytes match ZIP members.

Stage the six Task 7 files. Commit with intent `Make reproducibility the dominant Target Lock action`, constraint that computational replay and observational verdict remain visually separate, confidence `medium`, scope risk `moderate`, and automated/manual evidence in `Tested:`.

### Task 8: Independent artifact verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-10-experiment-passport-design.md` only if implementation names differ, never to weaken requirements

- [ ] **Step 1: Document the exact operator workflow**

Add README sections for Experiment Passport contents, the five replay stages, raw and summary CSV schemas copied from the design, verdict meanings, browser-local privacy, ZIP layout, checksum commands, Jupyter execution, and the distinction between computational reproduction and experimental replication. State the 2 MB / 50,000-row limits and that summary evidence is lower-auditability.

- [ ] **Step 2: Perform a clean independent reproduction**

From the UI generate one bundle with raw evidence and record its displayed ZIP SHA-256. Extract it into a new temporary directory, then run the generated notebook top-to-bottom. Expected final output: `REPRODUCED: scientific and result digests match`, followed by the same observational verdict shown by the browser.

Run an OS-level SHA-256 command on the downloaded ZIP and compare it to the UI. Run a second reproduction with identical inputs/evidence and verify byte-identical ZIPs; change the seed and verify scientific/result/bundle hashes change; change one measurement byte and verify only evidence/manifest/bundle identity changes.

- [ ] **Step 3: Run the complete release gate**

Run, in order:

```powershell
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Expected: all tests pass with zero failures, lint exits 0, production build exits 0, diff check is empty, and status contains only intended feature/documentation changes.

- [ ] **Step 4: Commit the release documentation**

Stage `README.md` and any truthful spec-name synchronization. Commit with intent `Make independent Passport replay operable without project context`, confidence `high`, scope risk `narrow`, the full release gate and independent notebook run in `Tested:`, and any browser/platform gap in `Not-tested:`.

## Final Requirements Audit

Before declaring completion, compare the implementation line by line against the approved spec and verify:

- all eleven Passport sections are present and populated from real calculation state;
- scientific, result, payload, manifest-root, and ZIP hashes have non-circular ownership;
- browser replay executes before verified download;
- raw and summary measurements remain local, hashed, normalized, and auditable;
- controls/precision gate every directional verdict;
- same inputs generate the same bundle bytes;
- notebook recomputes rather than echoes the stored sweep;
- quick downloads are the same member bytes packaged in the ZIP;
- unknown source commit blocks the fully verified badge;
- no backend or new package was introduced;
- existing physics, Reality Split, Target Lock, Experiment Card, and Catalyst behavior still passes.
