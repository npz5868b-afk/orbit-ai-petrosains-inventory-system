// SYNTHETIC TEST DATA ONLY. No inventory, booking, staffing or approval here is real.
const fs = require('node:fs');
const path = require('node:path');
const core = require('../../.test-tmp/programmes-core/index.js');
const root = path.resolve(__dirname, '../..');
const load = file => JSON.parse(fs.readFileSync(path.join(root, 'backend/data/programmes', file), 'utf8'));
function bundle() {
  return {manifest: load('source_manifest.json'), offerings: load('programme_offerings.json'), mapping: load('programme_theme_mapping.json'), constraints: load('programme_constraints.json'), dictionary: load('programme_dictionary.json'), materials: load('programme_materials.json'), audit: load('import_audit.json')};
}
const context = {evaluatedAt: '2026-09-26T02:00:00Z'};
const eventStart = '2026-10-01T09:00:00Z';
function fact(value, changes = {}) {
  return {value, verification: 'verified', sources: [{kind: 'synthetic', ref: 'SYNTHETIC TEST FIXTURE — not real operational evidence'}], observedAt: '2026-09-25T00:00:00Z', validUntil: '2026-12-31T23:59:59Z', eventStart, confirmedBy: 'synthetic-test-operator', ...changes};
}
function setField(o, key, value) {
  const state = value === null ? 'blank' : typeof value === 'number' ? value === 0 ? 'zero' : 'number' : ({Yes: 'yes', No: 'no', Optional: 'optional', Unknown: 'unknown', 'N/A': 'not_applicable', 'To be validated': 'to_be_validated', 'To be confirmed': 'undefined_placeholder'}[value] ?? 'text');
  o.fields[key] = {...o.fields[key], value, raw_value: value, state, cell_type: typeof value === 'number' ? 'n' : 's'};
}
function pool(id, kind, quantity, unit = 'unit') {return {id, kind, unit, currentQuantity: fact(quantity), eventQuantity: fact(quantity)};}
function material(id, poolId, kind = 'reusable', basis = 'per_participant', quantity = 1, changes = {}) {
  return {id, poolId, sourceRowIds: [`SYNTHETIC:${id}`], sources: fact(null).sources, mapping: fact('exact'), specificationCompatible: fact(true), quantity: fact(quantity), unit: 'unit', basis: fact(basis), kind: fact(kind), conversionToPoolUnit: fact(1), reuseApproved: fact(true), resetMin: fact(2), ...changes};
}
function scenario() {
  const original = core.adaptCatalogue(bundle());
  const make = (id, title, theme) => {
    const o = structuredClone(original.offerings[0]);
    Object.assign(o, {id, title: `SYNTHETIC ${title}`, source: {kind: 'synthetic', ref: `SYNTHETIC TEST CATALOGUE ${id}`}, materialRowIds: [], auditIssues: [], notes: 'SYNTHETIC TEST CATALOGUE, operational evidence is simulated.', confidence: 'High', format: 'Hands-on Workshop', delivery: 'Facilitator-led'});
    for (const [k, v] of Object.entries({Offering_ID: id, Activity_Title: o.title, Recommended_Age: '10+', Standard_Duration_Min: 30, Setup_Time_Min: 5, Min_Participants: 10, Max_Participants: 30, Facilitators_Required: 2, Electricity_Required: 'No', Internet_Required: 'No', Water_Required: 'No', Indoor_Outdoor: 'Indoor', Cost_Band: 'Low', Availability_Status: 'To be confirmed', Suitable_Themes: theme, Suitable_Objectives: 'Build teamwork; Apply engineering', Learning_Outcomes: 'Build teamwork; Apply engineering', Key_Concepts: `${theme}; Engineering; Teamwork`, STEM_Domain: 'Engineering', Notes: o.notes, Key_Constraints: 'Synthetic approved conditions', Participant_Handling_Rule: 'Only trained facilitators handle controlled test materials'})) setField(o, k, v);
    setField(o, 'Data_Confidence', 'High');
    for (const [key, derived] of Object.entries(o.numbers)) Object.assign(derived, {value: o.fields[key].value, raw: o.fields[key], source: o.source, reasons: ['SYNTHETIC TEST VALUE']});
    Object.assign(o.age, {value: core.parseAge(o.fields.Recommended_Age.value), raw: o.fields.Recommended_Age, source: o.source, reasons: ['SYNTHETIC TEST VALUE']});
    for (const [key, field] of Object.entries({electricity: 'Electricity_Required', internet: 'Internet_Required', water: 'Water_Required'})) Object.assign(o.utilities[key], {value: core.requirement(o.fields[field]), raw: o.fields[field], source: o.source, reasons: ['SYNTHETIC TEST VALUE']});
    return o;
  };
  const catalogue = {...original, offerings: [make('ACT-901', 'Robotics', 'Robotics'), make('ACT-902', 'Sustainability', 'Sustainability'), make('ACT-903', 'Offline Robotics', 'Robotics')], mappings: []};
  const evidence = {offerings: {}, pools: [pool('staff', 'facilitator', 4), pool('rooms', 'room', 2)], transitionMin: fact(3), earlyAccessMin: fact(30), lateAccessMin: fact(30)};
  for (const o of catalogue.offerings) {
    const fields = {};
    for (const k of ['Recommended_Age', 'Standard_Duration_Min', 'Setup_Time_Min', 'Min_Participants', 'Max_Participants', 'Facilitators_Required', 'Electricity_Required', 'Internet_Required', 'Water_Required', 'Cost_Band']) fields[k] = fact(o.fields[k].value);
    evidence.offerings[o.id] = {fields, available: fact(true), safetyApproved: fact(true), venueReady: fact(true), accessibilityReady: fact(true), offlineReady: fact(true), unstableInternetReady: fact(false), operationalRequirementsApproved: fact(true), parallelStations: fact(1), resetMin: fact(2), finalResetMin: fact(0), facilitatorPoolId: 'staff', roomPoolId: 'rooms', materialsComplete: fact(true), materials: []};
  }
  const request = {themes: [{text: 'Robotics', priority: 'critical'}], objectives: [{text: 'Build teamwork', priority: 'critical'}], audienceType: 'Secondary school', ages: {min: 12, max: 14}, participants: 30, durationMin: 240, eventStart, venue: 'indoor', internet: 'stable', electricity: 'yes', water: 'yes', budgetBand: 'Medium', accessibility: []};
  return {catalogue, evidence, request, context: {...context}, spec: {offeringIds: ['ACT-901']}};
}
function evaluate(s) {return core.evaluatePlan(s.catalogue, s.request, s.evidence, s.context, s.spec);}
module.exports = {core, bundle, fact, pool, material, scenario, evaluate, setField, context, eventStart};
