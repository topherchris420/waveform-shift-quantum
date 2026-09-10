/**
 * Shared ARFR domain types.
 *
 * ARFR is deliberately a bounded, deterministic simulation.  The types keep
 * the source geometry, emergent field geometry, medium response, controller,
 * and accounting layers separate so the UI cannot accidentally turn a field
 * visual into a direct particle command.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds3 {
  min: Vec3;
  max: Vec3;
}

export type SourceArrangement =
  | 'static'
  | 'rotating'
  | 'counter_rotating_pair'
  | 'phase_locked_pair'
  | 'quadrature_pair'
  | 'ring'
  | 'axial';

export interface ResonantFieldSource {
  id: string;
  position: Vec3;
  orientation: Vec3;
  frequency: number;
  phase: number;
  amplitude: number;
  angularVelocity: number;
  rotationAxis: Vec3;
  polarization: number;
  effectiveRadius: number;
  arrangement: SourceArrangement;
}

export interface CounterRotatingFieldPairConfig {
  center: Vec3;
  separation: number;
  axis: Vec3;
  frequency: number;
  phase: number;
  relativePhase: number;
  rotationRate: number;
  amplitude: number;
  polarization: number;
  effectiveRadius: number;
}

export type RouteKind = 'LINE' | 'ARC' | 'CIRCLE' | 'FIGURE_EIGHT' | 'HELIX' | 'USER_WAYPOINTS';

export interface RouteDefinition {
  kind: RouteKind;
  duration: number;
  start: Vec3;
  end: Vec3;
  center: Vec3;
  radius: number;
  startAngle: number;
  endAngle: number;
  turns: number;
  waypoints: Vec3[];
}

export type ARFRMode = 'hold' | 'route' | 'orbit' | 'conveyor' | 'split' | 'merge';

export type PocketShape = 'sphere' | 'ellipsoid' | 'ring' | 'two_lobe';

export type EnergyProfile = 'precision' | 'balanced' | 'low_energy' | 'max_confinement';

export type LockState = 'SEARCHING' | 'ACQUIRING' | 'LOCKED' | 'RECOVERING' | 'LOST';

export type DisturbanceKind =
  | 'velocity_impulse'
  | 'density_asymmetry'
  | 'field_noise'
  | 'source_perturbation';

export interface Disturbance {
  kind: DisturbanceKind;
  magnitude: number;
  direction: Vec3;
}

export interface MediumParameters {
  characteristicFrequency: number;
  resonanceBandwidth: number;
  responseAxis: Vec3;
  charge: number;
  mass: number;
  damping: number;
  coupling: number;
  magneticStrength: number;
  noiseAmplitude: number;
  waveNumber: number;
}

export interface ARFRControllerConfig {
  kpPosition: number;
  kiPosition: number;
  kdPosition: number;
  phaseGain: number;
  frequencyGain: number;
  amplitudeGain: number;
  rotationGain: number;
  maxPhaseStep: number;
  maxFrequencyStep: number;
  maxAmplitudeStep: number;
  maxRotationStep: number;
  energyWeight: number;
  shapeWeight: number;
}

export interface FieldResolution {
  x: number;
  y: number;
  z: number;
}

export interface ARFRConfig {
  simulationVersion: string;
  seed: number;
  dt: number;
  duration: number;
  bounds: Bounds3;
  fieldResolution: FieldResolution;
  threshold: number;
  particleCount: number;
  trailParticleCount: number;
  sources: ResonantFieldSource[];
  sourceArrangement: SourceArrangement;
  medium: MediumParameters;
  controller: ARFRControllerConfig;
  route: RouteDefinition;
  mode: ARFRMode;
  shape: PocketShape;
  energyProfile: EnergyProfile;
  morphing: boolean;
}

export interface FieldSample {
  vector: Vec3;
  magnitude: number;
  fieldStrength: number;
  meanFrequency: number;
  frequencyMatch: number;
  orientationMatch: number;
  coherence: number;
  resonancePotential: number;
}

export interface FieldGrid {
  resolution: FieldResolution;
  bounds: Bounds3;
  potential: Float32Array;
  magnitude: Float32Array;
  coherence: Float32Array;
  gradientMagnitude: Float32Array;
  vectors: Float32Array;
}

export interface ResonancePocket {
  id: string;
  centroid: Vec3;
  volume: number;
  velocity: Vec3;
  coherence: number;
  lifetime: number;
  energy: number;
  particleOccupancy: number;
  fieldGradient: number;
  radius: number;
  shape: PocketShape;
  cells: number[];
}

export interface ParticleEnsemble {
  count: number;
  position: Float64Array;
  velocity: Float64Array;
  kineticEnergy: Float64Array;
  localField: Float64Array;
  localPotential: Float64Array;
  alive: Uint8Array;
}

export interface EnergyLedger {
  fieldInput: number;
  controlInput: number;
  particleKinetic: number;
  estimatedDissipation: number;
  effectiveCoupledEnergy: number;
  routedDistance: number;
  stableConfinementTime: number;
  joulesPerSimulatedMeter: number;
  joulesPerParticleRetained: number;
  joulesPerStableSecond: number;
}

export interface ControllerState {
  integralError: Vec3;
  previousError: Vec3;
  observedPosition: Vec3;
  lockState: LockState;
  lockQuality: number;
  frequencyError: number;
  phaseError: number;
  coherence: number;
  controlEffort: number;
  acquiringTime: number;
  recoveryTime: number;
}

export interface ARFRTargetLock {
  targetPosition: Vec3;
  targetShape: PocketShape;
  targetTrajectory: RouteDefinition;
  targetResonanceState: LockState;
}

export interface ARFRMetrics {
  positionError: number;
  shapeError: number;
  occupancy: number;
  containment: number;
  routeProgress: number;
  angularVelocity: number;
  radialDispersion: number;
  escapeRate: number;
  splitDetected: boolean;
  mergeDetected: boolean;
  pocketCount: number;
}

export interface ResonantNetworkNode {
  id: string;
  position: Vec3;
  coherence: number;
  occupancy: number;
}

export interface ResonantNetworkEdge {
  from: string;
  to: string;
  distance: number;
  channelStrength: number;
}

export interface ResonantFieldNetwork {
  nodes: ResonantNetworkNode[];
  edges: ResonantNetworkEdge[];
}

/** Cumulative statistics survive the bounded visual event/trail buffers. */
export interface RunStatistics {
  samples: number;
  positionErrorSum: number;
  peakLockQuality: number;
  splitDetected: boolean;
  mergeDetected: boolean;
}

