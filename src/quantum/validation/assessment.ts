// From verification results to a conservative research status.
//
// The status is a pure function of executed checks and the run's own numbers.
// Precedence is deliberately pessimistic: a numerical failure outranks a control
// failure, which outranks any effect. The empirical gate is never passed by a
// simulation — it is always "not evaluable" here.

import {
  RESEARCH_GATE_ORDER,
  RESEARCH_GATES,
  type ResearchGateId,
  type ResearchStatus,
} from '@/lib/epistemics';
import type { VerificationResult } from './results';

export type GateOutcome = 'pass' | 'fail' | 'warning' | 'not_evaluable';

export interface GateAssessment {
  id: ResearchGateId;
  question: string;
  outcome: GateOutcome;
  /** Check ids that decided the outcome (failures, else warnings, else all). */
  decidingChecks: string[];
  explanation: string;
}

export interface ResearchAssessment {
  status: ResearchStatus;
  /** Always 'empirical_result_required' for a simulation. */
  empiricalStatus: 'empirical_result_required';
  gates: GateAssessment[];
  statement: string;
}

export interface AssessmentInput {
  checks: readonly VerificationResult[];
  /** Largest model–baseline separation the run produced (trace distance). */
  maxSeparation: number;
  /** Separation at or below this counts as "no effect" (the control tolerance). */
  effectFloor: number;
  /** Largest numerical uncertainty on the separation (e.g. finest ladder error). */
  numericalUncertainty: number;
  /** Resolution declared before the run, if any. */
  declaredResolution: number | null;
}

function gateOutcome(id: ResearchGateId, checks: readonly VerificationResult[]): GateAssessment {
  const mine = checks.filter((c) => c.gate === id && c.status !== 'not_applicable');
  const failed = mine.filter((c) => c.status === 'fail');
  const warned = mine.filter((c) => c.status === 'warning');
  if (id === 'empirical' && failed.length === 0) {
    return {
      id,
      question: RESEARCH_GATES[id].question,
      outcome: 'not_evaluable',
      decidingChecks: mine.map((c) => c.id),
      explanation:
        'Not evaluable by simulation. A calibrated measurement is required, and the open items listed under this gate must be resolved before one could be specified.',
    };
  }
  if (failed.length) {
    return {
      id,
      question: RESEARCH_GATES[id].question,
      outcome: 'fail',
      decidingChecks: failed.map((c) => c.id),
      explanation: `Failed: ${failed.map((c) => c.label).join('; ')}.`,
    };
  }
  if (mine.length === 0) {
    return {
      id,
      question: RESEARCH_GATES[id].question,
      outcome: 'not_evaluable',
      decidingChecks: [],
      explanation: 'No executed checks bear on this gate.',
    };
  }
  return {
    id,
    question: RESEARCH_GATES[id].question,
    outcome: warned.length ? 'warning' : 'pass',
    decidingChecks: (warned.length ? warned : mine).map((c) => c.id),
    explanation: warned.length
      ? `${mine.length - warned.length} passed; warnings: ${warned.map((c) => c.label).join('; ')}.`
      : `${mine.length} executed checks passed.`,
  };
}

export function assessRun(input: AssessmentInput): ResearchAssessment {
  const { checks } = input;
  const gates = RESEARCH_GATE_ORDER.map((id) => gateOutcome(id, checks));
  const failedIn = (gate: ResearchGateId, category?: VerificationResult['category']) =>
    checks.some((c) => c.gate === gate && c.status === 'fail' && (!category || c.category === category));

  let status: ResearchStatus;
  if (failedIn('code')) status = 'untested';
  else if (failedIn('numerics')) status = 'numerically_unstable';
  else if (failedIn('model', 'control')) status = 'control_failed';
  else if (failedIn('model', 'domain') || failedIn('model', 'units') || failedIn('empirical')) {
    // Out-of-domain parameters, inconsistent dimensions, or a unit/calibration
    // claim the run cannot support.
    status = 'assumptions_invalid';
  }
  else if (failedIn('model')) status = 'falsified_in_tested_parameter_region';
  else if (input.maxSeparation <= input.effectFloor) status = 'simulation_effect_absent';
  else if (input.maxSeparation <= 10 * input.numericalUncertainty) status = 'inconclusive';
  else if (input.declaredResolution !== null && input.maxSeparation < input.declaredResolution) {
    status = 'prediction_below_declared_resolution';
  } else status = 'simulation_effect_present';

  const statements: Record<ResearchStatus, string> = {
    untested: 'The run did not produce a valid, finite result.',
    numerically_unstable: 'The numerical method failed a check; no separation from this run describes even the model.',
    control_failed: 'A null control produced an effect; no separation from this run may be interpreted.',
    assumptions_invalid: 'The run left the model’s stated domain of validity.',
    falsified_in_tested_parameter_region:
      'An internal-consistency requirement of the model as implemented failed inside the tested parameters. This is not an empirical falsification of the physical hypothesis.',
    simulation_effect_absent: 'The model as implemented predicts no separation from the baseline here.',
    inconclusive: 'The separation is not resolved above the run’s numerical uncertainty.',
    prediction_below_declared_resolution:
      'The predicted separation is below the resolution declared before the run; the test as specified could not discriminate the models.',
    simulation_effect_present:
      'The code predicts a separation from the baseline that survives the controls and exceeds numerical error. This establishes what the model predicts, not what nature does.',
    empirical_result_required: 'Only a calibrated measurement can address this question.',
  };

  return {
    status,
    empiricalStatus: 'empirical_result_required',
    gates,
    statement: `${statements[status]} Whether nature exhibits the effect is untested.`,
  };
}
