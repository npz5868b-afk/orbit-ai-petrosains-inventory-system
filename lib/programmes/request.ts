import type { Assumption, Check, Goal, Request } from './types';
import { check, finite, integer, timestamp } from './evidence';
import { parseAge } from './catalogue';

/** Accepts untrusted structured input. Invalid values are errors, never silent defaults. */
export function normalizeRequest(input: unknown): {request: Request; checks: Check[]} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Request must be an object');
  const x = input as Record<string, unknown>, checks: Check[] = [];
  function bad(key: string): void { checks.push(check(`request.${key}.invalid`, 'RULE-009', 'NOT FEASIBLE', `Invalid structured request field: ${key}`, [], undefined, `Correct ${key}; no value was inferred.`)); }
  function nullableNumber(key: string, count = false): number | null {
    const n = x[key];
    if (n === undefined || n === null || n === 'Unknown') return null;
    if (!(count ? integer(n, 1) : finite(n, 0.001))) {bad(key); return null;}
    return n as number;
  }
  function enumeration<T extends string>(key: string, values: readonly T[], fallback: T): T {
    if (x[key] === undefined || x[key] === null || x[key] === 'Unknown') return fallback;
    if (!values.includes(x[key] as T)) {bad(key); return fallback;}
    return x[key] as T;
  }
  function goals(key: string): Goal[] {
    const raw = x[key];
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {bad(key); return [];}
    const result: Goal[] = [];
    for (const g of raw) {
      if (!g || typeof g !== 'object' || typeof g.text !== 'string' || !g.text.trim() || !['critical', 'preference'].includes(g.priority)) {bad(key); continue;}
      const text = g.text.trim();
      const existing = result.find(r => r.text.toLowerCase() === text.toLowerCase());
      if (existing) {if (g.priority === 'critical') existing.priority = 'critical';} else result.push({text, priority: g.priority});
    }
    return result;
  }
  function bool(key: string): boolean {
    if (x[key] === undefined) return false;
    if (typeof x[key] !== 'boolean') {bad(key); return false;}
    return x[key] as boolean;
  }
  function text(key: string): string | null {
    if (x[key] === undefined || x[key] === null) return null;
    if (typeof x[key] !== 'string') {bad(key); return null;}
    return (x[key] as string).trim() || null;
  }
  let ages = null;
  if (x.ages != null && x.ages !== 'Unknown') {
    if (typeof x.ages === 'object' && !Array.isArray(x.ages)) {
      const a = x.ages as {min: unknown; max: unknown};
      if (finite(a.min) && finite(a.max) && a.min <= a.max) ages = {min: a.min, max: a.max}; else bad('ages');
    } else {
      ages = parseAge(x.ages);
      if (!ages) bad('ages');
    }
  }
  let eventStart = text('eventStart');
  if (eventStart && timestamp(eventStart) === null) {bad('eventStart'); eventStart = null;}
  let accessibility: string[] | null = null;
  if (x.accessibility != null) {
    if (Array.isArray(x.accessibility) && x.accessibility.every(v => typeof v === 'string' && v.trim())) accessibility = [...new Set(x.accessibility as string[])]; else bad('accessibility');
  }
  const assumptions: Assumption[] = [];
  if (x.assumptions !== undefined) {
    if (!Array.isArray(x.assumptions)) bad('assumptions');
    else for (const a of x.assumptions) {
      if (!a || !['reflection_topic', 'operational'].includes(a.kind) || typeof a.text !== 'string' || !a.text.trim()) bad('assumptions');
      else assumptions.push({kind: a.kind, text: a.text.trim()});
    }
  }
  const request: Request = {brief: text('brief') ?? '', themes: goals('themes'), objectives: goals('objectives'), audienceType: text('audienceType'), ages,
    participants: nullableNumber('participants', true), durationMin: nullableNumber('durationMin'), eventStart,
    venue: enumeration('venue', ['indoor', 'outdoor', 'sheltered_outdoor', 'unknown'], 'unknown'),
    internet: enumeration('internet', ['stable', 'unstable', 'none', 'unknown'], 'unknown'),
    electricity: enumeration('electricity', ['yes', 'no', 'unknown'], 'unknown'), water: enumeration('water', ['yes', 'no', 'unknown'], 'unknown'),
    budgetBand: enumeration('budgetBand', ['Low', 'Medium', 'High', 'unknown'], 'unknown'), budgetIsHardLimit: bool('budgetIsHardLimit'),
    accessibility, format: text('format'), participantLed: bool('participantLed'), assumptions};
  for (const key of ['ages', 'participants', 'durationMin', 'eventStart', 'audienceType', 'accessibility', 'venue', 'budgetBand'] as const) {
    if (request[key] === null || request[key] === 'unknown') checks.push(check(`request.${key}.missing`, key === 'accessibility' ? 'RULE-011' : 'RULE-009', 'NEEDS VERIFICATION', `${key} is unspecified.`, [], undefined, `Provide ${key}; broad school/audience labels do not prove age or operational capability.`));
  }
  if (!request.themes.length && !request.objectives.length) checks.push(check('request.goals.missing', 'RULE-009', 'NEEDS VERIFICATION', 'No theme or objective supplied.', [], undefined, 'Specify the learning objectives and their criticality.'));
  for (const [i, a] of assumptions.entries()) checks.push(check(`request.assumption.${i}`, 'RULE-009', a.kind === 'reflection_topic' ? 'FEASIBLE WITH ASSUMPTIONS' : 'NEEDS VERIFICATION', a.kind === 'reflection_topic' ? `Non-operational reflection wording: ${a.text}` : `Operational assumption cannot supply evidence: ${a.text}`, [], undefined, a.kind === 'reflection_topic' ? 'Confirm reflection wording; it adds no activity time or resource allocation.' : 'Supply operational evidence; this assumption is not used in calculations.'));
  return {request, checks};
}
