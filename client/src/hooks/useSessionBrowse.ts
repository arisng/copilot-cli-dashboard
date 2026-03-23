import { useMemo } from 'react';
import type { SessionSummary } from '../api/client.ts';

export type SessionBrowseStatus = 'Needs attention' | 'Working' | 'Task complete' | 'Idle';
export type SessionBrowseSortField =
  | 'last_activity'
  | 'session_time'
  | 'api_time_spent'
  | 'total_premium_requests_usage_est';
export type SessionBrowseSortOrder = 'asc' | 'desc';

export interface SessionBrowseOption {
  value: string;
  label: string;
  count: number;
}

export interface SessionBrowseState {
  projectPath: string | null;
  branch: string | null;
  status: SessionBrowseStatus | null;
  sortField: SessionBrowseSortField;
  sortOrder: SessionBrowseSortOrder;
  page: number;
  pageSize: number;
}

export interface SessionBrowseResult {
  projectOptions: SessionBrowseOption[];
  branchOptions: SessionBrowseOption[];
  filteredSessions: SessionSummary[];
  paginatedSessions: SessionSummary[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  projectPath: string | null;
  branch: string | null;
  status: SessionBrowseStatus | null;
}

export const SESSION_BROWSE_STATUS_OPTIONS: SessionBrowseStatus[] = [
  'Needs attention',
  'Working',
  'Task complete',
  'Idle',
];

export const SESSION_BROWSE_SORT_FIELDS: SessionBrowseSortField[] = [
  'last_activity',
  'session_time',
  'api_time_spent',
  'total_premium_requests_usage_est',
];

export const DEFAULT_SESSION_BROWSE_STATE: SessionBrowseState = {
  projectPath: null,
  branch: null,
  status: null,
  sortField: 'last_activity',
  sortOrder: 'desc',
  page: 1,
  pageSize: 25,
};

function normalizePathSeparators(value: string): string {
  return value.replace(/[\\/]+/g, '/').trim();
}

function isWindowsStylePath(value: string): boolean {
  return /^[A-Za-z]:\//.test(value) || value.startsWith('//');
}

export function normalizeProjectPathForComparison(projectPath: string): string {
  const normalized = normalizePathSeparators(projectPath);

  if (!normalized) {
    return '';
  }

  const comparable = isWindowsStylePath(normalized)
    ? normalized.toLowerCase()
    : normalized;

  if (comparable === '/' || /^[a-z]:\/$/.test(comparable)) {
    return comparable;
  }

  return comparable.replace(/\/+$/, '');
}

export function getProjectLabel(projectPath: string): string {
  const normalized = normalizeProjectPathForComparison(projectPath);
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? projectPath;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function getTimestampValue(timestamp: string): number {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? 0 : value;
}

function getProjectPathKey(projectPath: string): string {
  return normalizeProjectPathForComparison(projectPath);
}

function areProjectPathsEqual(left: string, right: string): boolean {
  return getProjectPathKey(left) === getProjectPathKey(right);
}

function matchesProject(session: SessionSummary, projectPath: string | null): boolean {
  if (!projectPath) {
    return true;
  }

  return areProjectPathsEqual(session.projectPath, projectPath);
}

export function getProjectOptions(sessions: SessionSummary[]): SessionBrowseOption[] {
  const countsByProject = new Map<string, { projectPath: string; count: number }>();

  for (const session of sessions) {
    const key = getProjectPathKey(session.projectPath);
    const existing = countsByProject.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    countsByProject.set(key, {
      projectPath: session.projectPath,
      count: 1,
    });
  }

  return [...countsByProject.values()]
    .map(({ projectPath, count }) => ({
      value: projectPath,
      label: getProjectLabel(projectPath),
      count,
    }))
    .sort((left, right) => {
      const labelComparison = compareStrings(left.label, right.label);
      if (labelComparison !== 0) {
        return labelComparison;
      }

      return compareStrings(left.value, right.value);
    });
}

export function getBranchOptions(sessions: SessionSummary[], projectPath: string | null): SessionBrowseOption[] {
  if (!projectPath) {
    return [];
  }

  const countsByBranch = new Map<string, number>();

  for (const session of sessions) {
    if (!matchesProject(session, projectPath) || !session.gitBranch) {
      continue;
    }

    countsByBranch.set(session.gitBranch, (countsByBranch.get(session.gitBranch) ?? 0) + 1);
  }

  return [...countsByBranch.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((left, right) => compareStrings(left.label, right.label));
}

export function getSessionBrowseStatus(session: SessionSummary): SessionBrowseStatus | null {
  if (session.needsAttention) {
    return 'Needs attention';
  }

  if (session.isWorking) {
    return 'Working';
  }

  if (session.isTaskComplete) {
    return 'Task complete';
  }

  if (session.isIdle) {
    return 'Idle';
  }

  return null;
}

function getSortValue(session: SessionSummary, sortField: SessionBrowseSortField): number {
  switch (sortField) {
    case 'session_time':
      return session.durationMs;
    case 'api_time_spent':
      return session.totalApiDurationEstimateMs;
    case 'total_premium_requests_usage_est':
      return session.totalPremiumRequestsEstimate;
    case 'last_activity':
    default:
      return getTimestampValue(session.lastActivityAt);
  }
}

export function filterSessionsForBrowse(sessions: SessionSummary[], state: Pick<
  SessionBrowseState,
  'projectPath' | 'branch' | 'status'
>): SessionSummary[] {
  const selectedBranch = state.projectPath ? state.branch : null;

  return sessions.filter((session) => {
    if (!matchesProject(session, state.projectPath)) {
      return false;
    }

    if (selectedBranch && session.gitBranch !== selectedBranch) {
      return false;
    }

    if (state.status && getSessionBrowseStatus(session) !== state.status) {
      return false;
    }

    return true;
  });
}

export function sortSessionsForBrowse(
  sessions: SessionSummary[],
  sortField: SessionBrowseSortField,
  sortOrder: SessionBrowseSortOrder,
): SessionSummary[] {
  const direction = sortOrder === 'asc' ? 1 : -1;

  return [...sessions].sort((left, right) => {
    const primaryComparison = compareNumbers(
      getSortValue(left, sortField),
      getSortValue(right, sortField),
    );
    if (primaryComparison !== 0) {
      return primaryComparison * direction;
    }

    const activityComparison = compareNumbers(
      getTimestampValue(right.lastActivityAt),
      getTimestampValue(left.lastActivityAt),
    );
    if (activityComparison !== 0) {
      return activityComparison;
    }

    const durationComparison = compareNumbers(right.durationMs, left.durationMs);
    if (durationComparison !== 0) {
      return durationComparison;
    }

    const titleComparison = compareStrings(left.title, right.title);
    if (titleComparison !== 0) {
      return titleComparison;
    }

    return compareStrings(left.id, right.id);
  });
}

export function paginateSessionsForBrowse(
  sessions: SessionSummary[],
  page: number,
  pageSize: number,
): Pick<SessionBrowseResult, 'paginatedSessions' | 'page' | 'pageSize' | 'totalItems' | 'totalPages'> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = sessions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const startIndex = (safePage - 1) * safePageSize;

  return {
    paginatedSessions: sessions.slice(startIndex, startIndex + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
  };
}

export function browseSessions(sessions: SessionSummary[], state: SessionBrowseState): SessionBrowseResult {
  const projectOptions = getProjectOptions(sessions);
  let selectedProjectPath: string | null = null;

  if (state.projectPath) {
    const requestedProjectPath = state.projectPath;
    selectedProjectPath =
      projectOptions.find((option) => areProjectPathsEqual(option.value, requestedProjectPath))?.value ?? null;
  }

  const branchOptions = getBranchOptions(sessions, selectedProjectPath);
  const selectedBranch = branchOptions.some((option) => option.value === state.branch) ? state.branch : null;
  const selectedStatus = state.status && SESSION_BROWSE_STATUS_OPTIONS.includes(state.status) ? state.status : null;
  const filteredSessions = filterSessionsForBrowse(sessions, {
    projectPath: selectedProjectPath,
    branch: selectedBranch,
    status: selectedStatus,
  });
  const sortedSessions = sortSessionsForBrowse(filteredSessions, state.sortField, state.sortOrder);
  const pagination = paginateSessionsForBrowse(sortedSessions, state.page, state.pageSize);

  return {
    projectOptions,
    branchOptions,
    filteredSessions: sortedSessions,
    paginatedSessions: pagination.paginatedSessions,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    page: pagination.page,
    pageSize: pagination.pageSize,
    projectPath: selectedProjectPath,
    branch: selectedBranch,
    status: selectedStatus,
  };
}

export function useSessionBrowse(sessions: SessionSummary[], state: SessionBrowseState): SessionBrowseResult {
  return useMemo(
    () => browseSessions(sessions, state),
    [
      sessions,
      state.branch,
      state.page,
      state.pageSize,
      state.projectPath,
      state.sortField,
      state.sortOrder,
      state.status,
    ],
  );
}
