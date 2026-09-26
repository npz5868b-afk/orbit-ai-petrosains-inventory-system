'use client'

import {Beaker, CheckCircle2, Cpu, Droplets, FlaskConical, Leaf, PackageCheck, Sparkles, Sun, TriangleAlert, XCircle, Zap} from 'lucide-react'
import type {B1Bundle, Catalogue, Check, PlanResult, Request, Source} from '@/lib/programmes/types'
import type {ConsultationResult} from '@/lib/programmes/consultation'
import type {MaterialFeasibility} from '@/lib/programmes/resources'
import {GlassCard, StatusPill} from '@/components/ui-kit'
import {cn} from '@/lib/utils'

type MaterialSource = B1Bundle['materials']['sheets'][number]['records'][number]

const tone = (status: string) => status === 'NOT FEASIBLE' || status === 'Insufficient' ? 'danger' : status === 'VERIFIED FEASIBLE' || status === 'Sufficient' ? 'success' : 'warning'
const shown = (value: unknown): string => value === null || value === undefined || value === '' ? 'Unknown' : Array.isArray(value) ? value.length ? value.join(', ') : 'None reported' : String(value).replaceAll('_', ' ')

function Sources({sources}: {sources: Source[]}) {
  return <p className="mt-2 break-words text-xs text-muted-foreground">{[...new Set(sources.map((s) => `${s.ref}${s.sheet ? ` · ${s.sheet}` : ''}${s.row ? ` row ${s.row}` : ''}${s.cell ? ` (${s.cell})` : ''}`))].join(' / ') || 'No supporting evidence supplied'}</p>
}

function StatusIcon({status}: {status: string}) {
  if (status === 'VERIFIED FEASIBLE' || status === 'Sufficient') return <CheckCircle2 className="size-4 text-success" />
  if (status === 'NOT FEASIBLE' || status === 'Insufficient') return <XCircle className="size-4 text-danger" />
  return <TriangleAlert className="size-4 text-warning" />
}

function statusText(status: string) {
  if (status === 'VERIFIED FEASIBLE' || status === 'Sufficient') return 'Passed'
  if (status === 'NOT FEASIBLE' || status === 'Insufficient') return 'Not feasible'
  return 'Needs verification'
}

function priorityLabel(priority: 'critical' | 'preference') {
  return priority === 'critical' ? 'Critical' : 'Preference'
}

function GoalSummary({title, goals}: {title: string; goals: Request['themes']}) {
  if (!goals.length) return null
  return (
    <div className="rounded-2xl border border-cyan/20 bg-cyan/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan">{title}</p>
      <div className="mt-2 space-y-1.5">
        {goals.map((goal, index) => (
          <p key={`${title}:${goal.text}:${index}`} className="text-sm">
            {goal.text}
            <span className="text-muted-foreground"> · {priorityLabel(goal.priority)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

export function Understanding({request: r, compactUnknowns = []}: {request: Request; compactUnknowns?: string[]}) {
  const cards = [
    ['Participants', r.participants],
    ['Age', r.ages ? `${r.ages.min}${r.ages.max === null ? '+' : `–${r.ages.max}`}` : null],
    ['Duration', r.durationMin === null ? null : `${r.durationMin} min`],
  ]
  const tags = [
    r.venue !== 'unknown' ? shown(r.venue) : '',
    r.internet !== 'unknown' ? `Internet: ${shown(r.internet)}` : '',
  ].filter(Boolean)
  const unknowns = compactUnknowns.length ? compactUnknowns : [
    !r.eventStart && 'Start time',
    r.budgetBand === 'unknown' && 'Budget',
    r.electricity === 'unknown' && 'Electricity',
    r.water === 'unknown' && 'Water',
  ].filter(Boolean) as string[]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-display text-2xl font-semibold text-foreground">{shown(value)}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {(r.themes.length > 0 || r.objectives.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <GoalSummary title="Themes" goals={r.themes} />
          <GoalSummary title="Objectives" goals={r.objectives} />
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => <span key={tag} className="rounded-full border border-cyan/25 bg-cyan/10 px-3 py-1 text-xs text-cyan">{tag}</span>)}
        </div>
      )}
      {unknowns.length > 0 && (
        <div className="rounded-2xl border border-warning/25 bg-warning/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">Still unknown</p>
          <p className="mt-1 text-sm text-muted-foreground">{unknowns.join(' · ')}</p>
        </div>
      )}
      <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
        <summary className="cursor-pointer text-cyan">View all understood conditions</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ['Audience', r.audienceType],
            ['Event start', r.eventStart],
            ['Venue', r.venue],
            ['Internet', r.internet],
            ['Electricity', r.electricity],
            ['Water', r.water],
            ['Budget', `${r.budgetBand}${r.budgetIsHardLimit ? ' (hard limit)' : ' (preference)'}`],
            ['Accessibility', r.accessibility],
            ['Format', r.format],
            ['Participant-led requirement', r.participantLed ? 'Required' : 'Not required'],
            ['Brief · not parsed', r.brief],
          ].map(([key, value]) => <div key={String(key)}><dt className="text-muted-foreground">{String(key)}</dt><dd className="mt-1 break-words">{shown(value)}</dd></div>)}
        </dl>
      </details>
    </div>
  )
}

