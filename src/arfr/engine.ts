import type {
  ARFRConfig,
  ARFRControllerConfig,
  ARFRMetrics,
  ARFRMode,
  ARFRState,
  ARFRTargetLock,
  Bounds3,
  ControllerState,
  CounterRotatingFieldPairConfig,
  Disturbance,
  EnergyLedger,
  EnergyProfile,
  ExperimentResultSummary,
  ExperimentRunResult,
  FieldGrid,
  FieldResolution,
  FieldSample,
  LockState,
  MediumParameters,
  ParticleEnsemble,
  PocketShape,
  ResonancePocket,
  ResonantFieldNetwork,
  ResonantFieldSource,
  ResonantNetworkEdge,
  ResonantNetworkNode,
  RouteDefinition,
  RouteKind,
  SourceArrangement,
  Vec3,
} from './types';

export const TAU = Math.PI * 2;
export const EPSILON = 1e-9;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function addVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec(a: Vec3, scalar: number): Vec3 {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

export function dotVec(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function magnitudeVec(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function normalizeVec(a: Vec3, fallback: Vec3 = vec3(0, 0, 1)): Vec3 {
  const length = magnitudeVec(a);
  return length > EPSILON ? scaleVec(a, 1 / length) : { ...fallback };
}

export function distanceVec(a: Vec3, b: Vec3): number {
  return magnitudeVec(subVec(a, b));
}

export function lerpVec(a: Vec3, b: Vec3, amount: number): Vec3 {
  const t = clamp(amount);
  return addVec(a, scaleVec(subVec(b, a), t));
}

function clampVec(value: Vec3, min: number, max: number): Vec3 {
  return {
    x: clamp(value.x, min, max),
    y: clamp(value.y, min, max),
    z: clamp(value.z, min, max),
  };
}

function copyVec(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function copySource(source: ResonantFieldSource): ResonantFieldSource {
  return {
    ...source,
    position: copyVec(source.position),
    orientation: copyVec(source.orientation),
    rotationAxis: copyVec(source.rotationAxis),
  };
}

function copyRoute(route: RouteDefinition): RouteDefinition {
  return {
    ...route,
    start: copyVec(route.start),
    end: copyVec(route.end),
    center: copyVec(route.center),
    waypoints: route.waypoints.map(copyVec),
  };
}

/** Mulberry32 stateful step, used so every simulation frame is reproducible. */
export function nextRandomState(state: number): { value: number; state: number } {
  let next = (state >>> 0) || 0x6d2b79f5;
  next = (next + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(next ^ (next >>> 15), next | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

export function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    const step = nextRandomState(state);
    state = step.state;
    return step.value;
  };
}

function orthogonalUnit(axis: Vec3): Vec3 {
  const normalized = normalizeVec(axis);
  const reference = Math.abs(normalized.z) < 0.8 ? vec3(0, 0, 1) : vec3(1, 0, 0);
  return normalizeVec(crossVec(normalized, reference), vec3(1, 0, 0));
}

function rotatingOrientation(axis: Vec3): Vec3 {
  const normalized = normalizeVec(axis);
  return normalizeVec(addVec(scaleVec(normalized, 0.88), scaleVec(orthogonalUnit(normalized), 0.48)), normalized);
}

export function rotateAroundAxis(value: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = normalizeVec(axis);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const parallel = scaleVec(k, dotVec(k, value));
  const perpendicular = subVec(value, parallel);
  return addVec(
    addVec(scaleVec(perpendicular, cos), scaleVec(crossVec(k, value), sin)),
    parallel
  );
}

export interface SourceArrangementOptions {
  center?: Vec3;
  frequency?: number;
  phase?: number;
  amplitude?: number;
  rotationRate?: number;
  separation?: number;
  radius?: number;
  effectiveRadius?: number;
  polarization?: number;
  axis?: Vec3;
}

function makeSource(
  id: string,
  position: Vec3,
  options: {
    orientation?: Vec3;
    frequency: number;
    phase: number;
    amplitude: number;
    angularVelocity: number;
    rotationAxis: Vec3;
    polarization: number;
    effectiveRadius: number;
    arrangement: SourceArrangement;
  }
): ResonantFieldSource {
  return {
    id,
    position: copyVec(position),
    orientation: normalizeVec(options.orientation ?? vec3(0, 0, 1)),
    frequency: options.frequency,
    phase: wrapAngle(options.phase),
    amplitude: options.amplitude,
    angularVelocity: options.angularVelocity,
    rotationAxis: normalizeVec(options.rotationAxis),
    polarization: options.polarization,
    effectiveRadius: options.effectiveRadius,
    arrangement: options.arrangement,
  };
}

/**
 * A concrete two-source component used by the ring and pair experiments.
 * The two source positions are fixed; only their field orientation and phase
 * evolve with opposite angular velocities.
 */
export class CounterRotatingFieldPair {
  private readonly pair: [ResonantFieldSource, ResonantFieldSource];

  constructor(input: Partial<CounterRotatingFieldPairConfig> = {}) {
    const config: CounterRotatingFieldPairConfig = {
      center: input.center ?? vec3(),
      separation: input.separation ?? 1.0,
      axis: normalizeVec(input.axis ?? vec3(0, 0, 1)),
      frequency: input.frequency ?? 1.2,
      phase: input.phase ?? 0,
      relativePhase: input.relativePhase ?? 0,
      rotationRate: input.rotationRate ?? 1.4,
      amplitude: input.amplitude ?? 1,
      polarization: input.polarization ?? 0,
      effectiveRadius: input.effectiveRadius ?? 2.2,
    };
    const lateral = orthogonalUnit(config.axis);
    const firstPosition = addVec(config.center, scaleVec(lateral, -config.separation / 2));
    const secondPosition = addVec(config.center, scaleVec(lateral, config.separation / 2));
    this.pair = [
      makeSource('crf-1', firstPosition, {
        orientation: rotatingOrientation(config.axis),
        frequency: config.frequency,
        phase: config.phase - config.relativePhase / 2,
        amplitude: config.amplitude,
        angularVelocity: config.rotationRate,
        rotationAxis: config.axis,
        polarization: config.polarization,
        effectiveRadius: config.effectiveRadius,
        arrangement: 'counter_rotating_pair',
      }),
      makeSource('crf-2', secondPosition, {
        orientation: rotatingOrientation(config.axis),
        frequency: config.frequency,
        phase: config.phase + config.relativePhase / 2,
        amplitude: config.amplitude,
        angularVelocity: -config.rotationRate,
        rotationAxis: config.axis,
        polarization: config.polarization,
        effectiveRadius: config.effectiveRadius,
        arrangement: 'counter_rotating_pair',
      }),
    ];
  }

  get sources(): [ResonantFieldSource, ResonantFieldSource] {
    return [copySource(this.pair[0]), copySource(this.pair[1])];
  }

  setRelativeParameters(input: Partial<CounterRotatingFieldPairConfig>): void {
    if (input.frequency !== undefined) {
      this.pair[0].frequency = input.frequency;
      this.pair[1].frequency = input.frequency;
    }
    if (input.rotationRate !== undefined) {
      this.pair[0].angularVelocity = input.rotationRate;
      this.pair[1].angularVelocity = -input.rotationRate;
    }
    if (input.amplitude !== undefined) {
      this.pair[0].amplitude = input.amplitude;
      this.pair[1].amplitude = input.amplitude;
    }
    if (input.relativePhase !== undefined) {
      const mean = (this.pair[0].phase + this.pair[1].phase) / 2;
      this.pair[0].phase = wrapAngle(mean - input.relativePhase / 2);
      this.pair[1].phase = wrapAngle(mean + input.relativePhase / 2);
    }
  }
}

/** Build a source array without moving the source positions during operation. */
export function createSourceArrangement(
  arrangement: SourceArrangement,
  options: SourceArrangementOptions = {}
): ResonantFieldSource[] {
  const center = options.center ?? vec3();
  const frequency = options.frequency ?? 1.2;
  const phase = options.phase ?? 0;
  const amplitude = options.amplitude ?? 1;
  const rotationRate = options.rotationRate ?? 0.75;
  const separation = options.separation ?? 1.1;
  const radius = options.radius ?? 1.2;
  const effectiveRadius = options.effectiveRadius ?? 2.2;
  const polarization = options.polarization ?? 0;
  const axis = normalizeVec(options.axis ?? vec3(0, 0, 1));

  if (arrangement === 'counter_rotating_pair') {
    return new CounterRotatingFieldPair({
      center,
      separation,
      axis,
      frequency,
      phase,
      rotationRate,
      amplitude,
      polarization,
      effectiveRadius,
    }).sources;
  }

  if (arrangement === 'static' || arrangement === 'rotating') {
    return [
      makeSource('source-1', center, {
        orientation: arrangement === 'rotating' ? rotatingOrientation(axis) : axis,
        frequency,
        phase,
        amplitude,
        angularVelocity: arrangement === 'rotating' ? rotationRate : 0,
        rotationAxis: axis,
        polarization,
        effectiveRadius,
        arrangement,
      }),
    ];
  }

  if (arrangement === 'phase_locked_pair' || arrangement === 'quadrature_pair') {
    const lateral = orthogonalUnit(axis);
    const first = addVec(center, scaleVec(lateral, -separation / 2));
    const second = addVec(center, scaleVec(lateral, separation / 2));
    const secondPhase = arrangement === 'quadrature_pair' ? phase + Math.PI / 2 : phase;
    return [
      makeSource('source-1', first, {
        orientation: rotatingOrientation(axis),
        frequency,
        phase,
        amplitude,
        angularVelocity: rotationRate,
        rotationAxis: axis,
        polarization,
        effectiveRadius,
        arrangement,
      }),
      makeSource('source-2', second, {
        orientation: rotatingOrientation(axis),
        frequency,
        phase: secondPhase,
        amplitude,
        angularVelocity: rotationRate,
        rotationAxis: axis,
        polarization,
        effectiveRadius,
        arrangement,
      }),
    ];
  }

  if (arrangement === 'axial') {
    const offsets = [-1.2, -0.4, 0.4, 1.2];
    return offsets.map((offset, index) =>
      makeSource(`source-${index + 1}`, addVec(center, scaleVec(axis, offset)), {
        orientation: rotatingOrientation(axis),
        frequency,
        phase: phase + index * Math.PI / 2,
        amplitude,
        angularVelocity: index % 2 === 0 ? rotationRate : -rotationRate,
        rotationAxis: axis,
        polarization,
        effectiveRadius,
        arrangement,
      })
    );
  }

  const ringAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  return ringAngles.map((angle, index) =>
    makeSource(
      `source-${index + 1}`,
      addVec(center, vec3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)),
      {
        orientation: rotatingOrientation(axis),
        frequency,
        phase: phase + index * Math.PI / 2,
        amplitude,
        angularVelocity: index % 2 === 0 ? rotationRate : -rotationRate,
        rotationAxis: axis,
        polarization,
        effectiveRadius,
        arrangement: 'ring',
      }
    )
  );
}

/** Advance phase offsets and orientations while preserving fixed hardware positions. */
export function evolveSources(sources: ResonantFieldSource[], dt: number): ResonantFieldSource[] {
  return sources.map((source) => ({
    ...copySource(source),
    phase: wrapAngle(source.phase + source.angularVelocity * dt),
    orientation: normalizeVec(
      rotateAroundAxis(source.orientation, source.rotationAxis, source.angularVelocity * dt)
    ),
  }));
}

/** Linear superposition is kept as a standalone function for invariant tests. */
export function superposeFieldContributions(contributions: Vec3[]): Vec3 {
  return contributions.reduce((sum, contribution) => addVec(sum, contribution), vec3());
}

export function sourceFieldContribution(
  source: ResonantFieldSource,
  point: Vec3,
  time: number,
  medium: Pick<MediumParameters, 'waveNumber'>
): Vec3 {
  const displacement = subVec(point, source.position);
  const distance = magnitudeVec(displacement);
  const radius = Math.max(source.effectiveRadius, 0.08);
  const envelope = Math.exp(-0.5 * (distance / radius) ** 2);
  const propagationPhase =
    medium.waveNumber * distance + source.phase + TAU * source.frequency * time;
  const axis = normalizeVec(source.rotationAxis);
  const orientation = normalizeVec(source.orientation, axis);
  const transverse = normalizeVec(crossVec(axis, orientation), orthogonalUnit(axis));
  const polarized = normalizeVec(
    addVec(
      scaleVec(orientation, Math.cos(source.polarization)),
      scaleVec(transverse, Math.sin(source.polarization))
    ),
    orientation
  );
  const scalar =
    (source.amplitude * envelope * Math.cos(propagationPhase)) /
    (1 + 0.12 * distance);
  return scaleVec(polarized, scalar);
}

/**
 * Calculate the field observable at one point. Resonance Potential is a
 * normalized product of frequency match, field strength, orientation match,
 * and multi-source coherence; no visual-only vortex is added.
 */
export function fieldAt(
  point: Vec3,
  sources: ResonantFieldSource[],
  time: number,
  medium: MediumParameters
): FieldSample {
  if (sources.length === 0) {
    return {
      vector: vec3(),
      magnitude: 0,
      fieldStrength: 0,
      meanFrequency: 0,
      frequencyMatch: 0,
      orientationMatch: 0,
      coherence: 0,
      resonancePotential: 0,
    };
  }

  const contributions = sources.map((source) => sourceFieldContribution(source, point, time, medium));
  const vector = superposeFieldContributions(contributions);
  const magnitude = magnitudeVec(vector);
  const absoluteContribution = contributions.reduce((sum, value) => sum + magnitudeVec(value), 0);
  const totalAmplitude = sources.reduce((sum, source) => sum + Math.abs(source.amplitude), 0);
  const weightedFrequency = sources.reduce(
    (sum, source, index) => sum + source.frequency * magnitudeVec(contributions[index]),
    0
  );
  const meanFrequency = weightedFrequency / (absoluteContribution + EPSILON);
  const fieldStrength = clamp(magnitude / (totalAmplitude + EPSILON));
  const coherence = clamp(magnitude / (absoluteContribution + EPSILON));
  const frequencyMatch = Math.exp(
    -0.5 * ((meanFrequency - medium.characteristicFrequency) / Math.max(medium.resonanceBandwidth, 0.01)) ** 2
  );
  const fieldDirection = normalizeVec(vector, medium.responseAxis);
  const responseAxis = normalizeVec(medium.responseAxis);
  const orientationMatch = clamp(0.5 + 0.5 * Math.abs(dotVec(fieldDirection, responseAxis)));
  const resonancePotential = clamp(
    fieldStrength * frequencyMatch * orientationMatch * coherence
  );

  return {
    vector,
    magnitude,
    fieldStrength,
    meanFrequency,
    frequencyMatch,
    orientationMatch,
    coherence,
    resonancePotential,
  };
}

/**
 * Phased-array steering law. Source positions stay fixed; only their relative
 * phases are retuned so propagation phases align at the requested field site.
 */
export function phaseSteeringForTargets(
  sources: ResonantFieldSource[],
  targets: Vec3[],
  weights: number[],
  medium: Pick<MediumParameters, 'waveNumber'>
): number[] {
  if (targets.length === 0) return sources.map(() => 0);
  return sources.map((source) => {
    let real = 0;
    let imaginary = 0;
    targets.forEach((target, index) => {
      const weight = Math.max(0, weights[index] ?? 1);
      const desiredOffset = -medium.waveNumber * distanceVec(source.position, target);
      real += weight * Math.cos(desiredOffset);
      imaginary += weight * Math.sin(desiredOffset);
    });
    return Math.atan2(imaginary, real);
  });
}

function smoothStep(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function routePosition(route: RouteDefinition, time: number): Vec3 {
  const progress = clamp(time / Math.max(route.duration, EPSILON));
  switch (route.kind) {
    case 'LINE':
      return lerpVec(route.start, route.end, progress);
    case 'ARC': {
      const angle = route.startAngle + (route.endAngle - route.startAngle) * progress;
      return addVec(
        route.center,
        vec3(Math.cos(angle) * route.radius, Math.sin(angle) * route.radius, route.start.z)
      );
    }
    case 'CIRCLE': {
      const angle = route.startAngle + TAU * route.turns * progress;
      return addVec(
        route.center,
        vec3(Math.cos(angle) * route.radius, Math.sin(angle) * route.radius, route.start.z)
      );
    }
    case 'FIGURE_EIGHT': {
      const angle = route.startAngle + TAU * route.turns * progress;
      return addVec(
        route.center,
        vec3(
          route.radius * Math.sin(angle),
          route.radius * 0.55 * Math.sin(2 * angle),
          route.start.z + (route.end.z - route.start.z) * progress
        )
      );
    }
    case 'HELIX': {
      const angle = route.startAngle + TAU * route.turns * progress;
      return addVec(
        route.center,
        vec3(
          route.radius * Math.cos(angle),
          route.radius * Math.sin(angle),
          route.start.z + (route.end.z - route.start.z) * progress
        )
      );
    }
    case 'USER_WAYPOINTS': {
      const points = route.waypoints.length > 0 ? route.waypoints : [route.start, route.end];
      if (points.length === 1) return copyVec(points[0]);
      const scaled = progress * (points.length - 1);
      const index = Math.min(points.length - 2, Math.floor(scaled));
      return lerpVec(points[index], points[index + 1], scaled - index);
    }
    default:
      return copyVec(route.start);
  }
}

export function geometryTargets(
  center: Vec3,
  shape: PocketShape,
  radius = 0.34
): { targets: Vec3[]; weights: number[] } {
  if (shape === 'ring') {
    const targets: Vec3[] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU;
      targets.push(addVec(center, vec3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)));
    }
    return { targets, weights: targets.map(() => 1) };
  }
  if (shape === 'two_lobe') {
    return {
      targets: [
        addVec(center, vec3(-radius * 1.45, 0, 0)),
        addVec(center, vec3(radius * 1.45, 0, 0)),
      ],
      weights: [1, 1],
    };
  }
  if (shape === 'ellipsoid') {
    return {
      targets: [
        addVec(center, vec3(-radius * 0.55, 0, 0)),
        center,
        addVec(center, vec3(radius * 0.55, 0, 0)),
      ],
      weights: [0.58, 1, 0.58],
    };
  }
  return { targets: [copyVec(center)], weights: [1] };
}

function effectiveMorphShape(config: ARFRConfig, time: number): PocketShape {
  if (!config.morphing) return config.shape;
  const sequence: PocketShape[] = ['sphere', 'ellipsoid', 'ring', 'two_lobe', 'sphere'];
  const progress = clamp(time / Math.max(config.duration, EPSILON));
  const index = Math.min(sequence.length - 1, Math.floor(progress * (sequence.length - 1)));
  return sequence[index];
}

interface DesiredFieldTargets {
  primary: Vec3;
  targets: Vec3[];
  weights: number[];
  shape: PocketShape;
}

function desiredFieldTargets(config: ARFRConfig, time: number): DesiredFieldTargets {
  const primary = routePosition(config.route, time);
  const progress = clamp(time / Math.max(config.duration, EPSILON));

  if (config.mode === 'split') {
    const splitProgress = smoothStep((progress - 0.12) / 0.48);
    const separation = 0.92 * splitProgress;
    if (separation < 0.08) {
      return { primary, targets: [primary], weights: [1], shape: 'sphere' };
    }
    return {
      primary,
      targets: [
        addVec(primary, vec3(-separation / 2, 0, 0)),
        addVec(primary, vec3(separation / 2, 0, 0)),
      ],
      weights: [1, 1],
      shape: 'two_lobe',
    };
  }

  if (config.mode === 'merge') {
    const mergeProgress = smoothStep((progress - 0.08) / 0.75);
    const separation = 0.92 * (1 - mergeProgress);
    if (separation < 0.08) {
      return { primary, targets: [primary], weights: [1], shape: 'sphere' };
    }
    return {
      primary,
      targets: [
        addVec(primary, vec3(-separation / 2, 0, 0)),
        addVec(primary, vec3(separation / 2, 0, 0)),
      ],
      weights: [1, 1],
      shape: 'two_lobe',
    };
  }

  if (config.mode === 'conveyor') {
    const offsets = [0, 0.35, 0.7, 1.05];
    const weights = [1, 0.86, 0.68, 0.5];
    return {
      primary,
      targets: offsets.map((offset) => routePosition(config.route, time + offset)),
      weights,
      shape: 'sphere',
    };
  }

  const shape = effectiveMorphShape(config, time);
  const geometry = geometryTargets(primary, shape);
  return { primary, targets: geometry.targets, weights: geometry.weights, shape };
}

export function targetForState(config: ARFRConfig, time: number): Vec3 {
  return desiredFieldTargets(config, time).primary;
}

export function targetsForState(
  config: ARFRConfig,
  time: number
): { primary: Vec3; targets: Vec3[]; weights: number[]; shape: PocketShape } {
  const desired = desiredFieldTargets(config, time);
  return {
    primary: copyVec(desired.primary),
    targets: desired.targets.map(copyVec),
    weights: [...desired.weights],
    shape: desired.shape,
  };
}

export function gridIndex(indexX: number, indexY: number, indexZ: number, resolution: FieldResolution): number {
  return indexX + resolution.x * (indexY + resolution.y * indexZ);
}

function coordinateAt(
  indexX: number,
  indexY: number,
  indexZ: number,
  bounds: Bounds3,
  resolution: FieldResolution
): Vec3 {
  return {
    x: bounds.min.x + (bounds.max.x - bounds.min.x) * (indexX / Math.max(1, resolution.x - 1)),
    y: bounds.min.y + (bounds.max.y - bounds.min.y) * (indexY / Math.max(1, resolution.y - 1)),
    z: bounds.min.z + (bounds.max.z - bounds.min.z) * (indexZ / Math.max(1, resolution.z - 1)),
  };
}

export function sampleResonanceField(
  sources: ResonantFieldSource[],
  time: number,
  medium: MediumParameters,
  bounds: Bounds3,
  resolution: FieldResolution
): FieldGrid {
  const total = resolution.x * resolution.y * resolution.z;
  const potential = new Float32Array(total);
  const magnitude = new Float32Array(total);
  const coherence = new Float32Array(total);
  const gradientMagnitude = new Float32Array(total);
  const vectors = new Float32Array(total * 3);

  for (let indexZ = 0; indexZ < resolution.z; indexZ += 1) {
    for (let indexY = 0; indexY < resolution.y; indexY += 1) {
      for (let indexX = 0; indexX < resolution.x; indexX += 1) {
        const index = gridIndex(indexX, indexY, indexZ, resolution);
        const sample = fieldAt(coordinateAt(indexX, indexY, indexZ, bounds, resolution), sources, time, medium);
        potential[index] = sample.resonancePotential;
        magnitude[index] = sample.magnitude;
        coherence[index] = sample.coherence;
        vectors[index * 3] = sample.vector.x;
        vectors[index * 3 + 1] = sample.vector.y;
        vectors[index * 3 + 2] = sample.vector.z;
      }
    }
  }

  for (let indexZ = 0; indexZ < resolution.z; indexZ += 1) {
    for (let indexY = 0; indexY < resolution.y; indexY += 1) {
      for (let indexX = 0; indexX < resolution.x; indexX += 1) {
        const index = gridIndex(indexX, indexY, indexZ, resolution);
        const left = potential[gridIndex(Math.max(0, indexX - 1), indexY, indexZ, resolution)];
        const right = potential[gridIndex(Math.min(resolution.x - 1, indexX + 1), indexY, indexZ, resolution)];
        const down = potential[gridIndex(indexX, Math.max(0, indexY - 1), indexZ, resolution)];
        const up = potential[gridIndex(indexX, Math.min(resolution.y - 1, indexY + 1), indexZ, resolution)];
        const back = potential[gridIndex(indexX, indexY, Math.max(0, indexZ - 1), resolution)];
        const front = potential[gridIndex(indexX, indexY, Math.min(resolution.z - 1, indexZ + 1), resolution)];
        const dx = right - left;
        const dy = up - down;
        const dz = front - back;
        gradientMagnitude[index] = Math.hypot(dx, dy, dz) / 2;
      }
    }
  }

  return { resolution, bounds, potential, magnitude, coherence, gradientMagnitude, vectors };
}

function gridSpacing(grid: FieldGrid): Vec3 {
  return {
    x: (grid.bounds.max.x - grid.bounds.min.x) / Math.max(1, grid.resolution.x - 1),
    y: (grid.bounds.max.y - grid.bounds.min.y) / Math.max(1, grid.resolution.y - 1),
    z: (grid.bounds.max.z - grid.bounds.min.z) / Math.max(1, grid.resolution.z - 1),
  };
}

function nearestPreviousPocket(
  centroid: Vec3,
  previous: ResonancePocket[],
  used: Set<string>
): ResonancePocket | null {
  let best: ResonancePocket | null = null;
  let bestDistance = Infinity;
  for (const pocket of previous) {
    if (used.has(pocket.id)) continue;
    const distance = distanceVec(centroid, pocket.centroid);
    if (distance < bestDistance) {
      best = pocket;
      bestDistance = distance;
    }
  }
  return bestDistance < 0.9 ? best : null;
}

/** Find contiguous thresholded voxels and derive pocket observables. */
export function detectResonancePockets(
  grid: FieldGrid,
  threshold: number,
  previous: ResonancePocket[] = [],
  dt = 0.05,
  expectedShape: PocketShape = 'sphere'
): ResonancePocket[] {
  const { x: resolutionX, y: resolutionY, z: resolutionZ } = grid.resolution;
  const total = resolutionX * resolutionY * resolutionZ;
  const visited = new Uint8Array(total);
  const spacing = gridSpacing(grid);
  const cellVolume = spacing.x * spacing.y * spacing.z;
  const components: ResonancePocket[] = [];
  const usedPrevious = new Set<string>();
  const minimumCells = 2;

  for (let indexZ = 0; indexZ < resolutionZ; indexZ += 1) {
    for (let indexY = 0; indexY < resolutionY; indexY += 1) {
      for (let indexX = 0; indexX < resolutionX; indexX += 1) {
        const seedIndex = gridIndex(indexX, indexY, indexZ, grid.resolution);
        if (visited[seedIndex] || grid.potential[seedIndex] <= threshold) continue;

        const queue = [seedIndex];
        visited[seedIndex] = 1;
        const cells: number[] = [];
        let weightedTotal = 0;
        let centroid = vec3();
        let coherenceTotal = 0;
        let energy = 0;
        let gradientTotal = 0;

        while (queue.length > 0) {
          const current = queue.pop()!;
          const currentZ = Math.floor(current / (resolutionX * resolutionY));
          const remainder = current - currentZ * resolutionX * resolutionY;
          const currentY = Math.floor(remainder / resolutionX);
          const currentX = remainder - currentY * resolutionX;
          const value = grid.potential[current];
          const weight = Math.max(value - threshold, 0.001);
          const coordinate = coordinateAt(currentX, currentY, currentZ, grid.bounds, grid.resolution);
          centroid = addVec(centroid, scaleVec(coordinate, weight));
          weightedTotal += weight;
          coherenceTotal += grid.coherence[current] * weight;
          energy += value * cellVolume;
          gradientTotal += grid.gradientMagnitude[current];
          cells.push(current);

          const neighbours: Array<[number, number, number]> = [
            [currentX - 1, currentY, currentZ],
            [currentX + 1, currentY, currentZ],
            [currentX, currentY - 1, currentZ],
            [currentX, currentY + 1, currentZ],
            [currentX, currentY, currentZ - 1],
            [currentX, currentY, currentZ + 1],
          ];
          for (const [neighborX, neighborY, neighborZ] of neighbours) {
            if (
              neighborX < 0 || neighborX >= resolutionX ||
              neighborY < 0 || neighborY >= resolutionY ||
              neighborZ < 0 || neighborZ >= resolutionZ
            ) continue;
            const neighborIndex = gridIndex(neighborX, neighborY, neighborZ, grid.resolution);
            if (!visited[neighborIndex] && grid.potential[neighborIndex] > threshold) {
              visited[neighborIndex] = 1;
              queue.push(neighborIndex);
            }
          }
        }

        if (cells.length < minimumCells) continue;
        centroid = scaleVec(centroid, 1 / Math.max(weightedTotal, EPSILON));
        const match = nearestPreviousPocket(centroid, previous, usedPrevious);
        if (match) usedPrevious.add(match.id);
        const volume = cells.length * cellVolume;
        const radius = Math.cbrt((3 * volume) / (4 * Math.PI));
        components.push({
          id: `pocket-${components.length}`,
          centroid,
          volume,
          velocity: match ? scaleVec(subVec(centroid, match.centroid), 1 / Math.max(dt, EPSILON)) : vec3(),
          coherence: coherenceTotal / Math.max(weightedTotal, EPSILON),
          lifetime: match ? match.lifetime + dt : dt,
          energy,
          particleOccupancy: 0,
          fieldGradient: gradientTotal / cells.length,
          radius,
          shape: expectedShape,
          cells,
        });
      }
    }
  }

  components.sort((a, b) => b.energy - a.energy);
  return components.map((pocket, index) => ({ ...pocket, id: `pocket-${index}` }));
}

export function estimatePotentialGradient(
  point: Vec3,
  sources: ResonantFieldSource[],
  time: number,
  medium: MediumParameters,
  stepSize = 0.035
): Vec3 {
  const xPositive = fieldAt(addVec(point, vec3(stepSize, 0, 0)), sources, time, medium).resonancePotential;
  const xNegative = fieldAt(addVec(point, vec3(-stepSize, 0, 0)), sources, time, medium).resonancePotential;
  const yPositive = fieldAt(addVec(point, vec3(0, stepSize, 0)), sources, time, medium).resonancePotential;
  const yNegative = fieldAt(addVec(point, vec3(0, -stepSize, 0)), sources, time, medium).resonancePotential;
  const zPositive = fieldAt(addVec(point, vec3(0, 0, stepSize)), sources, time, medium).resonancePotential;
  const zNegative = fieldAt(addVec(point, vec3(0, 0, -stepSize)), sources, time, medium).resonancePotential;
  return {
    x: (xPositive - xNegative) / (2 * stepSize),
    y: (yPositive - yNegative) / (2 * stepSize),
    z: (zPositive - zNegative) / (2 * stepSize),
  };
}

export function createParticleEnsemble(count: number, seed: number, center: Vec3): ParticleEnsemble {
  const boundedCount = Math.round(clamp(count, 12, 1200));
  const random = seededRandom(seed);
  const position = new Float64Array(boundedCount * 3);
  const velocity = new Float64Array(boundedCount * 3);
  const kineticEnergy = new Float64Array(boundedCount);
  const localField = new Float64Array(boundedCount);
  const localPotential = new Float64Array(boundedCount);
  const alive = new Uint8Array(boundedCount);
  alive.fill(1);
  for (let index = 0; index < boundedCount; index += 1) {
    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * 0.24;
    position[index * 3] = center.x + Math.cos(angle) * radius;
    position[index * 3 + 1] = center.y + Math.sin(angle) * radius;
    position[index * 3 + 2] = center.z + (random() - 0.5) * 0.12;
    velocity[index * 3] = (random() - 0.5) * 0.08;
    velocity[index * 3 + 1] = (random() - 0.5) * 0.08;
    velocity[index * 3 + 2] = (random() - 0.5) * 0.04;
  }
  return {
    count: boundedCount,
    position,
    velocity,
    kineticEnergy,
    localField,
    localPotential,
    alive,
  };
}

function cloneParticles(particles: ParticleEnsemble): ParticleEnsemble {
  return {
    count: particles.count,
    position: particles.position.slice(),
    velocity: particles.velocity.slice(),
    kineticEnergy: particles.kineticEnergy.slice(),
    localField: particles.localField.slice(),
    localPotential: particles.localPotential.slice(),
    alive: particles.alive.slice(),
  };
}

interface ParticleAdvanceResult {
  particles: ParticleEnsemble;
  randomState: number;
  kineticEnergy: number;
  dissipation: number;
}

function advanceParticles(
  initial: ParticleEnsemble,
  sources: ResonantFieldSource[],
  time: number,
  medium: MediumParameters,
  bounds: Bounds3,
  dt: number,
  randomState: number
): ParticleAdvanceResult {
  const particles = cloneParticles(initial);
  let random = randomState;
  let totalKinetic = 0;
  let dissipation = 0;
  for (let index = 0; index < particles.count; index += 1) {
    if (particles.alive[index] === 0) continue;
    const offset = index * 3;
    const point = vec3(particles.position[offset], particles.position[offset + 1], particles.position[offset + 2]);
    const velocity = vec3(particles.velocity[offset], particles.velocity[offset + 1], particles.velocity[offset + 2]);
    const sample = fieldAt(point, sources, time, medium);
    const gradient = estimatePotentialGradient(point, sources, time, medium);
    const magnetic = scaleVec(crossVec(velocity, sample.vector), medium.magneticStrength);
    let force = addVec(
      addVec(scaleVec(gradient, medium.coupling), scaleVec(sample.vector, medium.charge * 0.04)),
      magnetic
    );
    if (medium.noiseAmplitude > 0) {
      const rx = nextRandomState(random); random = rx.state;
      const ry = nextRandomState(random); random = ry.state;
      const rz = nextRandomState(random); random = rz.state;
      force = addVec(
        force,
        scaleVec(vec3(rx.value - 0.5, ry.value - 0.5, rz.value - 0.5), medium.noiseAmplitude)
      );
    }
    const acceleration = subVec(scaleVec(force, 1 / Math.max(medium.mass, 0.01)), scaleVec(velocity, medium.damping));
    let nextVelocity = addVec(velocity, scaleVec(acceleration, dt));
    const speed = magnitudeVec(nextVelocity);
    if (speed > 2.4) nextVelocity = scaleVec(nextVelocity, 2.4 / speed);
    const nextPosition = addVec(point, scaleVec(nextVelocity, dt));

    (['x', 'y', 'z'] as const).forEach((axis) => {
      const minimum = bounds.min[axis];
      const maximum = bounds.max[axis];
      if (nextPosition[axis] < minimum) {
        nextPosition[axis] = minimum;
        nextVelocity[axis] = Math.abs(nextVelocity[axis]) * 0.72;
      } else if (nextPosition[axis] > maximum) {
        nextPosition[axis] = maximum;
        nextVelocity[axis] = -Math.abs(nextVelocity[axis]) * 0.72;
      }
    });

    particles.position[offset] = nextPosition.x;
    particles.position[offset + 1] = nextPosition.y;
    particles.position[offset + 2] = nextPosition.z;
    particles.velocity[offset] = nextVelocity.x;
    particles.velocity[offset + 1] = nextVelocity.y;
    particles.velocity[offset + 2] = nextVelocity.z;
    const energy = 0.5 * medium.mass * dotVec(nextVelocity, nextVelocity);
    particles.kineticEnergy[index] = energy;
    particles.localField[index] = sample.magnitude;
    particles.localPotential[index] = sample.resonancePotential;
    totalKinetic += energy;
    dissipation += medium.damping * dotVec(nextVelocity, nextVelocity) * dt;
  }
  return { particles, randomState: random, kineticEnergy: totalKinetic, dissipation };
}

function occupancyForPocket(pocket: ResonancePocket, particles: ParticleEnsemble, threshold: number): number {
  if (particles.count === 0) return 0;
  const radius = Math.max(pocket.radius * 1.8, 0.14);
  let contained = 0;
  for (let index = 0; index < particles.count; index += 1) {
    if (particles.alive[index] === 0) continue;
    const offset = index * 3;
    const point = vec3(particles.position[offset], particles.position[offset + 1], particles.position[offset + 2]);
    if (distanceVec(point, pocket.centroid) <= radius && particles.localPotential[index] >= threshold * 0.55) {
      contained += 1;
    }
  }
  return contained / particles.count;
}

function selectPrimaryPocket(pockets: ResonancePocket[], target: Vec3): ResonancePocket | null {
  if (pockets.length === 0) return null;
  return [...pockets].sort((a, b) => {
    const scoreA = a.energy / (1 + distanceVec(a.centroid, target));
    const scoreB = b.energy / (1 + distanceVec(b.centroid, target));
    return scoreB - scoreA;
  })[0];
}

function applyDisturbance(
  disturbance: Disturbance,
  particles: ParticleEnsemble,
  sources: ResonantFieldSource[]
): { particles: ParticleEnsemble; sources: ResonantFieldSource[] } {
  const updatedParticles = cloneParticles(particles);
  const updatedSources = sources.map(copySource);
  const direction = normalizeVec(disturbance.direction, vec3(1, 0, 0));
  if (disturbance.kind === 'velocity_impulse') {
    for (let index = 0; index < updatedParticles.count; index += 1) {
      const offset = index * 3;
      updatedParticles.velocity[offset] += direction.x * disturbance.magnitude;
      updatedParticles.velocity[offset + 1] += direction.y * disturbance.magnitude;
      updatedParticles.velocity[offset + 2] += direction.z * disturbance.magnitude;
    }
  } else if (disturbance.kind === 'density_asymmetry') {
    for (let index = 0; index < updatedParticles.count; index += 1) {
      const offset = index * 3;
      updatedParticles.position[offset] += direction.x * disturbance.magnitude * (index % 2 === 0 ? 1 : -1);
      updatedParticles.position[offset + 1] += direction.y * disturbance.magnitude * 0.35;
    }
  } else {
    updatedSources.forEach((source, index) => {
      const signed = index % 2 === 0 ? 1 : -1;
      source.phase = wrapAngle(source.phase + signed * disturbance.magnitude * (1 + index * 0.1));
    });
  }
  return { particles: updatedParticles, sources: updatedSources };
}

function profileController(profile: EnergyProfile): ARFRControllerConfig {
  const common = {
    kpPosition: 2.8,
    kiPosition: 0.18,
    kdPosition: 0.7,
    phaseGain: 4.2,
    frequencyGain: 1.5,
    amplitudeGain: 1.2,
    rotationGain: 1.1,
    maxPhaseStep: 0.24,
    maxFrequencyStep: 0.05,
    maxAmplitudeStep: 0.04,
    maxRotationStep: 0.08,
    energyWeight: 0.4,
    shapeWeight: 0.8,
  };
  if (profile === 'precision') {
    return { ...common, kpPosition: 3.8, kdPosition: 0.95, phaseGain: 5.3, energyWeight: 0.15 };
  }
  if (profile === 'low_energy') {
    return { ...common, kpPosition: 1.65, kiPosition: 0.08, kdPosition: 0.35, phaseGain: 2.2, amplitudeGain: 0.65, energyWeight: 1.15 };
  }
  if (profile === 'max_confinement') {
    return { ...common, kpPosition: 4.4, kiPosition: 0.24, kdPosition: 1.1, phaseGain: 5.6, amplitudeGain: 1.65, energyWeight: 0.05, shapeWeight: 1.1 };
  }
  return common;
}

interface ControllerInput {
  desiredPosition: Vec3;
  observedPosition: Vec3;
  targets: Vec3[];
  weights: number[];
  desiredShape: PocketShape;
  occupancy: number;
  shapeError: number;
  dt: number;
  sources: ResonantFieldSource[];
  medium: MediumParameters;
  controller: ARFRControllerConfig;
}

interface ControllerUpdate {
  sources: ResonantFieldSource[];
  controller: ControllerState;
}

export function updateAdaptiveController(
  previous: ControllerState,
  input: ControllerInput
): ControllerUpdate {
  const error = subVec(input.desiredPosition, input.observedPosition);
  const derivative = scaleVec(subVec(error, previous.previousError), 1 / Math.max(input.dt, EPSILON));
  const integral = clampVec(
    addVec(previous.integralError, scaleVec(error, input.dt)),
    -1.5,
    1.5
  );
  const config = profileControllerForInput(previous, input);
  const feedback = addVec(
    addVec(scaleVec(error, config.kpPosition), scaleVec(integral, config.kiPosition)),
    scaleVec(derivative, config.kdPosition)
  );
  const phaseTargets = phaseSteeringForTargets(input.sources, input.targets, input.weights, input.medium);
  let phaseErrorTotal = 0;
  let controlEffort = 0;
  const sources = input.sources.map((source, index) => {
    const phaseError = wrapAngle(phaseTargets[index] - source.phase);
    phaseErrorTotal += Math.abs(phaseError);
    const steeringDirection = normalizeVec(subVec(input.desiredPosition, source.position), vec3(1, 0, 0));
    const spatialFeedback = dotVec(feedback, steeringDirection);
    const phaseStep = clamp(
      (phaseError + spatialFeedback * 0.42) * config.phaseGain * input.dt,
      -config.maxPhaseStep,
      config.maxPhaseStep
    );
    const frequencyStep = clamp(
      spatialFeedback * config.frequencyGain * input.dt * 0.035,
      -config.maxFrequencyStep,
      config.maxFrequencyStep
    );
    const amplitudeStep = clamp(
      ((0.68 - input.occupancy) * config.amplitudeGain - Math.abs(spatialFeedback) * config.energyWeight * 0.025) * input.dt,
      -config.maxAmplitudeStep,
      config.maxAmplitudeStep
    );
    const rotationStep = clamp(
      input.shapeError * config.rotationGain * input.dt,
      -config.maxRotationStep,
      config.maxRotationStep
    );
    controlEffort += phaseStep ** 2 + frequencyStep ** 2 + amplitudeStep ** 2 + rotationStep ** 2;
    return {
      ...copySource(source),
      phase: wrapAngle(source.phase + phaseStep),
      frequency: clamp(source.frequency + frequencyStep, 0.25, 4.0),
      amplitude: clamp(source.amplitude + amplitudeStep, 0.15, 1.8),
      angularVelocity: clamp(source.angularVelocity + rotationStep, -4, 4),
    };
  });
  return {
    sources,
    controller: {
      ...previous,
      integralError: integral,
      previousError: error,
      observedPosition: copyVec(input.observedPosition),
      phaseError: phaseErrorTotal / Math.max(1, input.sources.length),
      controlEffort,
    },
  };
}

/** The profile is encoded in gains at config creation; this keeps the pure update signature compact. */
function profileControllerForInput(previous: ControllerState, input: ControllerInput): ARFRControllerConfig {
  const qualityBias = previous.lockState === 'LOCKED' ? 0.96 : 1;
  const base = input.controller;
  return {
    ...base,
    kpPosition: base.kpPosition * qualityBias,
    phaseGain: base.phaseGain * qualityBias,
    shapeWeight: base.shapeWeight * Math.max(0.5, input.desiredShape === 'sphere' ? 0.8 : 1),
  };
}

function updateLockState(
  previous: ControllerState,
  error: number,
  coherence: number,
  occupancy: number,
  dt: number,
  frequencyError: number
): ControllerState {
  const quality = clamp(
    0.46 * (1 - clamp(error / 1.35)) + 0.3 * coherence + 0.24 * clamp(occupancy / 0.68),
    0,
    1
  );
  let lockState: LockState = previous.lockState;
  let acquiringTime = previous.acquiringTime;
  let recoveryTime = previous.recoveryTime;
  if (quality >= 0.78) {
    acquiringTime += dt;
    recoveryTime = 0;
    lockState = acquiringTime >= 0.45 ? 'LOCKED' : 'ACQUIRING';
  } else if (quality >= 0.43) {
    acquiringTime = 0;
    recoveryTime += dt;
    lockState = previous.lockState === 'LOCKED' ? 'RECOVERING' : 'ACQUIRING';
  } else {
    acquiringTime = 0;
    recoveryTime += dt;
    lockState = previous.lockState === 'LOCKED' || previous.lockState === 'RECOVERING' ? 'RECOVERING' : 'LOST';
  }
  return {
    ...previous,
    lockState,
    lockQuality: quality,
    frequencyError,
    coherence,
    acquiringTime,
    recoveryTime,
  };
}

function computeOrbitMetrics(particles: ParticleEnsemble, center: Vec3, routeRadius: number): Pick<ARFRMetrics, 'angularVelocity' | 'radialDispersion' | 'escapeRate'> {
  const radii: number[] = [];
  let angularTotal = 0;
  let active = 0;
  let escaped = 0;
  for (let index = 0; index < particles.count; index += 1) {
    if (particles.alive[index] === 0) continue;
    const offset = index * 3;
    const dx = particles.position[offset] - center.x;
    const dy = particles.position[offset + 1] - center.y;
    const radius = Math.hypot(dx, dy);
    const tangential = (-dy * particles.velocity[offset] + dx * particles.velocity[offset + 1]) / Math.max(radius * radius, 0.01);
    radii.push(radius);
    angularTotal += tangential;
    active += 1;
    if (radius > Math.max(routeRadius * 1.65, 0.75)) escaped += 1;
  }
  if (radii.length === 0) return { angularVelocity: 0, radialDispersion: 0, escapeRate: 1 };
  const mean = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const variance = radii.reduce((sum, radius) => sum + (radius - mean) ** 2, 0) / radii.length;
  return {
    angularVelocity: angularTotal / Math.max(active, 1),
    radialDispersion: Math.sqrt(variance),
    escapeRate: escaped / Math.max(active, 1),
  };
}

function makeMetrics(
  state: Pick<ARFRState, 'config' | 'primaryPocket' | 'pockets' | 'desiredTarget' | 'desiredTargets' | 'energy' | 'particles' | 'time'>,
  lock: ControllerState
): ARFRMetrics {
  const positionError = state.primaryPocket ? distanceVec(state.primaryPocket.centroid, state.desiredTarget) : 1.35;
  const shapeError = Math.abs(state.pockets.length - state.desiredTargets.length) / Math.max(1, state.desiredTargets.length);
  let active = 0;
  let contained = 0;
  for (let index = 0; index < state.particles.count; index += 1) {
    if (state.particles.alive[index] === 0) continue;
    active += 1;
    if (state.particles.localPotential[index] >= state.config.threshold * 0.55) contained += 1;
  }
  const containment = contained / Math.max(1, active);
  const orbit = computeOrbitMetrics(state.particles, state.desiredTarget, state.config.route.radius);
  return {
    positionError,
    shapeError,
    occupancy: state.primaryPocket?.particleOccupancy ?? 0,
    containment,
    routeProgress: clamp(state.time / Math.max(state.config.duration, EPSILON)),
    angularVelocity: orbit.angularVelocity,
    radialDispersion: orbit.radialDispersion,
    escapeRate: orbit.escapeRate,
    splitDetected: state.pockets.length >= 2 && state.desiredTargets.length >= 2,
    mergeDetected: state.pockets.length === 1 && state.desiredTargets.length === 1 && state.config.mode === 'merge',
    pocketCount: state.pockets.length,
  };
}

function makeEnergyLedger(
  previous: EnergyLedger,
  sources: ResonantFieldSource[],
  particles: ParticleEnsemble,
  primary: ResonancePocket | null,
  controlEffort: number,
  dissipation: number,
  dt: number,
  routeDistance: number,
  stableTime: number
): EnergyLedger {
  const fieldInput = sources.reduce((sum, source) => sum + source.amplitude ** 2, 0) * dt;
  let particleKinetic = 0;
  let effectiveCoupledEnergy = 0;
  let retained = 0;
  for (let index = 0; index < particles.count; index += 1) {
    particleKinetic += particles.kineticEnergy[index];
    effectiveCoupledEnergy += particles.localPotential[index] * dt;
    if (primary && particles.localPotential[index] >= 0.55) retained += 1;
  }
  const nextFieldInput = previous.fieldInput + fieldInput;
  const nextControlInput = previous.controlInput + controlEffort;
  const nextDissipation = previous.estimatedDissipation + dissipation;
  const nextCoupled = previous.effectiveCoupledEnergy + effectiveCoupledEnergy;
  const totalEnergy = nextFieldInput + nextControlInput + nextDissipation;
  return {
    fieldInput: nextFieldInput,
    controlInput: nextControlInput,
    particleKinetic,
    estimatedDissipation: nextDissipation,
    effectiveCoupledEnergy: nextCoupled,
    routedDistance: routeDistance,
    stableConfinementTime: stableTime,
    joulesPerSimulatedMeter: totalEnergy / Math.max(routeDistance, 0.01),
    joulesPerParticleRetained: totalEnergy / Math.max(retained, 1),
    joulesPerStableSecond: totalEnergy / Math.max(stableTime, dt),
  };
}

function initialController(target: Vec3): ControllerState {
  return {
    integralError: vec3(),
    previousError: vec3(),
    observedPosition: copyVec(target),
    lockState: 'SEARCHING',
    lockQuality: 0,
    frequencyError: 0,
    phaseError: 0,
    coherence: 0,
    controlEffort: 0,
    acquiringTime: 0,
    recoveryTime: 0,
  };
}

function zeroEnergy(): EnergyLedger {
  return {
    fieldInput: 0,
    controlInput: 0,
    particleKinetic: 0,
    estimatedDissipation: 0,
    effectiveCoupledEnergy: 0,
    routedDistance: 0,
    stableConfinementTime: 0,
    joulesPerSimulatedMeter: 0,
    joulesPerParticleRetained: 0,
    joulesPerStableSecond: 0,
  };
}

export interface ARFRConfigOverrides extends Partial<Omit<ARFRConfig, 'sources' | 'medium' | 'controller' | 'route' | 'bounds' | 'fieldResolution'>> {
  sources?: ResonantFieldSource[];
  sourceArrangement?: SourceArrangement;
  medium?: Partial<MediumParameters>;
  controller?: Partial<ARFRControllerConfig>;
  route?: Partial<RouteDefinition>;
  bounds?: Partial<Bounds3>;
  fieldResolution?: Partial<FieldResolution>;
}

export const DEFAULT_ROUTE: RouteDefinition = {
  kind: 'LINE',
  duration: 18,
  start: vec3(-1.05, 0, 0),
  end: vec3(1.05, 0, 0),
  center: vec3(),
  radius: 0.9,
  startAngle: 0,
  endAngle: Math.PI,
  turns: 1,
  waypoints: [],
};

export function createDefaultARFRConfig(overrides: ARFRConfigOverrides = {}): ARFRConfig {
  const profile = overrides.energyProfile ?? 'balanced';
  const sourceArrangement = overrides.sourceArrangement ?? 'ring';
  const baseSources = createSourceArrangement(sourceArrangement, {
    radius: 1.35,
    effectiveRadius: 2.25,
    frequency: 1.2,
    rotationRate: 0.55,
  });
  const baseMedium: MediumParameters = {
    characteristicFrequency: 1.2,
    resonanceBandwidth: 0.48,
    responseAxis: vec3(0, 0, 1),
    charge: 1,
    mass: 1,
    damping: 0.62,
    coupling: 1.9,
    magneticStrength: 0.08,
    noiseAmplitude: 0,
    waveNumber: 4.2,
  };
  const baseController = profileController(profile);
  const baseBounds: Bounds3 = {
    min: vec3(-2.35, -1.75, -0.8),
    max: vec3(2.35, 1.75, 0.8),
  };
  const baseResolution: FieldResolution = { x: 19, y: 15, z: 7 };
  const route = { ...DEFAULT_ROUTE, ...overrides.route };
  route.duration = overrides.route?.duration ?? overrides.duration ?? route.duration;
  if (overrides.route?.start) route.start = copyVec(overrides.route.start);
  if (overrides.route?.end) route.end = copyVec(overrides.route.end);
  if (overrides.route?.center) route.center = copyVec(overrides.route.center);
  if (overrides.route?.waypoints) route.waypoints = overrides.route.waypoints.map(copyVec);
  const bounds = {
    ...baseBounds,
    ...overrides.bounds,
    min: overrides.bounds?.min ? copyVec(overrides.bounds.min) : copyVec(baseBounds.min),
    max: overrides.bounds?.max ? copyVec(overrides.bounds.max) : copyVec(baseBounds.max),
  };
  const config: ARFRConfig = {
    simulationVersion: 'ARFR-sim.1.0',
    seed: overrides.seed ?? 7301,
    dt: overrides.dt ?? 0.05,
    duration: route.duration,
    bounds,
    fieldResolution: { ...baseResolution, ...overrides.fieldResolution },
    threshold: overrides.threshold ?? 0.31,
    particleCount: overrides.particleCount ?? 180,
    trailParticleCount: overrides.trailParticleCount ?? 12,
    sources: (overrides.sources ?? baseSources).map(copySource),
    sourceArrangement,
    medium: { ...baseMedium, ...overrides.medium, responseAxis: overrides.medium?.responseAxis ? copyVec(overrides.medium.responseAxis) : copyVec(baseMedium.responseAxis) },
    controller: { ...baseController, ...overrides.controller },
    route,
    mode: overrides.mode ?? 'route',
    shape: overrides.shape ?? 'sphere',
    energyProfile: profile,
    morphing: overrides.morphing ?? false,
  };
  validateARFRConfig(config);
  return config;
}

export function validateARFRConfig(config: ARFRConfig): void {
  const finite = (value: number, label: string) => {
    if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  };
  const vector = (value: Vec3, label: string) => {
    for (const axis of ['x', 'y', 'z'] as const) finite(value[axis], `${label}.${axis}`);
  };
  finite(config.seed, 'seed');
  if (!Number.isSafeInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) throw new RangeError('seed must be a uint32 integer');
  finite(config.threshold, 'threshold');
  if (!Number.isInteger(config.particleCount)) throw new RangeError('particleCount must be an integer');
  if (!Number.isInteger(config.trailParticleCount) || config.trailParticleCount < 0 || config.trailParticleCount > config.particleCount) throw new RangeError('trailParticleCount must be an integer between zero and particleCount');
  vector(config.bounds.min, 'bounds.min');
  vector(config.bounds.max, 'bounds.max');
  vector(config.medium.responseAxis, 'medium.responseAxis');
  for (const [key, value] of Object.entries(config.medium)) {
    if (key !== 'responseAxis') finite(value as number, `medium.${key}`);
  }
  for (const [key, value] of Object.entries(config.controller)) {
    finite(value, `controller.${key}`);
    if (value < 0) throw new RangeError(`controller.${key} must be non-negative`);
  }
  for (const key of ['start', 'end', 'center'] as const) vector(config.route[key], `route.${key}`);
  config.route.waypoints.forEach((point, index) => vector(point, `route.waypoints[${index}]`));
  for (const key of ['duration', 'radius', 'startAngle', 'endAngle', 'turns'] as const) finite(config.route[key], `route.${key}`);
  if (config.route.duration <= 0 || config.route.radius < 0) throw new RangeError('route duration must be positive and radius non-negative');
  if (config.medium.damping < 0 || config.medium.noiseAmplitude < 0) throw new RangeError('medium damping and noiseAmplitude must be non-negative');
  finite(config.dt, 'dt');
  finite(config.duration, 'duration');
  if (config.dt <= 0 || config.dt > 0.5) throw new RangeError('dt must be in (0, 0.5]');
  if (config.duration <= 0) throw new RangeError('duration must be positive');
  if (config.particleCount < 12 || config.particleCount > 1200) throw new RangeError('particleCount must be between 12 and 1200');
  if (config.threshold <= 0 || config.threshold >= 1) throw new RangeError('threshold must be in (0, 1)');
  if (!Number.isInteger(config.fieldResolution.x) || !Number.isInteger(config.fieldResolution.y) || !Number.isInteger(config.fieldResolution.z)) throw new RangeError('field resolution must use integer dimensions');
  if (config.fieldResolution.x < 5 || config.fieldResolution.y < 5 || config.fieldResolution.z < 3) throw new RangeError('field resolution is too small');
  if (config.bounds.min.x >= config.bounds.max.x || config.bounds.min.y >= config.bounds.max.y || config.bounds.min.z >= config.bounds.max.z) throw new RangeError('bounds must have positive volume');
  if (config.fieldResolution.x * config.fieldResolution.y * config.fieldResolution.z > 250000) throw new RangeError('field resolution exceeds 250000 cells');
  if (config.sources.length > 64) throw new RangeError('at most 64 field sources are supported');
  if (config.sources.length === 0) throw new RangeError('at least one field source is required');
  config.sources.forEach((source) => {
    vector(source.position, `${source.id}.position`);
    vector(source.orientation, `${source.id}.orientation`);
    vector(source.rotationAxis, `${source.id}.rotationAxis`);
    finite(source.angularVelocity, `${source.id}.angularVelocity`);
    finite(source.polarization, `${source.id}.polarization`);
    finite(source.frequency, `${source.id}.frequency`);
    finite(source.phase, `${source.id}.phase`);
    finite(source.amplitude, `${source.id}.amplitude`);
    finite(source.effectiveRadius, `${source.id}.effectiveRadius`);
    if (source.effectiveRadius <= 0) throw new RangeError(`${source.id}.effectiveRadius must be positive`);
    if (source.amplitude < 0 || source.amplitude > 2) throw new RangeError(`${source.id}.amplitude must be in [0, 2]`);
  });
  finite(config.medium.characteristicFrequency, 'medium.characteristicFrequency');
  finite(config.medium.resonanceBandwidth, 'medium.resonanceBandwidth');
  finite(config.medium.waveNumber, 'medium.waveNumber');
  if (config.medium.mass <= 0) throw new RangeError('medium.mass must be positive');
  if (config.medium.resonanceBandwidth <= 0) throw new RangeError('medium.resonanceBandwidth must be positive');
}

function cloneField(grid: FieldGrid): FieldGrid {
  return {
    resolution: { ...grid.resolution },
    bounds: { min: copyVec(grid.bounds.min), max: copyVec(grid.bounds.max) },
    potential: grid.potential.slice(),
    magnitude: grid.magnitude.slice(),
    coherence: grid.coherence.slice(),
    gradientMagnitude: grid.gradientMagnitude.slice(),
    vectors: grid.vectors.slice(),
  };
}

export function createSimulation(config: ARFRConfig): ARFRState {
  validateARFRConfig(config);
  const nextConfig: ARFRConfig = {
    ...config,
    bounds: { min: copyVec(config.bounds.min), max: copyVec(config.bounds.max) },
    route: copyRoute(config.route),
    fieldResolution: { ...config.fieldResolution },
    sources: config.sources.map(copySource),
    medium: { ...config.medium, responseAxis: copyVec(config.medium.responseAxis) },
    controller: { ...config.controller },
  };
  const desired = targetsForState(nextConfig, 0);
  const steeredPhases = phaseSteeringForTargets(nextConfig.sources, desired.targets, desired.weights, nextConfig.medium);
  const sources = nextConfig.sources.map((source, index) => ({ ...copySource(source), phase: steeredPhases[index] }));
  const field = sampleResonanceField(sources, 0, nextConfig.medium, nextConfig.bounds, nextConfig.fieldResolution);
  const pockets = detectResonancePockets(field, nextConfig.threshold, [], nextConfig.dt, desired.shape);
  const particles = createParticleEnsemble(nextConfig.particleCount, nextConfig.seed, desired.primary);
  const particleTrails: Vec3[][] = [];
  for (let index = 0; index < Math.min(nextConfig.trailParticleCount, particles.count); index += 1) {
    const offset = index * 3;
    particleTrails.push([vec3(particles.position[offset], particles.position[offset + 1], particles.position[offset + 2])]);
  }
  const primaryPocket = selectPrimaryPocket(pockets, desired.primary);
  const controller = initialController(primaryPocket?.centroid ?? desired.primary);
  const initialState: ARFRState = {
    config: nextConfig,
    statistics: { samples: 0, positionErrorSum: 0, peakLockQuality: 0, splitDetected: false, mergeDetected: false },
    time: 0,
    step: 0,
    sources,
    initialSourcePositions: sources.map((source) => copyVec(source.position)),
    particles,
    field: cloneField(field),
    pockets,
    primaryPocket,
    desiredTarget: desired.primary,
    desiredTargets: desired.targets,
    desiredShape: desired.shape,
    targetLock: {
      targetPosition: desired.primary,
      targetShape: desired.shape,
      targetTrajectory: copyRoute(nextConfig.route),
      targetResonanceState: 'SEARCHING',
    },
    controller,
    energy: zeroEnergy(),
    metrics: makeMetrics({ config: nextConfig, primaryPocket, pockets, desiredTarget: desired.primary, desiredTargets: desired.targets, energy: zeroEnergy(), particles, time: 0 }, controller),
    pocketPath: primaryPocket ? [copyVec(primaryPocket.centroid)] : [],
    particleTrails,
    events: ['ARFR initialized: source geometry locked; field synthesis active'],
    randomState: (nextConfig.seed >>> 0) || 0x6d2b79f5,
    pendingDisturbance: null,
    disturbanceApplied: false,
  };
  return initialState;
}

export function queueDisturbance(state: ARFRState, disturbance: Disturbance): ARFRState {
  if (!Number.isFinite(disturbance.magnitude) || disturbance.magnitude < 0 || disturbance.magnitude > 2) {
    throw new RangeError('disturbance magnitude must be in [0, 2]');
  }
  return {
    ...state,
    pendingDisturbance: { ...disturbance, direction: normalizeVec(disturbance.direction) },
    disturbanceApplied: false,
    events: [...state.events, `disturbance queued: ${disturbance.kind}`].slice(-80),
  };
}

export function stepSimulation(previous: ARFRState, requestedDt = previous.config.dt): ARFRState {
  const dt = requestedDt;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) throw new RangeError('simulation dt must be in (0, 0.5]');
  const config = previous.config;
  const time = previous.time + dt;
  const desired = targetsForState(config, time);
  let sources = evolveSources(previous.sources, dt);
  let particles = cloneParticles(previous.particles);
  let disturbanceApplied = previous.disturbanceApplied;
  let randomState = previous.randomState;
  const events = [...previous.events];
  if (previous.pendingDisturbance && !previous.disturbanceApplied) {
    const applied = applyDisturbance(previous.pendingDisturbance, particles, sources);
    particles = applied.particles;
    sources = applied.sources;
    disturbanceApplied = true;
    events.push(`disturbance applied: ${previous.pendingDisturbance.kind}`);
  }

  const observed = previous.primaryPocket?.centroid ?? previous.controller.observedPosition;
  const previousOccupancy = previous.metrics.occupancy;
  const previousShapeError = previous.metrics.shapeError;
  const controlled = updateAdaptiveController(previous.controller, {
    desiredPosition: desired.primary,
    observedPosition: observed,
    targets: desired.targets,
    weights: desired.weights,
    desiredShape: desired.shape,
    occupancy: previousOccupancy,
    shapeError: previousShapeError,
    dt,
    sources,
    medium: config.medium,
    controller: config.controller,
  });
  sources = controlled.sources;

  const field = sampleResonanceField(sources, time, config.medium, config.bounds, config.fieldResolution);
  const advanced = advanceParticles(particles, sources, time, config.medium, config.bounds, dt, randomState);
  particles = advanced.particles;
  randomState = advanced.randomState;
  let pockets = detectResonancePockets(field, config.threshold, previous.pockets, dt, desired.shape);
  pockets = pockets.map((pocket) => ({
    ...pocket,
    particleOccupancy: occupancyForPocket(pocket, particles, config.threshold),
  }));
  const primaryPocket = selectPrimaryPocket(pockets, desired.primary);
  const positionError = primaryPocket ? distanceVec(primaryPocket.centroid, desired.primary) : 1.35;
  const shapeError = Math.abs(pockets.length - desired.targets.length) / Math.max(1, desired.targets.length);
  const occupancy = primaryPocket?.particleOccupancy ?? 0;
  const coherence = primaryPocket?.coherence ?? 0;
  const lock = updateLockState(
    { ...controlled.controller, observedPosition: primaryPocket?.centroid ?? observed },
    positionError,
    coherence,
    occupancy,
    dt,
    Math.abs(
      sources.reduce((sum, source) => sum + source.frequency, 0) / Math.max(sources.length, 1) - config.medium.characteristicFrequency
    )
  );
  if (lock.lockState !== previous.controller.lockState) {
    events.push(`resonance lock: ${previous.controller.lockState} → ${lock.lockState}`);
  }
  if (previous.pockets.length < 2 && pockets.length >= 2) events.push('field topology transition: pocket split detected');
  if (previous.pockets.length >= 2 && pockets.length < 2) events.push('field topology transition: pocket merge detected');

  const routeDistance = previous.energy.routedDistance + (primaryPocket && previous.primaryPocket ? distanceVec(primaryPocket.centroid, previous.primaryPocket.centroid) : 0);
  const stableTime = previous.energy.stableConfinementTime + (lock.lockState === 'LOCKED' ? dt : 0);
  const energy = makeEnergyLedger(previous.energy, sources, particles, primaryPocket, lock.controlEffort, advanced.dissipation, dt, routeDistance, stableTime);
  const nextPartial = {
    config,
    primaryPocket,
    pockets,
    desiredTarget: desired.primary,
    desiredTargets: desired.targets,
    energy,
    particles,
    time,
  };
  const metrics = makeMetrics(nextPartial, lock);
  metrics.positionError = positionError;
  metrics.shapeError = shapeError;
  metrics.occupancy = occupancy;
  metrics.splitDetected = previous.pockets.length < 2 && pockets.length >= 2;
  metrics.mergeDetected = previous.pockets.length >= 2 && pockets.length < 2;

  const pocketPath = primaryPocket
    ? [...previous.pocketPath, copyVec(primaryPocket.centroid)].slice(-600)
    : previous.pocketPath;
  const particleTrails = previous.particleTrails.map((trail, index) => {
    const offset = index * 3;
    const point = vec3(particles.position[offset], particles.position[offset + 1], particles.position[offset + 2]);
    return [...trail, point].slice(-70);
  });
  return {
    ...previous,
    time,
    step: previous.step + 1,
    statistics: {
      samples: previous.statistics.samples + 1,
      positionErrorSum: previous.statistics.positionErrorSum + positionError,
      peakLockQuality: Math.max(previous.statistics.peakLockQuality, lock.lockQuality),
      splitDetected: previous.statistics.splitDetected || metrics.splitDetected,
      mergeDetected: previous.statistics.mergeDetected || metrics.mergeDetected,
    },
    sources,
    particles,
    field,
    pockets,
    primaryPocket,
    desiredTarget: desired.primary,
    desiredTargets: desired.targets,
    desiredShape: desired.shape,
    targetLock: {
      targetPosition: desired.primary,
      targetShape: desired.shape,
      targetTrajectory: copyRoute(config.route),
      targetResonanceState: lock.lockState,
    },
    controller: lock,
    energy,
    metrics,
    pocketPath,
    particleTrails,
    events: events.slice(-80),
    randomState,
    disturbanceApplied,
  };
}

export function buildResonantFieldNetwork(pockets: ResonancePocket[], maxDistance = 1.6): ResonantFieldNetwork {
  const nodes: ResonantNetworkNode[] = pockets.map((pocket) => ({
    id: pocket.id,
    position: copyVec(pocket.centroid),
    coherence: pocket.coherence,
    occupancy: pocket.particleOccupancy,
  }));
  const edges: ResonantNetworkEdge[] = [];
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      const distance = distanceVec(nodes[first].position, nodes[second].position);
      if (distance <= maxDistance) {
        edges.push({
          from: nodes[first].id,
          to: nodes[second].id,
          distance,
          channelStrength: clamp((nodes[first].coherence + nodes[second].coherence) / 2 * (1 - distance / maxDistance)),
        });
      }
    }
  }
  return { nodes, edges };
}

