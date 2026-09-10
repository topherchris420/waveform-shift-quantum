import {
  CANONICAL_NUMBER_VERSION,
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
import { summarizeExperiment, type BuiltInExperiment } from './engine';

export interface ARFRPassportInput {
  experiment: BuiltInExperiment | string;
  state: ARFRState;
  summary?: ExperimentResultSummary;
}

export interface ARFRExperimentPassport {
  schema: 'arfr-experiment-passport.v2';
  technology: 'Adaptive Resonant Field Router';
  simulationVersion: string;
  generatedAt: string;
  provenance: {
    sourceCommit: string;
    configuration: ARFRConfig;
    completedSteps: number;
    elapsedSimulationTime: number;
    statistics: ARFRState['statistics'];
    artifactKind: 'result-snapshot';
    replayBoundary: string;
  };
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
  provenance: ARFRExperimentPassport['provenance'];
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
    schema: 'arfr-experiment-passport.v2',
    provenance: {
      sourceCommit: typeof __SOURCE_COMMIT__ === 'string' ? __SOURCE_COMMIT__ : 'unknown',
      configuration: cloneConfigPart(config),
      completedSteps: state.step,
      elapsedSimulationTime: state.time,
      statistics: { ...state.statistics },
      artifactKind: 'result-snapshot',
      replayBoundary: 'Records current configuration and cumulative results. Interactive parameter edits, disturbance history, and variable timestep schedules are not recorded; this snapshot is not an exact replay archive.',
    },
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
    results: { ...summary },
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
  const summary = input.summary ?? summarizeExperiment(input.state);
  const identity = passportIdentity(input, summary);
  const identityHash = await sha256Text(canonicalJson(identity));
  return {
    ...identity,
    generatedAt: new Date().toISOString(),
    integrity: {
      canonicalNumberVersion: CANONICAL_NUMBER_VERSION,
      identityHash,
    },
  };
}

/** Check content integrity, not authorship or physical validity. Malformed inputs fail closed. */
export async function verifyARFRPassport(passport: unknown): Promise<boolean> {
  try {
    if (!passport || typeof passport !== 'object' || Array.isArray(passport)) return false;
    const { generatedAt: _generatedAt, integrity, ...identity } = passport as ARFRExperimentPassport;
    if (identity.schema !== 'arfr-experiment-passport.v2' ||
        identity.technology !== 'Adaptive Resonant Field Router' ||
        integrity?.canonicalNumberVersion !== CANONICAL_NUMBER_VERSION ||
        typeof integrity.identityHash !== 'string' || !/^[a-f0-9]{64}$/.test(integrity.identityHash)) return false;
    const expected = await sha256Text(canonicalJson(identity));
    return expected === integrity.identityHash;
  } catch {
    return false;
  }
}
