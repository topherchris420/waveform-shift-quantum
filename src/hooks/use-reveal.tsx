import React, { useEffect, useRef, useState } from 'react';

/**
 * Observes an element and flips to true the first time it enters the viewport.
 * Respects prefers-reduced-motion by revealing immediately.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

type RevealVariant = 'up' | 'mask' | 'slide-left' | 'slide-right' | 'scale';

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section' | 'aside';
  variant?: RevealVariant;
  /** Delay in ms before the transition starts. */
  delay?: number;
  /** Stagger direct children instead of animating the wrapper as one block. */
  stagger?: boolean;
}

export const Reveal: React.FC<RevealProps> = ({
  as = 'div',
  variant = 'up',
  delay = 0,
  stagger = false,
  className = '',
  style,
  children,
  ...rest
}) => {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      data-visible={visible ? 'true' : 'false'}
      className={`${stagger ? 'reveal-stagger' : ''} ${className}`.trim()}
      style={{ ...style, transitionDelay: `${delay}ms`, ['--reveal-delay' as string]: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
};
