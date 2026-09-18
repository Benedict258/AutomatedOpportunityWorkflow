import { DeadlineType } from '../enums';

export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0;
}

export function isValidTimestamp(ts: string): boolean {
  const d = new Date(ts);
  return !isNaN(d.getTime());
}

export function validateDeadline(deadline?: string | null, deadlineType?: DeadlineType): { valid: boolean; reason?: string } {
  if (!deadlineType) return { valid: false, reason: 'deadlineType required' };
  if (deadlineType === DeadlineType.FIXED) {
    if (!deadline) return { valid: false, reason: 'FIXED deadline requires a value' };
    if (!isValidTimestamp(deadline)) return { valid: false, reason: 'invalid deadline timestamp' };
    return { valid: true };
  }
  if (deadlineType === DeadlineType.ROLLING) {
    if (deadline) return { valid: false, reason: 'ROLLING deadline should not have a date' };
    return { valid: true };
  }
  if (deadlineType === DeadlineType.UNKNOWN) {
    return { valid: true };
  }
  return { valid: false, reason: 'unknown deadline type' };
}
