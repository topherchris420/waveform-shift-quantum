import {
  CounterRotatingPairConfig,
  ResonantFieldSource,
  Vec3,
} from './types';

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Scale(v: Vec3, scale: number): Vec3 {
  return { x: v.x * scale, y: v.y * scale, z: v.z * scale };
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Len(v: Vec3): number {
  return Math.sqrt(vec3Dot(v, v));
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Len(v);
  if (len < 1e-9) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / len);
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function rodriguesRotate(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = vec3Normalize(axis);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // v cosA + (k x v) sinA + k (k . v) (1 - cosA)
  const term1 = vec3Scale(v, cosA);
  const term2 = vec3Scale(vec3Cross(k, v), sinA);
  const term3 = vec3Scale(k, vec3Dot(k, v) * (1 - cosA));

  return vec3Add(vec3Add(term1, term2), term3);
}

/**
 * Creates two sources rotating in opposite directions (+omega, -omega).
 * w1 = +w
 * w2 = -w
 */
export function createCounterRotatingPair(config: CounterRotatingPairConfig): ResonantFieldSource[] {
  const axis = vec3Normalize(config.axis);
  // Find a perpendicular vector to axis
  let perp = vec3Cross(axis, { x: 1, y: 0, z: 0 });
  if (vec3Len(perp) < 1e-6) {
    perp = vec3Cross(axis, { x: 0, y: 1, z: 0 });
  }
  perp = vec3Normalize(perp);

  const halfSep = config.separation / 2;
  const pos1 = vec3Add(config.center, vec3Scale(perp, halfSep));
  const pos2 = vec3Sub(config.center, vec3Scale(perp, halfSep));

  const source1: ResonantFieldSource = {
    id: `${config.id}_s1`,
    arrangement: 'counter_rotating_pair',
    position: pos1,
    orientation: vec3Normalize(vec3Sub(config.center, pos1)),
    frequency: config.frequency,
    phase: 0,
    amplitude: config.amplitude,
    angularVelocity: config.rotationRate, // +omega
    rotationAxis: axis,
    polarization: 0,
    effectiveRadius: config.effectiveRadius,
  };

  const source2: ResonantFieldSource = {
    id: `${config.id}_s2`,
    arrangement: 'counter_rotating_pair',
    position: pos2,
    orientation: vec3Normalize(vec3Sub(config.center, pos2)),
    frequency: config.frequency,
    phase: config.phaseOffset,
    amplitude: config.amplitude,
    angularVelocity: -config.rotationRate, // -omega
    rotationAxis: axis,
    polarization: Math.PI / 2,
    effectiveRadius: config.effectiveRadius,
  };

  return [source1, source2];
}

/**
 * Creates a standard 4-source ring array around origin/center.
 */
export function createFourSourceRingArray(
  center: Vec3 = vec3(0, 0, 0),
  radius = 2.0,
  frequency = 10.0,
  amplitude = 1.0,
  effectiveRadius = 3.0
): ResonantFieldSource[] {
  const sources: ResonantFieldSource[] = [];
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  angles.forEach((angle, idx) => {
    const pos = vec3Add(center, vec3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
    const orientation = vec3Normalize(vec3Sub(center, pos));
    const isOdd = idx % 2 === 1;

    sources.push({
      id: `ring_source_${idx + 1}`,
      arrangement: isOdd ? 'counter_rotating_pair' : 'quadrature_pair',
      position: pos,
      orientation,
      frequency,
      phase: idx * (Math.PI / 2),
      amplitude,
      angularVelocity: isOdd ? -2.5 : 2.5,
      rotationAxis: vec3(0, 0, 1),
      polarization: idx * (Math.PI / 4),
      effectiveRadius,
    });
  });

  return sources;
}

export interface EvaluatedField {
  vector: Vec3;
  magnitude: number;
  phase: number;
}

/**
 * Evaluates the instantaneous electromagnetic field vector produced by a single source at position p and time t.
 */
export function evaluateSingleSourceField(
  source: ResonantFieldSource,
  p: Vec3,
  t: number
): EvaluatedField {
  const rVec = vec3Sub(p, source.position);
  const dist = vec3Len(rVec);

  // Gaussian spatial roll-off scale
  const spatialDecay = Math.exp(-((dist / Math.max(source.effectiveRadius, 0.1)) ** 2));

  // Time-dependent orientation due to angular rotation
  let currentOrientation = source.orientation;
  if (Math.abs(source.angularVelocity) > 1e-9) {
    const rotationAngle = source.angularVelocity * t;
    currentOrientation = rodriguesRotate(source.orientation, source.rotationAxis, rotationAngle);
  }

  // Wave phase evolution: omega * t - k * r + phase
  // Assume wave number k ~ frequency / 3.0 for physical simulation scaling
  const k = source.frequency / 3.0;
  const instantaneousPhase = source.frequency * t - k * dist + source.phase;

  const scalarAmp = source.amplitude * spatialDecay * Math.cos(instantaneousPhase);
  const vector = vec3Scale(currentOrientation, scalarAmp);

  return {
    vector,
    magnitude: Math.abs(scalarAmp),
    phase: instantaneousPhase,
  };
}

/**
 * Calculates the superposed electromagnetic field from all sources at point p and time t.
 */
export function evaluateSuperposedField(
  sources: ResonantFieldSource[],
  p: Vec3,
  t: number
): { fieldVector: Vec3; netIntensity: number; coherence: number } {
  let fieldVector = vec3(0, 0, 0);
  let sumIntensity = 0;
  let phaseSumX = 0;
  let phaseSumY = 0;

  sources.forEach((source) => {
    const evalResult = evaluateSingleSourceField(source, p, t);
    fieldVector = vec3Add(fieldVector, evalResult.vector);
    const mag = evalResult.magnitude;
    sumIntensity += mag * mag;

    phaseSumX += Math.cos(evalResult.phase);
    phaseSumY += Math.sin(evalResult.phase);
  });

  const netIntensity = vec3Dot(fieldVector, fieldVector);
  const N = Math.max(sources.length, 1);
  const coherence = Math.sqrt(phaseSumX * phaseSumX + phaseSumY * phaseSumY) / N;

  return {
    fieldVector,
    netIntensity,
    coherence,
  };
}
