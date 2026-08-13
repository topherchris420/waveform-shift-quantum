import React, { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  Atom,
  Beaker,
  BookOpen,
  Download,
  Gauge,
  Layers,
  Radio,
  Sparkles,
  Split,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { InlineMath } from 'react-katex';
import { EquationBlock } from '@/components/lab/EquationBlock';
import { ReferencesFooter } from '@/components/lab/ReferencesFooter';
import { PhysicsToolRunner } from '@/components/lab/PhysicsToolRunner';
import { CatalystRunPanel } from '@/components/lab/CatalystRunPanel';
import { PaperReaderModal } from '@/components/lab/PaperReaderModal';
import { EpistemicLegend, EpistemicTag } from '@/components/lab/EpistemicTag';
import { ComparisonPanel } from '@/quantum/components/ComparisonPanel';
import { DiscoveryModePanel } from '@/quantum/components/DiscoveryModePanel';
import { RealitySplitStage } from '@/quantum/components/RealitySplitStage';
import { InstrumentScene, type SceneMode } from '@/quantum/components/InstrumentScene';
import {
  TeleportationWorkspace,
  type TeleportationSessionState,
} from '@/quantum/components/TeleportationWorkspace';
import { TwoSiteExperiment } from '@/quantum/experiments/TwoSiteExperiment';
import { SIMULATION_DISCLAIMER, type EpistemicClass } from '@/lib/epistemics';
import { DEFAULT_SPLIT_PARAMS, type RealitySplitParams, type SplitMode } from '@/lib/realitySplit';
import { getPlatform, PLATFORMS } from '@/lib/platforms';
import type { ExperimentCard } from '@/lib/experimentCard';
import type { CatalystArtifact } from '@/lib/catalyst';
import {
  interferometryPhaseShift,
  localizationKernel,
  toCSV,
  twoSiteModel,
} from '@/lib/physics';
import { Reveal } from '@/hooks/use-reveal';

type ExperimentMode =
  | 'two_site_transfer'
  | 'scalar_kernel'
  | 'signatures'
  | 'classical_limit'
  | 'teleportation'
  | 'interference'
  | 'superposition';

interface Measurement {
  id: number;
  timestamp: number;
  value: number;
  type: ExperimentMode;
}

interface ExperimentDefinition {
  label: string;
  eyebrow: string;
  icon: React.ElementType;
  premise: string;
  instruction: string;
  equation: string;
  equationNote?: string;
  epistemic: EpistemicClass;
}

const experiments: Record<ExperimentMode, ExperimentDefinition> = {
  two_site_transfer: {
    label: 'Two-Site Transfer',
    eyebrow: 'Woodyard (2026) §4 — Eq. (15)–(19), (28)',
    icon: Zap,
    premise:
      'Continuous spatial localization transfer between localized site states |A⟩ and |B⟩. Detuning δ(t) = (EB - EA) + g[φB(t) - φA(t)] shifts the mixing angle θ(t), transferring site occupation without discontinuous disappearance.',
    instruction:
      'Tune φA, φB and the coupling g. Watch the occupation imbalance z(t) change sign as localization transfers from Site A to Site B.',
    equation:
      'H_{2}(t) = \\begin{pmatrix} E_A + g\\phi_A(t) & \\Delta \\\\ \\Delta & E_B + g\\phi_B(t) \\end{pmatrix},\\quad z(t) = \\frac{\\delta(t)}{\\sqrt{\\delta(t)^2 + 4\\Delta^2}}',
    equationNote:
      'The two-level Hamiltonian itself is established physics. What is proposed is the g φ(x,t) coupling term and its interpretation as spatial re-localization.',
    epistemic: 'proposed',
  },
  scalar_kernel: {
    label: 'Response Kernel χ(x)',
    eyebrow: 'Woodyard (2026) §3 — Eq. (9)–(14)',
    icon: Waves,
    premise:
      'Observed localization density Ploc(x, t; ωw) is biased by a normalized response kernel χ(x) = exp[α L(x)], where L(x) is a Lorentzian response centred at the local resonance ωloc(x) = ω0 + βφ + κ∇²φ.',
    instruction:
      'Adjust drive frequency ωw, linewidth Γ and response strength α. Total probability stays exactly normalized; only its spatial distribution changes.',
    equation:
      'P_{\\text{loc}}(\\mathbf{x},t;\\omega_w) = \\frac{\\chi(\\mathbf{x},t;\\omega_w)|\\psi(\\mathbf{x},t)|^2}{\\int d^3x\'\\, \\chi(\\mathbf{x}\',t;\\omega_w)|\\psi(\\mathbf{x}\',t)|^2},\\quad \\chi = e^{\\alpha \\mathcal{L}}',
    equationNote:
      'Standard Born rule is recovered exactly as α → 0, which is what makes the deviation falsifiable rather than unfalsifiable.',
    epistemic: 'proposed',
  },
  signatures: {
    label: 'Experimental Signatures',
    eyebrow: 'Woodyard (2026) §7 — Eq. (28)–(31)',
    icon: Target,
    premise:
      'Four candidate observables: double-well occupation imbalance z(t), matter-wave interferometric phase shift Δφ_φ, clock-comparison differential offset ΔΦ_AB, and the driven localization-statistics anomaly δP.',
    instruction:
      'Modulate the external scalar drive and read the accumulated interferometric phase. These are predictions, not measurements.',
    equation:
      '\\Delta\\varphi_\\phi = \\frac{g}{\\hbar} \\int_{0}^{T} [\\phi(\\mathbf{x}_1(t),t) - \\phi(\\mathbf{x}_2(t),t)]\\, dt,\\quad \\Delta\\Phi_{AB} = \\eta \\int_{0}^{T} \\delta\\phi\\, dt',
    equationNote:
      'Each expression yields a number a real apparatus could return, which is the precondition for the Target Lock search.',
    epistemic: 'prediction',
  },
  classical_limit: {
    label: 'Ehrenfest Classical Limit',
    eyebrow: 'Woodyard (2026) §6 — Eq. (25)–(27)',
    icon: Gauge,
    premise:
      'Narrow wavepackets follow Ehrenfest dynamics in an effective potential V_eff(x, t) = V(x) + g φ(x, t). Re-localization corresponds to the continuous shift of stable potential minima.',
    instruction:
      'Reposition the scalar sources to deform V_eff(x, t) and watch the classical centre settle into the new minimum.',
    equation:
      'm\\ddot{\\mathbf{x}}_{\\text{cl}} = -\\nabla \\left[\\, V(\\mathbf{x}_{\\text{cl}}) + g\\,\\phi(\\mathbf{x}_{\\text{cl}},t)\\,\\right],\\quad V_{\\text{eff}} = V + g\\phi',
    equationNote:
      'Ehrenfest’s theorem is established physics; reading the shifted minimum as "position emerging dynamically" is an interpretation.',
    epistemic: 'interpretation',
  },
  teleportation: {
    label: 'Teleportation Protocol',
    eyebrow: 'Bennett et al. (1993)',
    icon: Radio,
    premise:
      'Discrete state teleportation via a shared Bell pair and two classical bits. Included as the control case: a protocol whose predictions are settled.',
    instruction:
      'Set the input state on the Bloch sphere, then step through Bell measurement and Pauli correction to reconstruct |ψ⟩ at Bob.',
    equation:
      '|\\Phi^{+}\\rangle = \\tfrac{1}{\\sqrt{2}}(|00\\rangle+|11\\rangle),\\quad F = |\\langle\\psi_{\\text{in}}|\\psi_{\\text{out}}\\rangle|^{2}',
    equationNote:
      'No matter or energy traverses the channel; the protocol transfers state via entanglement plus classical communication.',
    epistemic: 'established',
  },
  interference: {
    label: 'Double Slit Interference',
    eyebrow: 'Fraunhofer limit',
    icon: Waves,
    premise:
      'A monochromatic matter wave of wavelength λ passes through two slits of separation d, forming an intensity pattern on a screen at distance L.',
    instruction: 'Tune wavelength, slit separation and screen distance to verify Fraunhofer diffraction.',
    equation:
      'I(y) = I_{0}\\,\\cos^{2}\\!\\left(\\frac{\\pi\\, d\\, \\sin\\theta}{\\lambda}\\right),\\quad \\sin\\theta \\approx y/L',
    equationNote: 'Standard far-field diffraction — textbook physics, included as a calibration case.',
    epistemic: 'established',
  },
  superposition: {
    label: 'Bloch Superposition',
    eyebrow: 'Bloch sphere & Born rule',
    icon: Atom,
    premise:
      'A pure qubit state |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩. Projective measurement yields |0⟩ with probability cos²(θ/2).',
    instruction: 'Tune θ and φ, then measure repeatedly to verify convergence to the Born-rule expectation.',
    equation:
      '|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\varphi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle,\\quad P(0)=\\cos^{2}\\tfrac{\\theta}{2}',
    equationNote: 'Standard Born rule projective measurement.',
    epistemic: 'established',
  },
};

const modeOrder: ExperimentMode[] = [
  'two_site_transfer',
  'scalar_kernel',
  'signatures',
  'classical_limit',
  'teleportation',
  'interference',
  'superposition',
];

const SPLIT_MODES: Array<{ id: SplitMode; label: string }> = [
  { id: 'two_site', label: 'Two-Site Transfer' },
  { id: 'scalar_kernel', label: 'Localization Kernel' },
];

export const QuantumLab: React.FC = () => {
  // One shared parameter set: the stage, the comparison, the numerical
  // evolution and the exported artifacts all read from this single object.
  const [splitParams, setSplitParams] = useState<RealitySplitParams>(DEFAULT_SPLIT_PARAMS);
  const [splitMode, setSplitMode] = useState<SplitMode>('two_site');
  const [platformId, setPlatformId] = useState<string>('atom_interferometer');
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('two_site_transfer');
  const [fieldIntensity, setFieldIntensity] = useState([0.58]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [customCatalystArtifact, setCustomCatalystArtifact] = useState<CatalystArtifact | undefined>();
  const [teleportSession, setTeleportSession] = useState<TeleportationSessionState>({
    bits: [],
    shots: 0,
    purity: 0.98,
    fidelity: 0.88,
    concurrence: 0.97,
    zz: 0,
    theta: Math.PI / 3,
    phi: Math.PI / 5,
  });
  const [statusMessage, setStatusMessage] = useState(
    'Reality Split initialized. Both models start from |ψ(0)⟩ = |A⟩. Raise the coupling g — or drag a field handle — to make them diverge.'
  );

  const measurementIdRef = React.useRef(0);
  const activeExperiment = experiments[experimentMode];
  const platform = getPlatform(platformId) ?? PLATFORMS[0];

  const updateParams = useCallback((next: Partial<RealitySplitParams>) => {
    setSplitParams((current) => ({ ...current, ...next }));
  }, []);

  const comparisonKey = splitMode === 'scalar_kernel' ? 'scalar_kernel' : 'two_site';

  // Live analytical readouts for the hero strip.
  const eigenState = useMemo(
    () =>
      twoSiteModel({
        EA: splitParams.EA,
        EB: splitParams.EB,
        phiA: splitParams.phiA,
        phiB: splitParams.phiB,
        g: splitParams.g,
        delta: splitParams.delta,
      }),
    [splitParams]
  );

  const kernel = useMemo(
    () =>
      localizationKernel({
        omega0: 10.0,
        beta: 2.0,
        kappa: 0.5,
        phi: (splitParams.phiA + splitParams.phiB) / 2,
        d2phi: 0.2,
        omega_w: splitParams.omega_w,
        gamma: splitParams.gamma,
        alpha: splitParams.alpha,
      }),
    [splitParams]
  );

  const phaseShift = useMemo(
    () =>
      Math.abs(
        interferometryPhaseShift(splitParams.g, 1.0, (splitParams.phiB - splitParams.phiA) * 1.6)
      ),
    [splitParams]
  );

  const recordMeasurement = useCallback((type: ExperimentMode, value: number) => {
    setMeasurements((current) => [
      ...current.slice(-49),
      {
        id: (measurementIdRef.current += 1),
        timestamp: Date.now() / 1000,
        value,
        type,
      },
    ]);
  }, []);

  const runExperiment = useCallback(() => {
    const z = eigenState.z;
    recordMeasurement(experimentMode, (z + 1) / 2);
    setStatusMessage(
      `Run recorded — detuning δ = ${eigenState.detuning.toFixed(4)} eV, P_A = ${(eigenState.PA * 100).toFixed(2)}%, ` +
        `P_B = ${(eigenState.PB * 100).toFixed(2)}%, imbalance z = ${z.toFixed(4)}. ` +
        `This is simulation output, not measured data.`
    );
  }, [eigenState, experimentMode, recordMeasurement]);

  const exportCSV = useCallback(() => {
    const csv = toCSV(
      measurements.map((m) => ({
        id: m.id,
        timestamp: m.timestamp,
        value: m.value,
        type: m.type,
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `waveform-shift-measurements-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [measurements]);

  const loadCardParameters = useCallback(
    (card: ExperimentCard) => {
      updateParams({
        g: card.parameters.g,
        phiA: card.parameters.phiA,
        phiB: card.parameters.phiB,
        delta: card.parameters.delta,
        alpha: card.parameters.alpha,
        gamma: card.parameters.gamma,
        omega_w: card.parameters.omega_w,
      });
      setSplitMode(card.experimentType === 'scalar_kernel' ? 'scalar_kernel' : 'two_site');
      setPlatformId(card.platform.id);
      setStatusMessage(
        `Loaded ${card.id} into the Reality Split — ${card.platform.label}, |Δ| = ${Math.abs(card.delta).toExponential(3)}, ` +
          `${card.significance.toFixed(1)}σ at ${card.uncertainty.shots.toExponential(0)} shots.`
      );
      document.getElementById('reality-split')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [updateParams]
  );

  const handleDistinguishable = useCallback((traceDistance: number) => {
    setStatusMessage(
      `The predictions have separated beyond the selected platform's noise floor (D = ${traceDistance.toExponential(3)}). ` +
        `Run Target Lock to turn this regime into a concrete experiment card.`
    );
  }, []);

  const sceneMode: SceneMode =
    experimentMode === 'two_site_transfer' ? 'scalar_kernel' : (experimentMode as SceneMode);

  return (
    <main className="experience-background min-h-screen text-foreground">
      {/* Editorial masthead */}
      <Reveal as="section" variant="up" className="mx-auto max-w-[1700px] px-4 pb-4 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="hero-rule pl-6 md:pl-12">
          <p className="section-eyebrow mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>Project Falsification // Woodyard 2026</span>
            <span className="inline-block h-1.5 w-1.5 bg-primary" aria-hidden="true" />
            <span>Vers3Dynamics</span>
          </p>
          <h1 className="hero-title max-w-5xl">
            Two theories.
            <br />
            One initial condition.
            <br />
            <span className="text-primary">Find the experiment</span> that decides.
          </h1>
          <div className="mt-10 flex flex-col items-start gap-8 md:flex-row md:items-end">
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Standard quantum mechanics and the proposed field-modulated localization model{' '}
              <InlineMath math="\phi(\mathbf{x}, t)" /> are evolved side by side from identical
              initial conditions. Change one physical parameter and watch where — and by how much —
              their predictions separate.
            </p>
            <a
              href="#reality-split"
              className="shrink-0 border border-ink bg-foreground px-8 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-background transition-colors duration-300 hover:bg-primary"
            >
              Initiate sequence
            </a>
          </div>
        </div>

        <div className="mt-14 border-t border-foreground pt-4">
          <EpistemicLegend />
          <p className="mt-3 border-t border-foreground/10 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {SIMULATION_DISCLAIMER}
          </p>
        </div>

        <Reveal
          stagger
          variant="up"
          delay={120}
          className="mt-8 grid grid-cols-1 border-y border-foreground divide-y divide-foreground md:grid-cols-4 md:divide-x md:divide-y-0"
        >
          <Metric label="Imbalance z" value={eigenState.z.toFixed(3)} icon={Zap} tone="violet" kind="proposed" />
          <Metric label="Kernel χ" value={kernel.chi.toFixed(3)} icon={Waves} tone="lime" kind="proposed" />
          <Metric label="Phase Δφ_φ" value={`${phaseShift.toFixed(3)} rad`} icon={Target} tone="copper" kind="prediction" />
          <Metric label="Detuning δ" value={`${eigenState.detuning.toFixed(3)} eV`} icon={Activity} tone="primary" kind="proposed" />
        </Reveal>
      </Reveal>

      {/* ============================ THE CENTREPIECE ============================ */}
      <Reveal as="section" variant="scale" className="mx-auto mt-6 max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <RealitySplitStage
            mode={splitMode}
            params={splitParams}
            onParamsChange={updateParams}
            platform={platform}
            onDistinguishable={handleDistinguishable}
          />

          {/* Parameter rail */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
              <PanelHeader eyebrow="Comparison" title="What is being split" icon={Split} />
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {SPLIT_MODES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={splitMode === option.id}
                    onClick={() => setSplitMode(option.id)}
                    className={`rounded-md border px-2.5 py-2 font-mono text-[11px] transition ${
                      splitMode === option.id
                        ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100'
                        : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="stage-platform"
                  className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-300"
                >
                  <Target className="h-3.5 w-3.5 text-cyan-400" />
                  MEASURED AGAINST
                </label>
                <select
                  id="stage-platform"
                  value={platformId}
                  onChange={(event) => setPlatformId(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                >
                  {PLATFORMS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-slate-500">
                  Sets the noise floor the divergence must clear to count as measurable.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
              <PanelHeader eyebrow="Direct manipulation" title="Field & coupling" icon={Waves} />
              <div className="mt-4 space-y-4">
                <LabSlider
                  icon={Target}
                  label="Field at site A — φA"
                  value={[splitParams.phiA]}
                  onValueChange={([v]) => updateParams({ phiA: v })}
                  min={-2}
                  max={2}
                  step={0.01}
                  display={splitParams.phiA.toFixed(2)}
                />
                <LabSlider
                  icon={Target}
                  label="Field at site B — φB"
                  value={[splitParams.phiB]}
                  onValueChange={([v]) => updateParams({ phiB: v })}
                  min={-2}
                  max={2}
                  step={0.01}
                  display={splitParams.phiB.toFixed(2)}
                />
                <LabSlider
                  icon={Gauge}
                  label="Mixing amplitude Δ"
                  value={[splitParams.delta]}
                  onValueChange={([v]) => updateParams({ delta: v })}
                  min={0.05}
                  max={1}
                  step={0.01}
                  display={`${splitParams.delta.toFixed(2)} eV`}
                />
                <LabSlider
                  icon={Activity}
                  label="Drive amplitude"
                  value={[splitParams.driveAmplitude]}
                  onValueChange={([v]) => updateParams({ driveAmplitude: v })}
                  min={0}
                  max={1.5}
                  step={0.01}
                  display={splitParams.driveAmplitude.toFixed(2)}
                />
                <LabSlider
                  icon={Radio}
                  label="Drive frequency ω"
                  value={[splitParams.driveOmega]}
                  onValueChange={([v]) => updateParams({ driveOmega: v })}
                  min={0}
                  max={6}
                  step={0.05}
                  display={splitParams.driveOmega.toFixed(2)}
                />
                {splitMode === 'scalar_kernel' && (
                  <>
                    <LabSlider
                      icon={Sparkles}
                      label="Response strength α"
                      value={[splitParams.alpha]}
                      onValueChange={([v]) => updateParams({ alpha: v })}
                      min={0}
                      max={3}
                      step={0.01}
                      display={splitParams.alpha.toFixed(2)}
                    />
                    <LabSlider
                      icon={Waves}
                      label="Linewidth Γ"
                      value={[splitParams.gamma]}
                      onValueChange={([v]) => updateParams({ gamma: v })}
                      min={0.2}
                      max={4}
                      step={0.05}
                      display={splitParams.gamma.toFixed(2)}
                    />
                    <LabSlider
                      icon={Radio}
                      label="Drive ω_w"
                      value={[splitParams.omega_w]}
                      onValueChange={([v]) => updateParams({ omega_w: v })}
                      min={5}
                      max={25}
                      step={0.1}
                      display={`${splitParams.omega_w.toFixed(1)} GHz`}
                    />
                  </>
                )}
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full border-slate-700 bg-slate-950 font-mono text-[11px] text-slate-300 hover:bg-slate-800"
                onClick={() => {
                  setSplitParams(DEFAULT_SPLIT_PARAMS);
                  setStatusMessage('Parameters reset to the paper’s reference regime.');
                }}
              >
                RESET TO REFERENCE REGIME
              </Button>
            </div>
          </aside>
        </div>

        {/* Observation log */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-400">
              Observation log
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">{statusMessage}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="border-slate-700 font-mono text-[10px] text-slate-400">
              {measurements.length} recorded
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={exportCSV}
              disabled={measurements.length === 0}
              className="border-slate-700 bg-slate-950 font-mono text-[11px] text-slate-300 hover:bg-slate-800"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              EXPORT CSV
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Numbers behind the split */}
      <Reveal as="section" variant="up" className="mx-auto mt-6 max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <ComparisonPanel
          experimentMode={comparisonKey}
          parameters={{
            g: splitParams.g,
            phiA: splitParams.phiA,
            phiB: splitParams.phiB,
            delta: splitParams.delta,
            alpha: splitParams.alpha,
            gamma: splitParams.gamma,
            omega_w: splitParams.omega_w,
            purity: teleportSession.purity,
            decoherence: 1 - fieldIntensity[0] * 0.7,
          }}
        />
      </Reveal>

      {/* Discovery Mode + Target Lock */}
      <Reveal as="section" variant="up" className="mx-auto mt-6 max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <DiscoveryModePanel
          onLoadParameters={loadCardParameters}
          onGenerateCatalyst={(artifact) => {
            setCustomCatalystArtifact(artifact);
            setStatusMessage(`Catalyst research artifact ${artifact.run_id} compiled.`);
            document.getElementById('catalyst-panel')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </Reveal>

      {/* ============================ INSTRUMENT BAY ============================ */}
      <Reveal as="section" variant="up" id="instrument-bay" className="mx-auto mt-8 max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <p className="section-eyebrow text-cyan-400">Supporting instruments</p>
            <h2 className="mt-0.5 text-lg font-semibold text-foreground">
              Everything the split is built from
            </h2>
          </div>
          <EpistemicTag kind={activeExperiment.epistemic} size="sm" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="space-y-4">
            <InstrumentScene
              mode={sceneMode}
              fieldIntensity={fieldIntensity[0]}
              couplingG={splitParams.g}
              responseAlpha={splitParams.alpha}
              phaseShift={phaseShift}
              epistemicKind={activeExperiment.epistemic}
              caption={activeExperiment.premise}
            />

            <TwoSiteExperiment
              parameters={{
                g: splitParams.g,
                phiA: splitParams.phiA,
                phiB: splitParams.phiB,
                delta: splitParams.delta,
              }}
            />
          </div>

          <div className="space-y-4">
            <section className="instrument-panel p-4">
              <PanelHeader
                eyebrow={activeExperiment.eyebrow}
                title={activeExperiment.label}
                icon={activeExperiment.icon}
              />
              <p className="mt-3 text-xs leading-6 text-slate-300">{activeExperiment.premise}</p>
              <div className="mt-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-[11px] leading-5 text-cyan-100">
                {activeExperiment.instruction}
              </div>
              <div className="mt-3">
                <EquationBlock
                  title={activeExperiment.eyebrow}
                  latex={activeExperiment.equation}
                  note={activeExperiment.equationNote}
                />
              </div>
            </section>

            <section className="instrument-panel p-4">
              <PanelHeader eyebrow="Model catalogue" title="Woodyard (2026) framework" icon={Layers} />
              <div className="mt-3 space-y-1.5">
                {modeOrder.map((mode) => {
                  const definition = experiments[mode];
                  const Icon = definition.icon;
                  const active = experimentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setExperimentMode(mode);
                        if (mode === 'two_site_transfer') setSplitMode('two_site');
                        if (mode === 'scalar_kernel') setSplitMode('scalar_kernel');
                        setStatusMessage(`${definition.label} — ${definition.instruction}`);
                      }}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        active
                          ? 'border-cyan-400/60 bg-cyan-500/20 text-foreground'
                          : 'border-white/10 bg-black/20 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-400' : 'text-muted-foreground'}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                          {definition.label}
                        </span>
                        <EpistemicTag kind={definition.epistemic} short hideIcon />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="instrument-panel p-4">
              <PanelHeader eyebrow="Environment" title="Laboratory field intensity" icon={Waves} />
              <div className="mt-4">
                <LabSlider
                  icon={Waves}
                  label="Field intensity φ₀"
                  value={fieldIntensity}
                  onValueChange={setFieldIntensity}
                  min={0.1}
                  max={2}
                  step={0.01}
                  display={fieldIntensity[0].toFixed(2)}
                />
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
                Drives the backdrop scene and the decoherence term fed to the teleportation bench and
                Catalyst session.
              </p>
            </section>
          </div>
        </div>
      </Reveal>

      {/* Teleportation bench (established-physics control case) */}
      <Reveal as="section" variant="up" className="mx-auto mt-6 max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <TeleportationWorkspace
          decoherence={1 - fieldIntensity[0] * 0.7}
          onSessionChange={setTeleportSession}
        />
      </Reveal>

      {/* Analytical tool runner */}
      <Reveal as="section" variant="up" className="mx-auto mt-6 max-w-[1700px] px-4 sm:px-6 lg:px-8">
        <PhysicsToolRunner />
      </Reveal>

      {/* Catalyst verification */}
      <Reveal id="catalyst-panel" variant="mask" className="mt-6">
        <CatalystRunPanel
          session={{
            mode: splitMode,
            shots: teleportSession.shots,
            bits: teleportSession.bits,
            purity: teleportSession.purity,
            decoherence: 1 - fieldIntensity[0] * 0.7,
            fidelity: teleportSession.fidelity,
            concurrence: teleportSession.concurrence,
            zz: teleportSession.zz,
            theta: teleportSession.theta,
            phi: teleportSession.phi,
            seed: 137,
            parameters: {
              g: splitParams.g,
              phiA: splitParams.phiA,
              phiB: splitParams.phiB,
              delta: splitParams.delta,
              alpha: splitParams.alpha,
              gamma: splitParams.gamma,
              omega_w: splitParams.omega_w,
            },
          }}
          customArtifact={customCatalystArtifact}
        />
      </Reveal>

      <ReferencesFooter />

      <PaperReaderModal
        isOpen={isPaperModalOpen}
        onClose={() => setIsPaperModalOpen(false)}
        onSelectPreset={(mode) => {
          setExperimentMode(mode as ExperimentMode);
          if (mode === 'scalar_kernel') setSplitMode('scalar_kernel');
          if (mode === 'two_site_transfer') setSplitMode('two_site');
          setStatusMessage(`${experiments[mode as ExperimentMode].label} loaded from the manuscript.`);
        }}
      />
    </main>
  );
};

const BrandMark: React.FC = () => (
  <div className="brand-mark" aria-hidden="true">
    <span className="brand-mark__ring" />
    <span className="brand-mark__axis brand-mark__axis--x" />
    <span className="brand-mark__axis brand-mark__axis--y" />
    <span className="brand-mark__text">WQ</span>
  </div>
);

interface MetricProps {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: 'primary' | 'copper' | 'lime' | 'violet';
  kind: EpistemicClass;
}

const metricToneStyles: Record<NonNullable<MetricProps['tone']>, string> = {
  primary: 'bg-primary',
  copper: 'bg-copper',
  lime: 'bg-lime',
  violet: 'bg-violet',
};

const Metric: React.FC<MetricProps> = ({ label, value, icon: Icon, tone = 'primary', kind }) => (
  <div className="metric-cell p-6 lg:p-8">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <Icon className="h-3.5 w-3.5 text-foreground/50" />
    </div>
    <p className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
      {value}
    </p>
    <div className="mt-4 h-1 w-full bg-foreground/10">
      <div className={`h-full w-2/3 ${metricToneStyles[tone]}`} />
    </div>
    <div className="mt-3">
      <EpistemicTag kind={kind} short hideIcon />
    </div>
  </div>
);

interface PanelHeaderProps {
  eyebrow: string;
  title: string;
  icon: React.ElementType;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ eyebrow, title, icon: Icon }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="section-eyebrow text-[10px] text-cyan-400">{eyebrow}</p>
      <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">{title}</h3>
    </div>
  </div>
);

interface LabSliderProps {
  icon: React.ElementType;
  label: string;
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}

const LabSlider: React.FC<LabSliderProps> = ({
  icon: Icon,
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  display,
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3">
      <label className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-200">
        <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
        <span className="truncate">{label}</span>
      </label>
      <span className="shrink-0 font-mono text-[11px] font-bold text-cyan-300">{display}</span>
    </div>
    <Slider aria-label={label} value={value} onValueChange={onValueChange} min={min} max={max} step={step} />
  </div>
);
