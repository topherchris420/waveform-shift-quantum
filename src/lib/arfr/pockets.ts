import {
  PocketShape,
  ResonancePocket,
  ResonantFieldSource,
  Vec3,
} from './types';
import {
  evaluateSingleSourceField,
  evaluateSuperposedField,
  vec3,
  vec3Add,
  vec3Dot,
  vec3Len,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from './sources';

export interface ResonancePotentialOptions {
  characteristicFrequency?: number;
  threshold?: number;
}

/**
 * Normalised scalar Resonance Potential formula:
 * R(x,t) = frequency_match * field_strength * orientation_match * coherence
 */
export function calculateResonancePotential(
  sources: ResonantFieldSource[],
  p: Vec3,
  t: number,
  options: ResonancePotentialOptions = {}
): {
  resonancePotential: number;
  frequencyMatch: number;
  fieldStrength: number;
  orientationMatch: number;
  coherence: number;
  fieldVector: Vec3;
} {
  const targetFreq = options.characteristicFrequency ?? 10.0;
  const { fieldVector, netIntensity, coherence } = evaluateSuperposedField(sources, p, t);
  const fieldMag = Math.sqrt(netIntensity);

  if (sources.length === 0 || fieldMag < 1e-8) {
    return {
      resonancePotential: 0,
      frequencyMatch: 0,
      fieldStrength: 0,
      orientationMatch: 0,
      coherence: 0,
      fieldVector: vec3(0, 0, 0),
    };
  }

  // Frequency match: Gaussian overlap around characteristic frequency
  let avgSourceFreq = 0;
  sources.forEach((s) => {
    avgSourceFreq += s.frequency;
  });
  avgSourceFreq /= sources.length;
  const freqDiff = avgSourceFreq - targetFreq;
  const frequencyMatch = Math.exp(-((freqDiff / 4.0) ** 2));

  // Field strength normalised saturation curve
  const fieldStrength = fieldMag / (1.0 + fieldMag);

  // Orientation match: alignment of field vector with principal source orientations
  let dotSum = 0;
  const unitField = vec3Normalize(fieldVector);
  sources.forEach((s) => {
    const evalSingle = evaluateSingleSourceField(s, p, t);
    const unitSingle = vec3Normalize(evalSingle.vector);
    dotSum += Math.abs(vec3Dot(unitField, unitSingle));
  });
  const orientationMatch = dotSum / sources.length;

  const resonancePotential = frequencyMatch * fieldStrength * orientationMatch * coherence;

  return {
    resonancePotential: Math.min(Math.max(resonancePotential, 0), 1.0),
    frequencyMatch,
    fieldStrength,
    orientationMatch,
    coherence,
    fieldVector,
  };
}

/**
 * Grid-based sampling to identify contiguous Resonance Pockets (R(x,t) > R_threshold).
 */
export function detectResonancePockets(
  sources: ResonantFieldSource[],
  gridBounds: { min: Vec3; max: Vec3; steps: number },
  t: number,
  rThreshold = 0.25,
  shape: PocketShape = 'sphere'
): ResonancePocket[] {
  const { min, max, steps } = gridBounds;
  const dx = (max.x - min.x) / steps;
  const dy = (max.y - min.y) / steps;
  const dz = max.z === min.z ? 1.0 : (max.z - min.z) / steps;
  const voxelVolume = Math.abs(dx * dy * dz);

  const activePoints: { p: Vec3; r: number; fieldVec: Vec3; coherence: number }[] = [];

  for (let ix = 0; ix <= steps; ix++) {
    for (let iy = 0; iy <= steps; iy++) {
      for (let iz = 0; iz <= (max.z === min.z ? 0 : steps); iz++) {
        const p = vec3(min.x + ix * dx, min.y + iy * dy, min.z + iz * dz);
        const res = calculateResonancePotential(sources, p, t);
        if (res.resonancePotential >= rThreshold) {
          activePoints.push({
            p,
            r: res.resonancePotential,
            fieldVec: res.fieldVector,
            coherence: res.coherence,
          });
        }
      }
    }
  }

  if (activePoints.length === 0) {
    return [];
  }

  // Clustering points into contiguous pockets (DBSCAN / simple radius linkage)
  const clusters: typeof activePoints[] = [];
  const visited = new Set<number>();
  const linkDistSq = (dx * dx + dy * dy + (max.z === min.z ? 0 : dz * dz)) * 2.25 + 1e-6;

  for (let i = 0; i < activePoints.length; i++) {
    if (visited.has(i)) continue;
    const cluster: typeof activePoints = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const idx = queue.shift()!;
      const pt = activePoints[idx];
      cluster.push(pt);

      for (let j = 0; j < activePoints.length; j++) {
        if (visited.has(j)) continue;
        const other = activePoints[j];
        const distSq =
          (pt.p.x - other.p.x) ** 2 + (pt.p.y - other.p.y) ** 2 + (pt.p.z - other.p.z) ** 2;
        if (distSq <= linkDistSq) {
          visited.add(j);
          queue.push(j);
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters.map((cluster, idx) => {
    let centroid = vec3(0, 0, 0);
    let totalR = 0;
    let avgCoherence = 0;
    let peakR = 0;
    let totalEnergy = 0;

    cluster.forEach((pt) => {
      centroid = vec3Add(centroid, vec3Scale(pt.p, pt.r));
      totalR += pt.r;
      avgCoherence += pt.coherence;
      if (pt.r > peakR) peakR = pt.r;
      const fieldMag = vec3Len(pt.fieldVec);
      totalEnergy += fieldMag * fieldMag * voxelVolume;
    });

    if (totalR > 0) {
      centroid = vec3Scale(centroid, 1 / totalR);
    } else {
      centroid = cluster[0].p;
    }
    avgCoherence /= cluster.length;

    // Field gradient calculation at centroid
    const delta = 0.05;
    const rX1 = calculateResonancePotential(sources, vec3Add(centroid, vec3(delta, 0, 0)), t).resonancePotential;
    const rX0 = calculateResonancePotential(sources, vec3Sub(centroid, vec3(delta, 0, 0)), t).resonancePotential;
    const rY1 = calculateResonancePotential(sources, vec3Add(centroid, vec3(0, delta, 0)), t).resonancePotential;
    const rY0 = calculateResonancePotential(sources, vec3Sub(centroid, vec3(0, delta, 0)), t).resonancePotential;
    const rZ1 = calculateResonancePotential(sources, vec3Add(centroid, vec3(0, 0, delta)), t).resonancePotential;
    const rZ0 = calculateResonancePotential(sources, vec3Sub(centroid, vec3(0, 0, delta)), t).resonancePotential;

    const fieldGradient = vec3(
      (rX1 - rX0) / (2 * delta),
      (rY1 - rY0) / (2 * delta),
      (rZ1 - rZ0) / (2 * delta)
    );

    return {
      id: `pocket_${idx + 1}_t${Math.floor(t * 100)}`,
      centroid,
      volume: cluster.length * voxelVolume,
      velocity: vec3(0, 0, 0),
      coherence: avgCoherence,
      lifetime: t,
      energy: totalEnergy,
      particleOccupancy: 0,
      fieldGradient,
      shape: clusters.length > 1 ? 'two_lobe' : shape,
      peakPotential: peakR,
    };
  });
}

export function detectPocketSplitAndMerge(
  previousPockets: ResonancePocket[],
  currentPockets: ResonancePocket[]
): { isSplit: boolean; isMerge: boolean; description: string } {
  const prevCount = previousPockets.length;
  const currCount = currentPockets.length;

  if (prevCount === 1 && currCount === 2) {
    return {
      isSplit: true,
      isMerge: false,
      description: 'Single resonance pocket experienced topological phase split into 2 pockets.',
    };
  }

  if (prevCount === 2 && currCount === 1) {
    return {
      isSplit: false,
      isMerge: true,
      description: 'Two resonance pockets coalesced and merged into 1 continuous pocket.',
    };
  }

  return { isSplit: false, isMerge: false, description: 'Pocket topology unchanged.' };
}
