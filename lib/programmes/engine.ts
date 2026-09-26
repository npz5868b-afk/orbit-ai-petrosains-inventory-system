import type { Catalogue, EvaluationContext, Evidence, Fact, Offering, PlanResult, PlanSpec, SearchOptions, SearchResult } from './types';
import { aggregate, check, current, integer, validateContext } from './evidence';
import { normalizeRequest } from './request';
import { offeringChecks } from './constraints';
import { coverage } from './coverage';
import { scheduleProgramme } from './scheduling';

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function allFacts(value: unknown): Fact<unknown>[] {
  if (!value || typeof value !== 'object') return [];
  if ('verification' in value && 'sources' in value && 'value' in value) return [value as Fact<unknown>];
  return Object.values(value).flatMap(allFacts);
}
export function evaluatePlan(catalogue: Catalogue, input: unknown, evidence: Evidence, context: EvaluationContext, spec: PlanSpec): PlanResult {
  validateContext(context);
  const {request, checks} = normalizeRequest(input);
  if (!Array.isArray(spec.offeringIds) || !spec.offeringIds.length || new Set(spec.offeringIds).size !== spec.offeringIds.length) throw new Error('Plan must contain a nonempty unique sequence of offering IDs');
  if (spec.setupBeforeArrival !== undefined && typeof spec.setupBeforeArrival !== 'boolean') throw new Error('setupBeforeArrival must be boolean');
  const offerings: Offering[] = [];
  for (const id of spec.offeringIds) {
    const offering = catalogue.offerings.find(o => o.id === id);
    if (!offering) checks.push(check(`offering.${id}.identity`, 'RULE-010', 'NOT FEASIBLE', `${id} is not a catalogue offering.`, [], id, 'Use an existing Offering_ID, or submit a separately labelled Proposed Enhancement.'));
    else offerings.push(offering);
  }
  const params = new Map();
  for (const o of offerings) {
    const assessed = offeringChecks(o, request, evidence.offerings[o.id] ?? {}, context);
    checks.push(...assessed.checks); params.set(o.id, assessed.parameters);
  }
  const grounded = coverage(catalogue, offerings, request);
  let score = 0, coverageComplete = true;
  for (const kind of ['theme', 'objective'] as const) for (const goal of kind === 'theme' ? request.themes : request.objectives) {
    const matches = grounded.filter(c => c.kind === kind && c.goal === goal.text && c.strength !== 'none');
    const direct = matches.some(c => c.strength === 'master');
    if (!direct) coverageComplete = false;
    if (goal.priority === 'critical' && !matches.length) checks.push(check(`coverage.${kind}.${goal.text}`, 'RULE-012', 'NOT FEASIBLE', `No catalogue-grounded support for critical ${kind} "${goal.text}" was found in this plan by this matching method.`, [], undefined, 'Review the terminology/evidence, choose another combination, or explicitly revise the critical requirement.'));
    else if (goal.priority === 'critical' && !direct) checks.push(check(`coverage.${kind}.${goal.text}`, 'RULE-009', 'NEEDS VERIFICATION', `Critical ${kind} "${goal.text}" has supporting evidence only; mapping is not a verified answer.`, matches.flatMap(c => c.sources), undefined, 'Confirm the learning/theme connection against Master content.'));
    score += direct ? goal.priority === 'critical' ? 100 : 10 : matches.length ? goal.priority === 'critical' ? 20 : 2 : 0;
  }
  score += new Set(offerings.map(o => o.format)).size - offerings.length;
  const scheduled = scheduleProgramme(offerings, params, request, evidence, context, spec);
  checks.push(...scheduled.checks);
  // All operational facts must cover the complete computed operational window.
  for (const o of offerings) for (const [i, fact] of allFacts(evidence.offerings[o.id]).entries()) {
    if (current(fact, context, request.eventStart) && !current(fact, context, request.eventStart, scheduled.end, scheduled.start)) checks.push(check(`${o.id}.evidence.window.${i}`, 'RULE-012', 'NEEDS VERIFICATION', 'Evidence expires within or does not cover the complete setup/delivery/reset window.', fact.sources, o.id, 'Provide evidence valid over the complete operational interval.', [fact]));
  }
  for (const [key, fact] of Object.entries({transitionMin: evidence.transitionMin, earlyAccessMin: evidence.earlyAccessMin, lateAccessMin: evidence.lateAccessMin})) {
    if (current(fact, context, request.eventStart) && !current(fact, context, request.eventStart, scheduled.end, scheduled.start)) checks.push(check(`programme.${key}.window`, 'RULE-012', 'NEEDS VERIFICATION', 'Programme access/transition evidence does not cover the full operational window.', fact?.sources, undefined, 'Confirm validity over the complete operational interval.', [fact]));
  }
  const ruleMap = new Map(catalogue.rules.map(r => [r.fields.Rule_ID.value, r]));
  for (const c of checks) {
    const r = ruleMap.get(c.ruleId);
    if (!r) throw new Error(`Missing official rule definition ${c.ruleId}`);
    c.sources.push({kind: 'catalogue', ref: c.ruleId, workbookSha256: catalogue.sourceSha256, ...r.source});
  }
  const enhancements: PlanResult['enhancements'] = request.assumptions.filter(a => a.kind === 'reflection_topic').map(a => ({label: 'PROPOSED ENHANCEMENT', kind: 'reflection', description: a.text, approvalsRequired: ['Confirm facilitator wording; no extra duration or resources are included'], status: 'NEEDS VERIFICATION', losses: [], benefits: ['Contextual reflection wording']}));
  for (const c of checks.filter(c => c.id.endsWith('.duration.minimum') || c.id.endsWith('.override'))) {
    enhancements.push({label: 'PROPOSED ENHANCEMENT', kind: 'adapted_format', offeringId: c.offeringId, description: 'A shorter/changed version would be a separate proposed adaptation. The standard offering and failed check remain unchanged.', approvalsRequired: ['Petrosains approval', 'Validated revised content, safety, timing and resource requirements'], status: 'NEEDS VERIFICATION', losses: ['Content/learning losses are not yet assessed'], benefits: ['Potential time/operational benefit remains unverified']});
  }
  const facts = allFacts(evidence);
  const journey = scheduled.intervals.filter(i => i.phase === 'delivery').map(i => {
    const o = offerings.find(o => o.id === i.offeringId)!;
    const reasons = grounded.filter(c => c.offeringId === o.id && c.strength === 'master');
    return {offeringId: o.id, title: o.title, purpose: reasons.length ? reasons.map(c => `${c.kind}: ${c.goal}`).join('; ') : String(o.fields.Learning_Outcomes?.value ?? 'Learning purpose requires confirmation'), participantIds: i.participantIds, startMin: i.startMin, endMin: i.endMin};
  });
  return {spec: {...spec, offeringIds: [...spec.offeringIds]}, requestUnderstanding: request, evaluatedAt: context.evaluatedAt,
    status: aggregate(checks), checks, missingInformation: [...new Set(checks.filter(c => c.status === 'NEEDS VERIFICATION').map(c => c.nextAction))],
    officialOfferings: offerings.map(o => ({id: o.id, title: o.title, identity: o.identity, availabilityRaw: o.fields.Availability_Status?.value ?? null, learningOutcomes: String(o.fields.Learning_Outcomes?.value ?? '').split(';').map(s => s.trim()).filter(Boolean), format: o.format, engagementMethods: String(o.fields.Engagement_Methods?.value ?? '').split(';').map(s => s.trim()).filter(Boolean)})),
    schedules: scheduled.schedules, intervals: scheduled.intervals, coverage: grounded, coverageComplete, score,
    participantDurationMin: scheduled.duration, operationalStartMin: scheduled.start, operationalEndMin: scheduled.end,
    storyline: offerings.map((o, i) => `${i + 1}. ${o.title}: ${String(o.fields.Learning_Outcomes?.value ?? 'Confirm learning outcomes')}`).join(' → '), journey, enhancements,
    evidenceMode: facts.some(f => f.sources.some(s => s.kind === 'synthetic')) || offerings.some(o => o.source.kind === 'synthetic') ? 'synthetic' : 'supplied_evidence'};
}

