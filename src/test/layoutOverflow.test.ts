import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Layout Overflow & Mobile Responsiveness Safety', () => {
  it('index.css sets max-width: 100vw and overflow-x: hidden on html, body, and #root', () => {
    const cssPath = path.join(__dirname, '../index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('max-width: 100vw');
    expect(cssContent).toContain('overflow-x: hidden');
    expect(cssContent).toContain('width: 100%');
  });

  it('QDPWorkspace enforces max-width and min-width containment for grid items and qubit readouts', () => {
    const qdpPath = path.join(__dirname, '../quantum/components/QDPWorkspace.tsx');
    const qdpContent = fs.readFileSync(qdpPath, 'utf-8');

    expect(qdpContent).toContain('min-w-0 max-w-full overflow-hidden');
    expect(qdpContent).toContain('break-all');
    expect(qdpContent).toContain('overflow-x-auto rounded-md border border-slate-800 max-w-full min-w-0');
  });

  it('EquationBlock contains overflow within scrollable blocks', () => {
    const eqPath = path.join(__dirname, '../components/lab/EquationBlock.tsx');
    const eqContent = fs.readFileSync(eqPath, 'utf-8');

    expect(eqContent).toContain('min-w-0 max-w-full');
    expect(eqContent).toContain('overflow-x-auto max-w-full');
  });

  it('ResourceNetwork contains multi-column topology grid within max-w-full overflow wrapper', () => {
    const rnPath = path.join(__dirname, '../resource-resonance/ResourceNetwork.tsx');
    const rnContent = fs.readFileSync(rnPath, 'utf-8');

    expect(rnContent).toContain('min-w-0 max-w-full');
    expect(rnContent).toContain('overflow-x-auto');
  });

  it('QuantumLab and ResourceResonanceLab main page wrappers enforce overflow-x-hidden', () => {
    const qlPath = path.join(__dirname, '../components/QuantumLab.tsx');
    const qlContent = fs.readFileSync(qlPath, 'utf-8');
    expect(qlContent).toContain('max-w-full overflow-x-hidden');

    const rrlPath = path.join(__dirname, '../resource-resonance/ResourceResonanceLab.tsx');
    const rrlContent = fs.readFileSync(rrlPath, 'utf-8');
    expect(rrlContent).toContain('max-w-full overflow-x-hidden');
  });
});
