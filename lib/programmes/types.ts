/** B2 pure contracts. Operational evidence is supplied, never fetched here. */
export type Scalar = string | number | boolean | null;
export type Status = 'NOT FEASIBLE' | 'NEEDS VERIFICATION' | 'FEASIBLE WITH ASSUMPTIONS' | 'VERIFIED FEASIBLE';
export type RuleId = `RULE-${string}`;
export interface Source {
  kind: 'catalogue' | 'synthetic' | 'verified_record' | 'user_report';
  ref: string; workbookSha256?: string; sheet?: string; cell?: string; row?: number;
}
export interface Fact<T> {
  value: T | null; verification: 'verified' | 'pending'; sources: Source[];
  observedAt?: string; validUntil?: string; eventStart?: string; confirmedBy?: string;
  /** Optional availability interval start, distinct from evidence observation time. */
  availableFrom?: string;
}
export interface Cell { cell: string; raw_value: Scalar; value: Scalar; state: string; cell_type: string; formula?: string; cache_status?: string }
export interface RawRecord { source: {sheet: string; row: number}; fields: Record<string, Cell> }
export interface Table { schema_version: string; source_sha256: string; records: RawRecord[] }
export interface AuditIssue { code: string; source: {sheet: string; row?: number; cell?: string}; detail: unknown }
export interface B1Bundle {
  manifest: {schema_version: string; source_sha256: string; workbook_filename: string; sheet_names: string[]};
  offerings: Table; mapping: Table; constraints: Table; dictionary: Table;
  materials: {schema_version: string; source_sha256: string; sheets: Array<{Offering_ID: string; sheet: string; records: Array<{material_row_id: string; source: {sheet: string; row: number}; [key: string]: unknown}>}>};
  audit: {schema_version: string; source_sha256: string; issues: AuditIssue[]; operational_validation: string};
}
export interface AgeRange { min: number; max: number | null }
export type Requirement = 'required' | 'optional' | 'not_required' | 'not_applicable' | 'unknown';
export type NumericField = 'Standard_Duration_Min' | 'Setup_Time_Min' | 'Min_Participants' | 'Max_Participants' | 'Facilitators_Required';
export type OperationalField = NumericField | 'Recommended_Age' | 'Electricity_Required' | 'Internet_Required' | 'Water_Required' | 'Cost_Band';
export interface Derived<T> { value: T | null; raw: Cell; source: Source; verification: 'pending'; reasons: string[] }
export interface Offering {
  id: string; title: string; identity: 'official_catalogue'; fields: Record<string, Cell>;
  source: Source; notes: string; confidence: string; auditIssues: AuditIssue[];
  age: Derived<AgeRange>; numbers: Record<NumericField, Derived<number>>;
  utilities: Record<'electricity' | 'internet' | 'water', Derived<Requirement>>;
  format: string | null; delivery: string | null;
  materialRowIds: string[];
}
export interface Catalogue { sourceSha256: string; offerings: Offering[]; mappings: RawRecord[]; rules: RawRecord[]; dictionary: RawRecord[]; audit: AuditIssue[] }
export interface Goal { text: string; priority: 'critical' | 'preference' }
export interface Assumption { kind: 'reflection_topic' | 'operational'; text: string }
export interface Request {
  brief: string; themes: Goal[]; objectives: Goal[]; audienceType: string | null;
  ages: AgeRange | null; participants: number | null; durationMin: number | null;
  eventStart: string | null; venue: 'indoor' | 'outdoor' | 'sheltered_outdoor' | 'unknown';
  internet: 'stable' | 'unstable' | 'none' | 'unknown';
  electricity: 'yes' | 'no' | 'unknown'; water: 'yes' | 'no' | 'unknown';
  budgetBand: 'Low' | 'Medium' | 'High' | 'unknown'; budgetIsHardLimit: boolean;
  accessibility: string[] | null; format: string | null; participantLed: boolean;
  assumptions: Assumption[];
}
export interface Check {
  id: string; ruleId: RuleId; status: Status; reason: string; sources: Source[];
  nextAction: string; offeringId?: string; evidenceTimes: string[];
}
export interface EvaluationContext { evaluatedAt: string }
export interface ResourcePool {
  id: string; kind: 'facilitator' | 'room' | 'equipment' | 'consumable'; unit: string;
  currentQuantity: Fact<number>; eventQuantity: Fact<number>;
}
export interface MaterialDemand {
  id: string; sourceRowIds: string[]; sources: Source[]; poolId: string;
  mapping: Fact<'exact' | 'alias'>; specificationCompatible: Fact<boolean>;
  quantity: Fact<number>; unit: string;
  basis: Fact<'per_participant' | 'per_group' | 'per_station' | 'per_session'>;
  kind: Fact<'consumable' | 'reusable'>; conversionToPoolUnit: Fact<number>;
  reuseApproved: Fact<boolean>; resetMin: Fact<number>;
}
export interface OfferingEvidence {
  fields?: Partial<Record<OperationalField, Fact<Scalar>>>;
  available?: Fact<boolean>; safetyApproved?: Fact<boolean>; venueReady?: Fact<boolean>;
  accessibilityReady?: Fact<boolean>; offlineReady?: Fact<boolean>; unstableInternetReady?: Fact<boolean>;
  operationalRequirementsApproved?: Fact<boolean>;
  parallelStations?: Fact<number>; resetMin?: Fact<number>; finalResetMin?: Fact<number>;
  facilitatorPoolId?: string; roomPoolId?: string;
  materialsComplete?: Fact<boolean>; materials?: MaterialDemand[];
  materialRowDispositions?: Array<{sourceRowId: string; classification: Fact<'not_material'>; reason: string}>;
}
export interface Evidence {
  offerings: Record<string, OfferingEvidence>; pools: ResourcePool[];
  transitionMin?: Fact<number>; earlyAccessMin?: Fact<number>; lateAccessMin?: Fact<number>;
}
export interface PlanSpec { offeringIds: string[]; setupBeforeArrival?: boolean }
export interface Interval {
  id: string; offeringId: string; phase: 'setup' | 'delivery' | 'reset' | 'transition';
  startMin: number; endMin: number; participantIds: string[]; resources: Array<{poolId: string; quantity: number}>;
}
export interface ActivitySchedule {
  offeringId: string; groups: number[]; minimumGroups: number; parallelCapacity: number;
  rounds: number; setupMin: number; resetMin: number; deliveryMin: number;
  /** Per-activity optimistic bounds, separate from tentative displayed lane counts. */
  minimumRounds: number; attendanceLowerBoundMin: number; operationalLowerBoundMin: number;
  startMin: number; endMin: number; provisional: boolean;
}
export interface CoverageEvidence { goal: string; priority: Goal['priority']; kind: 'theme' | 'objective'; offeringId: string; strength: 'master' | 'supporting_only' | 'none'; rationale: string; sources: Source[]; provisional: boolean }
export interface Enhancement { label: 'PROPOSED ENHANCEMENT'; kind: 'reflection' | 'adapted_format'; offeringId?: string; description: string; approvalsRequired: string[]; status: 'NEEDS VERIFICATION'; losses: string[]; benefits: string[] }
export interface PlanResult {
  spec: PlanSpec; requestUnderstanding: Request; evaluatedAt: string; status: Status; checks: Check[]; missingInformation: string[];
  officialOfferings: Array<{id: string; title: string; identity: 'official_catalogue'; availabilityRaw: Scalar; learningOutcomes: string[]; format: string | null; engagementMethods: string[]}>;
  schedules: ActivitySchedule[]; intervals: Interval[]; coverage: CoverageEvidence[];
  score: number; coverageComplete: boolean; participantDurationMin: number; operationalStartMin: number; operationalEndMin: number;
  storyline: string; journey: Array<{offeringId: string; title: string; purpose: string; participantIds: string[]; startMin: number; endMin: number}>;
  enhancements: Enhancement[]; evidenceMode: 'synthetic' | 'supplied_evidence';
}
export interface SearchOptions { maxActivities?: number; maxEvaluations?: number }
export interface SearchResult {
  primary: PlanResult | null; alternative: PlanResult | null;
  rejected: Array<{offeringIds: string[]; status: Status; reasons: string[]}>;
  search: {evaluated: number; limit: number; maxActivities: number; exhaustedWithinBounds: boolean; scope: string; conclusion: string};
  tradeOffs: {preserved: string[]; lost: string[]; improved: string[]; unresolved: string[]};
}
