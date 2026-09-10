// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveResonantFieldRouter } from '../arfr/AdaptiveResonantFieldRouter';
import * as arfr from '../arfr/index';

let root: Root;
let container: HTMLDivElement;
let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;
let timestamp: number;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  callbacks = new Map();
  nextId = 0;
  timestamp = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++nextId, callback); return nextId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<AdaptiveResonantFieldRouter />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function frame() {
  timestamp += 50;
  const pending = [...callbacks.values()];
  callbacks.clear();
  act(() => pending.forEach(callback => callback(timestamp)));
}

function click(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  act(() => button!.click());
}

describe('ARFR interactive session lifecycle', () => {
  it('pauses stepping and resumes without accumulating paused time', () => {
    const step = vi.spyOn(arfr, 'stepSimulation');
    frame();
    frame();
    expect(step).toHaveBeenCalledTimes(1);
    click('Pause simulation execution');
    timestamp += 60000;
    frame();
    expect(step).toHaveBeenCalledTimes(1);
    click('Resume simulation execution');
    frame();
    expect(step).toHaveBeenCalledTimes(1);
    frame();
    expect(step).toHaveBeenCalledTimes(2);
  });

  it('schedules recovery in simulation time and cancels it on reset', () => {
    const queue = vi.spyOn(arfr, 'queueDisturbance');
    click('Load preset experiment D · Disturbance Recovery');
    frame();
    for (let index = 0; index < 20; index++) frame();
    expect(queue).not.toHaveBeenCalled();
    click('Reset simulation');
    for (let index = 0; index < 135; index++) frame();
    expect(queue).not.toHaveBeenCalled();
    click('Load preset experiment D · Disturbance Recovery');
    for (let index = 0; index < 135; index++) frame();
    expect(queue).toHaveBeenCalledTimes(1);
  });
});
