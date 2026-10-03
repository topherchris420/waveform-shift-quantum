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
    canvasColor: '#0ea5b7',
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
    canvasColor: '#c2410c',
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
    canvasColor: '#5b21b6',
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
    canvasColor: '#0f766e',
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

// ---------------------------------------------------------------------------
// How a proposed-model number was produced
// ---------------------------------------------------------------------------
//
// The epistemic class says what weight a claim deserves. It does not say how a
// "proposed" number came to exist. Two numbers can both carry PROPOSED MODEL
// while one is computed from the model's declared Hamiltonian and the other is a
// hand-tuned modification of an unrelated formula. This second axis keeps those
// cases from looking equivalent anywhere they are displayed.

export type ComparisonDerivation =
  | 'derived_prediction'
  | 'toy_assumption'
  | 'illustrative_transformation'
  | 'speculative_scenario';

export interface ComparisonDerivationDescriptor {
  id: ComparisonDerivation;
  label: string;
  meaning: string;
  /** True only when the number follows from the model's declared equations. */
  isModelPrediction: boolean;
}

export const COMPARISON_DERIVATIONS: Record<ComparisonDerivation, ComparisonDerivationDescriptor> = {
  derived_prediction: {
    id: 'derived_prediction',
    label: 'DERIVED FROM DECLARED MODEL',
    meaning:
      'Computed from the proposed model’s declared equations with no added free choices. Still simulation output, not data.',
    isModelPrediction: true,
  },
  toy_assumption: {
    id: 'toy_assumption',
    label: 'TOY ASSUMPTION',
    meaning:
      'Follows from the model only after an extra simplifying choice the model does not itself make (fixed constants, a chosen state, a chosen profile).',
    isModelPrediction: false,
  },
  illustrative_transformation: {
    id: 'illustrative_transformation',
    label: 'ILLUSTRATIVE — NOT A PREDICTION',
    meaning:
      'A number changed to show what an effect could look like. It is not derived from the model and must not be read as one of its predictions.',
    isModelPrediction: false,
  },
  speculative_scenario: {
    id: 'speculative_scenario',
    label: 'SPECULATIVE SCENARIO',
    meaning:
      'A heuristic modification of established physics with no derivation from the proposed model. Carries no predictive weight.',
    isModelPrediction: false,
  },
};

// ---------------------------------------------------------------------------
// Research status of a simulated experiment
// ---------------------------------------------------------------------------
//
// A simulation never returns "confirmed". It can say that the code produced an
// effect, that a control failed, that the numerics were not resolved, or that
// an internal-consistency requirement broke inside the tested parameters. It
// can never say that nature behaves this way: that needs empirical evidence.

export type ResearchStatus =
  | 'untested'
  | 'simulation_effect_present'
  | 'simulation_effect_absent'
  | 'control_failed'
  | 'numerically_unstable'
  | 'assumptions_invalid'
  | 'prediction_below_declared_resolution'
  | 'empirical_result_required'
  | 'falsified_in_tested_parameter_region'
  | 'inconclusive';

export interface ResearchStatusDescriptor {
  id: ResearchStatus;
  label: string;
  meaning: string;
  /**
   * computational — reachable by simulation alone.
   * empirical     — requires measured data; no simulation can assign it.
   */
  scope: 'computational' | 'empirical';
}

export const RESEARCH_STATUSES: Record<ResearchStatus, ResearchStatusDescriptor> = {
  untested: {
    id: 'untested',
    label: 'UNTESTED',
    meaning: 'No run has been executed for this question.',
    scope: 'computational',
  },
  simulation_effect_present: {
    id: 'simulation_effect_present',
    label: 'SIMULATION EFFECT PRESENT',
    meaning:
      'The code predicts a separation from the baseline that survives the controls and exceeds numerical error. This is a statement about the model as implemented, not about nature.',
    scope: 'computational',
  },
  simulation_effect_absent: {
    id: 'simulation_effect_absent',
    label: 'SIMULATION EFFECT ABSENT',
    meaning: 'The model as implemented predicts no separation from the baseline for these settings.',
    scope: 'computational',
  },
  control_failed: {
    id: 'control_failed',
    label: 'CONTROL FAILED',
    meaning: 'A null control produced an effect. No separation from this run may be interpreted.',
    scope: 'computational',
  },
  numerically_unstable: {
    id: 'numerically_unstable',
    label: 'NUMERICALLY UNSTABLE',
    meaning:
      'Normalisation, propagator or timestep checks failed. The numbers do not reliably describe even the model.',
    scope: 'computational',
  },
  assumptions_invalid: {
    id: 'assumptions_invalid',
    label: 'ASSUMPTIONS INVALID',
    meaning: 'The run left the domain in which the model’s stated assumptions hold.',
    scope: 'computational',
  },
  prediction_below_declared_resolution: {
    id: 'prediction_below_declared_resolution',
    label: 'BELOW DECLARED RESOLUTION',
    meaning:
      'The predicted separation is smaller than the resolution declared before the run, so the proposed test could not discriminate the models as specified.',
    scope: 'computational',
  },
  empirical_result_required: {
    id: 'empirical_result_required',
    label: 'EMPIRICAL RESULT REQUIRED',
    meaning:
      'Whether nature exhibits the effect can only be settled by a calibrated measurement. No simulation can change this status.',
    scope: 'empirical',
  },
  falsified_in_tested_parameter_region: {
    id: 'falsified_in_tested_parameter_region',
    label: 'FAILED IN TESTED REGION',
    meaning:
      'From a simulation: an internal-consistency requirement or implementation-level prediction failed inside the tested parameters. It does not mean the physical hypothesis was empirically falsified; that requires measured data.',
    scope: 'computational',
  },
  inconclusive: {
    id: 'inconclusive',
    label: 'INCONCLUSIVE',
    meaning: 'The separation is not resolved above the numerical uncertainty of the run.',
    scope: 'computational',
  },
};

/**
 * The four questions a research run must keep separate. Passing one gate never
 * implies the next: reproducible code can be numerically wrong, sound numerics
 * can describe a model that fails its own controls, and a model that survives
 * every control can still be wrong about nature.
 */
export type ResearchGateId = 'code' | 'numerics' | 'model' | 'empirical';

export const RESEARCH_GATES: Record<ResearchGateId, { id: ResearchGateId; question: string }> = {
  code: { id: 'code', question: 'Did the code run?' },
  numerics: { id: 'numerics', question: 'Did the numerical method behave correctly?' },
  model: { id: 'model', question: 'Does the proposed model internally survive its controls?' },
  empirical: { id: 'empirical', question: 'Does nature exhibit the predicted effect?' },
};

export const RESEARCH_GATE_ORDER: ResearchGateId[] = ['code', 'numerics', 'model', 'empirical'];
