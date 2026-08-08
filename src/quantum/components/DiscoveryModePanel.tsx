import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Download,
  Flame,
  Layers,
  RefreshCw,
  Search,
  Zap,
  Play,
  FileCode,
  Target,
  ShieldAlert,
  Crosshair
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchAnomalies, CandidateAnomaly } from '@/lib/anomalyEngine';
import { compileAnomalyExperiment, CatalystArtifact } from '@/lib/catalyst';

interface DiscoveryModePanelProps {
  onLoadParameters: (params: Record<string, number>) => void;
  onGenerateCatalyst: (artifact: CatalystArtifact) => void;
}

const PLATFORMS = [
  'Any',
  'Atom Interferometer',
  'Optical Lattice (Strontium Clock)',
  'Superconducting Transmon Circuit',
  'Trapped Ion (171Yb+)'
];

const SENSITIVITIES = [
  { label: 'Any Sensitivity', value: 0 },
  { label: 'Moderate (ΔP > 0.05)', value: 0.05 },
  { label: 'High (ΔP > 0.1)', value: 0.1 },
  { label: 'Extreme (ΔP > 0.25)', value: 0.25 }
];

export const DiscoveryModePanel: React.FC<DiscoveryModePanelProps> = ({
  onLoadParameters,
  onGenerateCatalyst,
}) => {
  const [candidates, setCandidates] = useState<CandidateAnomaly[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchSeed, setSearchSeed] = useState(42);
  
  const [targetPlatform, setTargetPlatform] = useState<string>('Any');
  const [sensitivityLimit, setSensitivityLimit] = useState<number>(0);

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      const results = searchAnomalies({ 
        seed: searchSeed, 
        iterations: 500, // higher iterations to find matches with constraints
        targetPlatform,
        sensitivityLimit
      });
      setCandidates(results);
      setIsSearching(false);
      if (results.length > 0) setSelectedIndex(0);
      else setSelectedIndex(null);
      setSearchSeed((prev) => prev + 1);
    }, 600);
  };

  const selectedAnomaly = selectedIndex !== null && candidates[selectedIndex] ? candidates[selectedIndex] : null;

  const handleGenerateExperiment = async (anomaly: CandidateAnomaly) => {
    const artifact = await compileAnomalyExperiment(anomaly);
    onGenerateCatalyst(artifact);
  };

  const handleExportJSON = (anomaly: CandidateAnomaly) => {
    const blob = new Blob([JSON.stringify(anomaly, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment_card_${anomaly.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-md">
      {/* Header Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              DISCOVERY MODE <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-[10px] text-cyan-300">AUTO-SWEEP</Badge>
            </h2>
            <p className="text-xs text-slate-400">
              Automatically search parameter space to find experimentally distinguishable regimes.
            </p>
          </div>
        </div>
      </div>
      
      {/* Target Lock Constraints */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-300">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            TARGET PLATFORM
          </label>
          <select 
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            value={targetPlatform}
            onChange={(e) => setTargetPlatform(e.target.value)}
          >
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-300">
            <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
            SENSITIVITY LIMIT
          </label>
          <select 
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            value={sensitivityLimit}
            onChange={(e) => setSensitivityLimit(Number(e.target.value))}
          >
            {SENSITIVITIES.map(s => <option key={s.label} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="h-9 bg-gradient-to-r from-cyan-600 to-blue-700 font-mono text-xs font-bold tracking-wider text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-600"
        >
          {isSearching ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              SWEEPING...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              LOCK & DISCOVER
            </>
          )}
        </Button>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-slate-950/40 py-12 text-center">
          <Target className="mb-3 h-10 w-10 text-cyan-500/40" />
          <h3 className="font-mono text-sm font-semibold uppercase text-slate-300">
            No Experiments Discovered
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            Click &quot;LOCK & DISCOVER&quot; to sweep parameter space for anomalies that meet your target platform and sensitivity constraints.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Ranked Candidates List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <span>DISCOVERED REGIMES ({candidates.length})</span>
              <span className="text-cyan-400">SORTED BY SCORE</span>
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {candidates.map((cand, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <div
                    key={cand.id}
                    onClick={() => setSelectedIndex(idx)}
                    className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-500/10'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 font-mono text-[10px] text-cyan-300">
                          #{idx + 1}
                        </Badge>
                        <span className="font-mono text-xs font-bold text-slate-200">{cand.id}</span>
                      </div>
                      <Badge className="bg-amber-500/20 font-mono text-[11px] text-amber-300">
                        Score: {cand.score}
                      </Badge>
                    </div>

                    <div className="mt-2 flex items-center justify-between font-mono text-xs">
                      <span className="text-slate-400">ΔP Deviation:</span>
                      <span className="font-bold text-emerald-400">
                        {cand.deltaP >= 0 ? '+' : ''}
                        {cand.deltaP.toFixed(4)} ({cand.percentDeviation.toFixed(1)}%)
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate pr-2">Platform: {cand.candidatePlatform}</span>
                      <span className="text-cyan-300 shrink-0">{cand.numericalStability}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Experiment Card View */}
          {selectedAnomaly && (
            <div className="lg:col-span-7 space-y-4 rounded-lg border-2 border-slate-700 bg-slate-950 p-5 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-800">
                    <FileCode className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-mono text-lg font-bold text-slate-100">EXPERIMENT CARD</h3>
                    <div className="font-mono text-xs text-slate-400">{selectedAnomaly.id}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="border-cyan-500/50 text-cyan-300 font-mono">
                    TARGET: {selectedAnomaly.candidatePlatform.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Prediction Grid */}
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-1">
                    <Badge className="bg-blue-600/30 text-[8px] text-blue-200">ESTABLISHED PHYSICS</Badge>
                  </div>
                  <div className="text-[10px] text-blue-400 mt-2">STANDARD QM PREDICTION</div>
                  <div className="text-xl font-bold text-blue-100">{selectedAnomaly.standardQM.toFixed(4)}</div>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-1">
                    <Badge className="bg-amber-600/30 text-[8px] text-amber-200">PROPOSED MODEL</Badge>
                  </div>
                  <div className="text-[10px] text-amber-400 mt-2">FIELD MODEL PREDICTION</div>
                  <div className="text-xl font-bold text-amber-100">
                    {selectedAnomaly.fieldModulatedModel.toFixed(4)}
                  </div>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3">
                  <div className="text-[10px] text-emerald-400">MEASURABLE DEVIATION ΔP</div>
                  <div className="text-xl font-bold text-emerald-300">
                    {selectedAnomaly.deltaP >= 0 ? '+' : ''}
                    {selectedAnomaly.deltaP.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Observables & Experimental Details */}
              <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Observable to measure:</span>
                  <span className="font-semibold text-cyan-300">{selectedAnomaly.sensitiveObservable}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Required Precision:</span>
                  <span className="font-semibold text-amber-300">
                    better than {Math.abs(selectedAnomaly.deltaP / 5).toExponential(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Required Parameter Regime:</span>
                  <span className="font-mono text-slate-200">
                    g={selectedAnomaly.parameters.g}, α={selectedAnomaly.parameters.alpha}, Δ={selectedAnomaly.parameters.delta}, φA={selectedAnomaly.parameters.phiA}, φB={selectedAnomaly.parameters.phiB}
                  </span>
                </div>
              </div>

              {/* Falsification Condition Box */}
              <div className="rounded-md border border-red-500/40 bg-red-950/20 p-4">
                <div className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase text-red-400">
                  <ShieldAlert className="h-4 w-4" />
                  EXPLICIT FALSIFICATION CONDITION
                </div>
                <p className="font-mono text-xs leading-relaxed text-red-200">
                  {selectedAnomaly.falsificationCondition}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  onClick={() => onLoadParameters(selectedAnomaly.parameters as unknown as Record<string, number>)}
                  className="flex-1 border border-cyan-500/50 bg-cyan-950/60 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60"
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  LOAD INTO REALITY SPLIT
                </Button>

                <Button
                  onClick={() => handleGenerateExperiment(selectedAnomaly)}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 font-mono text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-orange-500"
                >
                  <Layers className="mr-1.5 h-4 w-4" />
                  GENERATE CATALYST CODE
                </Button>

                <Button
                  onClick={() => handleExportJSON(selectedAnomaly)}
                  variant="outline"
                  className="border-slate-700 bg-slate-900 font-mono text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  SAVE CARD
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
