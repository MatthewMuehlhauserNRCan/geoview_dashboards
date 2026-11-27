import { createContext, useContext } from 'react';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingTag = `h${HeadingLevel}`;

export function clampHeadingLevel(level: number): HeadingLevel {
  return Math.min(6, Math.max(1, Math.round(level))) as HeadingLevel;
}

export function headingTag(level: number): HeadingTag {
  return `h${clampHeadingLevel(level)}`;
}

// The semantic level panel titles should render at - set by DashboardApp from the dashboard's
// `headingLevel` and which title elements are present, then bumped by one inside each titled
// PanelContainer so panels nested in a tab panel sit one level below the tab panel's own title.
export const HeadingLevelContext = createContext<HeadingLevel>(2);

export function useHeadingLevel(): HeadingLevel {
  return useContext(HeadingLevelContext);
}
