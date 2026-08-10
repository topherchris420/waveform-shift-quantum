// Epistemic labelling.
//
// Every quantity this laboratory shows carries exactly one of four labels. The
// labels are not decoration: they state what evidential weight a number is
// entitled to, and they are required on any surface that displays model output
// alongside textbook physics.
//
//   ESTABLISHED PHYSICS — standard quantum mechanics; textbook-derivable and
//                         experimentally confirmed. Safe to reason from.
//   PROPOSED MODEL      — Woodyard (2026) field-modulated localization. An
//                         unverified hypothesis. Never shown as fact.
//   INTERPRETATION      — a way of reading the mathematics that no measurement
//                         currently distinguishes. Carries no predictive weight.
//   PREDICTION          — a specific number the proposed model says a real
//                         apparatus would return. Testable, and not yet tested.
//
// Nothing produced by the proposed model is ever rendered with the established
// styling, and no simulated output is ever labelled as measured data.

export type EpistemicClass = 'established' | 'proposed' | 'interpretation' | 'prediction';

export interface EpistemicDescriptor {
  id: EpistemicClass;
  label: string;
  short: string;
  meaning: string;
  /** What it would take to move a claim out of this class. */
  evidenceRule: string;
  /** Tailwind classes for the badge. Distinct hue per class, deliberately. */
  className: string;
  /** Accent colour used by canvas rendering, so 2D and DOM agree. */
  canvasColor: string;
}

export const EPISTEMIC_CLASSES: Record<EpistemicClass, EpistemicDescriptor> = {
  established: {
    id: 'established',
    label: 'ESTABLISHED PHYSICS',
    short: 'ESTABLISHED',
    meaning:
      'Standard quantum mechanics. Derivable from textbook postulates and confirmed by existing experiment.',
    evidenceRule: 'Already supported by the experimental record; shown as the baseline against which everything else is judged.',
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    canvasColor: '#38bdf8',
  },
  proposed: {
    id: 'proposed',
    label: 'PROPOSED MODEL',
    short: 'PROPOSED',
    meaning:
      'Woodyard (2026) field-modulated spatial localization. A hypothesis under evaluation — not established physics.',
    evidenceRule:
      'Requires a positive, controlled measurement of the predicted deviation at 5σ, with all listed confounders excluded.',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    canvasColor: '#f59e0b',
  },
  interpretation: {
    id: 'interpretation',
    label: 'INTERPRETATION',
    short: 'INTERPRETATION',
    meaning:
      'A way of reading the same mathematics. No current measurement distinguishes it from the alternatives.',
    evidenceRule:
      'Cannot be confirmed or refuted by the observables on this page; carries no predictive weight and must not be scored.',
    className: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
    canvasColor: '#a78bfa',
  },
  prediction: {
    id: 'prediction',
    label: 'PREDICTION',
    short: 'PREDICTION',
    meaning:
      'A specific value the proposed model says a real apparatus would return. Testable, and not yet tested.',
    evidenceRule:
      'Becomes a result only after measurement on hardware. Until then it is simulation output, never data.',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    canvasColor: '#34d399',
  },
};

export function epistemic(id: EpistemicClass): EpistemicDescriptor {
  return EPISTEMIC_CLASSES[id];
}

/** Map the physics layer's scientific status onto an epistemic class. */
export function statusToEpistemic(
  status: 'Established' | 'Proposed' | 'Speculative'
): EpistemicClass {
  if (status === 'Established') return 'established';
  if (status === 'Speculative') return 'interpretation';
  return 'proposed';
}

/**
 * Standing disclaimer for any surface that renders model output. Kept in one
 * place so it cannot drift between panels.
 */
export const SIMULATION_DISCLAIMER =
  'All values on this page are computed from analytical models in your browser. Nothing here is measured laboratory data, and no prediction of the proposed model is presented as an experimental result.';
