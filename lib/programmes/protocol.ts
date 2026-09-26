/** Shared input boundary; no network, browser or server dependencies. */
import type {PlanSpec, SearchOptions} from './types';
import {normalizeRequest} from './request';
export const LIMITS = {bodyBytes: 65536, participants: 1000, durationMin: 1440, maxActivities: 3, maxEvaluations: 200, workUnits: 60000} as const;
export class InputError extends Error { constructor(public status: number, public code: string, message: string) {super(message);} }
const object = (v: unknown, label: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new InputError(400, 'INVALID_INPUT', `${label} must be an object.`);
  return v as Record<string, unknown>;
};
function keys(v: Record<string, unknown>, allowed: string[], label: string): void {
  if (Object.keys(v).some(k => !allowed.includes(k))) throw new InputError(400, 'UNSUPPORTED_FIELD', `Unexpected ${label} field; operational evidence and server configuration are not client inputs.`);
}
export function validateConsultation(input: unknown, validIds: string[]) {
  const root = object(input, 'body'); keys(root, ['request', 'plan', 'search'], 'body');
  const request = root.request === undefined ? {} : object(root.request, 'request');
  keys(request, ['brief','themes','objectives','audienceType','ages','participants','durationMin','eventStart','venue','internet','electricity','water','budgetBand','budgetIsHardLimit','accessibility','format','participantLed','assumptions'], 'request');
  for (const [name, value] of Object.entries(request)) {
    if (typeof value === 'string' && value.length > (name === 'brief' ? 4000 : 200)) throw new InputError(400, 'INVALID_INPUT', 'Text field exceeds its size limit.');
  }
  for (const name of ['themes','objectives','assumptions'] as const) if (request[name] !== undefined && request[name] !== null) {
    const list = request[name];
    if (!Array.isArray(list) || list.length > 8) throw new InputError(400, 'INVALID_INPUT', `${name} must contain at most 8 entries.`);
    for (const value of list) {
      const entry = object(value, name); keys(entry, name === 'assumptions' ? ['kind','text'] : ['text','priority'], name);
      if (typeof entry.text !== 'string' || entry.text.length > 200) throw new InputError(400, 'INVALID_INPUT', 'Goal/assumption text is invalid.');
    }
  }
  if (request.ages !== null && typeof request.ages === 'object') keys(object(request.ages, 'ages'), ['min','max'], 'ages');
  if (request.accessibility !== undefined && request.accessibility !== null && (!Array.isArray(request.accessibility) || request.accessibility.length > 12 || request.accessibility.some(v => typeof v !== 'string' || v.length > 200))) throw new InputError(400, 'INVALID_INPUT', 'Invalid accessibility list.');
  const normalized = normalizeRequest(request);
  const invalid = normalized.checks.filter(c => c.id.endsWith('.invalid'));
  if (invalid.length) throw new InputError(400, 'INVALID_INPUT', invalid.map(c => c.reason).join(' '));
  if ((normalized.request.participants ?? 0) > LIMITS.participants || (normalized.request.durationMin ?? 0) > LIMITS.durationMin) throw new InputError(400, 'LIMIT_EXCEEDED', 'API supports at most 1000 participants and a 1440-minute attendance window.');
  let plan: PlanSpec | undefined;
  if (root.plan !== undefined) {
    const p = object(root.plan, 'plan'); keys(p, ['offeringIds','setupBeforeArrival'], 'plan');
    if (!Array.isArray(p.offeringIds) || !p.offeringIds.length || p.offeringIds.length > 3 || new Set(p.offeringIds).size !== p.offeringIds.length || p.offeringIds.some(id => typeof id !== 'string' || !validIds.includes(id)) || (p.setupBeforeArrival !== undefined && typeof p.setupBeforeArrival !== 'boolean')) throw new InputError(400, 'INVALID_PLAN', 'Supply 1–3 distinct official offering IDs and an optional boolean setupBeforeArrival.');
    plan = p as unknown as PlanSpec;
  }
  const search = root.search === undefined ? {} : object(root.search, 'search'); keys(search, ['maxActivities','maxEvaluations'], 'search');
  const maxActivities = search.maxActivities ?? 2;
  if (!Number.isInteger(maxActivities) || Number(maxActivities) < 1 || Number(maxActivities) > 3) throw new InputError(400, 'INVALID_SEARCH', 'maxActivities must be 1–3.');
  const cost = Math.max(1, normalized.request.participants ?? 100) * Number(maxActivities);
  const maxEvaluations = search.maxEvaluations ?? Math.min(100, Math.floor(LIMITS.workUnits / cost));
  if (!Number.isInteger(maxEvaluations) || Number(maxEvaluations) < 1 || Number(maxEvaluations) > 200 || cost * Number(maxEvaluations) > LIMITS.workUnits) throw new InputError(400, 'INVALID_SEARCH', 'Search exceeds the evaluation or workload limit; reduce maxActivities/maxEvaluations.');
  return {request, normalized, plan, search: {maxActivities, maxEvaluations} as SearchOptions};
}
