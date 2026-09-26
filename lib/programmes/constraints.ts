import type { Check, EvaluationContext, Offering, OfferingEvidence, OperationalField, Request, Scalar, Source } from './types';
import { booleanCheck, check, current, finite, integer } from './evidence';
import { parseAge, requirement } from './catalogue';

export function field(o: Offering, key: OperationalField, ev: OfferingEvidence, ctx: EvaluationContext, req: Request, checks: Check[]): Scalar {
  const cell = o.fields[key], raw = cell?.value ?? null, fact = ev.fields?.[key];
  const sources: Source[] = [{...o.source, cell: cell?.cell}, ...(fact?.sources ?? [])];
  const absent = !cell || ['unknown', 'blank', 'not_applicable', 'undefined_placeholder', 'to_be_validated', 'formula_cache_missing', 'excel_error'].includes(cell.state);
  if (fact && !absent && fact.value !== raw) {
    checks.push(check(`${o.id}.${key}.override`, 'RULE-010', 'NOT FEASIBLE', `A changed ${key} is not the standard official offering. Original value ${String(raw)} is retained; propose an adapted format separately.`, sources, o.id, 'Seek approval and a revised catalogue/version or a separately labelled Proposed Enhancement.', [fact]));
    return raw;
  }
  const verified = current(fact, ctx, req.eventStart);
  checks.push(check(`${o.id}.${key}.evidence`, 'RULE-009', verified ? 'VERIFIED FEASIBLE' : 'NEEDS VERIFICATION', verified ? `${key} has event-scoped field evidence.` : `${key} is a planning value, not verified by Data_Confidence=${o.confidence}. Notes: ${o.notes}`, sources, o.id, `Verify ${key} specifically, retaining the source Notes and audit conditions.`, [fact]));
  // Pending overrides cannot supply missing numbers; retain explicit source unknowns.
  return verified && absent ? fact!.value : raw;
}
export interface Parameters { duration: number | null; setup: number | null; min: number | null; max: number | null; staff: number | null }
export function offeringChecks(o: Offering, req: Request, ev: OfferingEvidence, ctx: EvaluationContext): {checks: Check[]; parameters: Parameters} {
  const checks: Check[] = [];
  const put = (id: string, rule: `RULE-${string}`, status: Check['status'], reason: string, key?: string) => checks.push(check(`${o.id}.${id}`, rule, status, reason, [{...o.source, cell: key ? o.fields[key]?.cell : undefined}], o.id));
  const age = parseAge(field(o, 'Recommended_Age', ev, ctx, req, checks));
  if (!age || !req.ages) put('age', 'RULE-001', 'NEEDS VERIFICATION', 'Age eligibility is unknown; audience type cannot supply participant ages.', 'Recommended_Age');
  else if (req.ages.min < age.min || (age.max !== null && req.ages.max !== null && req.ages.max > age.max)) put('age', 'RULE-001', 'NOT FEASIBLE', `Requested age range is outside the catalogue range ${String(o.fields.Recommended_Age.value)}.`, 'Recommended_Age');
  else if (age.max !== null && req.ages.max === null) put('age', 'RULE-001', 'NEEDS VERIFICATION', 'Open-ended participant ages cannot establish compliance with the maximum age.', 'Recommended_Age');
  else put('age', 'RULE-001', 'VERIFIED FEASIBLE', 'Provided participant ages satisfy the retained age condition; field verification remains separate.', 'Recommended_Age');
  const numbers = {} as Parameters;
  const keys = {duration: 'Standard_Duration_Min', setup: 'Setup_Time_Min', min: 'Min_Participants', max: 'Max_Participants', staff: 'Facilitators_Required'} as const;
  for (const [target, key] of Object.entries(keys) as Array<[keyof Parameters, typeof keys[keyof typeof keys]]>) {
    const v = field(o, key, ev, ctx, req, checks);
    const valid = target === 'setup' ? finite(v) : target === 'duration' ? finite(v, 0.001) : integer(v, target === 'staff' ? 0 : 1);
    numbers[target] = valid ? v as number : null;
    if (!valid) put(`number.${key}`, 'RULE-009', 'NEEDS VERIFICATION', `${key} is missing or not a usable nonnegative quantity.`, key);
  }
  for (const [utility, key, rule] of [['electricity', 'Electricity_Required', 'RULE-003'], ['internet', 'Internet_Required', 'RULE-004'], ['water', 'Water_Required', 'RULE-006']] as const) {
    const val = field(o, key, ev, ctx, req, checks);
    const semantic = requirement({value: val, state: val === 'Yes' ? 'yes' : val === 'No' ? 'no' : val === 'Optional' ? 'optional' : val === 'N/A' ? 'not_applicable' : 'unknown'});
    const site = req[utility];
    if (semantic === 'unknown') put(utility, rule, 'NEEDS VERIFICATION', `${utility} requirement is unknown.`, key);
    else if (semantic === 'required') {
      if (site === 'no' || site === 'none') put(utility, rule, 'NOT FEASIBLE', `Required ${utility} is unavailable.`, key);
      else if (site === 'unknown') put(utility, rule, 'NEEDS VERIFICATION', `Confirm required ${utility} availability.`, key);
      else if (site === 'unstable') checks.push(booleanCheck(`${o.id}.internet.unstable`, rule, ev.unstableInternetReady, ctx, req.eventStart, 'delivery with unstable internet', o.id));
      else put(utility, rule, 'VERIFIED FEASIBLE', `The stated venue condition supplies required ${utility}; requirement evidence is checked separately.`, key);
    } else {
      put(utility, rule, 'VERIFIED FEASIBLE', `${utility} is ${semantic}; it is not treated as required.`, key);
      if (utility === 'internet' && site !== 'stable') checks.push(booleanCheck(`${o.id}.offline`, rule, ev.offlineReady, ctx, req.eventStart, 'offline prerequisites, including any preloaded materials/software', o.id));
    }
  }
  const venueCell = o.fields.Indoor_Outdoor;
  const venueRaw = typeof venueCell?.value === 'string' ? venueCell.value.trim().toLowerCase() : '';
  // Interpret complete known phrases, not incidental substrings in unresolved prose.
  // General outdoor permission does not establish that shelter preserves light/flight conditions.
  const venueTypes: Record<string, Array<Request['venue']>> = {
    'indoor': ['indoor'],
    'indoor with ventilation': ['indoor'],
    'indoor or sheltered outdoor': ['indoor', 'sheltered_outdoor'],
    'indoor with approval or suitable outdoor area': ['indoor', 'outdoor'],
    'indoor with protection or suitable outdoor area': ['indoor', 'outdoor'],
    'indoor near strong light or outdoor': ['indoor', 'outdoor'],
    'outdoor': ['outdoor'],
    'sheltered outdoor': ['sheltered_outdoor'],
    'indoor or outdoor': ['indoor', 'outdoor'],
  };
  const supported = venueCell?.state === 'text' && Object.prototype.hasOwnProperty.call(venueTypes, venueRaw) ? venueTypes[venueRaw] : undefined;
  const unclear = req.venue === 'unknown' || !supported || (req.venue === 'sheltered_outdoor' && supported.includes('outdoor'));
  put('venue.type', 'RULE-006', unclear ? 'NEEDS VERIFICATION' : supported.includes(req.venue) ? 'VERIFIED FEASIBLE' : 'NOT FEASIBLE',
    unclear ? `Venue compatibility is unresolved: catalogue ${String(venueCell?.value ?? 'missing')}, requested ${req.venue}. Confirm the exact setting and retained conditions.` :
      `Catalogue ${String(venueCell.value)} ${supported.includes(req.venue) ? 'supports' : 'does not support'} requested ${req.venue}; venue readiness cannot override this restriction.`, 'Indoor_Outdoor');
  checks.push(booleanCheck(`${o.id}.venue`, 'RULE-006', ev.venueReady, ctx, req.eventStart, `venue conditions: ${String(o.fields.Key_Constraints?.value ?? 'unspecified')}`, o.id));
  checks.push(booleanCheck(`${o.id}.safety`, 'RULE-007', ev.safetyApproved, ctx, req.eventStart, `trained handling, hazards and approvals: ${String(o.fields.Participant_Handling_Rule?.value ?? 'unspecified')}`, o.id));
  if (req.participantLed && (o.delivery === 'Facilitator-led' || o.delivery === 'Demonstration' || /only trained facilitators|facilitator.only/i.test(String(o.fields.Participant_Handling_Rule?.value)))) put('handling', 'RULE-007', 'NOT FEASIBLE', 'Participant-led handling conflicts with the standard facilitated/controlled delivery.', 'Participant_Handling_Rule');
  checks.push(booleanCheck(`${o.id}.operations`, 'RULE-012', ev.operationalRequirementsApproved, ctx, req.eventStart, 'all retained operational Notes and Key_Constraints', o.id));
  checks.push(booleanCheck(`${o.id}.availability`, 'RULE-012', ev.available, ctx, req.eventStart, `offering availability (catalogue raw: ${String(o.fields.Availability_Status?.value)})`, o.id));
  if (req.accessibility === null) put('accessibility', 'RULE-011', 'NEEDS VERIFICATION', 'Ask about accommodations; no disability or absence of needs is inferred.', 'Accessibility_Notes');
  else if (req.accessibility.length) checks.push(booleanCheck(`${o.id}.accessibility`, 'RULE-011', ev.accessibilityReady, ctx, req.eventStart, `accommodations: ${req.accessibility.join('; ')}`, o.id));
  else put('accessibility', 'RULE-011', 'VERIFIED FEASIBLE', 'Stakeholder explicitly supplied no additional accommodation requirements.', 'Accessibility_Notes');
  const band = field(o, 'Cost_Band', ev, ctx, req, checks), ranks = ['Low', 'Medium', 'High'];
  if (req.budgetBand === 'unknown' || typeof band !== 'string' || !ranks.includes(band)) put('budget', 'RULE-008', 'NEEDS VERIFICATION', 'Confirm the relative budget band; exact pricing is unavailable.', 'Cost_Band');
  else if (ranks.indexOf(band) > ranks.indexOf(req.budgetBand)) put('budget', 'RULE-008', req.budgetIsHardLimit ? 'NOT FEASIBLE' : 'NEEDS VERIFICATION', 'Catalogue relative cost exceeds the requested band. No RM quotation is inferred.', 'Cost_Band');
  else put('budget', 'RULE-008', 'VERIFIED FEASIBLE', 'Relative cost band fits; this does not estimate or approve a programme price.', 'Cost_Band');
  if (req.format && req.format !== o.format) put('format', 'RULE-012', 'NOT FEASIBLE', `Requested format ${req.format} differs from catalogue format ${String(o.format)}.`, 'Offering_Type');
  return {checks, parameters: numbers};
}
