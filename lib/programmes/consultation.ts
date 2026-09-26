/** One composition layer for HTTP and local computation; all rules remain B2/B3. */
import type {B1Bundle, Evidence} from './types';
import type {StockReview, InventorySnapshot} from './inventory-adapter';
import type {MaterialReview} from './resources';
import {adaptCatalogue} from './catalogue';
import {adaptResources, materialFeasibility} from './resources';
import {evaluatePlan, recommend, tradeOffs} from './engine';
import {validateConsultation, LIMITS} from './protocol';
export interface InventoryReadState {
 state: 'read' | 'unavailable' | 'timeout' | 'local'; degraded: boolean;
 readAt: string | null; quantityVerification: string; explanation: string;
}
export interface ReviewInputs {stocks: StockReview[]; materials: MaterialReview[]; operational: Evidence}
export function computeConsultation(bundle: B1Bundle, input: unknown, snapshot: InventorySnapshot, reviews: ReviewInputs, evaluatedAt: string, inventory: InventoryReadState, reviewPolicy = 'server-controlled; no client operational evidence accepted') {
 const catalogue = adaptCatalogue(bundle), accepted = validateConsultation(input,catalogue.offerings.map(o=>o.id)), ctx={evaluatedAt};
      const adapted = adaptResources(bundle, snapshot, inventory.state === 'read' ? reviews.stocks : [], inventory.state === 'read' ? reviews.materials : [], reviews.operational, ctx, accepted.normalized.request.eventStart);
      const search = recommend(catalogue, accepted.request, adapted.evidence, ctx, accepted.search, accepted.plan);
      const plan = accepted.plan ? evaluatePlan(catalogue, accepted.request, adapted.evidence, ctx, accepted.plan) : search.primary;
      const alternative = search.alternative;
      const diagnostics = plan ? [] : search.rejected.slice(0,3).map(r=>evaluatePlan(catalogue,accepted.request,adapted.evidence,ctx,{offeringIds:r.offeringIds}));

return {evaluatedAt, status:plan?.status ?? 'NOT FEASIBLE', outcome:plan?'evaluated':'no_plan_within_search', requestUnderstanding:accepted.normalized.request,
        missingInformation:plan?.missingInformation ?? [...new Set([...accepted.normalized.checks.filter(c=>c.status==='NEEDS VERIFICATION').map(c=>c.nextAction),...diagnostics.flatMap(p=>p.missingInformation)])], assumptions:accepted.normalized.request.assumptions,
        programme:plan, themeCoverage:plan?.coverage ?? [], storyline:plan?.storyline ?? null, participantJourney:plan?.journey ?? [], checks:plan?.checks ?? accepted.normalized.checks,
        materials:plan?materialFeasibility(adapted,plan):[], planB:alternative, planBMaterials:alternative?materialFeasibility(adapted,alternative):[], tradeOffs:tradeOffs(plan,alternative), proposedEnhancements:plan?.enhancements ?? [],
        search:search.search, rejected:search.rejected, rejectedDetails:diagnostics, evaluationCounts:{search:search.search.evaluated,reference:accepted.plan?1:0,requestedPlan:accepted.plan?1:0,diagnostics:diagnostics.length}, inventory, limits:LIMITS,
        sources:{catalogueSha256:catalogue.sourceSha256, reviews:reviewPolicy, themeMappingVerification:'pending'},
        conclusion:search.search.conclusion};
}
export type ConsultationResult = ReturnType<typeof computeConsultation>;
