import { browser } from 'wxt/browser';
import {
  mapRequestedReviewers,
  type RequestedReviewersPayload,
} from '../src/github/reviewRequests';
import { loadGitHubToken } from '../src/storage/settings';
import type {
  PullRequestReviewMetadata,
  ReviewDecision,
  ReviewMetadataResponse,
  ReviewRequest,
} from '../src/types';

interface ReviewMetadataMessage {
  numbers: number[];
  repository: string;
  type: 'get-review-metadata';
}

interface GraphQlReviewer {
  __typename: string;
  login?: string;
  name?: string;
  organization?: { login?: string };
  slug?: string;
}

interface GraphQlPullRequest {
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  reviewRequests: { nodes: Array<{ requestedReviewer: GraphQlReviewer | null } | null> };
  totalCommentsCount: number;
}

interface GraphQlResponse {
  data?: { repository?: Record<string, GraphQlPullRequest | null> };
  errors?: Array<{ message?: string }>;
}

interface GitHubErrorPayload {
  message?: string;
}

function isReviewMetadataMessage(message: unknown): message is ReviewMetadataMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as Partial<ReviewMetadataMessage>;
  return (
    candidate.type === 'get-review-metadata' &&
    typeof candidate.repository === 'string' &&
    Array.isArray(candidate.numbers) &&
    candidate.numbers.every((number) => Number.isInteger(number) && number > 0)
  );
}

function mapDecision(decision: GraphQlPullRequest['reviewDecision']): ReviewDecision {
  if (decision === 'APPROVED') return 'approved';
  if (decision === 'CHANGES_REQUESTED') return 'changes-requested';
  if (decision === 'REVIEW_REQUIRED') return 'review-required';
  return null;
}

function mapReviewer(reviewer: GraphQlReviewer | null): ReviewRequest | null {
  if (!reviewer) return null;
  if (reviewer.__typename === 'User' && reviewer.login) {
    return { id: `user:${reviewer.login}`, label: `@${reviewer.login}`, type: 'user' };
  }
  if (
    reviewer.__typename === 'Team' &&
    reviewer.slug &&
    reviewer.organization?.login
  ) {
    const slug = `${reviewer.organization.login}/${reviewer.slug}`;
    return { id: `team:${slug}`, label: `@${slug}`, type: 'team' };
  }
  return null;
}

function createQuery(numbers: number[]): string {
  const pullRequests = numbers.map((number, index) => `
    pr${index}: pullRequest(number: ${number}) {
      reviewDecision
      totalCommentsCount
      reviewRequests(first: 100) {
        nodes {
          requestedReviewer {
            __typename
            ... on User { login }
            ... on Team { name slug organization { login } }
          }
        }
      }
    }
  `).join('\n');

  return `query ReviewQueue($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      ${pullRequests}
    }
  }`;
}

async function fetchRedactedReviewRequests(
  owner: string,
  name: string,
  number: number,
  token: string,
): Promise<ReviewRequest[]> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/requested_reviewers`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  const payload = await response.json() as RequestedReviewersPayload & GitHubErrorPayload;
  if (!response.ok) {
    throw new Error(payload.message ?? `GitHub returned ${response.status} for PR #${number}.`);
  }
  return mapRequestedReviewers(owner, payload);
}

async function fetchReviewMetadata(
  message: ReviewMetadataMessage,
): Promise<ReviewMetadataResponse> {
  const token = await loadGitHubToken();
  if (!token) return { status: 'not-configured' };

  const [owner, name, ...extra] = message.repository.split('/');
  if (!owner || !name || extra.length > 0 || message.numbers.length === 0) {
    return { message: 'The repository or pull request list is invalid.', status: 'error' };
  }

  try {
    const response = await fetch('https://api.github.com/graphql', {
      body: JSON.stringify({
        query: createQuery(message.numbers),
        variables: { name, owner },
      }),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const payload = await response.json() as GraphQlResponse;
    if (!response.ok || payload.errors?.length) {
      return {
        message: payload.errors?.[0]?.message ?? `GitHub returned ${response.status}.`,
        status: 'error',
      };
    }

    const repository = payload.data?.repository;
    if (!repository) return { message: 'GitHub did not return this repository.', status: 'error' };

    const redactedRequests = new Map<number, ReviewRequest[]>();
    await Promise.all(message.numbers.map(async (number, index) => {
      const pullRequest = repository[`pr${index}`];
      const hasRedactedRequest = pullRequest?.reviewRequests.nodes.some(
        (node) => !node?.requestedReviewer,
      );
      if (!hasRedactedRequest) return;
      redactedRequests.set(
        number,
        await fetchRedactedReviewRequests(owner, name, number, token),
      );
    }));

    const metadata: Record<string, PullRequestReviewMetadata> = {};
    message.numbers.forEach((number, index) => {
      const pullRequest = repository[`pr${index}`];
      if (!pullRequest) return;
      metadata[String(number)] = {
        commentCount: pullRequest.totalCommentsCount,
        reviewDecision: mapDecision(pullRequest.reviewDecision),
        reviewRequests: redactedRequests.get(number) ?? pullRequest.reviewRequests.nodes
          .map((node) => mapReviewer(node?.requestedReviewer ?? null))
          .filter((request): request is ReviewRequest => request !== null),
      };
    });
    return { metadata, status: 'available' };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Could not reach GitHub.',
      status: 'error',
    };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isReviewMetadataMessage(message)) {
      void fetchReviewMetadata(message).then(sendResponse);
      return true;
    }
    return false;
  });
});
