// Browser port of the Vers3Dynamics Catalyst OS research compiler.
// A teleportation session is compiled into a typed ResearchSpec, a hypothesis
// graph, deterministic quality gates and a SHA-256 hash-chained provenance
// ledger — the same artifact shape the Python Catalyst OS emits.

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
}

export interface CatalystArtifact {
  run_id: string;
  created_at: string;
  backend: 'browser-deterministic';
  spec: ResearchSpec;
  gates: Gate[];
  validation: { passed: boolean; failed_gates: string[] };
  hypothesis_graph: { nodes: { id: string; kind: string; label: string }[]; edges: { from: string; to: string; rel: string }[]; mermaid: string };
  session: CatalystSession;
  ledger: LedgerEvent[];
}

const ZERO = '0'.repeat(64);

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function compileSpec(s: CatalystSession): ResearchSpec {
  const outcomeHist = s.bits.reduce<Record<string, number>>((acc, [a, b]) => {
    const k = `${a}${b}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const spread = Object.keys(outcomeHist).length;

  return {
    title: `Catalyst run: ${s.mode} — vibrational reinstantiation of |ψ⟩`,
    concept:
      'Teleportation modeled as a shift of localized vibrational variables: the source waveform decoheres while the target waveform is re-phased by a Pauli correction.',
    domain: 'quantum_navigation_simulation',
    objective:
      'Determine whether the simulated Bennett protocol reproduces the analytical fidelity and correlation bounds for a Werner Bell pair under the current instrument settings.',
    scientific_status: 'experimental',
    assumptions: [
      'The shared pair is Werner-form ρ = p|Φ⁺⟩⟨Φ⁺| + (1−p)I/4.',
      'Bell-basis outcomes are sampled i.i.d.; no memory between shots.',
      'Classical channel is noiseless and slower than light.',
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
        statement: 'Describing the object as a standing waveform with embedded location variables is an interpretive framing, not a measured claim.',
        status: 'speculative',
        rationale: 'The visualization is a pedagogical encoding of the state vector, not an ontological result.',
        evidence_needed: ['no experiment in this lab can distinguish this framing from the standard formalism'],
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
      'No superluminal signalling: Bob learns nothing before the two classical bits arrive.',
      'Simulation output must never be presented as empirical laboratory evidence.',
    ],
    risks: [
      'Visual metaphor may be read as literal transport of an object.',
      `Low shot count (${s.shots}) makes correlation estimates statistically weak.`,
    ],
    tags: ['teleportation', 'werner_state', s.mode, 'reproducible'],
    seed: s.seed,
  };
}

export function runGates(s: CatalystSession, spec: ResearchSpec): Gate[] {
  const spread = new Set(s.bits.map(([a, b]) => `${a}${b}`)).size;
  const expectedZZ = s.purity; // ⟨ZZ⟩ for Werner Φ⁺
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
  const payload_digest = await sha256(JSON.stringify(payload));
  const timestamp = new Date().toISOString();
  const hash = await sha256(`${previous_hash}|${event}|${payload_digest}|${timestamp}`);
  ledger.push({ event, hash, payload_digest, previous_hash, timestamp });
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
  const artifact: CatalystArtifact = {
    run_id,
    created_at,
    backend: 'browser-deterministic',
    spec,
    gates,
    validation: { passed: failed.length === 0, failed_gates: failed },
    hypothesis_graph: graph,
    session,
    ledger,
  };
  await appendEvent(ledger, 'artifact_finalized', { run_id, passed: failed.length === 0 });
  return artifact;
}

/** Re-derive the chain to prove no event was altered. */
export async function verifyLedger(ledger: LedgerEvent[]): Promise<boolean> {
  let prev = ZERO;
  for (const e of ledger) {
    if (e.previous_hash !== prev) return false;
    const expect = await sha256(`${e.previous_hash}|${e.event}|${e.payload_digest}|${e.timestamp}`);
    if (expect !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}

export const STAGES = [
  { id: 'spec', label: 'Epistemic compiler', detail: 'idea → typed ResearchSpec with claim statuses' },
  { id: 'graph', label: 'Hypothesis graph', detail: 'claims, metrics and falsifiers as a graph' },
  { id: 'gates', label: 'Quality gates', detail: 'deterministic checks against the live run data' },
  { id: 'ledger', label: 'Provenance ledger', detail: 'SHA-256 hash-chained event log' },
  { id: 'artifact', label: 'Artifact bundle', detail: 'immutable artifact.json, exportable' },
] as const;