export type BuiltInExperiment =
  | 'static_pocket'
  | 'translation'
  | 'circular_routing'
  | 'disturbance_recovery'
  | 'energy_optimization'
  | 'split'
  | 'merge';

export const BUILT_IN_EXPERIMENTS: Array<{ id: BuiltInExperiment; label: string; detail: string }> = [
  { id: 'static_pocket', label: 'A · Static Pocket', detail: 'Stabilize one field-defined region.' },
  { id: 'translation', label: 'B · Translation', detail: 'Move A → B while sources stay fixed.' },
  { id: 'circular_routing', label: 'C · Circular Routing', detail: 'Orbit the pocket around a center.' },
  { id: 'disturbance_recovery', label: 'D · Disturbance Recovery', detail: 'Impulse the medium and reacquire lock.' },
  { id: 'energy_optimization', label: 'E · Energy Optimization', detail: 'Compare control profiles.' },
  { id: 'split', label: 'F · Split Transform', detail: 'One coherent region → two.' },
  { id: 'merge', label: 'G · Merge Transform', detail: 'Two regions → one coherent region.' },
];

function configForExperiment(experiment: BuiltInExperiment, overrides: ARFRConfigOverrides): ARFRConfig {
  const base: ARFRConfigOverrides = { ...overrides, duration: overrides.duration ?? 12 };
  if (experiment === 'static_pocket') return createDefaultARFRConfig({ ...base, mode: 'hold', route: { kind: 'LINE', start: vec3(0, 0, 0), end: vec3(0, 0, 0) } });
  if (experiment === 'circular_routing') return createDefaultARFRConfig({ ...base, mode: 'orbit', route: { kind: 'CIRCLE', center: vec3(), radius: 0.85, turns: 1, startAngle: 0 } });
  if (experiment === 'disturbance_recovery') return createDefaultARFRConfig({ ...base, mode: 'hold', route: { kind: 'LINE', start: vec3(0, 0, 0), end: vec3(0, 0, 0) } });
  if (experiment === 'split') return createDefaultARFRConfig({ ...base, mode: 'split', shape: 'two_lobe' });
  if (experiment === 'merge') return createDefaultARFRConfig({ ...base, mode: 'merge', shape: 'two_lobe' });
  if (experiment === 'energy_optimization') return createDefaultARFRConfig({ ...base, mode: 'route', energyProfile: overrides.energyProfile ?? 'balanced' });
  return createDefaultARFRConfig({ ...base, mode: 'route', route: { kind: 'LINE', start: vec3(-1.05, 0, 0), end: vec3(1.05, 0, 0) } });
}

