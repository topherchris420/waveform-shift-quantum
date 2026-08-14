import React, { useState } from 'react';
import { SimulationParams, FrozenClaim, ChallengeOutcome, discoverAndFreeze, challengeClaim } from './engine';
import { Button } from '@/components/ui/button';
import { Search, Lock, FlaskConical, ShieldCheck, ShieldX, Loader2, Check, X } from 'lucide-react';

interface Props {
  onAdopt: (params: SimulationParams) => void;
  baseParams: SimulationParams;
}

type Stage = 'idle' | 'discovering' | 'frozen' | 'challenging' | 'done';

const STAGE_LABELS = ['Discover', 'Freeze', 'Challenge', 'Adjudicate'];

export const SuperiorityProtocol: React.FC<Props> = ({ onAdopt, baseParams }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [claim, setClaim] = useState<FrozenClaim | null>(null);
  const [outcome, setOutcome] = useState<ChallengeOutcome | null>(null);

  const stageIndex = stage === 'idle' ? -1 : stage === 'discovering' ? 0 : stage === 'frozen' ? 1 : stage === 'challenging' ? 2 : 3;

  const run = async () => {
    setStage('discovering');
    setOutcome(null);
    setClaim(null);
    setProgress(0);
    const tick = setInterval(() => setProgress((p) => Math.min(96, p + 7)), 60);
    await new Promise((r) => setTimeout(r, 400));
    const frozen = discoverAndFreeze(baseParams);
    clearInterval(tick);
    setProgress(100);
    setClaim(frozen);
    setStage('frozen');
    onAdopt(frozen.params);

    await new Promise((r) => setTimeout(r, 700));
    setStage('challenging');
    await new Promise((r) => setTimeout(r, 500));
    const res = challengeClaim(frozen);
    setOutcome(res);
    setStage('done');
  };

  const busy = stage === 'discovering' || stage === 'challenging';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
      <h3 className="font-mono text-xs sm:text-sm font-bold tracking-widest text-slate-200 uppercase flex items-center gap-2">
        <Search className="w-4 h-4 text-cyan-400 shrink-0" />
        Superiority Protocol
      </h3>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
        Search parameter space for a predicted advantage, freeze the region and its prediction, then re-test it on
        unseen seeds and shocks. Superiority is only granted if the holdout result clears the confidence and risk gates.
      </p>

      {/* Stage rail */}
      <ol className="mt-4 grid grid-cols-4 gap-1.5">
        {STAGE_LABELS.map((label, i) => (
          <li key={label} className="min-w-0">
            <div
              className={`h-1 rounded-full transition-colors ${
                i < stageIndex ? 'bg-cyan-500' : i === stageIndex ? 'bg-cyan-400 animate-pulse' : 'bg-slate-800'
              }`}
            />
            <span
              className={`mt-1.5 block truncate font-mono text-[9px] uppercase tracking-wider ${
                i <= stageIndex ? 'text-cyan-400' : 'text-slate-600'
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <Button
        onClick={run}
        disabled={busy}
        className="mt-5 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono uppercase text-[11px] tracking-wider h-11"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {stage === 'discovering' ? 'Sweeping regions…' : 'Challenging on holdout…'}
          </>
        ) : outcome ? (
          'Re-run protocol'
        ) : (
          'Run superiority protocol'
        )}
      </Button>

      {stage === 'discovering' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: `${progress}%` }} />
        </div>
      )}

      {claim && (
        <div className="mt-5 rounded-lg border border-cyan-900/40 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
            <Lock className="w-3.5 h-3.5" />
            Frozen claim {claim.id}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Predicted <span className="text-slate-200">+{claim.predictedDelta.toFixed(2)} ± {claim.predictedBand.toFixed(2)} pp</span>{' '}
            on discovery seeds [{claim.discoverySeeds.join(', ')}]. Holdout seeds [{claim.holdoutSeeds.join(', ')}] were
            not touched during the sweep.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
            <Row k="volatility" v={claim.params.renewableVolatility} />
            <Row k="friction" v={claim.params.geographicalFriction} />
            <Row k="reliability" v={claim.params.participantReliability} />
            <Row k="imbalance" v={claim.params.supplyDemandImbalance} />
          </dl>
        </div>
      )}

      {stage === 'challenging' && (
        <p className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <FlaskConical className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
          Replaying frozen region on unseen shock draws…
        </p>
      )}

      {outcome && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            outcome.granted ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-rose-500/40 bg-rose-950/10'
          }`}
        >
          <div className="flex items-start gap-2">
            {outcome.granted ? (
              <ShieldCheck className="mt-0.5 w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <ShieldX className="mt-0.5 w-4 h-4 shrink-0 text-rose-400" />
            )}
            <div className="min-w-0">
              <h4
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${
                  outcome.granted ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {outcome.granted ? 'Computational superiority confirmed within this regime' : 'Claim not upheld'}
              </h4>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{outcome.summary}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {outcome.gates.map((g) => (
              <li key={g.id} className="flex items-start gap-2">
                {g.passed ? (
                  <Check className="mt-0.5 w-3.5 h-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <X className="mt-0.5 w-3.5 h-3.5 shrink-0 text-rose-400" />
                )}
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium ${g.passed ? 'text-slate-200' : 'text-rose-300'}`}>{g.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-slate-500">{g.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 pt-px">
            <Cell label="Discovery Δ" value={`${outcome.claim.predictedDelta.toFixed(2)} pp`} />
            <Cell
              label="Holdout Δ"
              value={`${outcome.holdout.deltaUtility.toFixed(2)} ± ${outcome.holdout.deltaConfidence.toFixed(2)} pp`}
              tone={outcome.granted ? 'good' : 'bad'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ k: string; v: number }> = ({ k, v }) => (
  <>
    <dt className="truncate text-slate-500">{k}</dt>
    <dd className="text-right text-slate-200">{v.toFixed(2)}</dd>
  </>
);

const Cell: React.FC<{ label: string; value: string; tone?: 'good' | 'bad' }> = ({ label, value, tone }) => (
  <div className="bg-slate-950 p-3">
    <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
    <p
      className={`mt-1 font-mono text-xs ${
        tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : 'text-slate-200'
      }`}
    >
      {value}
    </p>
  </div>
);
