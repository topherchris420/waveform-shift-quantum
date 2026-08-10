import React from 'react';
import { BookOpen, FlaskConical, Lightbulb, Target } from 'lucide-react';
import { epistemic, type EpistemicClass } from '@/lib/epistemics';

const ICONS: Record<EpistemicClass, React.ElementType> = {
  established: BookOpen,
  proposed: FlaskConical,
  interpretation: Lightbulb,
  prediction: Target,
};

interface EpistemicTagProps {
  kind: EpistemicClass;
  /** Use the abbreviated wording where horizontal space is tight. */
  short?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
  /** Hide the icon when the tag sits inside an already busy row. */
  hideIcon?: boolean;
}

/**
 * The single component allowed to render an epistemic label. Every panel that
 * shows a number uses this, so the vocabulary cannot drift between surfaces.
 * The `title` attribute carries the meaning and the evidence rule, so the
 * definition is always one hover away from the number it qualifies.
 */
export const EpistemicTag: React.FC<EpistemicTagProps> = ({
  kind,
  short = false,
  size = 'xs',
  className = '',
  hideIcon = false,
}) => {
  const descriptor = epistemic(kind);
  const Icon = ICONS[kind];
  const sizing = size === 'xs' ? 'text-[9px] px-1.5 py-0.5 gap-1' : 'text-[11px] px-2 py-1 gap-1.5';

  return (
    <span
      title={`${descriptor.label} — ${descriptor.meaning} ${descriptor.evidenceRule}`}
      className={`inline-flex shrink-0 items-center rounded border font-mono font-bold uppercase tracking-wider ${sizing} ${descriptor.className} ${className}`}
    >
      {!hideIcon && <Icon className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />}
      {short ? descriptor.short : descriptor.label}
    </span>
  );
};

/**
 * Compact legend defining all four labels. Rendered once near the top of the
 * laboratory so the vocabulary is established before any number is read.
 */
export const EpistemicLegend: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
      Label key
    </span>
    {(['established', 'proposed', 'prediction', 'interpretation'] as EpistemicClass[]).map((kind) => (
      <span key={kind} className="flex items-center gap-1.5">
        <EpistemicTag kind={kind} />
        <span className="hidden text-[10px] text-slate-500 xl:inline">
          {epistemic(kind).meaning.split('.')[0]}.
        </span>
      </span>
    ))}
  </div>
);
