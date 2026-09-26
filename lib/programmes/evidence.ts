import type { Check, EvaluationContext, Fact, RuleId, Source, Status } from './types';

export const STATUSES: Status[] = ['NOT FEASIBLE', 'NEEDS VERIFICATION', 'FEASIBLE WITH ASSUMPTIONS', 'VERIFIED FEASIBLE'];
export const aggregate = (checks: Pick<Check, 'status'>[]): Status => checks.reduce<Status>((a, b) => STATUSES.indexOf(b.status) < STATUSES.indexOf(a) ? b.status : a, 'VERIFIED FEASIBLE');
export function timestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}
export function validateContext(ctx: EvaluationContext): void {
  if (timestamp(ctx?.evaluatedAt) === null) throw new Error('An explicit ISO evaluation timestamp with timezone is required');
}
export function current(fact: Fact<unknown> | undefined, ctx: EvaluationContext, eventStart?: string | null, endOffsetMin = 0, startOffsetMin = 0): boolean {
  if (!fact || fact.value === null || fact.verification !== 'verified' || !fact.sources?.length || fact.sources.some(s => !s.ref || !['synthetic', 'verified_record'].includes(s.kind))) return false;
  const observed = timestamp(fact.observedAt), until = timestamp(fact.validUntil), now = timestamp(ctx.evaluatedAt);
  if (observed === null || until === null || now === null || observed > now || until < now) return false;
  if (eventStart !== undefined) {
    const start = timestamp(eventStart);
    if (start === null || fact.eventStart !== eventStart || observed > start + startOffsetMin * 60000 || until < start + endOffsetMin * 60000) return false;
    if (fact.availableFrom !== undefined) {
      const from = timestamp(fact.availableFrom);
      if (from === null || from > start + startOffsetMin * 60000) return false;
    }
  }
  return true;
}
export const finite = (x: unknown, minimum = 0): x is number => typeof x === 'number' && Number.isFinite(x) && x >= minimum;
export const integer = (x: unknown, minimum = 0): x is number => finite(x, minimum) && Number.isSafeInteger(x);
/** Only machine rounding tolerance; no business/quantity rounding or inferred units. */
export const exceeds = (demand: number, available: number): boolean => demand - available > Number.EPSILON * Math.max(1, Math.abs(demand), Math.abs(available)) * 8;
export function check(id: string, ruleId: RuleId, status: Status, reason: string, sources: Source[] = [], offeringId?: string, nextAction = 'Confirm the cited requirement and supply dated evidence.', facts: Array<Fact<unknown> | undefined> = []): Check {
  return { id, ruleId, status, reason, sources: sources.map(s => ({...s})), offeringId, nextAction: status === 'VERIFIED FEASIBLE' ? 'Retain this evidence and recheck when conditions change.' : nextAction, evidenceTimes: facts.flatMap(f => f?.observedAt ? [f.observedAt] : []) };
}
export function booleanCheck(id: string, rule: RuleId, fact: Fact<boolean> | undefined, ctx: EvaluationContext, eventStart: string | null, label: string, offeringId?: string): Check {
  const known = current(fact, ctx, eventStart) && typeof fact?.value === 'boolean';
  return check(id, rule, known ? fact?.value ? 'VERIFIED FEASIBLE' : 'NOT FEASIBLE' : 'NEEDS VERIFICATION', `${label}: ${known ? fact?.value ? 'confirmed' : 'known not satisfied' : 'missing, pending, stale, or not scoped to this event'}`, fact?.sources, offeringId, `Verify ${label} for the event, including all catalogue conditions.`, [fact]);
}
