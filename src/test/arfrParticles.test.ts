import { describe, expect, it } from 'vitest';
import { createFourSourceRingArray, vec3 } from '../lib/arfr/sources';
import {
  createDefaultRoute,
  createParticleEnsemble,
  evaluateRouteTrajectory,
  stepParticleEnsemble,
} from '../lib/arfr/particlesAndRoutes';
import { RouteType } from '../lib/arfr/types';

describe('ARFR Particle Ensemble & Routing', () => {
  it('creates particle ensemble with specified bounds and count', () => {
    const ensemble = createParticleEnsemble(30);
    expect(ensemble).toHaveLength(30);
    expect(ensemble[0].kineticEnergy).toBeGreaterThanOrEqual(0);
  });

  it('steps particle ensemble based on field landscape', () => {
    const sources = createFourSourceRingArray();
    const ensemble = createParticleEnsemble(20);
    const initialPos = { ...ensemble[0].position };

    const { updatedParticles } = stepParticleEnsemble(ensemble, sources, [], 0.05, 0.1);
    expect(updatedParticles).toHaveLength(20);
    expect(updatedParticles[0].position).not.toEqual(initialPos);
  });

  it('evaluates trajectories for all predefined route types', () => {
    const routeTypes: RouteType[] = [
      'LINE',
      'ARC',
      'CIRCLE',
      'FIGURE_EIGHT',
      'HELIX',
      'WAYPOINTS',
    ];

    routeTypes.forEach((type) => {
      const route = createDefaultRoute(type);
      const pos0 = evaluateRouteTrajectory(route, 0);
      const posMid = evaluateRouteTrajectory(route, route.duration / 2);

      expect(pos0).toBeDefined();
      expect(posMid).toBeDefined();
      expect(route.type).toBe(type);
    });
  });
});
