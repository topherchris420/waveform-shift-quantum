import { describe, it, expect } from 'vitest';
import barrierTransmissionTool from '../lib/mcp/tools/barrier-transmission';
import doubleSlitIntensityTool from '../lib/mcp/tools/double-slit-intensity';
import bornProbabilitiesTool from '../lib/mcp/tools/born-probabilities';
import teleportationFidelityTool from '../lib/mcp/tools/teleportation-fidelity';
import pauliCorrectionTool from '../lib/mcp/tools/pauli-correction';
import twoSiteModelTool from '../lib/mcp/tools/two-site-model';
import localizationKernelTool from '../lib/mcp/tools/localization-kernel';
import interferometryPhaseTool from '../lib/mcp/tools/interferometry-phase';
import compareModelsTool from '../lib/mcp/tools/compare-models';
import anomalySearchTool from '../lib/mcp/tools/anomaly-search';
import mcpServer from '../lib/mcp/index';

describe('Model Context Protocol (MCP) Quantum Tools Suite', () => {
  it('registers all 10 tools on the MCP server definition', () => {
    expect(mcpServer.tools.length).toBe(10);
    const names = mcpServer.tools.map((t) => t.name);
    expect(names).toContain('barrier_transmission');
    expect(names).toContain('double_slit_intensity');
    expect(names).toContain('born_probabilities');
    expect(names).toContain('teleportation_fidelity');
    expect(names).toContain('pauli_correction');
    expect(names).toContain('two_site_model');
    expect(names).toContain('localization_kernel');
    expect(names).toContain('interferometry_phase_shift');
    expect(names).toContain('compare_models');
    expect(names).toContain('anomaly_search');
  });

  it('barrier_transmission handler computes transmission and reflection', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (barrierTransmissionTool as any).handler({
      energy_eV: 1.0,
      barrier_eV: 2.0,
      width_nm: 0.5,
    });
    expect(res.structuredContent.transmission).toBeGreaterThan(0);
    expect(res.structuredContent.transmission + res.structuredContent.reflection).toBeCloseTo(1.0, 8);
    expect(res.structuredContent.regime).toBe('tunneling');
  });

  it('double_slit_intensity handler computes normalized intensity', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (doubleSlitIntensityTool as any).handler({
      y_mm: 0,
      slit_separation_um: 50,
      wavelength_nm: 632.8,
      screen_distance_mm: 1000,
    });
    expect(res.structuredContent.intensity).toBeCloseTo(1.0, 6);
  });

  it('born_probabilities handler computes valid probabilities', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (bornProbabilitiesTool as any).handler({ theta_rad: Math.PI / 2 });
    expect(res.structuredContent.p0).toBeCloseTo(0.5, 6);
    expect(res.structuredContent.p1).toBeCloseTo(0.5, 6);
  });

  it('teleportation_fidelity handler computes fidelity and concurrence', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (teleportationFidelityTool as any).handler({ bell_purity: 0.9, decoherence: 0.1 });
    expect(res.structuredContent.fidelity).toBeGreaterThan(0.8);
    expect(res.structuredContent.concurrence).toBeGreaterThan(0);
    expect(res.structuredContent.entangled).toBe(true);
  });

  it('pauli_correction handler returns correct corrective operator', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c00 = await (pauliCorrectionTool as any).handler({ m1: 0, m2: 0 });
    expect(c00.structuredContent.operator).toBe('I');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c01 = await (pauliCorrectionTool as any).handler({ m1: 0, m2: 1 });
    expect(c01.structuredContent.operator).toBe('X');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c10 = await (pauliCorrectionTool as any).handler({ m1: 1, m2: 0 });
    expect(c10.structuredContent.operator).toBe('Z');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c11 = await (pauliCorrectionTool as any).handler({ m1: 1, m2: 1 });
    expect(c11.structuredContent.operator).toBe('X·Z');
  });

  it('two_site_model handler computes Woodyard Hamiltonian populations', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (twoSiteModelTool as any).handler({
      EA: 1.0,
      EB: 1.0,
      phiA: -0.5,
      phiB: 0.5,
      g: 0.8,
      delta: 0.25,
    });
    expect(res.structuredContent.PA + res.structuredContent.PB).toBeCloseTo(1.0, 8);
    expect(res.structuredContent.detuning).toBeCloseTo(0.8, 6);
  });

  it('localization_kernel handler computes response profile L(x) and chi factor', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (localizationKernelTool as any).handler({
      omega0: 10.0,
      beta: 2.0,
      kappa: 0,
      phi: 1.2,
      d2phi: 0,
      omega_w: 12.4,
      gamma: 1.5,
      alpha: 1.0,
    });
    expect(res.structuredContent.kernelFactor_chi).toBeGreaterThan(1.0);
    expect(res.structuredContent.localResonance_omega).toBeCloseTo(12.4, 6);
    expect(res.structuredContent.responseProfile_L).toBeCloseTo(1.0, 6);
  });

  it('interferometry_phase handler computes phase shift and visibility', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (interferometryPhaseTool as any).handler({
      armSeparation_um: 10.0,
      interrogationTime_ms: 2.5,
      fieldGradient_per_um: 0.8,
      coupling_g: 0.85,
      dephasingNoise: 0.05,
    });
    expect(res.structuredContent.phaseShift_rad).toBeGreaterThan(0);
    expect(res.structuredContent.visibility).toBeLessThanOrEqual(1.0);
    expect(res.structuredContent.visibility).toBeGreaterThan(0.5);
  });

  it('compare_models handler compares Standard QM vs Woodyard model', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (compareModelsTool as any).handler({
      experimentType: 'two_site',
      g: 0.8,
      phiA: -0.5,
      phiB: 0.5,
      delta: 0.25,
    });
    expect(res.structuredContent.standardQM).toBeDefined();
    expect(res.structuredContent.woodyardModel).toBeDefined();
    expect(res.structuredContent.falsificationCondition).toContain('excludes model coupling g');
  });

  it('anomaly_search handler finds candidate parameter regimes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (anomalySearchTool as any).handler({ seed: 42, iterations: 20 });
    expect(res.structuredContent.totalDiscovered).toBeGreaterThan(0);
    expect(res.structuredContent.topRegimes.length).toBeGreaterThan(0);
  });
});
