import {
  ChargedParticle,
  PerturbationEvent,
  ResonancePocket,
  ResonantFieldSource,
  RouteDefinition,
  RouteType,
  Vec3,
} from './types';
import {
  vec3,
  vec3Add,
  vec3Dot,
  vec3Len,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from './sources';
import { calculateResonancePotential } from './pockets';

/**
 * Initializes a charged particle ensemble inside a given medium volume.
 */
export function createParticleEnsemble(
  count = 60,
  bounds: { min: Vec3; max: Vec3 } = { min: vec3(-2, -2, -1), max: vec3(2, 2, 1) },
  seed = 42
): ChargedParticle[] {
  const particles: ChargedParticle[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  for (let i = 0; i < count; i++) {
    const px = bounds.min.x + rand() * (bounds.max.x - bounds.min.x);
    const py = bounds.min.y + rand() * (bounds.max.y - bounds.min.y);
    const pz = bounds.min.z + rand() * (bounds.max.z - bounds.min.z);

    const vx = (rand() - 0.5) * 0.1;
    const vy = (rand() - 0.5) * 0.1;
    const vz = (rand() - 0.5) * 0.1;

    const velocity = vec3(vx, vy, vz);
    const speed = vec3Len(velocity);

    particles.push({
      id: i + 1,
      position: vec3(px, py, pz),
      velocity,
      charge: 1.0,
      mass: 1.0,
      kineticEnergy: 0.5 * 1.0 * speed * speed,
      localField: vec3(0, 0, 0),
      localResonancePotential: 0,
      pocketId: null,
    });
  }

  return particles;
}

/**
 * Updates particle ensemble positions and velocities based on changing field landscape.
 * Particles respond to resonance gradients and local field forces (Lorentz-like attraction to resonance maximums).
 */
export function stepParticleEnsemble(
  particles: ChargedParticle[],
  sources: ResonantFieldSource[],
  pockets: ResonancePocket[],
  dt: number,
  t: number,
  perturbations: PerturbationEvent[] = []
): { updatedParticles: ChargedParticle[]; retainedCount: number } {
  let retainedCount = 0;

  // Active perturbations
  let netImpulse = vec3(0, 0, 0);
  let thermalNoiseScale = 0.05;

  perturbations.forEach((p) => {
    if (Math.abs(t - p.timestamp) < 0.2) {
      if (p.type === 'velocity_impulse' && p.direction) {
        netImpulse = vec3Add(netImpulse, vec3Scale(vec3Normalize(p.direction), p.magnitude));
      } else if (p.type === 'field_noise') {
        thermalNoiseScale += p.magnitude * 0.2;
      }
    }
  });

  const updatedParticles = particles.map((p) => {
    const pos = p.position;
    const evalRes = calculateResonancePotential(sources, pos, t);

    // Calculate gradient of resonance potential at particle location
    const delta = 0.02;
    const rX1 = calculateResonancePotential(sources, vec3Add(pos, vec3(delta, 0, 0)), t).resonancePotential;
    const rX0 = calculateResonancePotential(sources, vec3Sub(pos, vec3(delta, 0, 0)), t).resonancePotential;
    const rY1 = calculateResonancePotential(sources, vec3Add(pos, vec3(0, delta, 0)), t).resonancePotential;
    const rY0 = calculateResonancePotential(sources, vec3Sub(pos, vec3(0, delta, 0)), t).resonancePotential;
    const rZ1 = calculateResonancePotential(sources, vec3Add(pos, vec3(0, 0, delta)), t).resonancePotential;
    const rZ0 = calculateResonancePotential(sources, vec3Sub(pos, vec3(0, 0, delta)), t).resonancePotential;

    const resGradient = vec3(
      (rX1 - rX0) / (2 * delta),
      (rY1 - rY0) / (2 * delta),
      (rZ1 - rZ0) / (2 * delta)
    );

    // Forces: Resonance well attraction force + EM field force + Viscous damping + Noise
    const wellAttractionStrength = 8.0;
    const forceWell = vec3Scale(resGradient, wellAttractionStrength);
    const forceEM = vec3Scale(evalRes.fieldVector, 0.5 * p.charge);
    const damping = vec3Scale(p.velocity, -0.8);

    const randomNoise = vec3(
      (Math.sin(p.id * 17 + t * 10) - 0.5) * thermalNoiseScale,
      (Math.cos(p.id * 13 + t * 10) - 0.5) * thermalNoiseScale,
      (Math.sin(p.id * 23 + t * 10) - 0.5) * thermalNoiseScale
    );

    const netForce = vec3Add(vec3Add(vec3Add(forceWell, forceEM), damping), vec3Add(netImpulse, randomNoise));

    // Acceleration a = F / m
    const accel = vec3Scale(netForce, 1 / p.mass);
    const newVel = vec3Add(p.velocity, vec3Scale(accel, dt));
    const newPos = vec3Add(pos, vec3Scale(newVel, dt));

    const speed = vec3Len(newVel);
    const kineticEnergy = 0.5 * p.mass * speed * speed;

    // Check if particle is retained within any active pocket
    let activePocketId: string | null = null;
    pockets.forEach((pkt) => {
      const dist = vec3Len(vec3Sub(newPos, pkt.centroid));
      if (dist <= Math.cbrt(pkt.volume + 1e-6) * 1.5) {
        activePocketId = pkt.id;
      }
    });

    if (activePocketId !== null) {
      retainedCount++;
    }

    return {
      ...p,
      position: newPos,
      velocity: newVel,
      kineticEnergy,
      localField: evalRes.fieldVector,
      localResonancePotential: evalRes.resonancePotential,
      pocketId: activePocketId,
    };
  });

  return { updatedParticles, retainedCount };
}

/**
 * Calculates target trajectory position for predefined route geometries.
 */
export function evaluateRouteTrajectory(
  route: RouteDefinition,
  t: number
): Vec3 {
  const normTime = (t % route.duration) / route.duration;
  const waypoints = route.waypoints;

  if (waypoints.length === 0) return vec3(0, 0, 0);
  if (waypoints.length === 1) return waypoints[0];

  switch (route.type) {
    case 'LINE': {
      const start = waypoints[0];
      const end = waypoints[waypoints.length - 1];
      const progress = route.closedLoop ? 0.5 * (1 - Math.cos(2 * Math.PI * normTime)) : normTime;
      return vec3Add(start, vec3Scale(vec3Sub(end, start), progress));
    }
    case 'ARC': {
      const center = waypoints[0];
      const radius = vec3Len(vec3Sub(waypoints[1] ?? vec3(1, 0, 0), center));
      const angle = normTime * Math.PI;
      return vec3Add(center, vec3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
    }
    case 'CIRCLE': {
      const center = waypoints[0];
      const radius = vec3Len(vec3Sub(waypoints[1] ?? vec3(1, 0, 0), center));
      const angle = normTime * 2 * Math.PI;
      return vec3Add(center, vec3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
    }
    case 'FIGURE_EIGHT': {
      const center = waypoints[0];
      const scale = vec3Len(vec3Sub(waypoints[1] ?? vec3(1.5, 0, 0), center));
      const angle = normTime * 2 * Math.PI;
      return vec3Add(
        center,
        vec3(scale * Math.sin(angle), (scale / 2) * Math.sin(2 * angle), 0)
      );
    }
    case 'HELIX': {
      const center = waypoints[0];
      const radius = 1.2;
      const angle = normTime * 4 * Math.PI;
      const zHeight = (normTime - 0.5) * 2.0;
      return vec3Add(center, vec3(radius * Math.cos(angle), radius * Math.sin(angle), zHeight));
    }
    case 'WAYPOINTS':
    default: {
      const segments = waypoints.length - 1;
      const scaled = normTime * segments;
      const segIndex = Math.min(Math.floor(scaled), segments - 1);
      const segT = scaled - segIndex;
      const pA = waypoints[segIndex];
      const pB = waypoints[segIndex + 1];
      return vec3Add(pA, vec3Scale(vec3Sub(pB, pA), segT));
    }
  }
}

/**
 * Creates default route definition.
 */
export function createDefaultRoute(type: RouteType): RouteDefinition {
  switch (type) {
    case 'LINE':
      return {
        type: 'LINE',
        waypoints: [vec3(-1.8, 0, 0), vec3(1.8, 0, 0)],
        duration: 5.0,
        closedLoop: true,
      };
    case 'ARC':
      return {
        type: 'ARC',
        waypoints: [vec3(0, 0, 0), vec3(1.5, 0, 0)],
        duration: 6.0,
        closedLoop: true,
      };
    case 'CIRCLE':
      return {
        type: 'CIRCLE',
        waypoints: [vec3(0, 0, 0), vec3(1.5, 0, 0)],
        duration: 8.0,
        closedLoop: true,
      };
    case 'FIGURE_EIGHT':
      return {
        type: 'FIGURE_EIGHT',
        waypoints: [vec3(0, 0, 0), vec3(1.5, 0, 0)],
        duration: 10.0,
        closedLoop: true,
      };
    case 'HELIX':
      return {
        type: 'HELIX',
        waypoints: [vec3(0, 0, 0)],
        duration: 8.0,
        closedLoop: true,
      };
    case 'WAYPOINTS':
    default:
      return {
        type: 'WAYPOINTS',
        waypoints: [vec3(-1.5, -1.0, 0), vec3(0, 1.2, 0), vec3(1.5, -1.0, 0)],
        duration: 6.0,
        closedLoop: false,
      };
  }
}
