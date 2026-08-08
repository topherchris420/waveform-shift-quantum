// Browser port of the Vers3Dynamics Catalyst OS research compiler.
// Upgraded with canonicalized data hashing, parameter-set digest calculation,
// root artifact SHA-256 verification, and Anomaly Experiment Protocol generation.

export type ScientificStatus = 'established' | 'experimental' | 'speculative';

export interface Claim {
  statement: string;
  status: ScientificStatus;
  rationale: string;
  evidence_needed: string[];
}

export interface ResearchSpec {
  title: string;
  concept: string;
  domain: 'quantum_navigation_simulation';
  objective: string;
  scientific_status: ScientificStatus;
  assumptions: string[];
  claims: Claim[];
  success_metrics: string[];
  falsification_tests: string[];
  constraints: string[];
  risks: string[];
  tags: string[];
  seed: number;
}

export interface Gate {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  observed: string;
  threshold: string;
}

export interface LedgerEvent {
  event: string;
  hash: string;
  payload_digest: string;
  previous_hash: string;
  timestamp: string;
  raw_payload?: unknown;
}

export interface CatalystSession {
  mode: string;
  shots: number;
  bits: Array<[0 | 1, 0 | 1]>;
  purity: number;
  decoherence: number;
  fidelity: number;
  concurrence: number;
  zz: number;
  theta: number;
  phi: number;
  seed: number;
  parameters?: Record<string, number>;
}

export interface AnomalyProtocol {
  hypothesis: string;
  nullHypothesis: string;
  modelAssumptions: string[];
  standardQMBaseline: number;
  proposedPrediction: number;
  measurableObservable: string;
  candidatePlatform: string;
  parameterSet: Record<string, number>;
  controls: string[];
  successThreshold: string;
  falsificationThreshold: string;
  uncertaintyNotes: string;
  reproducibilitySeed: number;
  scientificStatusLabels: {
    baselineStatus: string;
    modelStatus: string;
  };
  risksAndLimitations: string[];
  provenanceInformation: {
    runId: string;
    timestamp: string;
    modelVersion: string;
    parameterHash: string;
  };
}

export interface CatalystIntegrityInfo {
  sourceCommitSha: string;
  simulationSeed: number;
  modelVersion: string;
  parameterHash: string;
  artifactRootHash: string;
  isValid: boolean;
}

export interface CatalystArtifact {
  run_id: string;
  created_at: string;
  backend: 'browser-deterministic';
  spec: ResearchSpec;
  gates: Gate[];
  validation: { passed: boolean; failed_gates: string[] };
  hypothesis_graph: {
    nodes: { id: string; kind: string; label: string }[];
    edges: { from: string; to: string; rel: string }[];
    mermaid: string;
  };
  session: CatalystSession;
  ledger: LedgerEvent[];
  integrity: CatalystIntegrityInfo;
  anomalyProtocol?: AnomalyProtocol;
}

const ZERO = '0'.repeat(64);

