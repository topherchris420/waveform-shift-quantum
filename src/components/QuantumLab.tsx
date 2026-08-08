import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Atom,
  BarChart3,
  Beaker,
  BookOpen,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Layers,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BlochSphere } from '@/components/lab/BlochSphere';
import { TeleportationCircuit, type TeleportStep } from '@/components/lab/TeleportationCircuit';
import { PauliCorrectionVisualizer } from '@/components/lab/PauliCorrectionVisualizer';
import { TeleportTimeline } from '@/components/lab/TeleportTimeline';
import { EquationBlock } from '@/components/lab/EquationBlock';
import { InlineMath } from 'react-katex';
import { ReferencesFooter } from '@/components/lab/ReferencesFooter';
import { PhysicsToolRunner } from '@/components/lab/PhysicsToolRunner';
import { CatalystRunPanel } from '@/components/lab/CatalystRunPanel';
import { PaperReaderModal } from '@/components/lab/PaperReaderModal';
import { ComparisonPanel } from '@/quantum/components/ComparisonPanel';
import { AnomalyEnginePanel } from '@/quantum/components/AnomalyEnginePanel';
import { TwoSiteExperiment } from '@/quantum/experiments/TwoSiteExperiment';
import { CatalystArtifact } from '@/lib/catalyst';
import {
  barrierTransmission,
  bornProbabilities,
  clockComparisonPhase,
  ehrenfestEffectivePotential,
  interferometryPhaseShift,
  localizationKernel,
  observedLocalizationDensity,
  teleportationFidelity,
  toCSV,
  twoSiteModel,
  wernerConcurrence,
  zzCorrelation,
} from '@/lib/physics';
import { EntanglementOverlay, type BellRecord } from '@/components/lab/EntanglementOverlay';

type ExperimentMode =
  | 'two_site_transfer'
  | 'scalar_kernel'
  | 'signatures'
  | 'classical_limit'
  | 'teleportation'
  | 'interference'
  | 'superposition';

interface QuantumObject {
  id: string;
  x: number;
  y: number;
  frequency: number;
  phase: number;
  amplitude: number;
  isEntangled: boolean;
  entangledWith?: string;
  isTeleporting: boolean;
}

interface ResonanceNode {
  x: number;
  y: number;
  intensity: number;
  phase: number;
}

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
  readoutLabel: string;
  equation: string;
  equationNote?: string;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;