/** Related pending candidates may be shown, but cannot substitute for an unsupported critical goal. */
function coversCriticalGoals(plan: PlanResult): boolean {
  return (['theme', 'objective'] as const).every(kind =>
    (kind === 'theme' ? plan.requestUnderstanding.themes : plan.requestUnderstanding.objectives)
      .filter(g => g.priority === 'critical')
      .every(g => plan.coverage.some(c => c.kind === kind && c.goal === g.text && c.strength === 'master')));
}

function fingerprint(plan: PlanSpec): string {return [...plan.offeringIds].sort(compareText).join('|');}
export function tradeOffs(before: PlanResult | null, after: PlanResult | null): SearchResult['tradeOffs'] {
  if (!after) return {preserved: [], lost: before?.coverage.filter(c => c.strength === 'master').map(c => c.goal) ?? [], improved: [], unresolved: ['No acceptable alternative was found within the declared search bounds; this is not a mathematical impossibility proof.']};
  const labels = (plan: PlanResult | null) => [...new Set(plan?.coverage.filter(c => c.strength === 'master').map(c => `${c.kind}: ${c.goal}`) ?? [])];
  const a = labels(before), b = labels(after);
  const lost = a.filter(g => !b.includes(g)), improved: string[] = [];
  const preserved = a.filter(g => b.includes(g));
  if (before) {
    for (const o of before.officialOfferings.filter(o => !after.spec.offeringIds.includes(o.id))) lost.push(`Direct experience of ${o.title}; do not claim identical learning depth.`);
    if (after.participantDurationMin < before.participantDurationMin) improved.push(`Computed duration ${before.participantDurationMin} → ${after.participantDurationMin} min (subject to each plan's verification status).`);
    for (const c of before.checks.filter(c => c.status === 'NOT FEASIBLE')) if (!after.checks.some(a => a.id === c.id && a.status === 'NOT FEASIBLE')) improved.push(`The alternative avoids the previous failure: ${c.reason}`);
    const states = ['NOT FEASIBLE', 'NEEDS VERIFICATION', 'FEASIBLE WITH ASSUMPTIONS', 'VERIFIED FEASIBLE'];
    if (before.status !== after.status) (states.indexOf(after.status) > states.indexOf(before.status) ? improved : lost).push(`Overall status: ${before.status} → ${after.status}; this does not supply missing operational evidence.`);
    const afterOutcomes = after.officialOfferings.flatMap(o => o.learningOutcomes);
    for (const outcome of new Set(before.officialOfferings.flatMap(o => o.learningOutcomes))) {
      if (afterOutcomes.includes(outcome)) preserved.push(`Catalogue learning outcome retained: ${outcome}`);
      else lost.push(`Not explicitly retained in the alternative catalogue outcomes: ${outcome}`);
    }
    const afterFormats = after.officialOfferings.map(o => o.format);
    for (const format of new Set(before.officialOfferings.map(o => o.format))) if (format && !afterFormats.includes(format)) lost.push(`Delivery format no longer represented: ${format}`);
    const afterEngagement = after.officialOfferings.flatMap(o => o.engagementMethods);
    for (const method of new Set(before.officialOfferings.flatMap(o => o.engagementMethods))) if (!afterEngagement.includes(method)) lost.push(`Engagement method not explicitly retained: ${method}`);
  }
  return {preserved, lost, improved, unresolved: after.checks.filter(c => c.status === 'NEEDS VERIFICATION').map(c => c.reason)};
}