export function summarizeExperiment(
  state: ARFRState,
  meanPositionError = state.statistics.samples ? state.statistics.positionErrorSum / state.statistics.samples : state.metrics.positionError,
  peakLockQuality = state.statistics.peakLockQuality
): ExperimentResultSummary {
  const totalEnergy = state.energy.fieldInput + state.energy.controlInput + state.energy.estimatedDissipation;
  let retained = 0;
  for (let index = 0; index < state.particles.count; index += 1) {
    if (state.particles.localPotential[index] >= state.config.threshold * 0.55) retained += 1;
  }
  return {
    finalPositionError: state.metrics.positionError,
    meanPositionError,
    peakLockQuality,
    finalLockState: state.controller.lockState,
    particleRetention: retained / Math.max(1, state.particles.count),
    containment: state.metrics.containment,
    routedDistance: state.energy.routedDistance,
    totalEnergy,
    energyPerSimulatedMeter: state.energy.joulesPerSimulatedMeter,
    joulesPerParticleRetained: state.energy.joulesPerParticleRetained,
    stableConfinementTime: state.energy.stableConfinementTime,
    splitDetected: state.statistics.splitDetected,
    mergeDetected: state.statistics.mergeDetected,
    pocketCount: state.pockets.length,
  };
}

export function runBuiltInExperiment(
  experiment: BuiltInExperiment,
  overrides: ARFRConfigOverrides = {},
  requestedSteps?: number
): ExperimentRunResult {
  const config = configForExperiment(experiment, overrides);
  const steps = requestedSteps ?? Math.ceil(config.duration / config.dt);
  if (!Number.isSafeInteger(steps) || steps < 0 || steps > 100000) throw new RangeError('steps must be an integer in [0, 100000]');
  let state = createSimulation(config);
  const trace: ExperimentRunResult['trace'] = [];
  for (let index = 0; index < steps; index += 1) {
    if (experiment === 'disturbance_recovery' && index === Math.floor(steps * 0.35)) {
      state = queueDisturbance(state, { kind: 'velocity_impulse', magnitude: 0.72, direction: vec3(1, 0.35, 0) });
    }
    state = stepSimulation(state);
    trace.push({
      time: state.time,
      target: copyVec(state.desiredTarget),
      observed: copyVec(state.primaryPocket?.centroid ?? state.controller.observedPosition),
      positionError: state.metrics.positionError,
      lockQuality: state.controller.lockQuality,
      lockState: state.controller.lockState,
      pocketCount: state.pockets.length,
      occupancy: state.metrics.occupancy,
      energy: state.energy.fieldInput + state.energy.controlInput + state.energy.estimatedDissipation,
    });
  }
  return {
    experiment,
    config,
    finalState: state,
    summary: summarizeExperiment(state),
    trace,
  };
}

export interface EnergyComparisonRow {
  profile: EnergyProfile;
  finalPositionError: number;
  totalEnergy: number;
  energyPerSimulatedMeter: number;
  particleRetention: number;
  stableConfinementTime: number;
}

export function runEnergyProfileComparison(seed = 7301, steps = 180): EnergyComparisonRow[] {
  const profiles: EnergyProfile[] = ['precision', 'balanced', 'low_energy', 'max_confinement'];
  return profiles.map((profile) => {
    const run = runBuiltInExperiment('energy_optimization', { seed, energyProfile: profile }, steps);
    return {
      profile,
      finalPositionError: run.summary.finalPositionError,
      totalEnergy: run.summary.totalEnergy,
      energyPerSimulatedMeter: run.summary.energyPerSimulatedMeter,
      particleRetention: run.summary.particleRetention,
      stableConfinementTime: run.summary.stableConfinementTime,
    };
  });
}
