import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Radio, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BlochSphere } from '@/components/lab/BlochSphere';
import { TeleportationCircuit, type TeleportStep } from '@/components/lab/TeleportationCircuit';
import { PauliCorrectionVisualizer } from '@/components/lab/PauliCorrectionVisualizer';
import { TeleportTimeline } from '@/components/lab/TeleportTimeline';
import { EntanglementOverlay, type BellRecord } from '@/components/lab/EntanglementOverlay';
import { EpistemicTag } from '@/components/lab/EpistemicTag';
import { teleportationFidelity, wernerConcurrence, zzCorrelation } from '@/lib/physics';

export interface TeleportationSessionState {
  bits: Array<[0 | 1, 0 | 1]>;
  shots: number;
  purity: number;
  fidelity: number;
  concurrence: number;
  zz: number;
  theta: number;
  phi: number;
}

interface TeleportationWorkspaceProps {
  /** Environmental decoherence supplied by the surrounding laboratory state. */
  decoherence: number;
  onSessionChange?: (session: TeleportationSessionState) => void;
}

/**
 * Bennett-protocol teleportation bench.
 *
 * Everything in this panel is ESTABLISHED PHYSICS: a Bell pair, a Bell-basis
 * measurement, two classical bits, and a Pauli correction. It is kept alongside
 * the Reality Split as the control case — a protocol whose predictions are not
 * in dispute — so the proposed model is always read against something known.
 */
