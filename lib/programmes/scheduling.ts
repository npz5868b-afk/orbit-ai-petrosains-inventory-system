import type { ActivitySchedule, Check, EvaluationContext, Evidence, Fact, Interval, MaterialDemand, Offering, OfferingEvidence, PlanSpec, Request, ResourcePool } from './types';
import { booleanCheck, check, current, exceeds, finite, integer } from './evidence';
import type { Parameters } from './constraints';

export function balancedGroups(participants: number, min: number, max: number): number[] | null {
  if (!integer(participants, 1) || !integer(min, 1) || !integer(max, 1) || min > max) return null;
  const count = Math.ceil(participants / max);
  if (count * min > participants) return null;
  return Array.from({length: count}, (_, i) => Math.floor(participants / count) + (i < participants % count ? 1 : 0));
}
function capacity(pool: ResourcePool | undefined, ctx: EvaluationContext, req: Request): number | null {
  return pool && current(pool.eventQuantity, ctx, req.eventStart) && finite(pool.eventQuantity.value) ? pool.eventQuantity.value : null;
}
function numberFact(fact: Fact<number> | undefined, ctx: EvaluationContext, req: Request, whole = false): number | null {
  return current(fact, ctx, req.eventStart) && (whole ? integer(fact?.value) : finite(fact?.value)) ? fact!.value : null;
}
function usableDemand(m: MaterialDemand, ctx: EvaluationContext, req: Request): boolean {
  return [m.mapping, m.specificationCompatible, m.quantity, m.basis, m.kind, m.conversionToPoolUnit].every(f => current(f, ctx, req.eventStart)) &&
    ['exact', 'alias'].includes(String(m.mapping.value)) && (m.mapping.value !== 'alias' || !!m.mapping.confirmedBy) && m.specificationCompatible.value === true && finite(m.quantity.value) && finite(m.conversionToPoolUnit.value, 0.000001) &&
    ['per_participant', 'per_group', 'per_station', 'per_session'].includes(String(m.basis.value)) && ['consumable', 'reusable'].includes(String(m.kind.value)) && !!m.unit && m.sources.length > 0;
}
function amount(m: MaterialDemand, participants: number): number {
  return m.quantity.value! * m.conversionToPoolUnit.value! * (m.basis.value === 'per_participant' ? participants : 1);
}

interface EquipmentUse { demand: MaterialDemand; quantity: number; start: number; end: number; release: number }
/** Allocate fungible units across every delivery, including transfers between activities.
 * Two passes distinguish confirmed reuse from the optimistic case where unknowns resolve.
 * Verified false never permits an incoming or outgoing reuse edge. */
