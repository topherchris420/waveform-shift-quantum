import { ARFREngine } from './arfrEngine';
import { ControlMode, OperatingProfile, RouteType } from './types';

let engine: ARFREngine | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT': {
      const { mode, routeType, profile } = payload as {
        mode: ControlMode;
        routeType: RouteType;
        profile: OperatingProfile;
      };
      engine = new ARFREngine(mode, routeType, profile);
      self.postMessage({ type: 'STATE_UPDATE', payload: engine.getState() });
      break;
    }
    case 'STEP': {
      if (!engine) engine = new ARFREngine();
      const dt = payload?.dt ?? 0.05;
      const state = engine.step(dt);
      self.postMessage({ type: 'STATE_UPDATE', payload: state });
      break;
    }
    case 'SET_MODE': {
      if (engine) {
        engine.setMode(payload as ControlMode);
        self.postMessage({ type: 'STATE_UPDATE', payload: engine.getState() });
      }
      break;
    }
    case 'SET_PROFILE': {
      if (engine) {
        engine.setProfile(payload as OperatingProfile);
        self.postMessage({ type: 'STATE_UPDATE', payload: engine.getState() });
      }
      break;
    }
    case 'SET_ROUTE': {
      if (engine) {
        engine.setRoute(payload as RouteType);
        self.postMessage({ type: 'STATE_UPDATE', payload: engine.getState() });
      }
      break;
    }
    case 'ADD_PERTURBATION': {
      if (engine) {
        const { pertType, magnitude, direction } = payload;
        engine.addPerturbation(pertType, magnitude, direction);
      }
      break;
    }
  }
};