export interface ARFRState {
  statistics: RunStatistics;
  config: ARFRConfig;
  time: number;
  step: number;
  sources: ResonantFieldSource[];
  initialSourcePositions: Vec3[];
  particles: ParticleEnsemble;
  field: FieldGrid;
  pockets: ResonancePocket[];
  primaryPocket: ResonancePocket | null;
  desiredTarget: Vec3;
  desiredTargets: Vec3[];
  desiredShape: PocketShape;
  targetLock: ARFRTargetLock;
  controller: ControllerState;
  energy: EnergyLedger;
  metrics: ARFRMetrics;
  pocketPath: Vec3[];
  particleTrails: Vec3[][];
  events: string[];
  randomState: number;
  pendingDisturbance: Disturbance | null;
  disturbanceApplied: boolean;
}

export interface ExperimentResultSummary {
  finalPositionError: number;
  meanPositionError: number;
  peakLockQuality: number;
  finalLockState: LockState;
  particleRetention: number;
  containment: number;
  routedDistance: number;
  totalEnergy: number;
  energyPerSimulatedMeter: number;
  joulesPerParticleRetained: number;
  stableConfinementTime: number;
  splitDetected: boolean;
  mergeDetected: boolean;
  pocketCount: number;
}

export interface ExperimentRunResult {
  experiment: string;
  config: ARFRConfig;
  finalState: ARFRState;
  summary: ExperimentResultSummary;
  trace: Array<{
    time: number;
    target: Vec3;
    observed: Vec3;
    positionError: number;
    lockQuality: number;
    lockState: LockState;
    pocketCount: number;
    occupancy: number;
    energy: number;
  }>;
}
