import React, { useCallback, useMemo, useState } from 'react';
import {
  Compass,
  Crosshair,
  Flame,
  Lightbulb,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { ExperimentCardView } from './ExperimentCardView';
import { runTargetLock, type TargetLockResult } from '@/lib/targetLock';
import { type ExperimentCard } from '@/lib/experimentCard';
import { ANY_PLATFORM_ID, PLATFORMS, SENSITIVITY_LIMITS } from '@/lib/platforms';
import { compileAnomalyExperiment, type CatalystArtifact } from '@/lib/catalyst';

interface DiscoveryModePanelProps {
  onLoadParameters: (card: ExperimentCard) => void;
  onGenerateCatalyst: (artifact: CatalystArtifact) => void;
}

const VERDICT_STYLES: Record<
  TargetLockResult['verdict'],
  { label: string; className: string }
> = {
  locked: {
    label: 'TARGET LOCKED',
    className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  },
  testable_only_with_longer_integration: {
    label: 'WEAK LOCK — INTEGRATION LIMITED',
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  },
  no_regime_above_sensitivity: {
    label: 'NO REGIME ABOVE YOUR SENSITIVITY LIMIT',
    className: 'border-slate-500/50 bg-slate-500/10 text-slate-200',
  },
  no_testable_regime: {
    label: 'NO TESTABLE REGIME — MODEL INDISTINGUISHABLE HERE',
    className: 'border-red-500/50 bg-red-500/10 text-red-200',
  },
};

export const DiscoveryModePanel: React.FC<DiscoveryModePanelProps> = ({
  onLoadParameters,
  onGenerateCatalyst,
}) => {
  const [result, setResult] = useState<TargetLockResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [platformId, setPlatformId] = useState<string>(ANY_PLATFORM_ID);
  const [sensitivityLimit, setSensitivityLimit] = useState<number>(0);
  const [seed, setSeed] = useState(42);

  const handleSearch = useCallback(() => {
    setIsSearching(true);
    // Yield a frame so the sweeping state paints before the synchronous sweep.
    window.setTimeout(() => {
      const next = runTargetLock({ platformId, sensitivityLimit, seed, iterations: 600 });
      setResult(next);
      setSelectedIndex(0);
      setSeed((value) => value + 1);
      setIsSearching(false);
    }, 30);
  }, [platformId, sensitivityLimit, seed]);

  const selectedCard = useMemo(
    () => (result && result.cards[selectedIndex]) || null,
    [result, selectedIndex]
  );

  const handleGenerateProtocol = useCallback(
    async (card: ExperimentCard) => {
      const artifact = await compileAnomalyExperiment({
        id: card.id,
        parameters: card.parameters as unknown as Record<string, number>,
        standardQM: card.standardPrediction,
        fieldModulatedModel: card.modelPrediction,
        deltaP: card.delta,
        sensitiveObservable: card.observable,
        candidatePlatform: card.platform.label,
        falsificationCondition: card.falsificationCondition,
        uncertainty: card.uncertainty.total,
        requiredPrecision: card.requiredPrecision,
        requiredShots: card.requiredShots,
        controls: card.controls,
        confounders: card.confounders,
      });
      onGenerateCatalyst(artifact);
    },
    [onGenerateCatalyst]
  );

  const verdict = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div
      id="discovery-mode"
      className="rounded-xl border border-cyan-500/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md sm:p-6"
    >
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-mono text-base font-bold uppercase tracking-wider text-cyan-300">
              Discovery Mode
              <Badge
                variant="outline"
                className="border-cyan-400/30 bg-cyan-400/10 text-[10px] text-cyan-300"
              >
                TARGET LOCK
              </Badge>
            </h2>
            <p className="text-xs text-slate-400">
              Sweeps parameter space and ranks regimes by statistical significance against a real
              apparatus — not by raw deviation.
            </p>
          </div>
        </div>
        <EpistemicTag kind="prediction" size="sm" />
      </div>

      {/* Target Lock constraints */}
      <div className="mb-5 grid gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div>
          <label
            htmlFor="target-platform"
            className="mb-1.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-300"
          >
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            TARGET PLATFORM
          </label>
          <select
            id="target-platform"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
          >
            <option value={ANY_PLATFORM_ID}>Any apparatus (let Catalyst choose)</option>
            {PLATFORMS.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.label} · floor {platform.systematicFloor.toExponential(0)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="sensitivity-limit"
            className="mb-1.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-300"
          >
            <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
            SENSITIVITY LIMIT
          </label>
          <select
            id="sensitivity-limit"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            value={sensitivityLimit}
            onChange={(event) => setSensitivityLimit(Number(event.target.value))}
          >
            {SENSITIVITY_LIMITS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="h-10 bg-gradient-to-r from-cyan-600 to-blue-700 font-mono text-xs font-bold tracking-wider text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-600"
        >
          {isSearching ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              SWEEPING…
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              LOCK &amp; DISCOVER
            </>
          )}
        </Button>
      </div>

      {!result ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-slate-950/40 py-12 text-center">
          <Compass className="mb-3 h-10 w-10 text-cyan-500/40" />
          <h3 className="font-mono text-sm font-semibold uppercase text-slate-300">
            Choose your constraints, then sweep
          </h3>
          <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-400">
            Target Lock evaluates hundreds of parameter regimes, discards those outside the model&apos;s
            stable range, and keeps only the ones a real apparatus could actually resolve. It reports
            what it rejected and why.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Verdict + guidance */}
          <div
            className={`rounded-lg border p-4 ${verdict?.className ?? 'border-slate-700 bg-slate-900'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold tracking-wider">{verdict?.label}</span>
              <span className="font-mono text-[10px] opacity-80">
                {result.scanned} regimes evaluated · seed {result.request.seed}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {result.guidance.map((line) => (
                <li key={line} className="flex gap-2 text-[11px] leading-relaxed opacity-95">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Rejection tally — evidence the search was real */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-3 lg:grid-cols-6">
            <Tally label="Outside stable g·α" value={result.rejected.unstable} />
            <Tally label="Below your Δ limit" value={result.rejected.belowSensitivity} />
            <Tally label="Degenerate / null" value={result.rejected.degenerate} />
            <Tally label="Wrong apparatus type" value={result.rejected.unsupportedMode} />
            <Tally label="Under systematic floor" value={result.rejected.belowSystematicFloor} />
            <Tally label="Over shot budget" value={result.rejected.beyondShotBudget} />
          </div>

          {result.cards.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Ranked candidates */}
              <div className="space-y-2 lg:col-span-4">
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span>SURVIVING REGIMES ({result.cards.length})</span>
                  <span className="text-cyan-400">RANKED BY σ</span>
                </div>
                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {result.cards.map((card, index) => {
                    const active = index === selectedIndex;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        aria-pressed={active}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-500/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-cyan-500/40 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
                            >
                              #{index + 1}
                            </Badge>
                            <span className="font-mono text-[11px] font-bold text-slate-200">
                              {card.platform.label}
                            </span>
                          </span>
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              card.testability === 'testable_now'
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                            }`}
                          >
                            {card.significance.toFixed(1)}σ
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
                          <span className="text-slate-500">|Δ|</span>
                          <span className="font-bold text-slate-200">
                            {Math.abs(card.delta).toExponential(2)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-slate-500">
                          <span>shots for 5σ</span>
                          <span>
                            {Number.isFinite(card.requiredShots)
                              ? card.requiredShots.toExponential(1)
                              : '∞'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected card */}
              <div className="lg:col-span-8">
                {selectedCard && (
                  <ExperimentCardView
                    card={selectedCard}
                    onLoadParameters={onLoadParameters}
                    onGenerateProtocol={handleGenerateProtocol}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Tally: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-slate-950 px-3 py-2">
    <div className="font-mono text-[9px] uppercase leading-tight tracking-wider text-slate-500">
      {label}
    </div>
    <div className="font-mono text-sm font-bold text-slate-300">{value}</div>
  </div>
);
