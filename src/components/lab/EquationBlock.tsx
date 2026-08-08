import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

interface EquationBlockProps {
  title?: string;
  latex: string;
  note?: string;
  inline?: boolean;
}

export const EquationBlock: React.FC<EquationBlockProps> = ({ title, latex, note, inline = false }) => (
  <div className="rounded-md border border-white/10 bg-black/30 p-3">
    {title && <p className="section-eyebrow mb-2">{title}</p>}
    <div className="overflow-x-auto text-foreground">
      {inline ? <InlineMath math={latex} /> : <BlockMath math={latex} />}
    </div>
    {note && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{note}</p>}
  </div>
);
