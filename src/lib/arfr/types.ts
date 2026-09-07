export interface Vec3 {
  x: number;
  y: number;
  z: number;
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
  arrangement: SourceArrangement;
  position: Vec3;
  orientation: Vec3; // Direction unit vector

  frequency: number; // Base frequency (rad/s or normalized Hz)
  phase: number; // Phase angle in radians
  amplitude: number; // Field excitation strength

  angularVelocity: number; // Rotation speed (rad/s)
  rotationAxis: Vec3; // Axis of source spatial/vector rotation

  polarization: number; // Polarization angle (radians)
  effectiveRadius: number; // Spatial roll-off scale factor
}

export interface CounterRotatingPairConfig {
  id: string;
  center: Vec3;
  separation: number;
  axis: Vec3;
  frequency: number;
  rotationRate: number; // +omega and -omega
  phaseOffset: number; // Relative phase shift
  amplitude: number;
  effectiveRadius: number;
}

export type PocketShape = 'sphere' | 'ellipsoid' | 'ring' | 'two_lobe';

export interface ResonancePocket {
  id: string;
  centroid: Vec3;
  volume: number;
  velocity: Vec3;
  coherence: number;
  lifetime: number; // seconds active
  energy: number;
  particleOccupancy: number;
  fieldGradient: Vec3;
  shape: PocketShape;
  peakPotential: number;
}

export type RouteType = 'LINE' | 'ARC' | 'CIRCLE' | 'FIGURE_EIGHT' | 'HELIX' | 'WAYPOINTS';

export interface RouteDefinition {
  type: RouteType;
  waypoints: Vec3[];
  duration: number; // Seconds for full traversal
  closedLoop: boolean;
}

export type ControlMode = 'HOLD' | 'ROUTE' | 'CONVEYOR' | 'ORBIT' | 'SPLIT' | 'MERGE' | 'NETWORK';

export type OperatingProfile = 'PRECISION' | 'BALANCED' | 'LOW_ENERGY' | 'MAX_CONFINEMENT';

export type LockState = 'SEARCHING' | 'ACQUIRING' | 'LOCKED' | 'RECOVERING' | 'LOST';

export interface ControlWeights {
  positionError: number;
  shapeError: number;
  particleLoss: number;
  controlEnergy: number;
  instability: number;
}

export interface ControllerState {
  lockState: LockState;
  profile: OperatingProfile;
  weights: ControlWeights;
  lockQuality: number; // 0..1
  frequencyError: number;
  phaseError: number;
  coherence: number;
  controlEffort: number;
  targetPosition: Vec3;
  observedPosition: Vec3;
  positionError: number; // Distance in sim units
}

export interface EnergyLedger {
  fieldInput: number; // Joules or sim energy units
  controlInput: number;
  particleKineticEnergy: number;
  estimatedDissipation: number;
  effectiveCoupledEnergy: number;
  joulesPerMeter: number;
  joulesPerParticleRetained: number;
  joulesPerSecondConfinement: number;
}

export interface ChargedParticle {
  id: number;
  position: Vec3;
  velocity: Vec3;
  charge: number;
  mass: number;
  kineticEnergy: number;
  localField: Vec3;
  localResonancePotential: number;
  pocketId: string | null;
}

export interface PerturbationEvent {
  type: 'velocity_impulse' | 'density_asymmetry' | 'field_noise' | 'source_perturbation';
  magnitude: number;
  direction?: Vec3;
  timestamp: number;
}

export interface ARFRNetworkNode {
  id: string;
  position: Vec3;
  resonancePotential: number;
  stable: boolean;
}

export interface ARFRNetworkEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  capacity: number;
  active: boolean;
}

export interface ARFRNetworkState {
  nodes: ARFRNetworkNode[];
  edges: ARFRNetworkEdge[];
}

export interface ARFRExperimentConfig {
  id: string;
  name: string;
  description: string;
  mode: ControlMode;
  profile: OperatingProfile;
  routeType: RouteType;
  sources: ResonantFieldSource[];
  seed: number;
}

export interface ARFRPassportRecord {
  simulationVersion: string;
  seed: number;
  sourceGeometry: ResonantFieldSource[];
  mediumParameters: {
    particleCount: number;
    viscosity: number;
    thermalNoise: number;
  };
  controllerConfiguration: {
    profile: OperatingProfile;
    weights: ControlWeights;
  };
  route: RouteDefinition;
  energyProfile: EnergyLedger;
  results: {
    meanPositionError: number;
    retentionRate: number;
    lockStabilityTime: number;
    reproducibilityHash: string;
  };
}
