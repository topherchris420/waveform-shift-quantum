import {
  ARFRExperimentConfig,
  ARFRPassportRecord,
  ControllerState,
  EnergyLedger,
} from './types';
import { canonicalJson, sha256Text } from '../passport/canonical';

export async function generateARFRPassportRecord(
  config: ARFRExperimentConfig,
  controllerState: ControllerState,
  energyLedger: EnergyLedger,
  retainedRate: number,
  lockStabilityTime: number
): Promise<ARFRPassportRecord> {
  const recordWithoutHash = {
    simulationVersion: 'ARFR-v1.0.0',
    seed: config.seed,
    sourceGeometry: config.sources,
    mediumParameters: {
      particleCount: 60,
      viscosity: 0.8,
      thermalNoise: 0.05,
    },
    controllerConfiguration: {
      profile: controllerState.profile,
      weights: controllerState.weights,
    },
    route: {
      type: config.routeType,
      waypoints: config.sources.map((s) => s.position),
      duration: 10.0,
      closedLoop: true,
    },
    energyProfile: energyLedger,
    results: {
      meanPositionError: controllerState.positionError,
      retentionRate: retainedRate,
      lockStabilityTime,
    },
  };

  const canonicalString = canonicalJson(recordWithoutHash);
  const hash = await sha256Text(canonicalString);

  return {
    ...recordWithoutHash,
    results: {
      ...recordWithoutHash.results,
      reproducibilityHash: hash,
    },
  };
}