function equipmentAllocation(uses: EquipmentUse[], pools: ResourcePool[], req: Request, ctx: EvaluationContext): Check[] {
  const checks: Check[] = [];
  for (const id of [...new Set(uses.map(u => u.demand.poolId))]) {
    const own = uses.filter(u => u.demand.poolId === id && u.quantity > 0).sort((a, b) => a.start - b.start || a.end - b.end);
    if (!own.length) continue;
    const pool = pools.find(p => p.id === id);
    const start = Math.min(...own.map(u => u.start)), end = Math.max(...own.map(u => u.release));
    const known = pool && current(pool.eventQuantity, ctx, req.eventStart, end, start) && finite(pool.eventQuantity.value);
    const freshNeeded = (optimistic: boolean): number => {
      const released: Array<{quantity: number; at: number}> = [];
      let fresh = 0;
      for (const u of own) {
        const m = u.demand;
        const approval = current(m.reuseApproved, ctx, req.eventStart, u.release, u.start) && typeof m.reuseApproved.value === 'boolean' ? m.reuseApproved.value : null;
        const permitted = approval === true || (optimistic && approval === null);
        let needed = u.quantity;
        // Previously used units first; keep fresh units for uses that prohibit reuse.
        if (permitted) for (const lot of released) {
          if (lot.at > u.start || !exceeds(needed, 0)) continue;
          const take = Math.min(needed, lot.quantity); needed -= take; lot.quantity -= take;
        }
        fresh += needed;
        const resetKnown = current(m.resetMin, ctx, req.eventStart, u.release, u.start) && finite(m.resetMin.value);
        if (permitted && (resetKnown || optimistic)) released.push({quantity: u.quantity, at: Math.max(u.release, u.end + (resetKnown ? m.resetMin.value! : 0))});
      }
      return fresh;
    };
    const optimistic = freshNeeded(true), confirmed = freshNeeded(false);
    checks.push(check(`equipment.${id}.allocation`, 'RULE-012', !known ? 'NEEDS VERIFICATION' : exceeds(optimistic, pool!.eventQuantity.value!) ? 'NOT FEASIBLE' : exceeds(confirmed, pool!.eventQuantity.value!) ? 'NEEDS VERIFICATION' : 'VERIFIED FEASIBLE',
      `${id}: fresh units required with confirmed reuse/reset ${confirmed}; optimistic requirement with unresolved reuse/reset ${optimistic}; event stock ${known ? pool!.eventQuantity.value : 'unverified'} ${pool?.unit ?? 'unknown units'}. Allocation spans all activities and rounds; non-overlap alone never authorizes reuse.`,
      [...own.flatMap(u => [...u.demand.sources, ...u.demand.reuseApproved.sources, ...u.demand.resetMin.sources]), ...(pool?.eventQuantity.sources ?? [])], undefined,
      'Supply sufficient fresh units, or verify reuse permission at both uses and release/reset before the next allocation; recheck the whole programme.',
      [pool?.eventQuantity, ...own.flatMap(u => [u.demand.reuseApproved, u.demand.resetMin])]));
  }
  return checks;
}

