import { browser } from 'wxt/browser';
import type { ReviewMetadataResponse } from '../types';

interface ReviewMetadataMessage {
  numbers: number[];
  repository: string;
  type: 'get-review-metadata';
}

export async function loadReviewMetadata(
  repository: string,
  numbers: number[],
): Promise<ReviewMetadataResponse> {
  const message: ReviewMetadataMessage = {
    numbers,
    repository,
    type: 'get-review-metadata',
  };
  return browser.runtime.sendMessage(message);
}

export function getGitHubApiOptionsUrl(theme: 'dark' | 'light'): string {
  return browser.runtime.getURL(`/options.html?embedded=1&theme=${theme}`);
}