/** Bounded exhaustive ordered combinations, serial activity blocks, automatic within-activity lanes. */
export function recommend(catalogue: Catalogue, input: unknown, evidence: Evidence, context: EvaluationContext, options: SearchOptions = {}, reference?: PlanSpec): SearchResult {
  validateContext(context);
  const maxActivities = options.maxActivities ?? 3, limit = options.maxEvaluations ?? 1000;
  if (!integer(maxActivities, 1) || maxActivities > 5 || !integer(limit, 1) || limit > 10000) throw new Error('Search bounds: 1–5 activities and 1–10000 evaluations');
  const req = normalizeRequest(input).request;
  const ranked = catalogue.offerings.map(o => ({o, score: coverage(catalogue, [o], req).reduce((sum, c) => sum + (c.strength === 'master' ? c.priority === 'critical' ? 100 : 10 : c.strength === 'supporting_only' ? 1 : 0), 0)})).sort((a, b) => b.score - a.score || compareText(a.o.id, b.o.id));
  const results: PlanResult[] = [];
  let truncated = false;
  function visit(prefix: string[], depth: number): void {
    if (truncated) return;
    if (prefix.length === depth) {
      if (results.length >= limit) {truncated = true; return;}
      results.push(evaluatePlan(catalogue, input, evidence, context, {offeringIds: prefix})); return;
    }
    for (const {o} of ranked) if (!prefix.includes(o.id)) {visit([...prefix, o.id], depth); if (truncated) return;}
  }
  for (let depth = 1; depth <= Math.min(maxActivities, ranked.length); depth++) {visit([], depth); if (truncated) break;}
  const quality = (p: PlanResult) => p.status === 'VERIFIED FEASIBLE' ? 0 : p.status === 'FEASIBLE WITH ASSUMPTIONS' ? 1 : 2;
  const admissible = results.filter(r => r.status !== 'NOT FEASIBLE').sort((a, b) => quality(a) - quality(b) || b.score - a.score || a.participantDurationMin - b.participantDurationMin || a.spec.offeringIds.length - b.spec.offeringIds.length || compareText(a.spec.offeringIds.join('|'), b.spec.offeringIds.join('|')));
  const primary = admissible[0] ?? null;
  const ref = reference ? evaluatePlan(catalogue, input, evidence, context, reference) : primary;
  const alternative = admissible.find(p => coversCriticalGoals(p) && (!ref || fingerprint(p.spec) !== fingerprint(ref.spec))) ?? null;
  return {primary, alternative, rejected: results.filter(r => r.status === 'NOT FEASIBLE').map(r => ({offeringIds: r.spec.offeringIds, status: r.status, reasons: r.checks.filter(c => c.status === 'NOT FEASIBLE').map(c => c.reason)})),
    search: {evaluated: results.length, limit, maxActivities, exhaustedWithinBounds: !truncated, scope: `Ordered distinct offerings up to ${maxActivities}; serial activity blocks, balanced groups and constrained parallel lanes. Not all arbitrary interleavings, custom adaptations or resource allocations are searched.`, conclusion: primary ? primary.status === 'NEEDS VERIFICATION' ? 'Relevant candidate found; critical evidence remains unverified.' : 'A plan satisfies the supplied evidence checks; synthetic evidence is not real operational approval.' : 'No acceptable plan found within this search space/budget. Review constraints and evidence; no global impossibility claim is made.'}, tradeOffs: tradeOffs(ref, alternative)};
}