function CheckRow({check: c}: {check: Check}) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={c.status} tone={tone(c.status)} />
        <span className="text-xs text-muted-foreground">{c.ruleId} · {c.offeringId ?? 'Programme'}</span>
      </div>
      <p className="mt-2 text-sm">{c.reason}</p>
      <p className="mt-2 text-sm text-muted-foreground">Next: {c.nextAction}</p>
      <Sources sources={c.sources} />
      {c.evidenceTimes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Evidence times: {c.evidenceTimes.join(', ')}</p>}
    </div>
  )
}

function activityIcon(text: string) {
  const value = text.toLowerCase()
  if (value.includes('water')) return Droplets
  if (value.includes('solar') || value.includes('energy')) return Sun
  if (value.includes('sustain')) return Leaf
  if (value.includes('led') || value.includes('electric')) return Zap
  if (value.includes('robot') || value.includes('tech') || value.includes('code')) return Cpu
  if (value.includes('chem') || value.includes('lab')) return FlaskConical
  return Beaker
}

function Materials({rows, sourceRows}: {rows: MaterialFeasibility[]; sourceRows: MaterialSource[]}) {
  const sufficient = rows.filter((r) => r.status === 'Sufficient').length
  const insufficient = rows.filter((r) => r.status === 'Insufficient').length
  const unknown = rows.filter((r) => r.status === 'Unknown').length
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{rows.length} selected material rows · {sufficient} Sufficient · {insufficient} Insufficient · {unknown} Unknown.</p>
      {rows.filter((r) => r.status === 'Insufficient').map((r) => <div key={r.rowId} className="rounded-xl border border-danger/30 p-3 text-sm"><strong>{r.rowId} · Insufficient</strong><p>{r.reasons.join(' ')}</p><p>{r.nextAction}</p></div>)}
      <details>
        <summary className="cursor-pointer text-sm text-cyan">Material evidence & source rows ({rows.length})</summary>
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <details key={r.rowId} className="rounded-xl border border-white/10 p-3 text-sm">
              <summary className="cursor-pointer break-words">{shown(sourceRows.find((s) => s.material_row_id === r.rowId)?.item_name)} · {r.rowId} · {r.status}</summary>
              <div className="mt-3 space-y-2">
                <p>Raw catalogue quantity is a source requirement, not inventory or an inferred per-person amount.</p>
                <p>Scope: event programme · Resource: {r.poolId ?? 'Unresolved mapping'}</p>
                <p>Raw recorded quantity: {shown(r.rawAvailable)} · Verified current: {shown(r.currentQuantity.value)} · Event quantity: {shown(r.eventQuantity.value)}</p>
                <p>{r.reasons.join(' ')}</p>
                <p>Next: {r.nextAction}</p>
                <Sources sources={r.sources} />
              </div>
            </details>
          ))}
        </div>
      </details>
    </div>
  )
}

