import type { SVGProps } from 'react';

type IconName =
  | 'approved'
  | 'aging'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'comment'
  | 'changes'
  | 'density'
  | 'new'
  | 'overdue'
  | 'pull'
  | 'recent'
  | 'search'
  | 'settings'
  | 'waiting'
  | 'x';

const paths: Record<IconName, string> = {
  approved: 'M3 8.5 6.5 12 13 4',
  aging: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3v4l3 2',
  check: 'm3 8 3 3 7-7',
  chevron: 'm4 6 4 4 4-4',
  clock: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3v4l2 2',
  comment: 'M2 2.5h12v8H7l-3.5 3v-3H2v-8Z',
  changes: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-2.5 4.5 5 5m0-5-5 5',
  density: 'M2 3h12M2 8h12M2 13h12',
  new: 'M8 2v12M2 8h12',
  overdue: 'M8 1 15 14H1L8 1Zm0 4v4m0 2v1',
  pull: 'M5 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm0 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm10 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 5v6m9 0V7a2 2 0 0 0-2-2H7m2-2L7 5l2 2',
  recent: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3v4',
  search: 'M7 2a5 5 0 1 0 0 10A5 5 0 0 0 7 2Zm4 9 3 3',
  settings: 'M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5Zm0-4 1 2 2 .5 2-1 1 2-1 2 .5 2 2 1-1 2-2-.5-2 1-1 2-2-1 .5-2-1.5-1.5-2 .5-1-2 1-1.5-.5-2-2-1 1-2 2 .5Z',
  waiting: 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3v4l3 2',
  x: 'm3 3 10 10M13 3 3 13',
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" {...props}>
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}
