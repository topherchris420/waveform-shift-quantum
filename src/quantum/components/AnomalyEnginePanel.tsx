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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchAnomalies, CandidateAnomaly } from '@/lib/anomalyEngine';
import { compileAnomalyExperiment, CatalystArtifact } from '@/lib/catalyst';

interface AnomalyEnginePanelProps {
  onLoadParameters: (params: Record<string, number>) => void;
  onGenerateCatalyst: (artifact: CatalystArtifact) => void;
}

export const AnomalyEnginePanel: React.FC<AnomalyEnginePanelProps> = ({
  onLoadParameters,
  onGenerateCatalyst,
}) => {
  const [candidates, setCandidates] = useState<CandidateAnomaly[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchSeed, setSearchSeed] = useState(42);

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      const results = searchAnomalies({ seed: searchSeed, iterations: 250 });
      setCandidates(results);
      setIsSearching(false);
      if (results.length > 0) setSelectedIndex(0);
      setSearchSeed((prev) => prev + 1);
    }, 400);
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
    a.download = `anomaly_${anomaly.id}.json`;
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
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-cyan-300">
              ANOMALY ENGINE
            </h2>
            <p className="text-xs text-slate-400">
              Automated parameter-space sweep for maximal deviation from Standard Quantum Mechanics.
            </p>
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={isSearching}
          size="lg"
          className="bg-gradient-to-r from-cyan-500 to-blue-600 font-mono text-xs font-bold tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500"
        >
          {isSearching ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              SWEEPING PARAMETER SPACE...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              SEARCH FOR DEVIATION
            </>
          )}
        </Button>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-slate-950/40 py-12 text-center">
          <Zap className="mb-3 h-10 w-10 text-cyan-500/40" />
          <h3 className="font-mono text-sm font-semibold uppercase text-slate-300">
            No Parameter Sweeps Initiated
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-400">
            Click &quot;SEARCH FOR DEVIATION&quot; to sweep parameter space (g, Δ, φA, φB, α, Γ, ω_w) for physical states that maximize measurable deviation from standard QM.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Ranked Candidates List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <span>RANKED CANDIDATES ({candidates.length})</span>
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
                      <span>Platform: {cand.candidatePlatform}</span>
                      <span className="text-cyan-300">{cand.numericalStability}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Anomaly Detail View */}
          {selectedAnomaly && (
            <div className="lg:col-span-7 space-y-4 rounded-lg border border-cyan-500/30 bg-slate-950/80 p-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <Badge className="mb-1 bg-cyan-500/20 text-cyan-200">ANOMALY FOUND</Badge>
                  <h3 className="font-mono text-lg font-bold text-slate-100">{selectedAnomaly.id}</h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-slate-400">SCORE</div>
                  <div className="font-mono text-2xl font-extrabold text-amber-400">
                    {selectedAnomaly.score}
                  </div>
                </div>
              </div>

              {/* Prediction Grid */}
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3">
                  <div className="text-[10px] text-blue-400">STANDARD QM</div>
                  <div className="text-xl font-bold text-blue-100">{selectedAnomaly.standardQM.toFixed(4)}</div>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3">
                  <div className="text-[10px] text-amber-400">FIELD MODEL</div>
                  <div className="text-xl font-bold text-amber-100">
                    {selectedAnomaly.fieldModulatedModel.toFixed(4)}
                  </div>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3">
                  <div className="text-[10px] text-emerald-400">DEVIATION ΔP</div>
                  <div className="text-xl font-bold text-emerald-300">
                    {selectedAnomaly.deltaP >= 0 ? '+' : ''}
                    {selectedAnomaly.deltaP.toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Observables & Experimental Details */}
              <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Most sensitive observable:</span>
                  <span className="font-semibold text-cyan-300">{selectedAnomaly.sensitiveObservable}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400">Candidate experimental platform:</span>
                  <span className="font-semibold text-amber-300">{selectedAnomaly.candidatePlatform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Parameter set:</span>
                  <span className="font-mono text-slate-200">
                    g={selectedAnomaly.parameters.g}, α={selectedAnomaly.parameters.alpha}, Δ={selectedAnomaly.parameters.delta}, φA={selectedAnomaly.parameters.phiA}, φB={selectedAnomaly.parameters.phiB}
                  </span>
                </div>
              </div>

              {/* Falsification Condition Box */}
              <div className="rounded-md border border-red-500/30 bg-red-950/20 p-3">
                <div className="mb-1 font-mono text-[11px] font-bold uppercase text-red-400">
                  FALSIFICATION CONDITION:
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
                  LOAD INTO LAB
                </Button>

                <Button
                  onClick={() => handleGenerateExperiment(selectedAnomaly)}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 font-mono text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-orange-500"
                >
                  <Layers className="mr-1.5 h-4 w-4" />
                  GENERATE EXPERIMENT
                </Button>

                <Button
                  onClick={() => handleExportJSON(selectedAnomaly)}
                  variant="outline"
                  className="border-slate-700 bg-slate-900 font-mono text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  EXPORT RESULT
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
