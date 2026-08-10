import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode,
  FlaskConical,
  Layers,
  Play,
  Ruler,
  ShieldAlert,
  Sigma,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import {
  DETECTION_SIGMA,
  experimentCardToCSV,
  testabilityLabel,
  type ExperimentCard,
} from '@/lib/experimentCard';

interface ExperimentCardViewProps {
  card: ExperimentCard;
  onLoadParameters?: (card: ExperimentCard) => void;
  onGenerateProtocol?: (card: ExperimentCard) => void;
  compact?: boolean;
}

const sci = (v: number) => (Number.isFinite(v) ? v.toExponential(2) : '∞');

const download = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const TESTABILITY_STYLES: Record<
  ExperimentCard['testability'],
  { className: string; icon: React.ElementType }
> = {
  testable_now: { className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200', icon: CheckCircle2 },
  needs_more_integration: { className: 'border-amber-500/50 bg-amber-500/10 text-amber-200', icon: AlertTriangle },
  below_systematic_floor: { className: 'border-red-500/50 bg-red-500/10 text-red-200', icon: XCircle },
};

/**
 * Full experiment card: parameters, observable, both predictions, the
 * uncertainty budget behind them, the precision required, and the explicit
 * result that would falsify the proposed model.
 */
export const ExperimentCardView: React.FC<ExperimentCardViewProps> = ({
  card,
  onLoadParameters,
  onGenerateProtocol,
  compact = false,
}) => {
  const verdict = TESTABILITY_STYLES[card.testability];
  const VerdictIcon = verdict.icon;

  return (
    <div className="space-y-4 rounded-xl border-2 border-slate-700 bg-slate-950 p-4 shadow-inner sm:p-5">
      {/* Card header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-800 text-cyan-400">
            <FileCode className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-mono text-base font-bold text-slate-100">EXPERIMENT CARD</h3>
            <p className="font-mono text-[11px] text-slate-400">
              {card.id} · {card.platform.label}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-bold ${verdict.className}`}
        >
          <VerdictIcon className="h-3.5 w-3.5" />
          {testabilityLabel(card.testability)}
        </div>
      </div>

      {card.modelValidity === 'extrapolated' && (
        <div className="flex items-start gap-2 rounded-lg border border-violet-500/40 bg-violet-950/25 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-violet-200">
              Outside the model&apos;s derived domain
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-100/90">
              The response kernel χ = exp(αL) is derived in the weak-response regime αL ≲ 1, and this
              regime uses α = {card.parameters.alpha}. The separation below is an extrapolation of
              the proposed model, not a consequence of it, and is ranked beneath regimes the model
              genuinely predicts.
            </p>
          </div>
        </div>
      )}

      {/* The two competing predictions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-3">
          <EpistemicTag kind="established" />
          <div className="mt-2 font-mono text-[10px] text-sky-400">STANDARD QM PREDICTS</div>
          <div className="font-mono text-2xl font-extrabold text-sky-100">
            {card.standardPrediction.toFixed(6)}
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
          <EpistemicTag kind="proposed" />
          <div className="mt-2 font-mono text-[10px] text-amber-400">PROPOSED MODEL PREDICTS</div>
          <div className="font-mono text-2xl font-extrabold text-amber-100">
            {card.modelPrediction.toFixed(6)}
          </div>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
          <EpistemicTag kind="prediction" />
          <div className="mt-2 font-mono text-[10px] text-emerald-400">SEPARATION Δ</div>
          <div className="font-mono text-2xl font-extrabold text-emerald-200">
            {card.delta >= 0 ? '+' : '−'}
            {Math.abs(card.delta).toExponential(3)}
          </div>
          <div className="font-mono text-[10px] text-emerald-400/80">
            {card.percentDeviation >= 0 ? '+' : ''}
            {card.percentDeviation.toFixed(3)}% of baseline
          </div>
        </div>
      </div>

      {/* Observable + parameter regime */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
            <FlaskConical className="h-3 w-3" /> Observable to measure
          </div>
          <p className="mt-1.5 text-xs font-semibold text-slate-200">{card.observable}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            Detected via {card.readoutChannel} on {card.platform.label}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">{card.platform.basis}</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
            <Layers className="h-3 w-3" /> Required parameter regime
          </div>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
            {(
              [
                ['g', card.parameters.g],
                ['α', card.parameters.alpha],
                ['Δ (eV)', card.parameters.delta],
                ['φA', card.parameters.phiA],
                ['φB', card.parameters.phiB],
                ['Γ', card.parameters.gamma],
                ['ω_w', card.parameters.omega_w],
              ] as Array<[string, number]>
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-semibold text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Uncertainty budget + required precision */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
          <Sigma className="h-3 w-3" /> Uncertainty budget & required precision
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <Stat label="σ per shot" value={sci(card.uncertainty.singleShot)} />
          <Stat
            label={`σ statistical (N = ${card.uncertainty.shots.toExponential(0)})`}
            value={sci(card.uncertainty.statistical)}
          />
          <Stat label="σ systematic (floor)" value={sci(card.uncertainty.systematic)} />
          <Stat label="σ total" value={sci(card.uncertainty.total)} emphasis />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Stat
            label={`Required 1σ precision for ${DETECTION_SIGMA}σ`}
            value={sci(card.requiredPrecision)}
            emphasis
          />
          <Stat
            label="Shots required"
            value={Number.isFinite(card.requiredShots) ? card.requiredShots.toExponential(2) : '∞'}
          />
          <Stat
            label="Significance at assumed N"
            value={`${card.significance.toFixed(2)}σ`}
            emphasis={card.significance >= DETECTION_SIGMA}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-500">
          {card.uncertainty.basis}
        </p>
      </div>

      {/* Falsification */}
      <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-red-300">
          <ShieldAlert className="h-4 w-4" />
          Explicit falsification condition
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-red-100">
          {card.falsificationCondition}
        </p>
      </div>

      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              <Ruler className="h-3 w-3" /> Required controls
            </div>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-slate-300">
              {card.controls.map((control) => (
                <li key={control} className="flex gap-1.5">
                  <span className="text-emerald-500">·</span>
                  {control}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Confounders that could fake this signal
            </div>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-slate-300">
              {card.confounders.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <span className="text-amber-500">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        {onLoadParameters && (
          <Button
            onClick={() => onLoadParameters(card)}
            className="flex-1 border border-cyan-500/50 bg-cyan-950/60 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60"
          >
            <Play className="mr-1.5 h-4 w-4" />
            LOAD INTO REALITY SPLIT
          </Button>
        )}
        {onGenerateProtocol && (
          <Button
            onClick={() => onGenerateProtocol(card)}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 font-mono text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-orange-500"
          >
            <Layers className="mr-1.5 h-4 w-4" />
            COMPILE CATALYST PROTOCOL
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => download(`${card.id}.json`, JSON.stringify(card, null, 2), 'application/json')}
          className="border-slate-700 bg-slate-900 font-mono text-xs text-slate-300 hover:bg-slate-800"
        >
          <Download className="mr-1.5 h-4 w-4" />
          JSON
        </Button>
        <Button
          variant="outline"
          onClick={() => download(`${card.id}.csv`, experimentCardToCSV(card), 'text/csv')}
          className="border-slate-700 bg-slate-900 font-mono text-xs text-slate-300 hover:bg-slate-800"
        >
          <Download className="mr-1.5 h-4 w-4" />
          CSV
        </Button>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({
  label,
  value,
  emphasis = false,
}) => (
  <div className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-1.5">
    <div className="font-mono text-[9px] uppercase leading-tight tracking-wider text-slate-500">
      {label}
    </div>
    <div
      className={`font-mono text-sm font-bold ${emphasis ? 'text-cyan-200' : 'text-slate-200'}`}
    >
      {value}
    </div>
  </div>
);
