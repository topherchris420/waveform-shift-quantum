import React, { Component, ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';

interface EquationBlockProps {
  title?: string;
  latex: string;
  note?: string;
  inline?: boolean;
}

interface KatexSafeState {
  hasError: boolean;
}

class KatexSafeBoundary extends Component<{ children: ReactNode; fallbackText: string }, KatexSafeState> {
  constructor(props: { children: ReactNode; fallbackText: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): KatexSafeState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <code className="font-mono text-xs text-amber-300">{this.props.fallbackText}</code>;
    }
    return this.props.children;
  }
}

export const EquationBlock: React.FC<EquationBlockProps> = ({ title, latex, note, inline = false }) => (
  <div className="equation-block min-w-0 max-w-full overflow-hidden rounded-md border border-white/15 bg-panel/90 p-2.5 sm:p-3">
    {title && <p className="section-eyebrow mb-2">{title}</p>}
    <div className="equation-scroll max-w-full overflow-x-auto overscroll-x-contain px-1 text-foreground [scrollbar-width:thin]">
      <KatexSafeBoundary fallbackText={latex}>
        {inline ? <InlineMath math={latex} /> : <BlockMath math={latex} />}
      </KatexSafeBoundary>
    </div>
    {note && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{note}</p>}
  </div>
);
