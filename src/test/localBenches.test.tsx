// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BornRuleBench } from '../components/lab/BornRuleBench';
import { DoubleSlitBench } from '../components/lab/DoubleSlitBench';
import { PhysicsToolRunner } from '../components/lab/PhysicsToolRunner';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Mode-gated local benches', () => {
  it('renders the Fraunhofer double-slit bench as a local instrument', () => {
    act(() => root.render(<DoubleSlitBench />));
    expect(container.textContent).toMatch(/Double-slit bench/i);
    expect(container.textContent).toMatch(/Local instrument/i);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('renders the Born-rule bench with Bloch-sphere measurement controls', () => {
    act(() => root.render(<BornRuleBench />));
    expect(container.textContent).toMatch(/Born-rule bench/i);
    expect(container.textContent).toMatch(/cos²/i);
    const measure = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('MEASURE'),
    );
    expect(measure).toBeDefined();
    act(() => measure!.click());
    expect(container.textContent).toMatch(/n=1/);
  });

  it('mode-gates the local instrument runner to double-slit in interference mode', () => {
    act(() => root.render(<PhysicsToolRunner mode="interference" />));
    expect(container.textContent).toMatch(/Local instruments/i);
    expect(container.textContent).toMatch(/double_slit_intensity/);
    expect(container.textContent).not.toMatch(/teleportation_fidelity/);
    expect(container.textContent).not.toMatch(/born_probabilities/);
  });

  it('mode-gates the local instrument runner to Born-rule in superposition mode', () => {
    act(() => root.render(<PhysicsToolRunner mode="superposition" />));
    expect(container.textContent).toMatch(/born_probabilities/);
    expect(container.textContent).not.toMatch(/double_slit_intensity/);
  });

  it('evaluates Horodecki fidelity locally from the teleportation instrument', () => {
    act(() => root.render(<PhysicsToolRunner mode="teleportation" />));
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Evaluate locally'),
    );
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(container.textContent).toMatch(/Horodecki/);
    expect(container.textContent).toMatch(/singlet_fraction/);
  });

  it('hides instruments when the active mode has no analytic bench', () => {
    act(() => root.render(<PhysicsToolRunner mode="qdp" />));
    expect(container.textContent).toBe('');
  });
});
