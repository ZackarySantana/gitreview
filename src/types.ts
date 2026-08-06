export interface LabelSummary {
  color: string | null;
  name: string;
}

export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required' | null;

export interface ReviewRequest {
  id: string;
  label: string;
  type: 'team' | 'user';
}

export interface PullRequestSummary {
  author: string | null;
  commentCount: number | null;
  draft: boolean;
  labels: LabelSummary[];
  number: number;
  openedAt: string;
  repository: string;
  reviewDecision: ReviewDecision;
  reviewRequests: ReviewRequest[];
  title: string;
  url: string;
}

export interface PullRequestPagination {
  currentPage: number;
  nextUrl: string | null;
  order: 'newest-first' | 'oldest-first' | 'other';
  previousUrl: string | null;
  totalPages: number | null;
}

export type Density = 'comfortable' | 'compact';
export type ExtensionView = 'github' | 'queue';

export interface Settings {
  defaultView: ExtensionView;
  density: Density;
  thresholds: [number, number, number];
}

export type ZoneId = 'overdue' | 'aging' | 'recent' | 'new';

export interface PullRequestZone {
  description: string;
  id: ZoneId;
  label: string;
  pullRequests: PullRequestSummary[];
}

export type DraftFilter = 'all' | 'draft' | 'ready';
export type QuickFilter = 'labeled' | 'mine';
export type ReviewFilter = 'all' | 'approved' | 'changes-requested' | 'needs-review';

export interface PullRequestReviewMetadata {
  commentCount: number;
  reviewDecision: ReviewDecision;
  reviewRequests: ReviewRequest[];
}

export type ReviewMetadataResponse =
  | { metadata: Record<string, PullRequestReviewMetadata>; status: 'available' }
  | { message: string; status: 'error' }
  | { status: 'not-configured' };