function Schedule({plan}: {plan: PlanResult}) {
  return (
    <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <summary className="cursor-pointer text-sm font-medium text-cyan">View timing, groups and rotations</summary>
      <div className="mt-4 space-y-3">
        {plan.schedules.map((s) => (
          <div key={s.offeringId} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{s.offeringId}</strong><StatusPill label={s.provisional || plan.status !== 'VERIFIED FEASIBLE' ? 'Tentative' : 'Verified'} tone={s.provisional || plan.status !== 'VERIFIED FEASIBLE' ? 'warning' : 'success'} /></div>
            <p className="mt-2 text-sm">{s.minimumGroups} minimum groups · {s.parallelCapacity} provisional lanes · {s.rounds} planned rounds</p>
            <p className="mt-1 text-sm text-muted-foreground">Time lower bound: {s.attendanceLowerBoundMin} min attendance / {s.operationalLowerBoundMin} min operational · Minimum rounds: {s.minimumRounds}</p>
            <p className="mt-1 text-sm text-muted-foreground">Setup {s.setupMin} min · Delivery {s.deliveryMin} min · Reset {s.resetMin} min · Tentative window {s.startMin}–{s.endMin} min</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function realityGroup(checks: Check[], id: string, label: string, matcher: (check: Check) => boolean) {
  const matched = checks.filter(matcher)
  const status = matched.some((c) => c.status === 'NOT FEASIBLE')
    ? 'NOT FEASIBLE'
    : matched.some((c) => c.status === 'NEEDS VERIFICATION')
      ? 'NEEDS VERIFICATION'
      : matched.some((c) => c.status === 'FEASIBLE WITH ASSUMPTIONS')
        ? 'FEASIBLE WITH ASSUMPTIONS'
        : matched.length
          ? 'VERIFIED FEASIBLE'
          : 'NEEDS VERIFICATION'
  return {id, label, status, reason: matched.find((c) => c.status !== 'VERIFIED FEASIBLE')?.reason ?? matched[0]?.reason ?? 'Evidence not supplied for this planning area.'}
}

function Journey({plan, catalogue}: {plan: PlanResult; catalogue: Catalogue}) {
  return (
    <GlassCard className="p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Programme journey</p>
          <h2 className="mt-1 font-display text-xl font-semibold">How participants move through the plan</h2>
        </div>
        <StatusPill label={`${plan.officialOfferings.length} activities`} tone="cyan" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {plan.officialOfferings.map((offering, index) => {
          const original = catalogue.offerings.find((item) => item.id === offering.id)
          const schedule = plan.schedules.find((s) => s.offeringId === offering.id)
          const coverage = plan.coverage.find((c) => c.offeringId === offering.id)
          const Icon = activityIcon(`${offering.title} ${coverage?.goal ?? ''}`)
          return (
            <div key={offering.id} className="group rounded-2xl border border-cyan/20 bg-cyan/[0.045] p-4 transition-all hover:border-cyan/40">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-semibold text-cyan">{String(index + 1).padStart(2, '0')}</span>
                <span className="grid size-12 place-items-center rounded-2xl border border-cyan/20 bg-cyan/10 text-cyan"><Icon className="size-5"/></span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{offering.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{schedule ? `${schedule.deliveryMin} min delivery` : shown(original?.fields.Standard_Duration_Min?.raw_value) + ' min'}</p>
              <p className="mt-3 text-sm">{coverage?.goal ?? offering.learningOutcomes[0] ?? 'Official Petrosains activity'}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-cyan">Why selected</summary>
                <p className="mt-2 text-muted-foreground">{coverage?.rationale ?? 'Selected by the programme evaluator against the supplied request.'}</p>
              </details>
            </div>
          )
        })}
      </div>
      <Schedule plan={plan} />
    </GlassCard>
  )
}

export function ProgrammeResults({result: r, catalogue, sourceRows, stale, changeNote}: {result: ConsultationResult; catalogue: Catalogue; sourceRows: MaterialSource[]; stale: boolean; changeNote: string}) {
  const checks = r.programme ? r.checks : [...r.checks, ...r.rejectedDetails.flatMap((p) => p.checks)]
  const unique = [...new Map(checks.map((c) => [`${c.id}:${c.reason}`, c])).values()]
  const failures = unique.filter((c) => c.status === 'NOT FEASIBLE')
  const unknowns = unique.filter((c) => c.status === 'NEEDS VERIFICATION')
  const plan = r.programme
  const reality = [
    realityGroup(unique, 'capacity', 'Capacity', (c) => /participant|capacity|group|round/i.test(`${c.id} ${c.reason}`)),
    realityGroup(unique, 'duration', 'Duration', (c) => /duration|time|window|schedule/i.test(`${c.id} ${c.reason}`)),
    realityGroup(unique, 'venue', 'Venue', (c) => /venue|room|indoor|outdoor/i.test(`${c.id} ${c.reason}`)),
    realityGroup(unique, 'internet', 'Internet', (c) => /internet|offline/i.test(`${c.id} ${c.reason}`)),
    {id: 'materials', label: 'Materials', status: r.materials.some((m) => m.status === 'Insufficient') ? 'NOT FEASIBLE' : r.materials.some((m) => m.status === 'Unknown') || r.materials.length === 0 ? 'NEEDS VERIFICATION' : 'VERIFIED FEASIBLE', reason: 'Material rows are checked separately from programme suitability.'},
    realityGroup(unique, 'staff', 'Staff', (c) => /staff|facilitator|handling|safety|approval/i.test(`${c.id} ${c.reason}`)),
  ]

  return (
    <section aria-label="Programme evaluation" className="space-y-5">
      <GlassCard strong className="overflow-hidden p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Recommended Programme</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{plan ? plan.officialOfferings.map((o) => o.title).join(' + ') : 'No acceptable programme found'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{changeNote || r.conclusion}</p>
          </div>
          <StatusPill label={r.status} tone={tone(r.status)} />
        </div>
        {stale && <p role="status" className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4 font-medium text-warning">OUT OF DATE — this result belongs to the previous input or calculation mode. Re-evaluate the current draft.</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/[0.04] p-4"><p className="font-display text-2xl font-semibold text-cyan">{plan?.officialOfferings.length ?? 0}</p><p className="text-xs text-muted-foreground">Activities</p></div>
          <div className="rounded-2xl bg-white/[0.04] p-4"><p className="font-display text-2xl font-semibold text-cyan">{plan?.participantDurationMin ?? '—'}</p><p className="text-xs text-muted-foreground">Participant minutes</p></div>
          <div className="rounded-2xl bg-white/[0.04] p-4"><p className="font-display text-2xl font-semibold text-cyan">{plan ? `${plan.operationalStartMin}–${plan.operationalEndMin}` : '—'}</p><p className="text-xs text-muted-foreground">Operational window</p></div>
          <div className="rounded-2xl bg-white/[0.04] p-4"><p className="font-display text-2xl font-semibold text-cyan">{r.themeCoverage.length}</p><p className="text-xs text-muted-foreground">Theme links</p></div>
        </div>
      </GlassCard>

      {plan ? <Journey plan={plan} catalogue={catalogue} /> : <GlassCard className="p-5 sm:p-7"><p className="text-sm">No acceptable programme found within this search. Review the hard failures and adjust the request or search scope.</p></GlassCard>}

      <GlassCard className="p-5 sm:p-7">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Reality Check</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Can this actually run?</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reality.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{item.label}</h3><StatusIcon status={item.status}/></div>
              <p className={cn('mt-2 text-sm font-medium', tone(item.status) === 'success' ? 'text-success' : tone(item.status) === 'danger' ? 'text-danger' : 'text-warning')}>{statusText(item.status)}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.reason}</p>
            </div>
          ))}
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-cyan">View all checks, sources & next actions ({unique.length})</summary>
          <div className="mt-4 space-y-3">{unique.map((c) => <CheckRow key={`${c.id}:${c.reason}`} check={c}/>)}</div>
        </details>
      </GlassCard>

      <GlassCard className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet">Plan B</p>
            <h2 className="mt-1 font-display text-xl font-semibold">If the preferred programme cannot run</h2>
            <p className="mt-1 text-sm text-muted-foreground">ORBIT revalidates an alternative against the same request and evidence.</p>
          </div>
          {r.planB && <StatusPill label={r.planB.status} tone={tone(r.planB.status)} />}
        </div>
        {r.planB ? (
          <>
            <div className="mt-4 rounded-2xl border border-violet/25 bg-violet/[0.06] p-4">
              <p className="text-sm text-muted-foreground">Alternative activities</p>
              <p className="mt-2 font-semibold">{r.planB.officialOfferings.map((o) => o.title).join(' → ')}</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(r.tradeOffs).map(([key, values]) => (
                <div key={key} className="rounded-xl bg-white/[0.03] p-4">
                  <h3 className="text-sm font-semibold capitalize">{key}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{(values.length ? values.slice(0,4) : ['None identified']).map((text, index) => <li key={index}>{text}</li>)}</ul>
                </div>
              ))}
            </div>
            <details className="mt-4"><summary className="cursor-pointer text-sm text-cyan">View Plan B checks and material evidence</summary><div className="mt-4 space-y-4"><Schedule plan={r.planB}/><Materials rows={r.planBMaterials} sourceRows={sourceRows}/>{r.planB.checks.map((c) => <CheckRow key={c.id} check={c}/>)}</div></details>
          </>
        ) : <p className="mt-4 text-sm text-muted-foreground">No suitable distinct Plan B found within this search. This is a bounded search result, not a proof that no alternative exists.</p>}
      </GlassCard>

      <GlassCard className="p-5 sm:p-7">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet">Proposed Enhancements</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Ideas that are not official offerings</h2>
        </div>
        {r.proposedEnhancements.length ? r.proposedEnhancements.map((enhancement, index) => (
          <div key={index} className="mt-3 rounded-xl border border-violet/30 p-4 text-sm">
            <StatusPill label={enhancement.label} tone="violet" />
            <p className="mt-2">{enhancement.description}</p>
            <p className="mt-2 text-warning">Needs verification: {enhancement.approvalsRequired.join(' · ')}</p>
            <p className="mt-2 text-muted-foreground">Benefits: {enhancement.benefits.join(' · ') || 'None stated'} · Losses: {enhancement.losses.join(' · ') || 'None stated'}</p>
          </div>
        )) : <p className="text-sm text-muted-foreground">No enhancement proposed for this request.</p>}
      </GlassCard>

      <GlassCard className="p-5 sm:p-7">
        <details>
          <summary className="cursor-pointer font-semibold text-cyan">View planning details</summary>
          <div className="mt-5 space-y-5 text-sm">
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-4"><p>{r.inventory.explanation}</p><p className="mt-2 text-muted-foreground">Last inventory read: {r.inventory.readAt ?? 'Unavailable'}. {r.inventory.quantityVerification}</p></div>
            {failures.length > 0 && <div className="space-y-3"><h3 className="font-semibold text-danger">Known hard failures</h3>{failures.map((c) => <CheckRow key={`${c.id}:${c.reason}`} check={c}/>)}</div>}
            <div><h3 className="font-semibold">Key information to verify</h3>{unknowns.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No unresolved checks in this evaluation.</p> : <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{[...new Set(unknowns.map((c) => c.reason))].slice(0,6).map((text) => <li key={text}>{text}</li>)}</ul>}</div>
            <Understanding request={r.requestUnderstanding}/>
            <Materials rows={r.materials} sourceRows={sourceRows}/>
            <div className="rounded-xl border border-white/10 p-4 text-xs leading-5 text-muted-foreground">
              <h3 className="font-semibold text-foreground">Search & evidence boundary</h3>
              <p className="mt-2">{r.conclusion}</p>
              <p>Evaluated {r.search.evaluated}/{r.search.limit} search candidates · Maximum {r.search.maxActivities} activities · {r.search.scope}</p>
              <p>Search exhausted within these bounds: {r.search.exhaustedWithinBounds ? 'Yes' : 'No'}.</p>
              <p className="mt-2 break-all">Catalogue SHA-256: {r.sources.catalogueSha256}</p>
            </div>
          </div>
        </details>
      </GlassCard>
    </section>
  )
}
