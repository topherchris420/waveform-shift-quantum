import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

const refs = [
  {
    title: 'Teleporting an unknown quantum state via dual classical and EPR channels',
    authors: 'Bennett, Brassard, Crépeau, Jozsa, Peres, Wootters',
    year: 1993,
    venue: 'Phys. Rev. Lett. 70, 1895',
    href: 'https://doi.org/10.1103/PhysRevLett.70.1895',
  },
  {
    title: 'Quantum Computation and Quantum Information §1.3.7, §4.7',
    authors: 'Nielsen & Chuang',
    year: 2010,
    venue: 'Cambridge University Press',
    href: 'https://doi.org/10.1017/CBO9780511976667',
  },
  {
    title: 'Introduction to Quantum Mechanics §2.5 (tunneling)',
    authors: 'D. J. Griffiths',
    year: 2018,
    venue: '3rd ed., Cambridge University Press',
    href: 'https://doi.org/10.1017/9781316995433',
  },
  {
    title: 'Feynman Lectures on Physics, Vol. III, Ch. 1 (double slit)',
    authors: 'R. P. Feynman',
    year: 1965,
    venue: 'Addison-Wesley',
    href: 'https://www.feynmanlectures.caltech.edu/III_01.html',
  },
];

export const ReferencesFooter: React.FC = () => (
  <section className="mx-auto max-w-[1700px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
    <div className="instrument-panel p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-primary">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="section-eyebrow">Model provenance</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">Primary references</h3>
        </div>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {refs.map((r) => (
          <li key={r.title} className="rounded-md border border-white/10 bg-black/20 p-3">
            <a href={r.href} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2 text-sm text-foreground">
              <span className="flex-1">
                <span className="block font-medium leading-6">{r.title}</span>
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{r.authors} · {r.year} · {r.venue}</span>
              </span>
              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
        Assumptions: non-relativistic single-particle Schrödinger regime; ideal Bell pair for teleportation; scalar Fraunhofer limit for the double slit; electron mass in tunneling calculations. Numerical values use natural units (eV, nm) with ħ = 1 in the code path.
      </p>
    </div>
  </section>
);
