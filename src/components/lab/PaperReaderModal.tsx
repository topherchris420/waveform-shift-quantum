import React, { useState } from 'react';
import { BookOpen, X, Sparkles, FileText, CheckCircle2, ChevronRight, Scale, Atom, Waves, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface PaperReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (mode: string) => void;
}

type SectionId = 'abstract' | 'model' | 'kernel' | 'twosite' | 'qm_limit' | 'classical' | 'signatures' | 'conclusions';

export const PaperReaderModal: React.FC<PaperReaderModalProps> = ({ isOpen, onClose, onSelectPreset }) => {
  const [activeSection, setActiveSection] = useState<SectionId>('abstract');

  if (!isOpen) return null;

  const sections: { id: SectionId; label: string; icon: React.ElementType }[] = [
    { id: 'abstract', label: '1. Abstract & Introduction', icon: Sparkles },
    { id: 'model', label: '2. Matter–Field Action & EOM', icon: Atom },
    { id: 'kernel', label: '3. Response Kernel χ(x)', icon: Waves },
    { id: 'twosite', label: '4. Two-Site Toy Model', icon: Zap },
    { id: 'qm_limit', label: '5. Quantum Mechanics Limit', icon: Scale },
    { id: 'classical', label: '6. Classical Ehrenfest Limit', icon: FileText },
    { id: 'signatures', label: '7. Experimental Signatures', icon: Clock },
    { id: 'conclusions', label: '8-10. Discussion & Conclusion', icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 backdrop-blur-md animate-in fade-in duration-200 sm:p-4">
      <div className="relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border border-cyan-500/30 bg-slate-950 text-slate-100 shadow-2xl sm:h-[90vh] sm:rounded-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-2 border-b border-white/10 bg-slate-900/80 px-3 py-3 sm:items-center sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/20 text-cyan-400 sm:flex">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-cyan-400 font-semibold">Manuscript Explorer</span>
                <Badge variant="outline" className="border-cyan-400/40 bg-cyan-400/10 text-cyan-200 text-[10px]">
                  April 16, 2026
                </Badge>
              </div>
              <h2 className="text-sm font-bold leading-tight text-white sm:text-lg">
                Field-Modulated Spatial Localization as a Dynamical Variable
              </h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </header>

        {/* Content Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:grid md:grid-cols-[240px_1fr]">
          {/* Sidebar Nav */}
          <aside className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-slate-900/40 p-2 md:block md:space-y-1 md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-auto shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition md:w-full ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 font-semibold'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="hidden pt-4 border-t border-white/10 mt-4 md:block">
              <p className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">Author & Affiliation</p>
              <div className="px-3 text-xs text-slate-300">
                <p className="font-semibold text-white">Christopher Woodyard</p>
                <p className="text-[11px] text-cyan-400">Vers3Dynamics</p>
                <p className="text-[10px] text-slate-500">Washington, D.C., USA</p>
              </div>
            </div>
          </aside>

          {/* Main Reading Section */}
          <main className="min-h-0 flex-1 overflow-y-auto p-4 space-y-6 text-sm text-slate-300 leading-relaxed sm:p-6">
            {activeSection === 'abstract' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-5">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                    Abstract
                  </h3>
                  <p className="mt-2 text-slate-200 italic leading-relaxed">
                    We propose an effective theoretical framework in which spatial location is not treated as a fixed intrinsic property of an object, but as a dynamical state emerging from the coupling between matter and an underlying field. In this picture, re-localization is not interpreted as literal disappearance at one coordinate and reappearance at another. Instead, changes in field-controlled localization parameters shift the stable conditions under which matter becomes localized, thereby transferring localization toward a new coordinate defined by the updated dynamics.
                  </p>
                </div>

                <h4 className="text-base font-semibold text-white">Key Contributions</h4>
                <ul className="grid gap-2 sm:grid-cols-2 text-xs">
                  {[
                    '(i) Effective matter–field action S_tot = S_ψ + S_ϕ + S_int',
                    '(ii) Field-modified Schrödinger equation iħ∂ₜψ = [-ħ²/2m ∇² + V + gϕ]ψ',
                    '(iii) Normalized localization response kernel χ(x,t;ω_w)',
                    '(iv) Explicit two-site toy model of continuous localization transfer',
                    '(v) Recovery of standard quantum mechanics in the weak-coupling limit',
                    '(vi) Classical Ehrenfest limit m d²x/dt² = -∇[V + gϕ]',
                    '(vii) 4 experimentally testable signatures in double-well, interferometry, & clocks',
                  ].map((c, i) => (
                    <li key={i} className="rounded-lg border border-white/10 bg-slate-900/60 p-3 text-slate-300">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeSection === 'model' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">2. Effective Matter–Field Model</h3>
                <p>
                  Matter wavefunction <InlineMath math="\\psi(\\mathbf{x}, t)" /> is coupled to a real auxiliary scalar field <InlineMath math="\\phi(\\mathbf{x}, t)" /> through the local density <InlineMath math="|\\psi(\\mathbf{x}, t)|^2" />:
                </p>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs font-mono text-cyan-400 mb-2">Total Action (Eq. 5):</p>
                  <BlockMath math="S_{\\text{tot}} = S_\\psi + S_\\phi + S_{\\text{int}}" />
                  <p className="text-xs font-mono text-cyan-400 my-2">Matter-Scalar Coupling (Eq. 4):</p>
                  <BlockMath math="S_{\\text{int}} = -g \\int dt\\, d^3x\\, \\phi(\\mathbf{x}, t)|\\psi(\\mathbf{x}, t)|^2" />
                </div>

                <h4 className="text-base font-semibold text-white">Equations of Motion (Eq. 6–7)</h4>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-mono text-cyan-300">Field-Modified Schrödinger Equation:</p>
                    <BlockMath math="i\\hbar \\partial_t \\psi(\\mathbf{x},t) = \\left[ -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{x}) + g \\phi(\\mathbf{x},t) \\right] \\psi(\\mathbf{x},t)" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-cyan-300">Auxiliary Scalar Field Equation:</p>
                    <BlockMath math="\\partial_t^2 \\phi - c_\\phi^2 \\nabla^2 \\phi + m_\\phi^2 \\phi + \\frac{\\lambda}{6}\\phi^3 = J(\\mathbf{x},t) - g|\\psi(\\mathbf{x},t)|^2" />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'kernel' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">3. Localization as a Field-Dependent Response</h3>
                <p>
                  To model field-sensitive measurement and localization without destroying Born probabilities, we introduce a local resonance frequency:
                </p>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs font-mono text-cyan-400 mb-1">Local Resonance (Eq. 9):</p>
                  <BlockMath math="\\omega_{\\text{loc}}(\\mathbf{x},t) = \\omega_0 + \\beta \\phi(\\mathbf{x},t) + \\kappa \\nabla^2 \\phi(\\mathbf{x},t)" />
                  <p className="text-xs font-mono text-cyan-400 my-1">Bounded Response Profile (Eq. 10):</p>
                  <BlockMath math="\\mathcal{L}(\\mathbf{x},t;\\omega_w) = \\frac{(\\Gamma/2)^2}{[\\omega_w - \\omega_{\\text{loc}}(\\mathbf{x},t)]^2 + (\\Gamma/2)^2}" />
                  <p className="text-xs font-mono text-cyan-400 my-1">Observed Biased Localization Density (Eq. 12):</p>
                  <BlockMath math="P_{\\text{loc}}(\\mathbf{x},t;\\omega_w) = \\frac{\\exp[\\alpha \\mathcal{L}(\\mathbf{x},t;\\omega_w)] |\\psi(\\mathbf{x},t)|^2}{\\int d^3x' \\exp[\\alpha \\mathcal{L}(\\mathbf{x}',t;\\omega_w)] |\\psi(\\mathbf{x}',t)|^2}" />
                </div>
              </div>
            )}

            {activeSection === 'twosite' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">4. Two-Site Toy Model of Localization Transfer</h3>
                <p>
                  Consider a two-site reduction with localized basis states <InlineMath math="\\{|A\\rangle, |B\\rangle\\}" />. The Hamiltonian is:
                </p>

                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <BlockMath math="H_2(t) = \\begin{pmatrix} E_A + g\\phi_A(t) & \\Delta \\\\ \\Delta & E_B + g\\phi_B(t) \\end{pmatrix}" />
                  <p className="text-xs font-mono text-cyan-400 my-2">Detuning & Mixing Angle (Eq. 16–17):</p>
                  <BlockMath math="\\delta(t) = (E_B - E_A) + g[\\phi_B(t) - \\phi_A(t)], \\quad \\tan(2\\theta(t)) = \\frac{2\\Delta}{\\delta(t)}" />
                  <p className="text-xs font-mono text-cyan-400 my-2">Site Occupation Imbalance (Eq. 28):</p>
                  <BlockMath math="z(t) = P_A(t) - P_B(t) = \\cos(2\\theta(t)) = \\frac{\\delta(t)}{\\sqrt{\\delta(t)^2 + 4\\Delta^2}}" />
                </div>

                {onSelectPreset && (
                  <Button onClick={() => { onSelectPreset('two_site_transfer'); onClose(); }} className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold">
                    Launch Two-Site Simulation
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {activeSection === 'qm_limit' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">5. Recovery of Standard Quantum Mechanics</h3>
                <p>
                  A viable theoretical extension must reduce to standard quantum mechanics under ordinary conditions.
                </p>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                  <div>
                    <h5 className="font-semibold text-cyan-300">5.1 Uniform Weak Field</h5>
                    <p className="text-xs text-slate-300 mt-1">
                      If <InlineMath math="\\phi(\\mathbf{x},t) = \\phi_0(t)" />, <InlineMath math="g\\phi_0(t)" /> contributes only a global phase <InlineMath math="\\exp\\left(-\\frac{i}{\\hbar}\\int_0^t g\\phi_0(t')dt'\\right)" />, yielding exact Schrödinger evolution for <InlineMath math="\\tilde{\\psi}" />.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-cyan-300">5.2 Weak Localization Response</h5>
                    <p className="text-xs text-slate-300 mt-1">
                      If <InlineMath math="\\alpha \\to 0" />, <InlineMath math="\\chi \\to 1" /> and <InlineMath math="P_{\\text{loc}}(\\mathbf{x},t;\\omega_w) \\to |\\psi(\\mathbf{x},t)|^2" /> (standard Born rule).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'classical' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">6. Classical Limit & Effective Potential</h3>
                <p>
                  Ehrenfest relations derived from the field-modified Schrödinger equation yield:
                </p>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <BlockMath math="m\\ddot{\\mathbf{x}}_{\\text{cl}} = -\\nabla \\left[ V(\\mathbf{x}_{\\text{cl}}) + g\\phi(\\mathbf{x}_{\\text{cl}},t) \\right]" />
                  <p className="text-xs font-mono text-cyan-400 my-2">Effective Potential Landscape (Eq. 27):</p>
                  <BlockMath math="V_{\\text{eff}}(\\mathbf{x},t) = V(\\mathbf{x}) + g\\phi(\\mathbf{x},t)" />
                </div>
              </div>
            )}

            {activeSection === 'signatures' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">7. Experimentally Testable Consequences</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <h5 className="font-semibold text-cyan-300">7.1 Double-Well Bias</h5>
                    <BlockMath math="z(t) = \\frac{\\delta(t)}{\\sqrt{\\delta(t)^2 + 4\\Delta^2}}" />
                    <p className="text-xs text-slate-400">Sign change in δ(t) reverses localization bias.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <h5 className="font-semibold text-cyan-300">7.2 Matter-Wave Interferometry</h5>
                    <BlockMath math="\\Delta\\varphi_\\phi = \\frac{g}{\\hbar} \\int_0^T [\\phi(\\mathbf{x}_1(t),t) - \\phi(\\mathbf{x}_2(t),t)] dt" />
                    <p className="text-xs text-slate-400">Interferometer phase shift correlated with field drive.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <h5 className="font-semibold text-cyan-300">7.3 Clock Comparisons</h5>
                    <BlockMath math="\\Delta\\Phi_{AB}(T) = \\eta \\int_0^T [\\phi(\\mathbf{x}_A,t) - \\phi(\\mathbf{x}_B,t)] dt" />
                    <p className="text-xs text-slate-400">Differential clock phase offset under field drive.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <h5 className="font-semibold text-cyan-300">7.4 Statistics Anomaly</h5>
                    <BlockMath math="\\delta P(\\mathbf{x},t;\\omega_w) = P_{\\text{loc}}(\\mathbf{x},t;\\omega_w) - P_B(\\mathbf{x},t)" />
                    <p className="text-xs text-slate-400">Field-correlated statistical deviation from Born rule.</p>
                  </div>
                </div>

                {onSelectPreset && (
                  <Button onClick={() => { onSelectPreset('signatures'); onClose(); }} className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold">
                    Explore Experimental Signatures
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {activeSection === 'conclusions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">8–10. Discussion & Conclusions</h3>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-3">
                  <p>
                    Location need not be a permanently fixed intrinsic property of an object; it can be modeled as a dynamical state emerging from coupling to underlying fields.
                  </p>
                  <p className="text-xs text-slate-400 border-t border-white/10 pt-3">
                    Paper limitations: Phenomenological localization response kernel; auxiliary scalar field rather than emergent gravity; two-site model is illustrative.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
