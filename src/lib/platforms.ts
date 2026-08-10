// Experimental platform registry for Target Lock.
//
// Each entry describes what a real class of apparatus can actually resolve, so
// that a predicted deviation can be judged testable or untestable rather than
// merely "large". The numbers below are order-of-magnitude figures typical of
// each platform's published state of the art; they are modelling inputs for the
// laboratory's feasibility arithmetic, not measurements.

export interface Platform {
  id: string;
  label: string;
  /** Short name of the quantity the apparatus reads out. */
  observable: string;
  /**
   * What the hardware physically detects. This is the detection channel, NOT
   * the dimensionless observable being compared — a clock detects a frequency
   * ratio even when the quantity under test is a site-occupation probability.
   */
  readoutChannel: string;
  /**
   * 1σ resolution of a SINGLE shot, expressed in the dimensionless units of the
   * compared observable. Statistical averaging improves on this as 1/√N.
   */
  singleShotResolution: number;
  /**
   * Irreducible systematic floor (1σ). No amount of averaging goes below this,
   * so it decides whether a prediction is testable even in principle here.
   */
  systematicFloor: number;
  /** Shots realistically achievable in one campaign. */
  practicalShots: number;
  /** Human-readable duration for that shot budget. */
  integrationTime: string;
  /** Dominant systematics a null result would have to exclude first. */
  systematics: string[];
  /** Which comparison modes this apparatus can actually address. */
  supportedModes: Array<'two_site' | 'scalar_kernel' | 'teleportation'>;
  /** Reference class for the sensitivity figures. */
  basis: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'atom_interferometer',
    label: 'Atom Interferometer',
    observable: 'Matter-wave interferometric phase / port population',
    readoutChannel: 'ΔP(Δφ)',
    singleShotResolution: 3e-2,
    systematicFloor: 5e-5,
    practicalShots: 1e5,
    integrationTime: '~8 h at 3 Hz repetition',
    systematics: [
      'Residual magnetic-field gradients across the arms',
      'Gravity gradient and rotation (Coriolis) phase',
      'Laser wavefront aberration',
    ],
    supportedModes: ['two_site', 'scalar_kernel'],
    basis: 'Light-pulse Raman/Bragg interferometry, shot-noise limited readout',
  },
  {
    id: 'optical_lattice_clock',
    label: 'Optical Lattice Clock (Sr)',
    observable: 'Differential fractional frequency between trapped ensembles',
    readoutChannel: 'Δν/ν',
    singleShotResolution: 1e-2,
    systematicFloor: 2e-6,
    practicalShots: 4e5,
    integrationTime: '~24 h interleaved differential comparison',
    systematics: [
      'Blackbody radiation shift mismatch between ensembles',
      'Lattice AC Stark / tunnelling shifts',
      'DC Stark from stray charges on chamber windows',
    ],
    supportedModes: ['scalar_kernel', 'two_site'],
    basis: 'Differential clock comparison; systematics partly common-mode rejected',
  },
  {
    id: 'transmon_circuit',
    label: 'Superconducting Transmon Circuit',
    observable: 'Two-level population after controlled detuning sweep',
    readoutChannel: 'P₁',
    singleShotResolution: 4e-2,
    systematicFloor: 3e-3,
    practicalShots: 1e6,
    integrationTime: '~20 min at 10 kHz repetition',
    systematics: [
      'Readout discrimination infidelity (~1%)',
      'Charge-parity switching and 1/f offset drift',
      'Leakage to the second excited state',
    ],
    supportedModes: ['two_site', 'teleportation'],
    basis: 'Dispersive readout, high repetition rate but limited absolute accuracy',
  },
  {
    id: 'trapped_ion',
    label: 'Trapped Ion (¹⁷¹Yb⁺)',
    observable: 'Internal-state population by fluorescence detection',
    readoutChannel: 'P(bright)',
    singleShotResolution: 5e-1,
    systematicFloor: 2e-4,
    practicalShots: 2e5,
    integrationTime: '~3 h at 20 Hz repetition',
    systematics: [
      'Anomalous motional heating from trap electrodes',
      'Micromotion-induced AC Stark shift',
      'Detection crosstalk between neighbouring ions',
    ],
    supportedModes: ['two_site', 'scalar_kernel', 'teleportation'],
    basis: 'Projective binary detection (single-shot variance is maximal, ≈0.5)',
  },
  {
    id: 'neutron_interferometer',
    label: 'Perfect-Crystal Neutron Interferometer',
    observable: 'Interference-order beam intensity fraction',
    readoutChannel: 'I/I₀',
    singleShotResolution: 8e-2,
    systematicFloor: 1e-3,
    practicalShots: 5e4,
    integrationTime: '~5 days of reactor beam time',
    systematics: [
      'Thermal drift of the silicon crystal interferometer',
      'Vibration coupling into the blades',
      'Low counting rate at the sample position',
    ],
    supportedModes: ['two_site', 'scalar_kernel'],
    basis: 'Neutron interferometry; excellent isolation, very low flux',
  },
];

export const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

export const ANY_PLATFORM_ID = 'any';

export function getPlatform(id: string): Platform | undefined {
  return PLATFORM_BY_ID.get(id);
}

/**
 * Best statistical resolution a platform can reach with a given shot budget,
 * floored by its systematics. σ_total = √(σ_shot²/N + σ_sys²).
 */
export function platformResolution(platform: Platform, shots: number): number {
  const n = Math.max(1, shots);
  const statistical = platform.singleShotResolution / Math.sqrt(n);
  return Math.hypot(statistical, platform.systematicFloor);
}

/** Floor achievable at the platform's practical shot budget. */
export function platformPracticalFloor(platform: Platform): number {
  return platformResolution(platform, platform.practicalShots);
}

export interface SensitivityOption {
  label: string;
  /** Minimum |Δ| the user is willing to consider, in observable units. */
  value: number;
}

export const SENSITIVITY_LIMITS: SensitivityOption[] = [
  { label: 'Any deviation', value: 0 },
  { label: 'Δ ≥ 1×10⁻⁴ (state of the art)', value: 1e-4 },
  { label: 'Δ ≥ 1×10⁻³ (demanding)', value: 1e-3 },
  { label: 'Δ ≥ 1×10⁻² (routine)', value: 1e-2 },
  { label: 'Δ ≥ 5×10⁻² (unmistakable)', value: 5e-2 },
];