const experiments: Record<ExperimentMode, ExperimentDefinition> = {
  two_site_transfer: {
    label: 'Two-Site Transfer',
    eyebrow: 'Woodyard (2026) §4 — Eq. (15)–(19), (28)',
    icon: Zap,
    premise:
      'Continuous spatial localization transfer between localized site states |A⟩ and |B⟩. Detuning δ(t) = (EB - EA) + g[φB(t) - φA(t)] shifts the mixing angle θ(t), dynamically transferring site occupation without discontinuous disappearance.',
    instruction:
      'Tune field scalar values φA, φB and coupling g. Watch occupation imbalance z(t) change sign adiabatically as localization smoothly transfers from Site A to Site B.',
    readoutLabel: 'Imbalance z(t)',
    equation:
      'H_{2}(t) = \\begin{pmatrix} E_A + g\\phi_A(t) & \\Delta \\\\ \\Delta & E_B + g\\phi_B(t) \\end{pmatrix},\\quad z(t) = \\frac{\\delta(t)}{\\sqrt{\\delta(t)^2 + 4\\Delta^2}}',
    equationNote:
      'Continuous transfer mechanism: localization shifts through field-shaped stability rather than abrupt ontological destruction and recreation.',
  },
  scalar_kernel: {
    label: 'Response Kernel χ(x)',
    eyebrow: 'Woodyard (2026) §3 — Eq. (9)–(14)',
    icon: Waves,
    premise:
      'Observed spatial localization density Ploc(x, t; ωw) is biased by a normalized response kernel χ(x) = exp[α L(x)], where L(x) is a lorentzian response centered at local resonance frequency ωloc(x) = ω0 + βφ + κ∇²φ.',
    instruction:
      'Adjust drive frequency ωw, linewidth Γ, and response strength α. Observe how the field biases spatial observation while preserving exact total probability normalization.',
    readoutLabel: 'Peak Factor χ_max',
    equation:
      'P_{\\text{loc}}(\\mathbf{x},t;\\omega_w) = \\frac{\\chi(\\mathbf{x},t;\\omega_w)|\\psi(\\mathbf{x},t)|^2}{\\int d^3x\'\\, \\chi(\\mathbf{x}\',t;\\omega_w)|\\psi(\\mathbf{x}\',t)|^2},\\quad \\chi = e^{\\alpha \\mathcal{L}}',
    equationNote:
      'Weak-response expansion: P_loc(x) ≈ P_B(x)[1 + α(L(x) - <L>_ψ)]. Standard Born rule is recovered as α → 0.',
  },
  signatures: {
    label: 'Experimental Signatures',
    eyebrow: 'Woodyard (2026) §7 — Eq. (28)–(31)',
    icon: Target,
    premise:
      'Four testable predictions: (1) Double-well occupation imbalance z(t), (2) Matter-wave interferometric phase shift Δφ_φ, (3) Clock-comparison differential phase offset ΔΦ_AB, and (4) Driven localization-statistics anomaly δP.',
    instruction:
      'Modulate the external scalar field drive. Observe real-time accumulated interferometric phase shift and differential clock offset.',
    readoutLabel: 'Phase Shift Δφ_φ (rad)',
    equation:
      '\\Delta\\varphi_\\phi = \\frac{g}{\\hbar} \\int_{0}^{T} [\\phi(\\mathbf{x}_1(t),t) - \\phi(\\mathbf{x}_2(t),t)]\\, dt,\\quad \\Delta\\Phi_{AB} = \\eta \\int_{0}^{T} \\delta\\phi\\, dt',
    equationNote:
      'Provides concrete, experimentally testable observables for atom interferometers and optical atomic clocks.',
  },
  classical_limit: {
    label: 'Ehrenfest Classical Limit',
    eyebrow: 'Woodyard (2026) §6 — Eq. (25)–(27)',
    icon: Gauge,
    premise:
      'In the classical limit, narrow wavepackets follow Ehrenfest dynamics in an effective potential V_eff(x, t) = V(x) + g φ(x, t). Re-localization corresponds to the continuous shift of stable potential minima.',
    instruction:
      'Reposition scalar sources to deform V_eff(x, t). Watch the classical wavepacket center settle into the new energetic minimum.',
    readoutLabel: 'Min Potential V_eff',
    equation:
      'm\\mathbf{\\ddot{x}}_{\\text{cl}} = -\\nabla \\left[\\, V(\\mathbf{x}_{\\text{cl}}) + g\\,\\phi(\\mathbf{x}_{\\text{cl}},t)\\,\\right],\\quad V_{\\text{eff}} = V + g\\phi',
    equationNote:
      'Spatial location emerges dynamically as the equilibrium coordinate of matter coupled to the surrounding field landscape.',
  },
  teleportation: {
    label: 'Teleportation Protocol',
    eyebrow: 'Bennett et al. (1993) vs Continuous Transfer',
    icon: Radio,
    premise:
      'Discrete state teleportation via shared Bell pair and 2 classical bits (Bennett 1993). Contrast with Woodyard (2026) continuous field-mediated re-localization.',
    instruction:
      'Adjust input state on the Bloch sphere, then step through Bell measurement and Pauli corrections to reconstruct |ψ⟩ at Bob.',
    readoutLabel: 'Fidelity F',
    equation:
      '|\\Phi^{+}\\rangle = \\tfrac{1}{\\sqrt{2}}(|00\\rangle+|11\\rangle),\\quad F = |\\langle\\psi_{\\text{in}}|\\psi_{\\text{out}}\\rangle|^{2}',
    equationNote:
      'Bennett protocol transfers information via classical bits and entanglement; Woodyard model transfers localization dynamically via field coupling.',
  },
  interference: {
    label: 'Double Slit Interference',
    eyebrow: 'Fraunhofer Limit & Scalar Wave Optics',
    icon: Waves,
    premise:
      'A monochromatic matter wave of wavelength λ passes through two slits of separation d, forming an intensity pattern on a screen at distance L.',
    instruction:
      'Tune wavelength, slit separation, and screen distance. Accumulate single-photon readouts to verify Fraunhofer diffraction.',
    readoutLabel: 'Visibility V',
    equation:
      'I(y) = I_{0}\\,\\cos^{2}\\!\\left(\\frac{\\pi\\, d\\, \\sin\\theta}{\\lambda}\\right),\\quad \\sin\\theta \\approx y/L',
    equationNote: 'Standard Fraunhofer far-field diffraction pattern.',
  },
  superposition: {
    label: 'Bloch Superposition',
    eyebrow: 'Bloch sphere & Born rule',
    icon: Atom,
    premise:
      'A pure qubit state |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩ on the Bloch sphere. Projective measurement yields |0⟩ with probability cos²(θ/2).',
    instruction:
      'Tune θ and φ, then measure repeatedly to verify convergence toward the Born-rule expectation.',
    readoutLabel: 'P(|0⟩)',
    equation:
      '|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\varphi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle,\\quad P(0)=\\cos^{2}\\tfrac{\\theta}{2}',
    equationNote: 'Standard Born rule projective measurement.',
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

const initialObjects: QuantumObject[] = [
  { id: 'alpha', x: 280, y: 320, frequency: 2, phase: 0, amplitude: 54, isEntangled: true, entangledWith: 'beta', isTeleporting: false },
  { id: 'beta', x: 680, y: 320, frequency: 2, phase: Math.PI, amplitude: 54, isEntangled: true, entangledWith: 'alpha', isTeleporting: false },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const formatPercent = (value: number) => `${Math.round(clamp(value) * 100)}%`;

export const QuantumLab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const lastUiTick = useRef(0);
  const measurementIdRef = useRef(0);

  const [isRunning, setIsRunning] = useState(true);
  const [selectedObject, setSelectedObject] = useState<string | null>('alpha');
  const [objects, setObjects] = useState<QuantumObject[]>(initialObjects);
  const [resonanceNodes, setResonanceNodes] = useState<ResonanceNode[]>([]);
  const [fieldIntensity, setFieldIntensity] = useState([0.58]);
  const [waveSpeed, setWaveSpeed] = useState([1]);
  const [particleCount, setParticleCount] = useState([26]);
  const [barrierHeight, setBarrierHeight] = useState([48]);
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('two_site_transfer');
  const [showTraces, setShowTraces] = useState(true);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    'Woodyard (2026) Two-Site Model initialized. Detuning δ(t) controls continuous localization transfer between Site A and Site B.'
  );
  const [time, setTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const draggingObjId = useRef<string | null>(null);

  // Woodyard (2026) Paper Model Sliders
  const [couplingG, setCouplingG] = useState([0.8]);
  const [phiA, setPhiA] = useState([-0.6]);
  const [phiB, setPhiB] = useState([0.6]);
  const [mixingDelta, setMixingDelta] = useState([0.25]);
  const [driveOmegaW, setDriveOmegaW] = useState([12.0]);
  const [responseAlpha, setResponseAlpha] = useState([1.2]);
  const [linewidthGamma, setLinewidthGamma] = useState([1.5]);

  // Legacy/other experiment parameters
  const [energyE, setEnergyE] = useState([1.2]);
  const [barrierV, setBarrierV] = useState([2.0]);
  const [barrierA, setBarrierA] = useState([0.4]);
  const [slitD, setSlitD] = useState([25]);
  const [wavelength, setWavelength] = useState([650]);
  const [screenL, setScreenL] = useState([1200]);
  const [blochTheta, setBlochTheta] = useState([Math.PI / 3]);
  const [blochPhi, setBlochPhi] = useState([Math.PI / 4]);
  const [inputTheta, setInputTheta] = useState([Math.PI / 3]);
  const [inputPhi, setInputPhi] = useState([Math.PI / 5]);
  const [bellPurity, setBellPurity] = useState([0.98]);
  const [teleportStep, setTeleportStep] = useState<TeleportStep>(0);
  const [teleportBits, setTeleportBits] = useState<[0 | 1, 0 | 1] | undefined>(undefined);
  const [bellHistory, setBellHistory] = useState<BellRecord[]>([]);
  const bellIdRef = useRef(0);
  const [scrubEventId, setScrubEventId] = useState<number | null>(null);
  const [scrubStep, setScrubStep] = useState<TeleportStep>(4);
  const [customCatalystArtifact, setCustomCatalystArtifact] = useState<CatalystArtifact | undefined>(undefined);

  const activeExperiment = experiments[experimentMode];
  const selectedObj = objects.find((object) => object.id === selectedObject) ?? objects[0];

  useEffect(() => {
    const nodes: ResonanceNode[] = [];
    for (let x = 0; x <= CANVAS_WIDTH; x += 48) {
      for (let y = 0; y <= CANVAS_HEIGHT; y += 48) {
        nodes.push({ x, y, intensity: 0.16 + Math.random() * 0.24, phase: Math.random() * Math.PI * 2 });
      }
    }
    setResonanceNodes(nodes);
  }, []);

  // Analytical physics calculations for Woodyard (2026) paper models
  const twoSiteRes = useMemo(() => {
    // Dynamic field modulation with time oscillation
    const dynamicPhiA = phiA[0] + Math.sin(time * 0.8) * 0.4;
    const dynamicPhiB = phiB[0] - Math.sin(time * 0.8) * 0.4;
    return twoSiteModel({
      EA: 1.0,
      EB: 1.0,
      phiA: dynamicPhiA,
      phiB: dynamicPhiB,
      g: couplingG[0],
      delta: mixingDelta[0],
    });
  }, [phiA, phiB, couplingG, mixingDelta, time]);

  const kernelRes = useMemo(() => {
    return localizationKernel({
      omega0: 10.0,
      beta: 2.0,
      kappa: 0.5,
      phi: fieldIntensity[0] * 2,
      d2phi: Math.sin(time * 1.2) * 0.2,
      omega_w: driveOmegaW[0],
      gamma: linewidthGamma[0],
      alpha: responseAlpha[0],
    });
  }, [fieldIntensity, driveOmegaW, linewidthGamma, responseAlpha, time]);

  const phaseShift = useMemo(() => {
    return Math.abs(
      interferometryPhaseShift(couplingG[0], 1.0, Math.sin(time * 1.5) * fieldIntensity[0] * 3.2)
    );
  }, [couplingG, fieldIntensity, time]);

  const effectiveV = useMemo(() => {
    return ehrenfestEffectivePotential(1.0, Math.cos(time * 0.8) * fieldIntensity[0], couplingG[0]);
  }, [couplingG, fieldIntensity, time]);

  const tunnelResult = useMemo(
    () => barrierTransmission(energyE[0], barrierV[0], barrierA[0]),
    [energyE, barrierV, barrierA]
  );
  const bornP = useMemo(() => bornProbabilities(blochTheta[0]), [blochTheta]);
  const fringeVisibility = useMemo(() => clamp(0.55 + fieldIntensity[0] * 0.42), [fieldIntensity]);
  const fidelity = useMemo(
    () => teleportationFidelity(bellPurity[0], 1 - fieldIntensity[0] * 0.7),
    [bellPurity, fieldIntensity]
  );
  const concurrence = useMemo(() => wernerConcurrence(bellPurity[0]), [bellPurity]);
  const zz = useMemo(() => zzCorrelation(bellHistory.slice(-20).map((r) => r.bits)), [bellHistory]);

  const coherence = useMemo(() => {
    const crowdingPenalty = objects.length * 0.028;
    return clamp(0.94 - crowdingPenalty + Math.cos(time * 0.65) * 0.035);
  }, [objects.length, time]);

  const activeReadout = useMemo(() => {
    if (experimentMode === 'two_site_transfer') return (twoSiteRes.z + 1) / 2; // normalized 0..1 for gauge
    if (experimentMode === 'scalar_kernel') return clamp(kernelRes.chi / 3);
    if (experimentMode === 'signatures') return clamp(phaseShift / (2 * Math.PI));
    if (experimentMode === 'classical_limit') return clamp(effectiveV / 3);
    if (experimentMode === 'superposition') return bornP.p0;
    if (experimentMode === 'interference') return fringeVisibility;
    return fidelity;
  }, [bornP.p0, effectiveV, experimentMode, fidelity, fringeVisibility, kernelRes.chi, phaseShift, twoSiteRes.z]);

  const recordMeasurement = useCallback(
    (type: ExperimentMode, value = activeReadout) => {
      setMeasurements((current) => [
        ...current.slice(-11),
        { id: (measurementIdRef.current += 1), timestamp: timeRef.current, value: clamp(value), type },
      ]);
    },
    [activeReadout]
  );

  // Drawing Canvas Elements
  const drawQuantumField = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      const background = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      background.addColorStop(0, '#030712');
      background.addColorStop(0.52, '#07111d');
      background.addColorStop(1, '#101326');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Scalar field background ripples φ(x, t)
      ctx.save();
      ctx.globalAlpha = 0.08 * fieldIntensity[0];
      for (let r = 50; r < 500; r += 60) {
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, r + Math.sin(currentTime * 1.5 + r * 0.05) * 15, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // Scanning grid
      ctx.strokeStyle = 'rgba(148, 214, 255, 0.045)';
      ctx.lineWidth = 1;
      const scanY = (currentTime * 50) % CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(CANVAS_WIDTH, scanY);
      ctx.stroke();

      for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.strokeStyle = 'rgba(78, 234, 255, 0.04)';
        ctx.stroke();
      }

      resonanceNodes.forEach((node) => {
        const intensity = node.intensity * fieldIntensity[0] * (1 + 0.35 * Math.sin(currentTime * 1.6 + node.phase));
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 46);
        gradient.addColorStop(0, `rgba(112, 232, 255, ${intensity * 0.16})`);
        gradient.addColorStop(1, 'rgba(112, 232, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(node.x - 46, node.y - 46, 92, 92);
      });

      if (!showTraces) return;
      for (let i = 0; i < particleCount[0]; i += 1) {
        const x = Math.sin(currentTime * 0.9 + i * 0.74) * 230 + 480 + Math.cos(currentTime * 0.52 + i) * 120;
        const y = Math.cos(currentTime * 1.1 + i * 0.43) * 170 + 320 + Math.sin(currentTime * 0.4 + i * 1.8) * 86;
        const alpha = 0.25 + Math.sin(currentTime + i) * 0.12;
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + Math.sin(currentTime * 2 + i) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [fieldIntensity, particleCount, resonanceNodes, showTraces]
  );

  // Mode Specific Visualizers
  const drawTwoSiteScene = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      if (experimentMode !== 'two_site_transfer') return;

      const siteAX = 280;
      const siteBX = 680;
      const siteY = 360;

      // Potential Wells A and B
      ctx.save();
      ctx.lineWidth = 3;

      // Site A Well
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.beginPath();
      ctx.arc(siteAX, siteY, 90, 0, Math.PI);
      ctx.stroke();

      // Site B Well
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.8)';
      ctx.beginPath();
      ctx.arc(siteBX, siteY, 90, 0, Math.PI);
      ctx.stroke();

      // Tunneling Bridge Δ
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
      ctx.beginPath();
      ctx.moveTo(siteAX + 90, siteY);
      ctx.lineTo(siteBX - 90, siteY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Wavepacket densities inside wells
      const radiusA = Math.max(8, Math.sqrt(twoSiteRes.PA) * 75);
      const radiusB = Math.max(8, Math.sqrt(twoSiteRes.PB) * 75);

      // Wavepacket A
      const gradA = ctx.createRadialGradient(siteAX, siteY + 20, 0, siteAX, siteY + 20, radiusA);
      gradA.addColorStop(0, `rgba(56, 189, 248, ${0.9 * twoSiteRes.PA})`);
      gradA.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = gradA;
      ctx.beginPath();
      ctx.arc(siteAX, siteY + 20, radiusA, 0, Math.PI * 2);
      ctx.fill();

      // Wavepacket B
      const gradB = ctx.createRadialGradient(siteBX, siteY + 20, 0, siteBX, siteY + 20, radiusB);
      gradB.addColorStop(0, `rgba(192, 132, 252, ${0.9 * twoSiteRes.PB})`);
      gradB.addColorStop(1, 'rgba(192, 132, 252, 0)');
      ctx.fillStyle = gradB;
      ctx.beginPath();
      ctx.arc(siteBX, siteY + 20, radiusB, 0, Math.PI * 2);
      ctx.fill();

      // Labels and Readout overlays on Canvas
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(`Site A |A⟩  [P_A = ${(twoSiteRes.PA * 100).toFixed(1)}%]`, siteAX - 80, siteY + 115);
      ctx.fillText(`Site B |B⟩  [P_B = ${(twoSiteRes.PB * 100).toFixed(1)}%]`, siteBX - 80, siteY + 115);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '500 12px JetBrains Mono, monospace';
      ctx.fillText(`detuning δ(t) = ${twoSiteRes.detuning.toFixed(3)} eV`, CANVAS_WIDTH / 2 - 110, siteY - 70);
      ctx.fillText(`imbalance z(t) = ${twoSiteRes.z.toFixed(4)}`, CANVAS_WIDTH / 2 - 90, siteY - 45);

      ctx.restore();
    },
    [experimentMode, twoSiteRes]
  );

  const drawResponseKernelScene = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      if (experimentMode !== 'scalar_kernel') return;

      const startX = 100;
      const endX = 860;
      const baselineY = 440;
      const width = endX - startX;

      ctx.save();

      // Draw Born Density P_B(x) [Gold Dashed Curve]
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;

      for (let px = 0; px <= width; px += 4) {
        const x = startX + px;
        const normX = (px / width - 0.5) * 6;
        const pb = Math.exp(-normX * normX);
        const y = baselineY - pb * 180;
        if (px === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw Field-Biased Density P_loc(x) [Cyan Solid Curve]
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([]);
      ctx.lineWidth = 3;

      const driveShift = Math.sin(currentTime * 1.5) * 1.5;
      for (let px = 0; px <= width; px += 4) {
        const x = startX + px;
        const normX = (px / width - 0.5) * 6;
        const pb = Math.exp(-normX * normX);
        const L = 1 / (1 + (normX - driveShift) ** 2);
        const chi = Math.exp(responseAlpha[0] * L);
        const ploc = pb * chi * 0.5;
        const y = baselineY - ploc * 180;
        if (px === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Labels
      ctx.fillStyle = '#facc15';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText('--- Born Rule Density P_B(x) = |ψ(x)|²', startX + 20, 140);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('—— Field-Biased Density P_loc(x) = χ(x)|ψ|² / ∫χ|ψ|²', startX + 320, 140);

      ctx.restore();
    },
    [experimentMode, responseAlpha]
  );

  const drawSignaturesScene = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      if (experimentMode !== 'signatures') return;

      // Atom interferometer arms
      const startX = 140;
      const endX = 820;
      const midY = 320;

      ctx.save();
      ctx.lineWidth = 3;

      // Arm 1 (Top Path)
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(startX, midY);
      ctx.quadraticCurveTo(CANVAS_WIDTH / 2, midY - 120, endX, midY);
      ctx.stroke();

      // Arm 2 (Bottom Path)
      ctx.strokeStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(startX, midY);
      ctx.quadraticCurveTo(CANVAS_WIDTH / 2, midY + 120, endX, midY);
      ctx.stroke();

      // Phase readout badge
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 16px Inter, sans-serif';
      ctx.fillText(`Interferometric Phase Shift Δφ_φ = ${phaseShift.toFixed(4)} rad`, CANVAS_WIDTH / 2 - 180, midY - 140);

      ctx.restore();
    },
    [experimentMode, phaseShift]
  );

  const drawClassicalLimitScene = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      if (experimentMode !== 'classical_limit') return;

      const startX = 100;
      const width = 760;
      const baselineY = 460;

      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();

      let minX = startX + width / 2;
      let minY = baselineY;

      for (let px = 0; px <= width; px += 4) {
        const x = startX + px;
        const normX = (px / width - 0.5) * 6;
        const V_bare = normX * normX;
        const phi_val = Math.cos(normX * 2 - currentTime * 1.5) * fieldIntensity[0];
        const veff = V_bare + couplingG[0] * phi_val;
        const y = baselineY - veff * 35;
        if (px === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (y > minY) {
          minY = y;
          minX = x;
        }
      }
      ctx.stroke();

      // Classical Particle at Minimum
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(minX, minY - 12, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(`Effective Potential V_eff = V(x) + g φ(x,t)`, startX + 20, 160);
      ctx.fillText(`Classical Minimum: x_cl = ${((minX - startX) / width).toFixed(3)}`, startX + 20, 185);

      ctx.restore();
    },
    [couplingG, experimentMode, fieldIntensity]
  );

  const drawScene = useCallback(
    (currentTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawQuantumField(ctx, currentTime);
      drawTwoSiteScene(ctx, currentTime);
      drawResponseKernelScene(ctx, currentTime);
      drawSignaturesScene(ctx, currentTime);
      drawClassicalLimitScene(ctx, currentTime);
    },
    [drawClassicalLimitScene, drawQuantumField, drawResponseKernelScene, drawSignaturesScene, drawTwoSiteScene]
  );

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (isRunning) timeRef.current += 0.016 * waveSpeed[0];
      drawScene(timeRef.current);

      if (timestamp - lastUiTick.current > 140) {
        lastUiTick.current = timestamp;
        setTime(timeRef.current);
        if (measurementMode && isRunning) recordMeasurement(experimentMode);
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [drawScene, experimentMode, isRunning, measurementMode, recordMeasurement, waveSpeed]);

  const runExperiment = useCallback(() => {
    if (experimentMode === 'two_site_transfer') {
      setStatusMessage(
        `Woodyard (2026) §4 Run: Detuning δ = ${twoSiteRes.detuning.toFixed(3)} eV → Site A occupation PA = ${(twoSiteRes.PA * 100).toFixed(1)}%, Site B occupation PB = ${(twoSiteRes.PB * 100).toFixed(1)}%. Imbalance z(t) = ${twoSiteRes.z.toFixed(4)}.`
      );
      recordMeasurement('two_site_transfer', (twoSiteRes.z + 1) / 2);
      return;
    }

    if (experimentMode === 'scalar_kernel') {
      setStatusMessage(
        `Woodyard (2026) §3 Run: Drive ωw = ${driveOmegaW[0]} GHz → Peak response kernel factor χ_max = ${kernelRes.chi.toFixed(4)}. Exact Born normalization maintained.`
      );
      recordMeasurement('scalar_kernel', clamp(kernelRes.chi / 3));
      return;
    }

    if (experimentMode === 'signatures') {
      setStatusMessage(
        `Woodyard (2026) §7 Run: Matter-wave interferometric phase shift Δφ_φ = ${phaseShift.toFixed(4)} rad correlated with applied field drive.`
      );
      recordMeasurement('signatures', clamp(phaseShift / (2 * Math.PI)));
      return;
    }

    if (experimentMode === 'classical_limit') {
      setStatusMessage(
        `Woodyard (2026) §6 Run: Ehrenfest trajectory tracking effective potential minimum V_eff = ${effectiveV.toFixed(4)}.`
      );
      recordMeasurement('classical_limit', clamp(effectiveV / 3));
      return;
    }

    recordMeasurement(experimentMode, activeReadout);
  }, [activeReadout, driveOmegaW, effectiveV, experimentMode, kernelRes.chi, phaseShift, recordMeasurement, twoSiteRes]);

  return (
    <main className="experience-background min-h-screen overflow-y-auto pb-16 lg:pb-0 lg:overflow-hidden text-foreground">
      {/* Top Header Navigation */}
      <section className="relative px-4 py-4 sm:px-6 lg:px-8">
        <nav className="topline-nav mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Waveform Shift Quantum</p>
              <p className="section-eyebrow mt-0.5">Woodyard (2026) Theory & Simulation Suite</p>
            </div>
          </div>
          <div className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaperModalOpen(true)}
              className="gap-2 border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            >
              <BookOpen className="h-4 w-4 text-cyan-400" />
              Manuscript Explorer
            </Button>
            <a href="#scene" className="transition hover:text-foreground">Scene</a>
            <a href="#protocols" className="transition hover:text-foreground">Models</a>
            <a href="#controls" className="transition hover:text-foreground">Controls</a>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPaperModalOpen(true)}
              className="md:hidden border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={runExperiment}>
              <Beaker className="h-4 w-4" />
              Run
            </Button>
          </div>
        </nav>

        {/* Hero Section Banner */}
        <div className="mx-auto grid max-w-[1500px] gap-8 py-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:items-start xl:gap-12">
          <div className="hero-copy max-w-xl lg:sticky lg:top-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="instrument-mark flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Primary Paper Integration
              </span>
              <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                Christopher Woodyard (2026)
              </Badge>
            </div>
            <h1 className="hero-title mt-4 text-3xl font-extrabold sm:text-4xl leading-tight">
              Field-Modulated Spatial Localization as a Dynamical Variable
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              An effective matter-scalar model of continuous re-localization without discontinuous disappearance. Spatial position is not a fixed intrinsic property, but a dynamical state emerging from coupling to an underlying scalar field <InlineMath math="\\phi(\\mathbf{x}, t)" />.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="h-11 bg-cyan-500 px-5 text-slate-950 font-bold hover:bg-cyan-400" onClick={runExperiment}>
                <Beaker className="h-4 w-4 mr-1.5" />
                Run {activeExperiment.label}
              </Button>
              <Button
                variant="outline"
                className="h-11 border-cyan-500/40 bg-cyan-500/10 px-5 text-cyan-200 hover:bg-cyan-500/20"
                onClick={() => setIsPaperModalOpen(true)}
              >
                <BookOpen className="h-4 w-4 mr-1.5 text-cyan-400" />
                Read Paper Text & Math
              </Button>
            </div>
            <div className="hero-stat-strip mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Coherence" value={formatPercent(coherence)} icon={Activity} tone="primary" />
              <Metric label="Imbalance z(t)" value={twoSiteRes.z.toFixed(3)} icon={Zap} tone="violet" />
              <Metric label="Kernel χ_max" value={kernelRes.chi.toFixed(2)} icon={Waves} tone="lime" />
              <Metric label="Phase Δφ_φ" value={`${phaseShift.toFixed(2)} rad`} icon={Target} tone="copper" />
            </div>
          </div>

          {/* Live Simulation Canvas Card */}
          <section id="scene" className="scene-showcase min-w-0 overflow-hidden">
            {/* Mobile Mode Switcher Tab Bar */}
            <div className="px-3 pt-3 pb-1 border-b border-white/10 lg:hidden bg-white/[0.02]">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                {modeOrder.map((mode) => {
                  const def = experiments[mode];
                  const Icon = def.icon;
                  const active = experimentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setExperimentMode(mode);
                        setStatusMessage(`${def.label} loaded. ${def.instruction}`);
                      }}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                        active
                          ? 'border-cyan-400/80 bg-cyan-500/20 text-cyan-200 shadow-sm'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${active ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                      <span>{def.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="scene-topbar flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="section-eyebrow">Live Simulation Field</p>
                <h2 className="mt-0.5 text-lg font-semibold text-foreground">{activeExperiment.label}</h2>
              </div>
              <div className="hidden sm:flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08]" onClick={() => setIsRunning((current) => !current)}>
                  {isRunning ? <Pause className="h-4 w-4 mr-1 text-amber-300" /> : <Play className="h-4 w-4 mr-1 text-cyan-300" />}
                  {isRunning ? 'Pause' : 'Resume'}
                </Button>
                <Button size="sm" className="bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400" onClick={runExperiment}>
                  <Beaker className="h-4 w-4 mr-1" />
                  Run Model
                </Button>
              </div>
            </div>

            <div className="scene-canvas relative min-h-[300px] sm:min-h-[480px] overflow-hidden bg-quantum-field touch-none select-none">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                aria-label="Interactive quantum field simulation canvas"
                className="absolute inset-0 h-full w-full cursor-crosshair object-contain touch-none select-none"
              />

              <div className="pointer-events-none absolute left-3 top-3 z-10 space-y-2">
                <ReadoutPill label="Model" value={activeExperiment.label} />
                <ReadoutPill label="Time t" value={`${time.toFixed(2)}s`} />
              </div>
              <div className="pointer-events-none absolute right-3 top-3 z-10 space-y-2 text-right">
                <ReadoutPill label="Coupling g" value={couplingG[0].toFixed(2)} />
                <ReadoutPill label="Field φ" value={fieldIntensity[0].toFixed(2)} />
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 bg-white/[0.025] p-3 sm:p-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-400 font-mono font-semibold">Live Observation Log</p>
                  <p className="mt-1.5 text-xs sm:text-sm leading-5 text-slate-200">{statusMessage}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Numerical Two-Site Time Evolution Section */}
        {experimentMode === 'two_site_transfer' && (
          <div className="mx-auto max-w-[1700px] mt-6">
            <TwoSiteExperiment
              parameters={{
                g: couplingG[0],
                phiA: phiA[0],
                phiB: phiB[0],
                delta: mixingDelta[0],
              }}
            />
          </div>
        )}

        {/* Standard QM vs Woodyard Model Comparison Section */}
        <div className="mx-auto max-w-[1700px] mt-6">
          <ComparisonPanel
            experimentMode={experimentMode}
            parameters={{
              g: couplingG[0],
              phiA: phiA[0],
              phiB: phiB[0],
              delta: mixingDelta[0],
              alpha: responseAlpha[0],
              gamma: linewidthGamma[0],
              omega_w: driveOmegaW[0],
              purity: bellPurity[0],
              decoherence: 1 - fieldIntensity[0] * 0.7,
            }}
          />
        </div>

        {/* Anomaly Engine Feature Section */}
        <div className="mx-auto max-w-[1700px] mt-6">
          <AnomalyEnginePanel
            onLoadParameters={(params) => {
              if (params.g !== undefined) setCouplingG([params.g]);
              if (params.phiA !== undefined) setPhiA([params.phiA]);
              if (params.phiB !== undefined) setPhiB([params.phiB]);
              if (params.delta !== undefined) setMixingDelta([params.delta]);
              if (params.alpha !== undefined) setResponseAlpha([params.alpha]);
              if (params.gamma !== undefined) setLinewidthGamma([params.gamma]);
              if (params.omega_w !== undefined) setDriveOmegaW([params.omega_w]);
              setStatusMessage('Anomaly parameters loaded into active simulation workspace.');
            }}
            onGenerateCatalyst={(artifact) => {
              setCustomCatalystArtifact(artifact);
              setStatusMessage(`Catalyst Research Artifact ${artifact.run_id} compiled for Anomaly Protocol.`);
              const el = document.getElementById('catalyst-panel');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </section>

      {/* Model Briefing & Control Studio Section */}
      <section id="controls" className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="control-studio mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)_minmax(320px,0.55fr)]">
          {/* Briefing Panel */}
          <section className="instrument-panel p-5">
            <PanelHeader eyebrow="Theoretical Model" title={activeExperiment.label} icon={activeExperiment.icon} />
            <p className="mt-4 text-sm leading-7 text-slate-300">{activeExperiment.premise}</p>
            <div className="mt-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs leading-6 text-cyan-100">
              {activeExperiment.instruction}
            </div>
            <div className="mt-4">
              <EquationBlock title={activeExperiment.eyebrow} latex={activeExperiment.equation} note={activeExperiment.equationNote} />
            </div>
          </section>

          {/* Controls Panel */}
          <section className="instrument-panel p-5">
            <PanelHeader eyebrow="Paper Model Tuning" title="Field & Coupling Parameters" icon={Waves} />
            <div className="mt-6 space-y-5">
              <LabSlider icon={Zap} label="Matter-Scalar Coupling g" value={couplingG} onValueChange={setCouplingG} min={0.1} max={3.0} step={0.1} display={couplingG[0].toFixed(2)} />
              {experimentMode === 'two_site_transfer' && (
                <>
                  <LabSlider icon={Target} label="Field Site φA" value={phiA} onValueChange={setPhiA} min={-2.0} max={2.0} step={0.1} display={phiA[0].toFixed(2)} />
                  <LabSlider icon={Target} label="Field Site φB" value={phiB} onValueChange={setPhiB} min={-2.0} max={2.0} step={0.1} display={phiB[0].toFixed(2)} />
                  <LabSlider icon={Gauge} label="Mixing Amplitude Δ (eV)" value={mixingDelta} onValueChange={setMixingDelta} min={0.05} max={1.0} step={0.05} display={`${mixingDelta[0].toFixed(2)} eV`} />
                </>
              )}
              {experimentMode === 'scalar_kernel' && (
                <>
                  <LabSlider icon={Radio} label="Drive Frequency ω_w (GHz)" value={driveOmegaW} onValueChange={setDriveOmegaW} min={5.0} max={20.0} step={0.5} display={`${driveOmegaW[0].toFixed(1)} GHz`} />
                  <LabSlider icon={Sparkles} label="Response Strength α" value={responseAlpha} onValueChange={setResponseAlpha} min={0.1} max={3.0} step={0.1} display={responseAlpha[0].toFixed(2)} />
                  <LabSlider icon={Waves} label="Linewidth Γ (GHz)" value={linewidthGamma} onValueChange={setLinewidthGamma} min={0.2} max={4.0} step={0.2} display={`${linewidthGamma[0].toFixed(1)} GHz`} />
                </>
              )}
              <LabSlider icon={Waves} label="Field Intensity φ₀" value={fieldIntensity} onValueChange={setFieldIntensity} min={0.1} max={2.0} step={0.1} display={fieldIntensity[0].toFixed(2)} />
              <LabSlider icon={Zap} label="Simulation Speed" value={waveSpeed} onValueChange={setWaveSpeed} min={0.1} max={3.0} step={0.1} display={`${waveSpeed[0].toFixed(1)}x`} />
            </div>
          </section>

          {/* Model Catalogue Panel */}
          <section className="instrument-panel p-5">
            <PanelHeader eyebrow="Paper Model Catalogue" title="Woodyard (2026) Framework" icon={Layers} />
            <div className="mt-4 space-y-2">
              {modeOrder.map((mode) => {
                const definition = experiments[mode];
                return (
                  <ModeButton
                    key={mode}
                    definition={definition}
                    active={experimentMode === mode}
                    compact
                    onSelect={() => {
                      setExperimentMode(mode);
                      setStatusMessage(`${definition.label} loaded. ${definition.premise}`);
                    }}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </section>

      {/* Physics Tool Runner & Catalyst Panel */}
      <section className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">
        <PhysicsToolRunner />
      </section>

      <div id="catalyst-panel">
        <CatalystRunPanel
          session={{
            mode: experimentMode,
            shots: bellHistory.length,
            bits: bellHistory.map((r) => r.bits),
            purity: bellPurity[0],
            decoherence: 1 - fieldIntensity[0] * 0.7,
            fidelity,
            concurrence,
            zz,
            theta: inputTheta[0],
            phi: inputPhi[0],
            seed: 137,
            parameters: {
              g: couplingG[0],
              phiA: phiA[0],
              phiB: phiB[0],
              delta: mixingDelta[0],
              alpha: responseAlpha[0],
              gamma: linewidthGamma[0],
              omega_w: driveOmegaW[0],
            },
          }}
          customArtifact={customCatalystArtifact}
        />
      </div>

      <ReferencesFooter />

      {/* Interactive Paper Reader Modal */}
      <PaperReaderModal
        isOpen={isPaperModalOpen}
        onClose={() => setIsPaperModalOpen(false)}
        onSelectPreset={(mode) => {
          setExperimentMode(mode as ExperimentMode);
          setStatusMessage(`${experiments[mode as ExperimentMode].label} loaded from Manuscript Explorer.`);
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
}

const metricToneStyles: Record<NonNullable<MetricProps['tone']>, string> = {
  primary: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  copper: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  lime: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  violet: 'border-purple-500/30 bg-purple-500/10 text-purple-200',
};

const Metric: React.FC<MetricProps> = ({ label, value, icon: Icon, tone = 'primary' }) => (
  <div className={`rounded-lg border p-3 backdrop-blur ${metricToneStyles[tone]}`}>
    <div className="flex items-center justify-between gap-2 text-slate-400">
      <span className="section-eyebrow text-[10px] uppercase font-mono">{label}</span>
      <Icon className="h-3.5 w-3.5 text-cyan-400" />
    </div>
    <p className="mt-1.5 font-mono text-base font-bold text-white">{value}</p>
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
      <p className="section-eyebrow text-cyan-400 text-[10px]">{eyebrow}</p>
      <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">{title}</h3>
    </div>
  </div>
);

interface ModeButtonProps {
  definition: ExperimentDefinition;
  active: boolean;
  compact?: boolean;
  onSelect: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ definition, active, compact = false, onSelect }) => {
  const Icon = definition.icon;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${
        active
          ? 'border-cyan-400/60 bg-cyan-500/20 text-foreground shadow-md'
          : 'border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-cyan-400' : 'text-muted-foreground'}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{definition.label}</p>
          {!compact && <p className="mt-1 text-xs leading-5 text-muted-foreground">{definition.eyebrow}</p>}
        </div>
      </div>
    </button>
  );
};

interface ReadoutPillProps {
  label: string;
  value: string;
}

const ReadoutPill: React.FC<ReadoutPillProps> = ({ label, value }) => (
  <div className="rounded-md border border-cyan-400/20 bg-slate-950/80 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
    <span className="text-slate-400">{label}</span>
    <span className="ml-2 font-mono text-cyan-300 font-semibold">{value}</span>
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

const LabSlider: React.FC<LabSliderProps> = ({ icon: Icon, label, value, onValueChange, min, max, step, display }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3">
      <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-200">
        <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
        <span className="truncate">{label}</span>
      </label>
      <span className="shrink-0 font-mono text-xs text-cyan-300 font-bold">{display}</span>
    </div>
    <Slider aria-label={label} value={value} onValueChange={onValueChange} min={min} max={max} step={step} />
  </div>
);
