import {
  canonicalJson,
  sha256Text,
} from '@/lib/passport/canonical';
import type {
  ARFRConfig,
  ARFRState,
  ExperimentResultSummary,
  LockState,
  ResonantFieldSource,
  RouteDefinition,
  Vec3,
} from './types';
import type { BuiltInExperiment } from './engine';

export interface ARFRPassportInput {
  experiment: BuiltInExperiment | string;
  state: ARFRState;
  summary?: ExperimentResultSummary;
}

export interface ARFRExperimentPassport {
  schema: 'arfr-experiment-passport.v1';
  technology: 'Adaptive Resonant Field Router';
  simulationVersion: string;
  generatedAt: string;
  seed: number;
  experiment: string;
  operatingMode: ARFRConfig['mode'];
  sourceGeometry: {
    arrangement: ARFRConfig['sourceArrangement'];
    initialPositions: Vec3[];
    finalSources: ResonantFieldSource[];
    positionsStayedFixed: boolean;
  };
  mediumParameters: ARFRConfig['medium'];
  controllerConfiguration: ARFRConfig['controller'];
  targetLock: {
    targetShape: ARFRState['desiredShape'];
    finalState: LockState;
    finalPositionError: number;
    peakQuality: number;
  };
  route: RouteDefinition;
  energyProfile: ARFRConfig['energyProfile'];
  results: ExperimentResultSummary;
  modelBoundary: {
    establishedSimulatorEquations: string[];
    simplifiedAssumptions: string[];
    experimentalAbstractions: string[];
    safety: 'simulation-only';
  };
  integrity: {
    canonicalNumberVersion: string;
    identityHash: string;
  };
}

interface PassportIdentity {
  schema: ARFRExperimentPassport['schema'];
  technology: ARFRExperimentPassport['technology'];
  simulationVersion: string;
  seed: number;
  experiment: string;
  operatingMode: ARFRConfig['mode'];
  sourceGeometry: ARFRExperimentPassport['sourceGeometry'];
  mediumParameters: ARFRConfig['medium'];
  controllerConfiguration: ARFRConfig['controller'];
  targetLock: ARFRExperimentPassport['targetLock'];
  route: RouteDefinition;
  energyProfile: ARFRConfig['energyProfile'];
  results: ExperimentResultSummary;
  modelBoundary: ARFRExperimentPassport['modelBoundary'];
}

function cloneVec(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function cloneSource(source: ResonantFieldSource): ResonantFieldSource {
  return {
    ...source,
    position: cloneVec(source.position),
    orientation: cloneVec(source.orientation),
    rotationAxis: cloneVec(source.rotationAxis),
  };
}

function cloneRoute(route: RouteDefinition): RouteDefinition {
  return {
    ...route,
    start: cloneVec(route.start),
    end: cloneVec(route.end),
    center: cloneVec(route.center),
    waypoints: route.waypoints.map(cloneVec),
  };
}

function cloneConfigPart<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function passportIdentity(
  input: ARFRPassportInput,
  summary: ExperimentResultSummary
): PassportIdentity {
  const { state } = input;
  const config = state.config;
  return {
    schema: 'arfr-experiment-passport.v1',
    technology: 'Adaptive Resonant Field Router',
    simulationVersion: config.simulationVersion,
    seed: config.seed,
    experiment: input.experiment,
    operatingMode: config.mode,
    sourceGeometry: {
      arrangement: config.sourceArrangement,
      initialPositions: state.initialSourcePositions.map(cloneVec),
      finalSources: state.sources.map(cloneSource),
      positionsStayedFixed: state.sources.every((source, index) =>
        source.position.x === state.initialSourcePositions[index]?.x &&
        source.position.y === state.initialSourcePositions[index]?.y &&
        source.position.z === state.initialSourcePositions[index]?.z
      ),
    },
    mediumParameters: cloneConfigPart(config.medium),
    controllerConfiguration: cloneConfigPart(config.controller),
    targetLock: {
      targetShape: state.desiredShape,
      finalState: state.controller.lockState,
      finalPositionError: summary.finalPositionError,
      peakQuality: summary.peakLockQuality,
    },
    route: cloneRoute(config.route),
    energyProfile: config.energyProfile,
    results: summary,
    modelBoundary: {
      establishedSimulatorEquations: [
        'linear field superposition',
        'finite-difference resonance-potential gradient',
        'symplectic-Euler particle update',
      ],
      simplifiedAssumptions: [
        'normalized field units rather than SI electromagnetic units',
        'bounded charged-particle ensemble with phenomenological damping',
        'finite phased-array source model and finite grid resolution',
      ],
      experimentalAbstractions: [
        'resonance-selective coupling metric',
        'field-defined pocket routing and topology transitions',
        'energy-aware adaptive phase/frequency/amplitude controller',
      ],
      safety: 'simulation-only',
    },
  };
}

/**
 * Build a reproducible passport. `generatedAt` is deliberately outside the
 * identity hash so exporting the same deterministic run twice produces the
 * same scientific identity.
 */
export async function createARFRPassport(input: ARFRPassportInput): Promise<ARFRExperimentPassport> {
  const summary = input.summary ?? {
    finalPositionError: input.state.metrics.positionError,
    meanPositionError: input.state.metrics.positionError,
    peakLockQuality: input.state.controller.lockQuality,
    finalLockState: input.state.controller.lockState,
    particleRetention: input.state.metrics.containment,
    containment: input.state.metrics.containment,
    routedDistance: input.state.energy.routedDistance,
    totalEnergy: input.state.energy.fieldInput + input.state.energy.controlInput + input.state.energy.estimatedDissipation,
    energyPerSimulatedMeter: input.state.energy.joulesPerSimulatedMeter,
    joulesPerParticleRetained: input.state.energy.joulesPerParticleRetained,
    stableConfinementTime: input.state.energy.stableConfinementTime,
    splitDetected: input.state.metrics.splitDetected,
    mergeDetected: input.state.metrics.mergeDetected,
    pocketCount: input.state.metrics.pocketCount,
  };
  const identity = passportIdentity(input, summary);
  const identityHash = await sha256Text(canonicalJson(identity));
  return {
    ...identity,
    generatedAt: new Date().toISOString(),
    integrity: {
      canonicalNumberVersion: 'scientific-e13.v1',
      identityHash,
    },
  };
}

export async function verifyARFRPassport(passport: ARFRExperimentPassport): Promise<boolean> {
  const {
    generatedAt: _generatedAt,
    integrity: _integrity,
    ...identity
  } = passport;
  const expected = await sha256Text(canonicalJson(identity));
  return expected === passport.integrity.identityHash;
}
