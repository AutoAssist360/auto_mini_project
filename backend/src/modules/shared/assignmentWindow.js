const ASSIGNMENT_CONFIRMATION_WINDOW_MS = 5 * 60 * 1000;

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getAssignmentWindow(job) {
  const startedAt = parseDate(job?.offer?.updated_at || job?.offer?.created_at);
  if (!startedAt) {
    return {
      assignment_started_at: null,
      assignment_expires_at: null,
      assignment_window_seconds: ASSIGNMENT_CONFIRMATION_WINDOW_MS / 1000,
    };
  }

  return {
    assignment_started_at: startedAt,
    assignment_expires_at: new Date(
      startedAt.getTime() + ASSIGNMENT_CONFIRMATION_WINDOW_MS
    ),
    assignment_window_seconds: ASSIGNMENT_CONFIRMATION_WINDOW_MS / 1000,
  };
}

export function isAssignmentExpired(job, now = new Date()) {
  const { assignment_expires_at } = getAssignmentWindow(job);
  return Boolean(assignment_expires_at && now >= assignment_expires_at);
}

export function attachAssignmentWindow(job) {
  if (!job) return job;

  return {
    ...job,
    ...getAssignmentWindow(job),
  };
}