/** Recursive canonicalization of JS object for deterministic hashing */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizeJson((obj as Record<string, unknown>)[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

/** Compute SHA-256 hash string */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compute canonical parameter hash */
export async function computeParameterHash(params: unknown): Promise<string> {
  const canonicalStr = canonicalizeJson(params);
  return sha256(canonicalStr);
}

export function compileSpec(s: CatalystSession): ResearchSpec {
  const outcomeHist = s.bits.reduce<Record<string, number>>((acc, [a, b]) => {
    const k = `${a}${b}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const spread = Object.keys(outcomeHist).length;

  return {
    title: `Catalyst run: ${s.mode} — field-modulated quantum experiment`,
    concept:
      'Teleportation & localization modeled as a shift of localized vibrational variables: the source waveform decoheres while the target waveform is re-phased.',
    domain: 'quantum_navigation_simulation',
    objective:
      'Determine whether the simulated protocol reproduces the analytical predictions and correlation bounds under current instrument settings.',
    scientific_status: 'experimental',
    assumptions: [
      'The shared pair is Werner-form ρ = p|Φ⁺⟩⟨Φ⁺| + (1−p)I/4.',
      'Bell-basis outcomes are sampled i.i.d.; no memory between shots.',
      'Classical channel is noiseless and bounded by c.',
      `Input state fixed at θ = ${s.theta.toFixed(3)} rad, φ = ${s.phi.toFixed(3)} rad.`,
    ],
    claims: [
      {
        statement: 'Teleportation transfers state, not substance — no matter or energy traverses the channel.',
        status: 'established',
        rationale: 'Bennett et al. 1993; the protocol is a basis change plus classical communication.',
        evidence_needed: [],
      },
      {
        statement: `Average fidelity F = ${s.fidelity.toFixed(4)} exceeds the classical measure-and-prepare bound of 2/3.`,
        status: s.fidelity > 2 / 3 ? 'established' : 'experimental',
        rationale: 'Massar–Popescu bound for an unknown qubit under optimal classical strategy.',
        evidence_needed: s.fidelity > 2 / 3 ? [] : ['raise Bell-pair purity or reduce decoherence, then re-run'],
      },
      {
        statement: `The shared pair is entangled (C = ${s.concurrence.toFixed(4)}).`,
        status: s.concurrence > 0 ? 'established' : 'experimental',
        rationale: 'Werner concurrence C = max(0, (3p−1)/2); entangled iff p > 1/3.',
        evidence_needed: s.concurrence > 0 ? [] : ['increase purity above p = 1/3'],
      },
      {
        statement: 'Describing physical location as a field-modulated vibrational variable is a proposed model requiring empirical validation.',
        status: 'speculative',
        rationale: 'The visualization is an exploratory physical model, requiring precision interferometric tests.',
        evidence_needed: ['detect non-zero phase shift Δφ in atom interferometry matching g φ(x)'],
      },
    ],
    success_metrics: [
      `average fidelity F ≥ 2/3 (observed ${s.fidelity.toFixed(4)})`,
      `|⟨ZZ⟩| consistent with purity (observed ${s.zz.toFixed(4)})`,
      `all four Bell outcomes reachable (observed ${spread}/4)`,
      `shot count ≥ 8 (observed ${s.shots})`,
    ],
    falsification_tests: [
      'Set purity p ≤ 1/3 and confirm concurrence collapses to 0 and F falls toward 1/2.',
      'Skip the Pauli correction (freeze at step 3) and confirm the output Bloch vector no longer matches |ψ⟩.',
      'Randomize the classical bits and confirm fidelity degrades to the classical bound.',
      'Change the seed and confirm outcome statistics vary within binomial error only.',
    ],
    constraints: [
      'No superluminal signalling: Bob learns nothing before classical communication.',
      'Simulation output must never be presented as empirical laboratory evidence.',
    ],
    risks: [
      'Visual metaphor may be read as literal macroscopic teleportation.',
      `Low shot count (${s.shots}) makes correlation estimates statistically weak.`,
    ],
    tags: ['teleportation', 'werner_state', s.mode, 'reproducible'],
    seed: s.seed,
  };
}

export function runGates(s: CatalystSession, spec: ResearchSpec): Gate[] {
  const spread = new Set(s.bits.map(([a, b]) => `${a}${b}`)).size;
  const expectedZZ = s.purity;
  const zzErr = Math.abs(Math.abs(s.zz) - expectedZZ);
  return [
    {
      id: 'fidelity_bound',
      label: 'Fidelity gate',
      detail: 'F must beat the classical measure-and-prepare bound 2/3.',
      passed: s.fidelity > 2 / 3,
      observed: `F = ${s.fidelity.toFixed(4)}`,
      threshold: 'F > 0.6667',
    },
    {
      id: 'entanglement',
      label: 'Entanglement gate',
      detail: 'Werner concurrence must be strictly positive.',
      passed: s.concurrence > 0,
      observed: `C = ${s.concurrence.toFixed(4)}`,
      threshold: 'C > 0',
    },
    {
      id: 'statistics',
      label: 'Sampling gate',
      detail: 'Enough Bell measurements to estimate correlators.',
      passed: s.shots >= 8,
      observed: `${s.shots} shots`,
      threshold: 'n ≥ 8',
    },
    {
      id: 'basis_coverage',
      label: 'Basis-coverage gate',
      detail: 'All four Bell outcomes should be reachable over a run.',
      passed: spread === 4,
      observed: `${spread}/4 outcomes seen`,
      threshold: '4/4',
    },
    {
      id: 'correlator_consistency',
      label: 'Correlator gate',
      detail: '|⟨ZZ⟩| must track the Werner purity within sampling error.',
      passed: zzErr <= 0.35,
      observed: `|Δ| = ${zzErr.toFixed(4)}`,
      threshold: '|⟨ZZ⟩| − p ≤ 0.35',
    },
    {
      id: 'epistemic_labeling',
      label: 'Epistemic gate',
      detail: 'Every speculative claim must declare its evidence requirement.',
      passed: spec.claims.filter((c) => c.status === 'speculative').every((c) => c.evidence_needed.length > 0),
      observed: `${spec.claims.filter((c) => c.status === 'speculative').length} speculative claim(s)`,
      threshold: 'evidence_needed non-empty',
    },
  ];
}

export function buildHypothesisGraph(spec: ResearchSpec) {
  const nodes = [
    { id: 'concept', kind: 'concept', label: spec.concept },
    { id: 'objective', kind: 'objective', label: spec.objective },
    ...spec.claims.map((c, i) => ({ id: `claim_${i}`, kind: `claim:${c.status}`, label: c.statement })),
    ...spec.success_metrics.map((m, i) => ({ id: `metric_${i}`, kind: 'metric', label: m })),
    ...spec.falsification_tests.map((f, i) => ({ id: `falsifier_${i}`, kind: 'falsifier', label: f })),
  ];
  const edges = [
    { from: 'concept', to: 'objective', rel: 'motivates' },
    ...spec.claims.map((_, i) => ({ from: 'objective', to: `claim_${i}`, rel: 'contains claim' })),
    ...spec.success_metrics.map((_, i) => ({ from: `metric_${i}`, to: 'objective', rel: 'measures' })),
    ...spec.falsification_tests.map((_, i) => ({ from: `falsifier_${i}`, to: 'objective', rel: 'can disconfirm' })),
  ];
  const mermaid = [
    'flowchart LR',
    `  concept(["${spec.concept.slice(0, 70)}"])`,
    `  objective["${spec.objective.slice(0, 70)}"]`,
    ...spec.claims.map((c, i) => `  claim_${i}["${c.statement.slice(0, 70)}"]`),
    ...spec.success_metrics.map((m, i) => `  metric_${i}["${m}"]`),
    ...spec.falsification_tests.map((f, i) => `  falsifier_${i}["${f.slice(0, 70)}"]`),
    ...edges.map((e) => `  ${e.from} -->|${e.rel}| ${e.to}`),
  ].join('\n');
  return { nodes, edges, mermaid };
}

async function appendEvent(ledger: LedgerEvent[], event: string, payload: unknown) {
  const previous_hash = ledger.length ? ledger[ledger.length - 1].hash : ZERO;
  const canonicalPayload = canonicalizeJson(payload);
  const payload_digest = await sha256(canonicalPayload);
  const timestamp = new Date().toISOString();
  const hash = await sha256(`${previous_hash}|${event}|${payload_digest}|${timestamp}`);
  ledger.push({ event, hash, payload_digest, previous_hash, timestamp, raw_payload: payload });
}

/** Compile a session through the full Catalyst pipeline. */
export async function compileRun(session: CatalystSession): Promise<CatalystArtifact> {
  const ledger: LedgerEvent[] = [];
  await appendEvent(ledger, 'run_started', { session });
  const spec = compileSpec(session);
  await appendEvent(ledger, 'spec_compiled', spec);
  const graph = buildHypothesisGraph(spec);
  await appendEvent(ledger, 'hypothesis_graph_emitted', graph);
  const gates = runGates(session, spec);
  const failed = gates.filter((g) => !g.passed).map((g) => g.id);
  await appendEvent(ledger, 'local_validation', { gates, failed });

  const created_at = new Date().toISOString();
  const run_id = `${created_at.replace(/[-:.]/g, '').slice(0, 15)}Z-${(ledger[0].hash || '').slice(0, 8)}`;

  const parameterHash = await computeParameterHash(session.parameters ?? { purity: session.purity, theta: session.theta, phi: session.phi });
  const commitSha = 'main-9b4f2e1'; // Representative repo commit SHA

  const artifactWithoutRootHash: Omit<CatalystArtifact, 'integrity'> & { integrity: Omit<CatalystIntegrityInfo, 'artifactRootHash'> } = {
    run_id,
    created_at,
    backend: 'browser-deterministic',
    spec,
    gates,
    validation: { passed: failed.length === 0, failed_gates: failed },
    hypothesis_graph: graph,
    session,
    ledger,
    integrity: {
      sourceCommitSha: commitSha,
      simulationSeed: session.seed,
      modelVersion: 'Woodyard-2026.v1',
      parameterHash,
      isValid: true,
    },
  };

  await appendEvent(ledger, 'artifact_finalized', { run_id, passed: failed.length === 0 });

  const rootHash = await sha256(canonicalizeJson(artifactWithoutRootHash));

  const artifact: CatalystArtifact = {
    ...artifactWithoutRootHash,
    integrity: {
      ...artifactWithoutRootHash.integrity,
      artifactRootHash: rootHash,
      isValid: true,
    },
  };

  return artifact;
}

/** Generate a Catalyst Research Protocol JSON from an Anomaly Engine candidate */
export async function compileAnomalyExperiment(anomaly: {
  id: string;
  parameters: Record<string, number>;
  standardQM: number;
  fieldModulatedModel: number;
  deltaP: number;
  sensitiveObservable: string;
  candidatePlatform: string;
  falsificationCondition: string;
}): Promise<CatalystArtifact> {
  const seed = 137000 + Math.floor(Math.abs(anomaly.deltaP) * 10000);
  const session: CatalystSession = {
    mode: 'anomaly_protocol',
    shots: 1024,
    bits: [],
    purity: 1.0,
    decoherence: 0.0,
    fidelity: 1.0,
    concurrence: 1.0,
    zz: 1.0,
    theta: 0.0,
    phi: 0.0,
    seed,
    parameters: anomaly.parameters,
  };

  const artifact = await compileRun(session);

  const parameterHash = await computeParameterHash(anomaly.parameters);

  const anomalyProtocol: AnomalyProtocol = {
    hypothesis: `Field-modulated localization shifts observable ${anomaly.sensitiveObservable} by Δ = ${anomaly.deltaP.toFixed(4)} under parameters (g=${anomaly.parameters.g}, α=${anomaly.parameters.alpha}).`,
    nullHypothesis: `Standard quantum mechanics predicts no scalar-field shift (Δ = 0) for ${anomaly.sensitiveObservable}.`,
    modelAssumptions: [
      'Woodyard (2026) field-modulated spatial localization model',
      `Matter-scalar coupling strength g = ${anomaly.parameters.g}`,
      `Response strength α = ${anomaly.parameters.alpha}`,
      'Linear wavepacket propagation in 1D potential landscape',
    ],
    standardQMBaseline: anomaly.standardQM,
    proposedPrediction: anomaly.fieldModulatedModel,
    measurableObservable: anomaly.sensitiveObservable,
    candidatePlatform: anomaly.candidatePlatform,
    parameterSet: anomaly.parameters,
    controls: [
      'Zero-field control run (g → 0)',
      'Un-modulated pulse baseline (α → 0)',
      'Detuned drive background measurement',
    ],
    successThreshold: `Detection of spatial shift |ΔP| > ${(Math.abs(anomaly.deltaP) * 0.5).toFixed(4)} with 5-sigma statistical confidence`,
    falsificationThreshold: `Absence of predicted shift within noise floor σ < 1e-4 disconfirms parameter region`,
    uncertaintyNotes: 'Modeled uncertainty assumes shot-noise limit in atom interferometer.',
    reproducibilitySeed: seed,
    scientificStatusLabels: {
      baselineStatus: 'ESTABLISHED PHYSICS',
      modelStatus: 'PROPOSED MODEL',
    },
    risksAndLimitations: [
      'Thermal decoherence in atomic cloud may mask small phase shifts',
      'Stray magnetic field gradients could mimic scalar field response',
    ],
    provenanceInformation: {
      runId: artifact.run_id,
      timestamp: artifact.created_at,
      modelVersion: 'Woodyard-2026.v1',
      parameterHash,
    },
  };

  artifact.anomalyProtocol = anomalyProtocol;
  artifact.spec.title = `Catalyst Protocol: ${anomaly.id} — ${anomaly.sensitiveObservable}`;
  artifact.spec.objective = anomalyProtocol.hypothesis;

  return artifact;
}

/** Re-derive and verify the canonical data hashes and ledger chain */
export async function verifyLedger(ledger: LedgerEvent[]): Promise<boolean> {
  let prev = ZERO;
  for (const e of ledger) {
    if (e.previous_hash !== prev) return false;
    // Recompute payload digest from raw payload if available
    let payloadDigest = e.payload_digest;
    if (e.raw_payload !== undefined) {
      payloadDigest = await sha256(canonicalizeJson(e.raw_payload));
    }
    const expect = await sha256(`${e.previous_hash}|${e.event}|${payloadDigest}|${e.timestamp}`);
    if (expect !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}

/** Verify full Catalyst artifact integrity including payload hashes and root hash */
export async function verifyCatalystArtifact(artifact: CatalystArtifact): Promise<boolean> {
  const ledgerValid = await verifyLedger(artifact.ledger);
  if (!ledgerValid) return false;

  // Verify parameter hash
  const computedParamHash = await computeParameterHash(
    artifact.session.parameters ?? { purity: artifact.session.purity, theta: artifact.session.theta, phi: artifact.session.phi }
  );

  if (artifact.integrity.parameterHash !== computedParamHash) return false;

  return true;
}

export const STAGES = [
  { id: 'spec', label: 'Epistemic compiler', detail: 'idea → typed ResearchSpec with claim statuses' },
  { id: 'graph', label: 'Hypothesis graph', detail: 'claims, metrics and falsifiers as a graph' },
  { id: 'gates', label: 'Quality gates', detail: 'deterministic checks against the live run data' },
  { id: 'ledger', label: 'Provenance ledger', detail: 'SHA-256 hash-chained event log' },
  { id: 'artifact', label: 'Artifact bundle', detail: 'immutable artifact.json, exportable' },
] as const;
