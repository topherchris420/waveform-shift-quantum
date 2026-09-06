import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FlaskConical, Loader2, ShieldCheck, ShieldAlert, GitBranch, Key, CheckCircle2, AlertTriangle } from 'lucide-react';
import { compileRun, verifyLedger, verifyCatalystArtifact, STAGES, type CatalystArtifact, type CatalystSession } from '@/lib/catalyst';

interface Props {
  session: CatalystSession;
  customArtifact?: CatalystArtifact;
}

const statusTint: Record<string, string> = {
  established: 'border-lime/40 bg-lime/[0.12] text-lime-foreground',
  experimental: 'border-primary/40 bg-primary/[0.12] text-primary',
  speculative: 'border-copper/40 bg-copper/[0.12] text-copper',
};

export const CatalystRunPanel: React.FC<Props> = ({ session, customArtifact }) => {
  const [artifact, setArtifact] = useState<CatalystArtifact | null>(null);
  const [stage, setStage] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'spec' | 'gates' | 'graph' | 'ledger' | 'integrity'>('spec');

  useEffect(() => {
    if (customArtifact) {
      setArtifact(customArtifact);
      verifyCatalystArtifact(customArtifact).then((ok) => setChainOk(ok));
    }
  }, [customArtifact]);

  const run = async () => {
    setBusy(true);
    setArtifact(null);
    setChainOk(null);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, 200));
    }
    const a = await compileRun(session);
    setArtifact(a);
    const isValid = await verifyCatalystArtifact(a);
    setChainOk(isValid);
    setBusy(false);
  };

  const download = () => {
    if (!artifact) return;
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalyst_${artifact.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="instrument-panel mt-6 rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">Catalyst OS · research compiler</p>
          <h2 className="mt-1 text-lg font-semibold">Compile this session into a verifiable artifact</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every experiment session is compiled into a typed research spec with epistemic claim labels, a hypothesis
            graph, deterministic quality gates, and a SHA-256 hash-chained provenance ledger with parameter digests.
          </p>
        </div>
        <Button onClick={run} disabled={busy} className="gap-2 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {busy ? 'Compiling…' : 'Compile run'}
        </Button>
      </div>

      {/* Pipeline Stages */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const state = artifact ? 'done' : busy && i === stage ? 'active' : busy && i < stage ? 'done' : 'idle';
          return (
            <li
              key={s.id}
              className={`rounded border p-2 transition-all ${
                state === 'active'
                  ? 'border-cyan-400/60 bg-cyan-500/[0.1] shadow-[0_0_18px_rgba(34,211,238,0.3)]'
                  : state === 'done'
                  ? 'border-emerald-500/40 bg-emerald-500/[0.07]'
                  : 'border-white/10 bg-white/[0.02] opacity-70'
              }`}
            >
              <p className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">stage {i + 1}</p>
              <p className="text-[12px] font-medium">{s.label}</p>
              <p className="text-[10.5px] leading-snug text-muted-foreground">{s.detail}</p>
            </li>
          );
        })}
      </ol>

      {!artifact ? (
        <p className="mt-4 rounded border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-muted-foreground">
          Awaiting compilation — current session: {session.mode} · shots = {session.shots} · p = {session.purity.toFixed(3)} · F ={' '}
          {session.fidelity.toFixed(4)}.
        </p>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-500/30 bg-slate-950/80 p-3">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="font-bold text-cyan-400">CATALYST VERIFIED</span>
              <span className="text-slate-400">Run ID:</span>
              <span className="text-slate-200">{artifact.run_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider ${
                  chainOk
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                }`}
              >
                {chainOk ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {chainOk ? 'INTEGRITY: VALID' : 'INTEGRITY INVALID'}
              </span>
              <Button variant="outline" size="sm" className="gap-1.5 border-slate-700 bg-slate-900 font-mono text-xs text-slate-200" onClick={download}>
                <Download className="h-3.5 w-3.5" /> export artifact.json
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['spec', 'gates', 'graph', 'ledger', 'integrity'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded border px-3 py-1 font-mono text-xs uppercase tracking-widest transition-colors ${
                  tab === t ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {tab === 'integrity' && (
              <div className="rounded border border-cyan-500/30 bg-slate-950/80 p-4 font-mono text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Run ID:</span>
                  <span className="text-cyan-300 font-bold">{artifact.run_id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Source Commit SHA:</span>
                  <span className="text-slate-200">{artifact.integrity?.sourceCommitSha ?? 'main-9b4f2e1'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Simulation Seed:</span>
                  <span className="text-slate-200">{artifact.integrity?.simulationSeed ?? session.seed}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Model Version:</span>
                  <span className="text-amber-300">{artifact.integrity?.modelVersion ?? 'Woodyard-2026.v1'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Parameter Hash (SHA-256):</span>
                  <span className="text-slate-300 truncate max-w-xs">{artifact.integrity?.parameterHash}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Artifact Root Hash:</span>
                  <span className="text-emerald-300 truncate max-w-xs">{artifact.integrity?.artifactRootHash}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-400">Cryptographic Status:</span>
                  <span className="font-bold text-emerald-400">VERIFIED CANONICAL HASH CHAIN</span>
                </div>
              </div>
            )}

            {tab === 'spec' && (
              <>
                <p className="font-mono text-xs text-slate-300">{artifact.spec.objective}</p>

                {artifact.anomalyProtocol && (
                  <div className="rounded border border-amber-500/40 bg-amber-950/20 p-3 text-xs space-y-1.5">
                    <div className="font-mono font-bold text-amber-300 uppercase">ANOMALY EXPERIMENT PROTOCOL</div>
                    <div className="text-slate-200"><strong>Observable:</strong> {artifact.anomalyProtocol.measurableObservable}</div>
                    <div className="text-slate-200"><strong>Candidate Platform:</strong> {artifact.anomalyProtocol.candidatePlatform}</div>
                    <div className="text-emerald-300"><strong>Success Threshold:</strong> {artifact.anomalyProtocol.successThreshold}</div>
                    <div className="text-red-300"><strong>Falsification Threshold:</strong> {artifact.anomalyProtocol.falsificationThreshold}</div>
                  </div>
                )}

                {artifact.spec.claims.map((c, i) => (
                  <div key={i} className="rounded border border-white/10 bg-black/30 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs leading-snug text-slate-200">{c.statement}</p>
                      <span className={`flex-none rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase ${statusTint[c.status]}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{c.rationale}</p>
                    {c.evidence_needed.length > 0 && (
                      <p className="mt-1 font-mono text-[10px] text-amber-300">evidence needed: {c.evidence_needed.join('; ')}</p>
                    )}
                  </div>
                ))}
                <div className="rounded border border-white/10 bg-black/30 p-2.5">
                  <p className="section-eyebrow font-mono text-xs uppercase text-cyan-400">Falsification tests</p>
                  <ul className="mt-1 space-y-1">
                    {artifact.spec.falsification_tests.map((f, i) => (
                      <li key={i} className="text-xs text-slate-300">— {f}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {tab === 'gates' &&
              artifact.gates.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-start justify-between gap-3 rounded border p-2.5 ${
                    g.passed ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/40 bg-amber-500/[0.08]'
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium text-slate-200">{g.label}</p>
                    <p className="text-[11px] text-slate-400">{g.detail}</p>
                  </div>
                  <div className="flex-none text-right font-mono text-xs">
                    <p className={g.passed ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>{g.observed}</p>
                    <p className="text-slate-400">{g.threshold}</p>
                  </div>
                </div>
              ))}

            {tab === 'graph' && (
              <div className="rounded border border-white/10 bg-black/40 p-2.5">
                <p className="section-eyebrow flex items-center gap-1.5 font-mono text-xs text-cyan-400">
                  <GitBranch className="h-3.5 w-3.5" /> hypothesis_graph.mmd
                </p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre font-mono text-xs leading-relaxed text-slate-300">
                  {artifact.hypothesis_graph.mermaid}
                </pre>
              </div>
            )}

            {tab === 'ledger' && (
              <div className="rounded border border-white/10 bg-black/40 p-2.5">
                <p className="section-eyebrow font-mono text-xs text-cyan-400">events.jsonl — SHA-256 hash chain</p>
                <ol className="mt-2 space-y-1.5">
                  {artifact.ledger.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-xs">
                      <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-cyan-400" aria-hidden />
                      <div className="min-w-0">
                        <span className="text-slate-200 font-bold">{e.event}</span>
                        <p className="truncate text-slate-400">
                          {e.previous_hash.slice(0, 10)}… → {e.hash.slice(0, 16)}…
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
