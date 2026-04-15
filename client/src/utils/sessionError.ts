import type { SessionEventError } from '../api/client.ts';

export function getSessionErrorLabel(error?: SessionEventError | null): string {
  if (!error) return 'Error';
  if (error.type === 'rate_limit') return 'Rate limited';
  if (typeof error.statusCode === 'number') return `Error ${error.statusCode}`;
  return error.type.replace(/_/g, ' ');
}

export function getSessionErrorDescription(error?: SessionEventError | null): string {
  if (!error) return 'The session reported an error.';
  return error.message.trim() || 'The session reported an error.';
}
