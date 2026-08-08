import React from 'react';
import { BookOpen, ExternalLink, FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const primaryPaper = {
  title: 'Field-Modulated Spatial Localization as a Dynamical Variable: An Effective Matter–Scalar Model of Re-Localization Without Discontinuous Disappearance',
  author: 'Christopher Woodyard',
  affiliation: 'Vers3Dynamics, Washington, D.C., USA',
  date: 'April 16, 2026',
  abstract:
    'We propose an effective theoretical framework in which spatial location is not treated as a fixed intrinsic property of an object, but as a dynamical state emerging from the coupling between matter and an underlying field. Changes in field-controlled localization parameters shift the stable conditions under which matter becomes localized, thereby transferring localization toward a new coordinate defined by the updated dynamics without discontinuous disappearance.',
};

const refs = [
  {
    id: 1,
    title: 'Mathematical Foundations of Quantum Mechanics',
    authors: 'J. von Neumann',
    year: 1955,
    venue: 'Princeton University Press',
    topic: 'Self-adjoint position operators & Born rule foundations',
  },
  {
    id: 2,
    title: 'Modern Quantum Mechanics, 2nd ed.',
    authors: 'J. J. Sakurai and J. Napolitano',
    year: 2017,
    venue: 'Cambridge University Press',
    topic: 'Standard non-relativistic quantum dynamics & Hilbert space states',
  },
  {
    id: 3,
    title: 'The Theory of Open Quantum Systems',
    authors: 'H.-P. Breuer and F. Petruccione',
    year: 2002,
    venue: 'Oxford University Press',
    topic: 'Environment-induced decoherence & measurement dynamics',
  },
  {
    id: 4,
    title: 'Quantum Fields in Curved Space',
    authors: 'N. D. Birrell and P. C. W. Davies',
    year: 1982,
    venue: 'Cambridge University Press',
    topic: 'Scalar field quantization & effective field theories',
  },
  {
    id: 5,
    title: 'Introduction to Effective Field Theory',
    authors: 'C. P. Burgess',
    year: 2020,
    venue: 'Cambridge University Press',
    topic: 'Phenomenological matter-scalar coupling & low-energy limits',
  },
  {
    id: 6,
    title: 'Optics and interferometry with atoms and molecules',
    authors: 'A. D. Cronin, J. Schmiedmayer, and D. E. Pritchard',
    year: 2009,
    venue: 'Reviews of Modern Physics, vol. 81, no. 3, pp. 1051–1129',
    topic: 'Matter-wave interferometry signatures (Eq. 29 testable prediction)',
  },
  {
    id: 7,
    title: 'Optical atomic clocks',
    authors: 'A. D. Ludlow, M. M. Boyd, J. Ye, E. Peik, and P. O. Schmidt',
    year: 2015,
    venue: 'Reviews of Modern Physics, vol. 87, no. 2, pp. 637–701',
    topic: 'Clock-comparison differential phase shift (Eq. 30 testable prediction)',
  },
  {
    id: 8,
    title: 'Decoherence, einselection, and the quantum origins of the classical',
    authors: 'W. H. Zurek',
    year: 2003,
    venue: 'Reviews of Modern Physics, vol. 75, no. 3, pp. 715–775',
    topic: 'Einselection of spatial pointer states & classical limit emergence',
  },
];

export const ReferencesFooter: React.FC = () => (
  <section className="mx-auto max-w-[1700px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
    {/* Featured Primary Paper Hero Card */}
    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-purple-950/30 p-6 sm:p-8 shadow-2xl backdrop-blur-md mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/30">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-cyan-400 font-semibold">Primary Paper Integration</span>
              <Badge variant="outline" className="border-cyan-400/40 bg-cyan-400/10 text-cyan-200 text-[10px]">
                April 16, 2026
              </Badge>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">{primaryPaper.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span>{primaryPaper.author}</span>
          <span>•</span>
          <span className="text-cyan-300">{primaryPaper.affiliation}</span>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
        <p className="font-semibold text-cyan-200 mb-1 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          Core Abstract & Theoretical Thesis
        </p>
        <p className="text-slate-300 italic">{primaryPaper.abstract}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Core Equation (6)</span>
          <p className="mt-1 font-mono text-cyan-300">iℏ∂ₜψ = [-ℏ²/2m ∇² + V + gφ]ψ</p>
          <p className="mt-1 text-[11px] text-slate-400">Field-modified Schrödinger equation</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Response Kernel (12)</span>
          <p className="mt-1 font-mono text-cyan-300">P_loc = χ(x)|ψ|² / ∫χ|ψ|²</p>
          <p className="mt-1 text-[11px] text-slate-400">Normalized field-dependent Born bias</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Two-Site Imbalance (28)</span>
          <p className="mt-1 font-mono text-cyan-300">z(t) = δ(t) / √(δ² + 4Δ²)</p>
          <p className="mt-1 text-[11px] text-slate-400">Continuous spatial transfer dynamics</p>
        </div>
      </div>
    </div>

    {/* Paper References List */}
    <div className="instrument-panel p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-primary">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="section-eyebrow">Paper Literature References</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">Woodyard (2026) Citations [1]–[8]</h3>
        </div>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {refs.map((r) => (
          <li key={r.id} className="rounded-md border border-white/10 bg-black/20 p-3 hover:border-cyan-500/40 transition">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-cyan-500/20 font-mono text-xs font-bold text-cyan-300">
                [{r.id}]
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground">{r.title}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {r.authors} ({r.year}) — <span className="text-slate-300">{r.venue}</span>
                </p>
                <p className="mt-1 text-[11px] text-cyan-400/90 font-mono">
                  {r.topic}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
        Theoretical Framework Assumptions: Effective matter-scalar coupling $g \phi(\mathbf{x},t)$; non-relativistic Schrödinger wavefunction $\psi(\mathbf{x},t)$; real auxiliary scalar field $\phi(\mathbf{x},t)$ with parameters $(c_\phi, m_\phi, \lambda)$; normalized localization response kernel $\chi(\mathbf{x},t;\omega_w) = \exp[\alpha \mathcal{L}(\mathbf{x},t;\omega_w)]$. Weak-coupling limit $g\phi_0 \ll \|V\|$ reproduces exact standard quantum mechanics.
      </p>
    </div>
  </section>
);

