import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FlaskConical, Loader2, ShieldCheck, ShieldAlert, GitBranch } from 'lucide-react';
import { compileRun, verifyLedger, STAGES, type CatalystArtifact, type CatalystSession } from '@/lib/catalyst';

interface Props {
  session: CatalystSession;
}

const statusTint: Record<string, string> = {
  established: 'border-lime/40 bg-lime/[0.12] text-lime-foreground',
  experimental: 'border-primary/40 bg-primary/[0.12] text-primary',
  speculative: 'border-copper/40 bg-copper/[0.12] text-copper',
};

export const CatalystRunPanel: React.FC<Props> = ({ session }) => {
  const [artifact, setArtifact] = useState<CatalystArtifact | null>(null);
  const [stage, setStage] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'spec' | 'gates' | 'graph' | 'ledger'>('spec');

  const run = async () => {
    setBusy(true);
    setArtifact(null);
    setChainOk(null);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, 260));
    }
    const a = await compileRun(session);
    setArtifact(a);
    setChainOk(await verifyLedger(a.ledger));
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
            Every teleportation run is compiled into a typed research spec with epistemic claim labels, a hypothesis
            graph, deterministic quality gates and a SHA-256 hash-chained provenance ledger.
          </p>
        </div>
        <Button onClick={run} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {busy ? 'Compiling…' : 'Compile run'}
        </Button>
      </div>

      {/* Pipeline */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-5">
        {STAGES.map((s, i) => {
          const state = artifact ? 'done' : busy && i === stage ? 'active' : busy && i < stage ? 'done' : 'idle';
          return (
            <li
              key={s.id}
              className={`rounded border p-2 transition-all ${
                state === 'active'
                  ? 'border-primary/60 bg-primary/[0.1] shadow-[0_0_18px_hsl(var(--primary)/0.3)]'
                  : state === 'done'
                  ? 'border-lime/40 bg-lime/[0.07]'
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
          Awaiting compilation — current session: {session.shots} Bell shots · p = {session.purity.toFixed(3)} · F ={' '}
          {session.fidelity.toFixed(4)} · C = {session.concurrence.toFixed(4)}.
        </p>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/30 p-2.5">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-muted-foreground">run_id</span>
              <span className="text-foreground">{artifact.run_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  artifact.validation.passed
                    ? 'border-lime/40 bg-lime/[0.12] text-lime-foreground'
                    : 'border-copper/40 bg-copper/[0.12] text-copper'
                }`}
              >
                {artifact.validation.passed ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {artifact.validation.passed ? 'all gates passed' : `${artifact.validation.failed_gates.length} gate(s) failed`}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                chain {chainOk === null ? '…' : chainOk ? 'verified' : 'BROKEN'}
              </span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={download}>
                <Download className="h-3.5 w-3.5" /> artifact.json
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['spec', 'gates', 'graph', 'ledger'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-widest transition-colors ${
                  tab === t ? 'border-primary/60 bg-primary/[0.12] text-primary' : 'border-white/10 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {tab === 'spec' && (
              <>
                <p className="font-mono text-[11px] text-muted-foreground">{artifact.spec.objective}</p>
                {artifact.spec.claims.map((c, i) => (
                  <div key={i} className="rounded border border-white/10 bg-black/30 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] leading-snug">{c.statement}</p>
                      <span className={`flex-none rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase ${statusTint[c.status]}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground">{c.rationale}</p>
                    {c.evidence_needed.length > 0 && (
                      <p className="mt-1 font-mono text-[10px] text-copper">evidence needed: {c.evidence_needed.join('; ')}</p>
                    )}
                  </div>
                ))}
                <div className="rounded border border-white/10 bg-black/30 p-2.5">
                  <p className="section-eyebrow">Falsification tests</p>
                  <ul className="mt-1 space-y-1">
                    {artifact.spec.falsification_tests.map((f, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground">— {f}</li>
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
                    g.passed ? 'border-lime/30 bg-lime/[0.06]' : 'border-copper/40 bg-copper/[0.08]'
                  }`}
                >
                  <div>
                    <p className="text-[12px] font-medium">{g.label}</p>
                    <p className="text-[10.5px] text-muted-foreground">{g.detail}</p>
                  </div>
                  <div className="flex-none text-right font-mono text-[10.5px]">
                    <p className={g.passed ? 'text-lime-foreground' : 'text-copper'}>{g.observed}</p>
                    <p className="text-muted-foreground">{g.threshold}</p>
                  </div>
                </div>
              ))}

            {tab === 'graph' && (
              <div className="rounded border border-white/10 bg-black/40 p-2.5">
                <p className="section-eyebrow flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" /> hypothesis_graph.mmd
                </p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                  {artifact.hypothesis_graph.mermaid}
                </pre>
              </div>
            )}

            {tab === 'ledger' && (
              <div className="rounded border border-white/10 bg-black/40 p-2.5">
                <p className="section-eyebrow">events.jsonl — hash chain</p>
                <ol className="mt-2 space-y-1.5">
                  {artifact.ledger.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-[10.5px]">
                      <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden />
                      <div className="min-w-0">
                        <span className="text-foreground">{e.event}</span>
                        <p className="truncate text-muted-foreground">
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
