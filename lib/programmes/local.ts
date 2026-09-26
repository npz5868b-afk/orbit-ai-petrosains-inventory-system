/** Loaded-page fallback. No network or persisted operational approvals. */
import type {B1Bundle, PlanResult} from './types';
import {computeConsultation} from './consultation';
import {inventorySnapshot} from './inventory-adapter';
export function consultLocally(bundle: B1Bundle, input: unknown, evaluatedAt: string, lastReadAt: string | null) {
 const snapshot=inventorySnapshot([], {namespace:'local-unavailable',origin:'saved_snapshot',sourceRef:'No local inventory evidence',retrievedAt:evaluatedAt});
 return computeConsultation(bundle,input,snapshot,{stocks:[],materials:[],operational:{offerings:{},pools:[]}},evaluatedAt,
 {state:'local',degraded:true,readAt:lastReadAt,quantityVerification:'Unknown: online approvals and quantities are not reused locally.',explanation:'Loaded-page local calculation. No inventory was refreshed or retained as evidence. Any previous read time is historical only. Current stock, event availability and operational approvals require online re-evaluation.'},'Local mode: no operational review evidence loaded');
}
export function comparePlans(before: PlanResult | null, after: PlanResult | null, alternative: PlanResult | null = null): string {
 if (!before) return 'New evaluation';
 if (!after) return 'No acceptable plan found within the search bounds.';
 const same=before.spec.offeringIds.join('|')===after.spec.offeringIds.join('|');
 return same ? after.status==='NOT FEASIBLE' ? alternative
  ? 'Previous plan rechecked: hard failure. Review the separately rechecked Plan B and its remaining unknowns.'
  : 'Previous plan rechecked: hard failure. No suitable Plan B found within the search bounds.'
  : 'Original plan retained and rechecked. Remaining unknowns still require verification.' : 'Different plan evaluated against the edited request.';
}
/** Invalidates in-flight work on every edit, mode change and newer submission. */
export class LatestEvaluation {
 private version=0;
 invalidate(): number {return ++this.version;}
 isCurrent(ticket: number): boolean {return ticket===this.version;}
}