export function whatIf(catalogue: Catalogue, previous: PlanResult, input: unknown, evidence: Evidence, context: EvaluationContext, options: SearchOptions = {}) {
  const rechecked = evaluatePlan(catalogue, input, evidence, context, previous.spec);
  const changedChecks: Array<{id: string; before: PlanResult['status'] | null; after: PlanResult['status'] | null; reason: string}> = rechecked.checks.filter(c => {const p = previous.checks.find(p => p.id === c.id); return !p || p.status !== c.status || p.reason !== c.reason;}).map(c => ({id: c.id, before: previous.checks.find(p => p.id === c.id)?.status ?? null, after: c.status, reason: c.reason}));
  for (const p of previous.checks.filter(p => !rechecked.checks.some(c => c.id === p.id))) changedChecks.push({id: p.id, before: p.status, after: null, reason: 'Previous check is no longer applicable under the new input; see the complete re-evaluation.'});
  const changedInputs = (Object.keys(rechecked.requestUnderstanding) as Array<keyof typeof rechecked.requestUnderstanding>).filter(k => JSON.stringify(previous.requestUnderstanding[k]) !== JSON.stringify(rechecked.requestUnderstanding[k]));
  if (rechecked.status !== 'NOT FEASIBLE') return {action: 'retained' as const, reason: 'The original offering sequence remains suitable under the rechecked constraints. Any remaining unknown evidence still blocks verified feasibility.', changedInputs, changedChecks, previousRechecked: rechecked, plan: rechecked, alternativeSearch: null, tradeOffs: tradeOffs(previous, rechecked)};
  const search = recommend(catalogue, input, evidence, context, options, previous.spec);
  const candidate = [search.primary, search.alternative].find(p => p !== null && coversCriticalGoals(p)) ?? null;
  return {action: candidate ? 'changed' as const : 'no_alternative' as const, reason: candidate ? 'The original plan has a hard failure; the replacement passed the same evaluator to its reported evidence status.' : 'No acceptable plan found within the declared search bounds with Master-supported coverage of every critical requirement. Related candidates may still require verification.', changedInputs, changedChecks, previousRechecked: rechecked, plan: candidate, alternativeSearch: search.search, tradeOffs: tradeOffs(rechecked, candidate)};
}
