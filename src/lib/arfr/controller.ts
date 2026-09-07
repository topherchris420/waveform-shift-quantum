import {
  ControllerState,
  ControlWeights,
  EnergyLedger,
  LockState,
  OperatingProfile,
  ResonancePocket,
  ResonantFieldSource,
  Vec3,
} from './types';
import {
  vec3,
  vec3Add,
  vec3Len,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from './sources';

export function getProfileWeights(profile: OperatingProfile): ControlWeights {
  switch (profile) {
    case 'PRECISION':
      return { positionError: 10.0, shapeError: 5.0, particleLoss: 4.0, controlEnergy: 1.0, instability: 8.0 };
    case 'LOW_ENERGY':
      return { positionError: 2.0, shapeError: 1.0, particleLoss: 2.0, controlEnergy: 10.0, instability: 2.0 };
    case 'MAX_CONFINEMENT':
      return { positionError: 6.0, shapeError: 3.0, particleLoss: 12.0, controlEnergy: 2.0, instability: 10.0 };
    case 'BALANCED':
    default:
      return { positionError: 5.0, shapeError: 3.0, particleLoss: 4.0, controlEnergy: 3.0, instability: 5.0 };
  }
}

/**
 * Closed-loop feedback controller updating field source parameters
 * to translate or stabilize the emergent resonance pocket without moving source hardware.
 */
export function updateAdaptiveController(
  sources: ResonantFieldSource[],
  observedPocket: ResonancePocket | null,
  targetPosition: Vec3,
  dt: number,
  prevState: ControllerState
): { updatedSources: ResonantFieldSource[]; nextState: ControllerState } {
  const observedPosition = observedPocket ? observedPocket.centroid : prevState.observedPosition;
  const errorVec = vec3Sub(targetPosition, observedPosition);
  const posError = vec3Len(errorVec);

  const weights = getProfileWeights(prevState.profile);

  // Lock State Machine logic
  let lockState: LockState = prevState.lockState;
  let lockQuality = prevState.lockQuality;

  if (!observedPocket) {
    lockState = 'LOST';
    lockQuality = Math.max(0, lockQuality - dt * 2.0);
  } else if (posError < 0.15 && observedPocket.coherence > 0.6) {
    lockQuality = Math.min(1.0, lockQuality + dt * 1.5);
    lockState = lockQuality > 0.85 ? 'LOCKED' : 'ACQUIRING';
  } else if (posError < 0.8) {
    lockState = 'RECOVERING';
    lockQuality = Math.max(0.2, lockQuality - dt * 0.5);
  } else {
    lockState = 'SEARCHING';
    lockQuality = Math.max(0, lockQuality - dt * 1.0);
  }

  // Phase shift compensation: Phase changes translate the interference maximum across stationary sources
  const kPhaseGain = 0.8 * (weights.positionError / 5.0);
  const controlEffort = posError * weights.positionError;

  const updatedSources = sources.map((source, index) => {
    // Spatial direction from source to target
    const dirToTarget = vec3Normalize(vec3Sub(targetPosition, source.position));
    const isOdd = index % 2 === 1;

    // Adjust relative phases to shift field interference maximum
    const phaseShift = (errorVec.x * dirToTarget.x + errorVec.y * dirToTarget.y) * kPhaseGain;
    const newPhase = source.phase + phaseShift * dt * (isOdd ? -1 : 1);

    // Adjust rotation speed / angular velocity to maintain lock stability
    const freqCorrection = errorVec.z * 0.1 * (weights.positionError / 5.0);
    const newFreq = Math.max(2.0, Math.min(30.0, source.frequency + freqCorrection * dt));

    return {
      ...source,
      phase: newPhase,
      frequency: newFreq,
      orientation: vec3Normalize(vec3Add(source.orientation, vec3Scale(dirToTarget, 0.05 * dt))),
    };
  });

  const nextState: ControllerState = {
    lockState,
    profile: prevState.profile,
    weights,
    lockQuality,
    frequencyError: Math.abs(updatedSources[0].frequency - 10.0),
    phaseError: posError * 0.5,
    coherence: observedPocket ? observedPocket.coherence : 0,
    controlEffort,
    targetPosition,
    observedPosition,
    positionError: posError,
  };

  return { updatedSources, nextState };
}

/**
 * Calculates energy ledger metrics.
 */
export function updateEnergyLedger(
  prevLedger: EnergyLedger,
  sources: ResonantFieldSource[],
  controllerState: ControllerState,
  particleKineticEnergy: number,
  retainedParticles: number,
  routedDistance: number,
  dt: number
): EnergyLedger {
  // Input field energy calculation
  let fieldPower = 0;
  sources.forEach((s) => {
    fieldPower += s.amplitude * s.amplitude * s.frequency;
  });

  const controlPower = controllerState.controlEffort * 0.5;
  const fieldInput = prevLedger.fieldInput + fieldPower * dt;
  const controlInput = prevLedger.controlInput + controlPower * dt;
  const totalInputEnergy = fieldInput + controlInput;

  const estimatedDissipation = prevLedger.estimatedDissipation + fieldPower * 0.15 * dt;
  const effectiveCoupledEnergy = Math.max(0, totalInputEnergy - estimatedDissipation);

  const joulesPerMeter = routedDistance > 0.01 ? totalInputEnergy / routedDistance : 0;
  const joulesPerParticleRetained =
    retainedParticles > 0 ? totalInputEnergy / Math.max(retainedParticles, 1) : 0;
  const joulesPerSecondConfinement = totalInputEnergy / Math.max(dt * 10, 0.1);

  return {
    fieldInput,
    controlInput,
    particleKineticEnergy,
    estimatedDissipation,
    effectiveCoupledEnergy,
    joulesPerMeter,
    joulesPerParticleRetained,
    joulesPerSecondConfinement,
  };
}

export function createInitialControllerState(profile: OperatingProfile = 'BALANCED'): ControllerState {
  return {
    lockState: 'SEARCHING',
    profile,
    weights: getProfileWeights(profile),
    lockQuality: 0,
    frequencyError: 0,
    phaseError: 0,
    coherence: 0,
    controlEffort: 0,
    targetPosition: vec3(0, 0, 0),
    observedPosition: vec3(0, 0, 0),
    positionError: 0,
  };
}

export function createInitialEnergyLedger(): EnergyLedger {
  return {
    fieldInput: 0,
    controlInput: 0,
    particleKineticEnergy: 0,
    estimatedDissipation: 0,
    effectiveCoupledEnergy: 0,
    joulesPerMeter: 0,
    joulesPerParticleRetained: 0,
    joulesPerSecondConfinement: 0,
  };
}
