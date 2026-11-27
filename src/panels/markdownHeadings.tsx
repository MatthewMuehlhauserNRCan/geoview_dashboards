import { useMemo, type ComponentPropsWithoutRef } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import { headingTag, useHeadingLevel } from '../common/headingLevel';

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

// Author-written markdown (`# Heading`) would otherwise render a bare <h1> in the middle of the
// dashboard, breaking the page's heading outline. Shifts every markdown heading down so its `#`
// sits at `baseLevel` (defaults to the surrounding panel content's level), while the `md-hN`
// class keeps its original visual size (App.css) - only the semantic level changes.
export function useMarkdownHeadings(baseLevel?: number): Components {
  const contextLevel = useHeadingLevel();
  const base = baseLevel ?? contextLevel;
  return useMemo(() => {
    const components: Components = {};
    for (const n of LEVELS) {
      const Tag = headingTag(base + n - 1);
      components[`h${n}`] = ({ node: _node, className, ...props }: ComponentPropsWithoutRef<'h1'> & ExtraProps) => (
        <Tag {...props} className={className ? `${className} md-h${n}` : `md-h${n}`} />
      );
    }
    return components;
  }, [base]);
}