export const TeleportationWorkspace: React.FC<TeleportationWorkspaceProps> = ({
  decoherence,
  onSessionChange,
}) => {
  const [inputTheta, setInputTheta] = useState([Math.PI / 3]);
  const [inputPhi, setInputPhi] = useState([Math.PI / 5]);
  const [bellPurity, setBellPurity] = useState([0.98]);
  const [step, setStep] = useState<TeleportStep>(0);
  const [bits, setBits] = useState<[0 | 1, 0 | 1] | undefined>(undefined);
  const [history, setHistory] = useState<BellRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [scrubStep, setScrubStep] = useState<TeleportStep>(4);
  const idRef = useRef(0);
  const shotRef = useRef(0);

  const fidelity = useMemo(
    () => teleportationFidelity(bellPurity[0], decoherence),
    [bellPurity, decoherence]
  );
  const concurrence = useMemo(() => wernerConcurrence(bellPurity[0]), [bellPurity]);
  const zz = useMemo(() => zzCorrelation(history.slice(-32).map((r) => r.bits)), [history]);

  useEffect(() => {
    onSessionChange?.({
      bits: history.map((r) => r.bits),
      shots: history.length,
      purity: bellPurity[0],
      fidelity,
      concurrence,
      zz,
      theta: inputTheta[0],
      phi: inputPhi[0],
    });
  }, [history, bellPurity, fidelity, concurrence, zz, inputTheta, inputPhi, onSessionChange]);

  /**
   * One protocol run. Bell outcomes are drawn from a deterministic counter so
   * that repeated sessions reproduce the same sequence — the laboratory never
   * presents irreproducible numbers.
   */
  const runShot = useCallback(() => {
    const n = (shotRef.current += 1);
    const m1 = ((n * 7 + 3) % 4 < 2 ? 0 : 1) as 0 | 1;
    const m2 = ((n * 5 + 1) % 3 === 0 ? 1 : 0) as 0 | 1;
    const nextBits: [0 | 1, 0 | 1] = [m1, m2];
    setBits(nextBits);
    setStep(4);
    setHistory((current) => [
      ...current.slice(-63),
      {
        id: (idRef.current += 1),
        t: n,
        bits: nextBits,
        mode: 'teleportation',
        fidelity,
      },
    ]);
  }, [fidelity]);

  const reset = () => {
    setHistory([]);
    setBits(undefined);
    setStep(0);
    setSelectedEventId(null);
    idRef.current = 0;
    shotRef.current = 0;
  };

  const selectedRecord = history.find((r) => r.id === selectedEventId) ?? null;
  const isLive = selectedEventId === null;
  const displayStep: TeleportStep = isLive ? step : scrubStep;
  const displayBits = isLive ? bits : selectedRecord?.bits;

  // Output Bloch angles: with the Pauli correction applied the output matches
  // the input exactly; before step 4 it does not.
  const outputTheta = displayStep >= 4 ? inputTheta[0] : Math.PI - inputTheta[0];
  const outputPhi = displayStep >= 4 ? inputPhi[0] : inputPhi[0] + Math.PI;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-300">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
              Teleportation Bench — Bennett et al. (1993)
            </h3>
            <p className="text-xs text-slate-400">
              The control case: a protocol whose predictions are not in dispute.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EpistemicTag kind="established" />
          <Button
            size="sm"
            className="bg-sky-600 font-mono text-xs font-bold text-white hover:bg-sky-500"
            onClick={runShot}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            RUN SHOT
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 bg-slate-800 font-mono text-xs text-slate-200"
            onClick={reset}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            RESET
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Input / output states */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Alice input |ψ⟩
              </p>
              <BlochSphere theta={inputTheta[0]} phi={inputPhi[0]} size={150} label="|ψ_in⟩" />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Bob output
              </p>
              <BlochSphere theta={outputTheta} phi={outputPhi} size={150} label="|ψ_out⟩" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <LabeledSlider
              label="Input θ"
              value={inputTheta}
              onChange={setInputTheta}
              min={0}
              max={Math.PI}
              step={0.01}
              display={`${inputTheta[0].toFixed(2)} rad`}
            />
            <LabeledSlider
              label="Input φ"
              value={inputPhi}
              onChange={setInputPhi}
              min={0}
              max={2 * Math.PI}
              step={0.01}
              display={`${inputPhi[0].toFixed(2)} rad`}
            />
            <LabeledSlider
              label="Bell-pair purity p"
              value={bellPurity}
              onChange={setBellPurity}
              min={0.2}
              max={1}
              step={0.01}
              display={bellPurity[0].toFixed(2)}
            />
          </div>

          <EntanglementOverlay
            history={history}
            concurrence={concurrence}
            purity={bellPurity[0]}
            zz={zz}
            compact
          />
        </div>

        {/* Circuit + corrections */}
        <div className="space-y-4">
          <TeleportationCircuit step={displayStep} bits={displayBits} />

          <div className="flex flex-wrap items-center gap-1.5">
            {([0, 1, 2, 3, 4] as TeleportStep[]).map((value) => (
              <Button
                key={value}
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedEventId(null);
                  setStep(value);
                }}
                className={`h-7 border-slate-700 font-mono text-[11px] ${
                  displayStep === value
                    ? 'bg-sky-600/30 text-sky-200'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                STEP {value}
              </Button>
            ))}
          </div>

          <PauliCorrectionVisualizer step={displayStep} bits={displayBits} />

          <TeleportTimeline
            events={history}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            scrubStep={scrubStep}
            onScrubStep={setScrubStep}
            isLive={isLive}
            onGoLive={() => setSelectedEventId(null)}
            liveStep={step}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-4">
        <MetricCell label="Fidelity F" value={fidelity.toFixed(4)} note="classical bound 2/3" />
        <MetricCell label="Concurrence C" value={concurrence.toFixed(4)} note="entangled iff C > 0" />
        <MetricCell label="⟨ZZ⟩" value={zz.toFixed(4)} note={`${history.length} shots`} />
        <MetricCell
          label="Decoherence"
          value={decoherence.toFixed(3)}
          note="from laboratory field intensity"
        />
      </div>
    </section>
  );
};

interface LabeledSliderProps {
  label: string;
  value: number[];
  onChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}

const LabeledSlider: React.FC<LabeledSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
}) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="font-mono text-[11px] text-slate-300">{label}</span>
      <span className="font-mono text-[11px] font-bold text-sky-300">{display}</span>
    </div>
    <Slider aria-label={label} value={value} onValueChange={onChange} min={min} max={max} step={step} />
  </div>
);

const MetricCell: React.FC<{ label: string; value: string; note: string }> = ({
  label,
  value,
  note,
}) => (
  <div className="bg-slate-950 px-3 py-2.5">
    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-mono text-base font-bold text-slate-100">{value}</div>
    <div className="font-mono text-[10px] text-slate-500">{note}</div>
  </div>
);