/** Half-open occupancy intervals. Public for future externally proposed schedules. */
export function checkIntervals(intervals: Interval[], pools: ResourcePool[], req: Request, ctx: EvaluationContext): Check[] {
  const checks: Check[] = [];
  if (new Set(pools.map(p => p.id)).size !== pools.length) throw new Error('Duplicate shared resource pool identity');
  if (new Set(intervals.map(i => i.id)).size !== intervals.length) throw new Error('Duplicate interval identity');
  const valid: Interval[] = [];
  for (const i of intervals) {
    if (!finite(i.startMin, -Number.MAX_SAFE_INTEGER) || !finite(i.endMin, -Number.MAX_SAFE_INTEGER) || i.endMin < i.startMin || new Set(i.participantIds).size !== i.participantIds.length || i.resources.some(r => !r.poolId || !finite(r.quantity))) {
      checks.push(check(`interval.${i.id}.invalid`, 'RULE-012', 'NOT FEASIBLE', 'Malformed interval, duplicate participants or invalid resource demand.')); continue;
    }
    if (i.endMin > i.startMin) valid.push(i);
  }
  const byParticipant = new Map<string, Interval[]>();
  for (const i of valid) for (const pid of i.participantIds) {
    const own = byParticipant.get(pid) ?? []; own.push(i); byParticipant.set(pid, own);
  }
  for (const [pid, entries] of byParticipant) {
    const own = entries.sort((a, b) => a.startMin - b.startMin || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let end = -Infinity;
    for (const i of own) {
      if (end > i.startMin) {checks.push(check(`participant.${pid}.overlap`, 'RULE-012', 'NOT FEASIBLE', `${pid} has overlapping participation intervals.`, [], undefined, 'Reschedule the whole journey and recheck all shared resources.')); break;}
      end = Math.max(end, i.endMin);
    }
  }
  const poolIds = [...new Set(valid.flatMap(i => i.resources.filter(r => r.quantity > 0).map(r => r.poolId)))];
  for (const id of poolIds) {
    const pool = pools.find(p => p.id === id), relevant = valid.filter(i => i.resources.some(r => r.poolId === id && r.quantity > 0));
    const times = [...new Set(relevant.flatMap(i => [i.startMin, i.endMin]))].sort((a, b) => a - b);
    const peak = Math.max(0, ...times.map(t => relevant.filter(i => i.startMin <= t && i.endMin > t).reduce((s, i) => s + i.resources.filter(r => r.poolId === id).reduce((n, r) => n + r.quantity, 0), 0)));
    const start = Math.min(...relevant.map(i => i.startMin)), end = Math.max(...relevant.map(i => i.endMin));
    const known = pool && current(pool.eventQuantity, ctx, req.eventStart, end, start) && finite(pool.eventQuantity.value);
    checks.push(check(`resource.${id}.overlap`, 'RULE-012', known ? exceeds(peak, pool!.eventQuantity.value!) ? 'NOT FEASIBLE' : 'VERIFIED FEASIBLE' : 'NEEDS VERIFICATION', `${id}: peak simultaneous demand ${peak} ${pool?.unit ?? 'unknown units'}; event availability ${known ? pool!.eventQuantity.value : 'unverified'}. Setup and reset occupy resources too.`, pool?.eventQuantity.sources, undefined, 'Confirm the same identified resource pool for the complete operational interval, or reschedule and recheck.', [pool?.eventQuantity]));
  }
  return checks;
}

export function scheduleProgramme(offerings: Offering[], parameters: Map<string, Parameters>, req: Request, ev: Evidence, ctx: EvaluationContext, spec: PlanSpec): {checks: Check[]; schedules: ActivitySchedule[]; intervals: Interval[]; duration: number; start: number; end: number} {
  const checks: Check[] = [], schedules: ActivitySchedule[] = [], intervals: Interval[] = [];
  let cursor = 0, provisional = false, programmeMinimum = 0;
  const consumed = new Map<string, {quantity: number; sources: MaterialDemand['sources']}>();
  const equipmentUses: EquipmentUse[] = [];
  if (req.participants === null || req.participants > 10000) {
    checks.push(check('schedule.population', 'RULE-002', 'NEEDS VERIFICATION', 'Participant count is missing or exceeds this planner’s explicit 10,000-person expansion limit.', [], undefined, 'Supply the count or review a larger-scale planning method.'));
    return {checks, schedules, intervals, duration: 0, start: 0, end: 0};
  }
  const allParticipants = Array.from({length: req.participants}, (_, i) => `participant-${i + 1}`);
  for (const [index, o] of offerings.entries()) {
    const p = parameters.get(o.id)!, oe: OfferingEvidence = ev.offerings[o.id] ?? {};
    if (p.duration === null || p.setup === null || p.min === null || p.max === null || p.staff === null) {
      checks.push(check(`${o.id}.schedule.missing`, 'RULE-002', 'NEEDS VERIFICATION', 'Complete duration, setup, min/max capacity and facilitator requirements before scheduling.', [o.source], o.id)); provisional = true; continue;
    }
    const groups = balancedGroups(req.participants, p.min, p.max);
    if (!groups) {
      checks.push(check(`${o.id}.groups`, 'RULE-002', 'NOT FEASIBLE', `Cannot partition ${req.participants} participants into groups satisfying both minimum ${p.min} and maximum ${p.max}.`, [o.source], o.id)); continue;
    }
    checks.push(check(`${o.id}.groups`, 'RULE-002', 'VERIFIED FEASIBLE', `Minimum ${groups.length} groups; balanced sizes ${groups.join(', ')}. This is grouping arithmetic, not proof of parallel capacity.`, [o.source], o.id));
    let stations = numberFact(oe.parallelStations, ctx, req, true), activityProvisional = stations === null;
    const declaredParallelUnknown = stations === null;
    let hasParallelUpperBound = stations !== null;
    if (stations === null) {
      stations = groups.length;
    } else if (stations === 0) {
      checks.push(check(`${o.id}.parallel`, 'RULE-002', 'NOT FEASIBLE', 'Confirmed parallel capacity is zero.', oe.parallelStations?.sources, o.id)); continue;
    }
    stations = Math.min(stations, groups.length);
    for (const [kind, poolId, demand] of [['facilitator', oe.facilitatorPoolId, p.staff], ['room', oe.roomPoolId, 1]] as const) {
      if (demand === 0) continue;
      const pool = ev.pools.find(pool => pool.id === poolId), available = capacity(pool, ctx, req);
      if (!pool || pool.kind !== kind || !integer(available)) {
        activityProvisional = true;
        checks.push(check(`${o.id}.${kind}.availability`, 'RULE-002', 'NEEDS VERIFICATION', `${kind} identity/count for the event is missing, stale or invalid.`, pool?.eventQuantity.sources, o.id));
      } else {
        hasParallelUpperBound = true;
        const supported = Math.floor(available / demand);
        if (supported < 1) checks.push(check(`${o.id}.${kind}.shortage`, 'RULE-002', 'NOT FEASIBLE', `${available} ${kind} resources cannot support even one station requiring ${demand}.`, pool.eventQuantity.sources, o.id));
        stations = Math.min(stations, Math.max(1, supported));
      }
    }
    const materials = oe.materials ?? [];
    checks.push(booleanCheck(`${o.id}.materials.complete`, 'RULE-012', oe.materialsComplete, ctx, req.eventStart, 'complete, reviewed material requirements and all ambiguous source rows', o.id));
    const mappedRows = new Set(materials.flatMap(m => m.sourceRowIds));
    for (const disposition of oe.materialRowDispositions ?? []) {
      if (current(disposition.classification, ctx, req.eventStart) && disposition.classification.value === 'not_material' && disposition.classification.confirmedBy && disposition.reason.trim() && !mappedRows.has(disposition.sourceRowId)) mappedRows.add(disposition.sourceRowId);
      else checks.push(check(`${o.id}.${disposition.sourceRowId}.disposition`, 'RULE-012', 'NEEDS VERIFICATION', 'A non-material row disposition needs dated human confirmation, a reason, and no conflicting material mapping.', disposition.classification.sources, o.id));
    }
    if (o.materialRowIds.some(id => !mappedRows.has(id))) checks.push(check(`${o.id}.materials.rows`, 'RULE-012', 'NEEDS VERIFICATION', 'Some B1 material/ambiguous rows are not represented in the supplied requirements.', [o.source], o.id, 'Resolve every original material row, with an explicit reviewed disposition for section headings.'));
    if (new Set(materials.map(m => m.id)).size !== materials.length) throw new Error(`Duplicate material demand ID for ${o.id}`);
    const perPoolStationDemand = new Map<string, number>();
    for (const m of materials) {
      const pool = ev.pools.find(pool => pool.id === m.poolId);
      if (current(m.specificationCompatible, ctx, req.eventStart) && m.specificationCompatible.value === false) checks.push(check(`${o.id}.${m.id}.specification`, 'RULE-012', 'NOT FEASIBLE', 'Verified specifications are incompatible; the supplied mapping is rejected.', m.specificationCompatible.sources, o.id));
      if (!usableDemand(m, ctx, req) || !pool || !pool.unit || pool.kind !== (m.kind.value === 'consumable' ? 'consumable' : 'equipment')) {
        checks.push(check(`${o.id}.${m.id}.mapping`, 'RULE-012', 'NEEDS VERIFICATION', 'Material specification, verified mapping/alias, quantity, units/conversion, usage basis or resource kind is unresolved. No demand is invented.', m.sources, o.id));
        activityProvisional = true; continue;
      }
      if (m.kind.value === 'reusable') {
        perPoolStationDemand.set(pool.id, (perPoolStationDemand.get(pool.id) ?? 0) + amount(m, Math.max(...groups)));
      }
    }
    for (const [id, perStation] of perPoolStationDemand) {
      const available = capacity(ev.pools.find(p => p.id === id), ctx, req);
      if (available !== null && perStation > 0) {hasParallelUpperBound = true; stations = Math.min(stations, Math.max(1, Math.floor(available / perStation)));}
    }
    if (!hasParallelUpperBound) stations = 1;
    if (declaredParallelUnknown) checks.push(check(`${o.id}.parallel`, 'RULE-002', 'NEEDS VERIFICATION', hasParallelUpperBound ? `Approved concurrency is unknown. ${stations} lanes is only an optimistic upper-bound scenario constrained by verified shared resources; it does not prove those lanes can be delivered.` : 'Concurrency and resource bounds are unknown. One tentative lane is shown, without certifying a time fit or impossibility.', oe.parallelStations?.sources, o.id, 'Verify actual parallel delivery capability. Retain independent hard failures, including timing that fails even at the resource upper bound.', [oe.parallelStations]));
    const rounds = Math.ceil(groups.length / stations);
    let reset = numberFact(oe.resetMin, ctx, req), finalReset = numberFact(oe.finalResetMin, ctx, req);
    if (rounds > 1 && reset === null) {
      activityProvisional = true;
      checks.push(check(`${o.id}.reset`, 'RULE-005', 'NEEDS VERIFICATION', 'Between-round reset is unknown; displayed time is a lower bound with unknown reset omitted.', oe.resetMin?.sources, o.id));
    }
    if (finalReset === null) {
      activityProvisional = true;
      checks.push(check(`${o.id}.finalReset`, 'RULE-005', 'NEEDS VERIFICATION', 'Final equipment release/reset time is unknown; the displayed operational end is a lower bound.', oe.finalResetMin?.sources, o.id));
    }
    for (const m of materials.filter(m => usableDemand(m, ctx, req) && m.kind.value === 'reusable')) {
      const materialReset = numberFact(m.resetMin, ctx, req);
      if (materialReset === null) {activityProvisional = true; checks.push(check(`${o.id}.${m.id}.reset`, 'RULE-005', 'NEEDS VERIFICATION', 'Reusable resource release/reset duration is unverified.', m.resetMin.sources, o.id));}
      else {reset = Math.max(reset ?? 0, materialReset); finalReset = Math.max(finalReset ?? 0, materialReset);}
    }
    if (index > 0) {
      const transition = numberFact(ev.transitionMin, ctx, req);
      if (transition === null) {activityProvisional = true; checks.push(check(`${o.id}.transition`, 'RULE-005', 'NEEDS VERIFICATION', 'Transition duration is unknown; displayed programme time is a lower bound.', ev.transitionMin?.sources, o.id));}
      else {
        programmeMinimum += transition;
        intervals.push({id: `${o.id}.transition`, offeringId: o.id, phase: 'transition', startMin: cursor, endMin: cursor + transition, participantIds: allParticipants, resources: []});
        cursor += transition;
      }
    }
    if (index === 0 && spec.setupBeforeArrival) cursor = -p.setup;
    const start = cursor;
    const participantGroups: string[][] = [];
    let position = 0;
    for (const count of groups) {participantGroups.push(allParticipants.slice(position, position + count)); position += count;}
    const resources = (groupSize: number) => {
      const resources: Interval['resources'] = [];
      if (oe.facilitatorPoolId && p.staff! > 0) resources.push({poolId: oe.facilitatorPoolId, quantity: p.staff!});
      if (oe.roomPoolId) resources.push({poolId: oe.roomPoolId, quantity: 1});
      for (const m of materials.filter(m => usableDemand(m, ctx, req) && m.kind.value === 'reusable')) resources.push({poolId: m.poolId, quantity: amount(m, groupSize)});
      return resources;
    };
    // One setup per used physical station, concurrently; never repeated per round.
    for (let station = 0; station < stations; station++) intervals.push({id: `${o.id}.setup.${station}`, offeringId: o.id, phase: 'setup', startMin: cursor, endMin: cursor + p.setup, participantIds: [], resources: resources(Math.max(...groups.filter((_, i) => i % stations === station)))});
    cursor += p.setup;
    for (let round = 0; round < rounds; round++) {
      for (let station = 0; station < stations; station++) {
        const group = round * stations + station;
        if (group >= groups.length) continue;
        intervals.push({id: `${o.id}.delivery.${group}`, offeringId: o.id, phase: 'delivery', startMin: cursor, endMin: cursor + p.duration, participantIds: participantGroups[group], resources: resources(groups[group])});
        for (const m of materials.filter(m => usableDemand(m, ctx, req) && m.kind.value === 'reusable')) {
          equipmentUses.push({demand: m, quantity: amount(m, groups[group]), start: round === 0 ? start : cursor, end: cursor + p.duration, release: cursor + p.duration + (round < rounds - 1 ? reset ?? 0 : finalReset ?? 0)});
        }
      }
      cursor += p.duration;
      const release = round < rounds - 1 ? (reset ?? 0) : (finalReset ?? 0);
      for (let station = 0; station < stations; station++) {
        const group = round * stations + station;
        if (group >= groups.length) continue;
        intervals.push({id: `${o.id}.reset.${group}`, offeringId: o.id, phase: 'reset', startMin: cursor, endMin: cursor + release, participantIds: [], resources: resources(groups[group])});
      }
      cursor += release;
    }
    for (const m of materials.filter(m => usableDemand(m, ctx, req) && m.kind.value === 'consumable')) {
      const total = m.quantity.value! * m.conversionToPoolUnit.value! * (m.basis.value === 'per_participant' ? req.participants : m.basis.value === 'per_station' ? stations : groups.length);
      const old = consumed.get(m.poolId);
      consumed.set(m.poolId, {quantity: (old?.quantity ?? 0) + total, sources: [...(old?.sources ?? []), ...m.sources]});
    }
    // Unknown concurrency in this activity cannot erase another activity's proven rounds.
    const minimumRounds = hasParallelUpperBound ? rounds : 1;
    const lowerBound = minimumRounds * p.duration + (minimumRounds - 1) * (reset ?? 0) + (spec.setupBeforeArrival && index === 0 ? 0 : p.setup);
    const operationalLowerBound = p.setup + minimumRounds * p.duration + (minimumRounds - 1) * (reset ?? 0) + (finalReset ?? 0);
    schedules.push({offeringId: o.id, groups, minimumGroups: groups.length, parallelCapacity: stations, rounds, minimumRounds, attendanceLowerBoundMin: lowerBound, operationalLowerBoundMin: operationalLowerBound, setupMin: p.setup, resetMin: reset ?? 0, deliveryMin: p.duration, startMin: start, endMin: cursor, provisional: activityProvisional});
    provisional ||= activityProvisional;
    // Every earlier block must also release its resources before the next block starts.
    programmeMinimum += lowerBound + (index < offerings.length - 1 ? finalReset ?? 0 : 0);
    if (req.durationMin !== null && lowerBound > req.durationMin) checks.push(check(`${o.id}.duration.minimum`, 'RULE-005', 'NOT FEASIBLE', `Setup plus at least ${minimumRounds} delivery rounds and known reset gives a ${lowerBound}-minute lower bound, exceeding the ${req.durationMin}-minute attendance window.`, [o.source], o.id, 'Extend the window, choose a different official offering, or request an explicitly approved Proposed Enhancement.'));
  }
  for (const [id, demand] of consumed) {
    const pool = ev.pools.find(p => p.id === id), known = pool && current(pool.eventQuantity, ctx, req.eventStart, cursor) && finite(pool.eventQuantity.value);
    checks.push(check(`consumable.${id}.total`, 'RULE-012', known ? exceeds(demand.quantity, pool!.eventQuantity.value!) ? 'NOT FEASIBLE' : 'VERIFIED FEASIBLE' : 'NEEDS VERIFICATION', `${id}: cumulative consumable demand ${demand.quantity} ${pool?.unit ?? 'unknown units'} across all activities/rounds; rotations do not replenish it.`, [...demand.sources, ...(pool?.eventQuantity.sources ?? [])], undefined, 'Verify event-dated stock and demand/conversion evidence.', [pool?.eventQuantity]));
  }
  checks.push(...checkIntervals(intervals, ev.pools, req, ctx), ...equipmentAllocation(equipmentUses, ev.pools, req, ctx));
  const usedPools = new Set([...intervals.flatMap(i => i.resources.map(r => r.poolId)), ...consumed.keys()]);
  for (const pool of ev.pools.filter(p => usedPools.has(p.id))) {
    const known = current(pool.currentQuantity, ctx) && finite(pool.currentQuantity.value);
    checks.push(check(`resource.${pool.id}.current`, 'RULE-012', known ? 'VERIFIED FEASIBLE' : 'NEEDS VERIFICATION', known ? `Current observed quantity ${pool.currentQuantity.value} ${pool.unit}; it does not verify future bookings.` : 'Current stock snapshot/observation is missing or stale; updated_at alone is insufficient.', pool.currentQuantity.sources, undefined, 'Supply observed/synced inventory evidence separately from future availability.', [pool.currentQuantity]));
  }
  const start = Math.min(0, ...intervals.map(i => i.startMin));
  if (start < 0) {
    const access = numberFact(ev.earlyAccessMin, ctx, req);
    checks.push(check('schedule.earlyAccess', 'RULE-006', access === null ? 'NEEDS VERIFICATION' : access >= -start ? 'VERIFIED FEASIBLE' : 'NOT FEASIBLE', `Setup needs ${-start} minutes of earlier access; confirmed allowance ${access ?? 'unknown'}.`, ev.earlyAccessMin?.sources, undefined, 'Verify early venue access AND the staff/equipment intervals before arrival.', [ev.earlyAccessMin]));
  }
  const attendanceEnd = Math.max(0, ...intervals.filter(i => i.phase === 'delivery').map(i => i.endMin));
  if (req.durationMin !== null) {
    const failed = programmeMinimum > req.durationMin;
    checks.push(check('schedule.window', 'RULE-005', failed ? 'NOT FEASIBLE' : provisional || attendanceEnd > req.durationMin ? 'NEEDS VERIFICATION' : 'VERIFIED FEASIBLE', `Attendance end ${attendanceEnd} min, operational end ${cursor} min; requested attendance ${req.durationMin} min. Serial-block lower bound ${programmeMinimum} min.${provisional ? ' Schedule is provisional; unknown times are omitted only in the displayed lower bound, never treated as verified zero.' : ''}`, [], undefined, 'Confirm missing timing/concurrency or adjust the programme window and reevaluate.'));
    if (cursor > req.durationMin && attendanceEnd <= req.durationMin) {
      const allowance = numberFact(ev.lateAccessMin, ctx, req);
      checks.push(check('schedule.lateAccess', 'RULE-006', allowance === null ? 'NEEDS VERIFICATION' : allowance >= cursor - req.durationMin ? 'VERIFIED FEASIBLE' : 'NOT FEASIBLE', `Final reset extends ${cursor - req.durationMin} min beyond attendance; late operational access ${allowance ?? 'unknown'}.`, ev.lateAccessMin?.sources, undefined, 'Verify venue access, staff and equipment for final reset after participants leave.', [ev.lateAccessMin]));
    }
  }
  return {checks, schedules, intervals, duration: attendanceEnd, start, end: cursor};
}
