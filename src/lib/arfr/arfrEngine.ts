import {
  ARFRNetworkState,
  ChargedParticle,
  ControllerState,
  ControlMode,
  EnergyLedger,
  OperatingProfile,
  PerturbationEvent,
  ResonancePocket,
  ResonantFieldSource,
  RouteDefinition,
  RouteType,
  Vec3,
} from './types';
import { createFourSourceRingArray, vec3, vec3Len, vec3Sub } from './sources';
import { detectPocketSplitAndMerge, detectResonancePockets } from './pockets';
import {
  createDefaultRoute,
  createParticleEnsemble,
  evaluateRouteTrajectory,
  stepParticleEnsemble,
} from './particlesAndRoutes';
import {
  createInitialControllerState,
  createInitialEnergyLedger,
  updateAdaptiveController,
  updateEnergyLedger,
} from './controller';

export interface ARFRSimState {
  time: number;
  dt: number;
  mode: ControlMode;
  profile: OperatingProfile;
  route: RouteDefinition;
  sources: ResonantFieldSource[];
  pockets: ResonancePocket[];
  particles: ChargedParticle[];
  controllerState: ControllerState;
  energyLedger: EnergyLedger;
  networkState: ARFRNetworkState;
  perturbations: PerturbationEvent[];
  routedDistance: number;
  retainedParticleCount: number;
  lastSplitMergeStatus: { isSplit: boolean; isMerge: boolean; description: string };
}

export class ARFREngine {
  private state: ARFRSimState;

  constructor(
    initialMode: ControlMode = 'ROUTE',
    initialRoute: RouteType = 'LINE',
    profile: OperatingProfile = 'BALANCED'
  ) {
    const sources = createFourSourceRingArray(vec3(0, 0, 0), 2.0, 10.0, 1.0, 3.0);
    const route = createDefaultRoute(initialRoute);
    const particles = createParticleEnsemble(60);
    const controllerState = createInitialControllerState(profile);
    const energyLedger = createInitialEnergyLedger();

    this.state = {
      time: 0,
      dt: 0.05,
      mode: initialMode,
      profile,
      route,
      sources,
      pockets: [],
      particles,
      controllerState,
      energyLedger,
      networkState: {
        nodes: [
          { id: 'node_1', position: vec3(-1.5, 0, 0), resonancePotential: 0.8, stable: true },
          { id: 'node_2', position: vec3(0, 1.2, 0), resonancePotential: 0.85, stable: true },
          { id: 'node_3', position: vec3(1.5, 0, 0), resonancePotential: 0.75, stable: true },
        ],
        edges: [
          { id: 'edge_1_2', fromNodeId: 'node_1', toNodeId: 'node_2', capacity: 100, active: true },
          { id: 'edge_2_3', fromNodeId: 'node_2', toNodeId: 'node_3', capacity: 100, active: true },
        ],
      },
      perturbations: [],
      routedDistance: 0,
      retainedParticleCount: particles.length,
      lastSplitMergeStatus: { isSplit: false, isMerge: false, description: 'Initialization' },
    };
  }

  public getState(): ARFRSimState {
    return this.state;
  }

  public setMode(mode: ControlMode): void {
    this.state.mode = mode;
  }

  public setProfile(profile: OperatingProfile): void {
    this.state.profile = profile;
    this.state.controllerState.profile = profile;
  }

  public setRoute(routeType: RouteType): void {
    this.state.route = createDefaultRoute(routeType);
  }

  public addPerturbation(type: PerturbationEvent['type'], magnitude = 1.0, direction?: Vec3): void {
    this.state.perturbations.push({
      type,
      magnitude,
      direction,
      timestamp: this.state.time,
    });
  }

  public setSources(sources: ResonantFieldSource[]): void {
    this.state.sources = sources;
  }

  public step(dt = 0.05): ARFRSimState {
    this.state.time += dt;
    this.state.dt = dt;
    const t = this.state.time;

    // 1. Evaluate Target Position based on active Mode
    let targetPos = vec3(0, 0, 0);
    if (this.state.mode === 'HOLD') {
      targetPos = vec3(0, 0, 0);
    } else if (this.state.mode === 'ORBIT') {
      const r = 1.5;
      targetPos = vec3(r * Math.cos(t * 1.5), r * Math.sin(t * 1.5), 0);
    } else if (this.state.mode === 'CONVEYOR') {
      const stepIdx = Math.floor(t * 2) % 4;
      targetPos = vec3(-1.5 + stepIdx * 1.0, 0, 0);
    } else {
      targetPos = evaluateRouteTrajectory(this.state.route, t);
    }

    // 2. Pocket detection grid sweep
    const bounds = { min: vec3(-2.2, -2.2, 0), max: vec3(2.2, 2.2, 0), steps: 12 };
    const prevPockets = this.state.pockets;
    const detectedPockets = detectResonancePockets(this.state.sources, bounds, t, 0.15);
    const primaryPocket = detectedPockets.length > 0 ? detectedPockets[0] : null;

    // Topological split/merge check
    const splitMergeStatus = detectPocketSplitAndMerge(prevPockets, detectedPockets);
    this.state.lastSplitMergeStatus = splitMergeStatus;
    this.state.pockets = detectedPockets;

    // 3. Adaptive Controller retuning of sources
    const { updatedSources, nextState } = updateAdaptiveController(
      this.state.sources,
      primaryPocket,
      targetPos,
      dt,
      this.state.controllerState
    );
    this.state.sources = updatedSources;
    this.state.controllerState = nextState;

    // 4. Particle ensemble movement in updated field landscape
    const { updatedParticles, retainedCount } = stepParticleEnsemble(
      this.state.particles,
      this.state.sources,
      this.state.pockets,
      dt,
      t,
      this.state.perturbations
    );
    this.state.particles = updatedParticles;
    this.state.retainedParticleCount = retainedCount;

    // Distance calculation
    if (primaryPocket) {
      const deltaPos = vec3Sub(primaryPocket.centroid, nextState.observedPosition);
      this.state.routedDistance += vec3Len(deltaPos);
    }

    // Total particle kinetic energy
    let totalKinetic = 0;
    updatedParticles.forEach((p) => {
      totalKinetic += p.kineticEnergy;
    });

    // 5. Update Energy Ledger
    this.state.energyLedger = updateEnergyLedger(
      this.state.energyLedger,
      this.state.sources,
      nextState,
      totalKinetic,
      retainedCount,
      this.state.routedDistance,
      dt
    );

    return this.state;
  }
}
