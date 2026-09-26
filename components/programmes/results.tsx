'use client'

import {useEffect, useMemo, useState} from 'react'
import {Beaker, Bookmark, CheckCircle2, Cpu, Download, Droplets, FileText, FlaskConical, Leaf, PackageCheck, Route, Sparkles, Star, Sun, TriangleAlert, Users, XCircle, Zap} from 'lucide-react'
import type {B1Bundle, Catalogue, Check, PlanResult, Request, Source} from '@/lib/programmes/types'
import type {ConsultationResult} from '@/lib/programmes/consultation'
import type {MaterialFeasibility} from '@/lib/programmes/resources'
import {GlassCard, StatusPill} from '@/components/ui-kit'
import {cn} from '@/lib/utils'

type MaterialSource = B1Bundle['materials']['sheets'][number]['records'][number]

const tone = (status: string) => status === 'NOT FEASIBLE' || status === 'Insufficient' ? 'danger' : status === 'VERIFIED FEASIBLE' || status === 'Sufficient' ? 'success' : 'warning'
const shown = (value: unknown): string => value === null || value === undefined || value === '' ? 'Unknown' : Array.isArray(value) ? value.length ? value.join(', ') : 'None reported' : String(value).replaceAll('_', ' ')
const favouriteKey = 'orbit-programme-favourites-v1'

function escapeHtml(value: unknown) {
  return shown(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function listHtml(values: string[]) {
  return values.length ? `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '<p>None listed.</p>'
}

function programmeTitle(plan: PlanResult | null) {
  return plan ? plan.officialOfferings.map((o) => o.title).join(' + ') : 'No acceptable programme found'
}

function makeReportHtml({result: r, reality, unknowns}: {result: ConsultationResult; reality: Array<{label: string; status: string; reason: string}>; unknowns: Check[]}) {
  const plan = r.programme
  const generatedAt = new Date().toLocaleString()
  const activities = plan?.officialOfferings.map((offering, index) => {
    const schedule = plan.schedules.find((s) => s.offeringId === offering.id)
    const coverage = plan.coverage.find((c) => c.offeringId === offering.id)
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(offering.title)}</strong><br><span>${escapeHtml(offering.id)}</span></td><td>${escapeHtml(schedule ? `${schedule.deliveryMin} min` : 'Unknown')}</td><td>${escapeHtml(coverage?.goal ?? offering.learningOutcomes[0] ?? 'Official Petrosains activity')}</td></tr>`
  }).join('') ?? ''
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ORBIT AI Programme Report</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Inter, Arial, sans-serif; color: #101822; margin: 0; line-height: 1.5; }
    header { border-bottom: 2px solid #0ea5b7; padding-bottom: 18px; margin-bottom: 24px; }
    .eyebrow { color: #0e7490; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 6px 0 8px; font-size: 30px; line-height: 1.1; }
    h2 { margin: 26px 0 10px; font-size: 18px; }
    .meta { color: #526171; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .card { border: 1px solid #d5e4ea; border-radius: 14px; padding: 12px; background: #f8fbfc; }
    .label { color: #526171; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .value { font-size: 18px; font-weight: 800; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #d9e7ec; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { color: #526171; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .status { display: inline-block; border-radius: 999px; padding: 5px 10px; background: #e6f7fb; color: #07576a; font-weight: 800; font-size: 12px; }
    .note { border-left: 4px solid #0ea5b7; padding: 10px 12px; background: #f3fafc; }
    ul { margin-top: 8px; padding-left: 20px; }
    footer { margin-top: 28px; color: #526171; font-size: 11px; border-top: 1px solid #d9e7ec; padding-top: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">ORBIT AI · Petrosains Programme Twin</div>
    <h1>${escapeHtml(programmeTitle(plan))}</h1>
    <div class="status">${escapeHtml(r.status)}</div>
    <p class="meta">Generated ${escapeHtml(generatedAt)} · AI recommends, humans remain in control.</p>
  </header>
  <section class="grid">
    <div class="card"><div class="label">Participants</div><div class="value">${escapeHtml(r.requestUnderstanding.participants)}</div></div>
    <div class="card"><div class="label">Duration</div><div class="value">${escapeHtml(r.requestUnderstanding.durationMin ? `${r.requestUnderstanding.durationMin} min` : null)}</div></div>
    <div class="card"><div class="label">Activities</div><div class="value">${escapeHtml(plan?.officialOfferings.length ?? 0)}</div></div>
  </section>
  <h2>Request Summary</h2>
  <div class="note">
    <strong>Themes:</strong> ${escapeHtml(r.requestUnderstanding.themes.map((g) => `${g.text} (${priorityLabel(g.priority)})`).join(', ') || 'Unknown')}<br>
    <strong>Objectives:</strong> ${escapeHtml(r.requestUnderstanding.objectives.map((g) => `${g.text} (${priorityLabel(g.priority)})`).join(', ') || 'Unknown')}<br>
    <strong>Venue:</strong> ${escapeHtml(r.requestUnderstanding.venue)} · <strong>Internet:</strong> ${escapeHtml(r.requestUnderstanding.internet)}
  </div>
  <h2>Programme Journey</h2>
  <table><thead><tr><th>#</th><th>Activity</th><th>Duration</th><th>Why included</th></tr></thead><tbody>${activities || '<tr><td colspan="4">No accepted programme journey.</td></tr>'}</tbody></table>
  <h2>Reality Check</h2>
  <table><thead><tr><th>Area</th><th>Status</th><th>Reason</th></tr></thead><tbody>${reality.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(statusText(item.status))}</td><td>${escapeHtml(item.reason)}</td></tr>`).join('')}</tbody></table>
  <h2>Needs Verification / Unknowns</h2>
  ${listHtml([...new Set(unknowns.map((check) => check.nextAction || check.reason))].slice(0, 8))}
  <h2>Next Steps</h2>
  ${listHtml([r.conclusion, r.inventory.explanation, 'Confirm unresolved materials, staff, venue and operational evidence before delivery.'])}
  <footer>ORBIT AI · Built for operations, not just detection. This report is generated from the current frontend evaluation state.</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`
}

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
    <div className="animate-rise rounded-3xl border border-cyan/20 bg-cyan/[0.055] p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan">{title}</p>
      <div className="mt-3 space-y-2">
        {goals.map((goal, index) => (
          <p key={`${title}:${goal.text}:${index}`} className="text-base font-medium">
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
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="animate-rise rounded-3xl border border-white/10 bg-white/[0.055] p-5">
            <p className="font-display text-3xl font-semibold text-foreground">{shown(value)}</p>
            <p className="mt-2 text-sm uppercase tracking-wide text-muted-foreground">{label}</p>
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
          {tags.map((tag) => <span key={tag} className="rounded-full border border-cyan/25 bg-cyan/10 px-4 py-2 text-sm font-medium text-cyan">{tag}</span>)}
        </div>
      )}
      {unknowns.length > 0 && (
        <div className="rounded-3xl border border-warning/25 bg-warning/10 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-warning">Still unknown</p>
          <p className="mt-2 text-base text-muted-foreground">{unknowns.join(' · ')}</p>
        </div>
      )}
      <details className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 text-sm">
        <summary className="cursor-pointer text-base font-medium text-cyan">View all understood conditions</summary>
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

function ActionButton({active, onClick, children, title}: {active?: boolean; onClick: () => void; children: React.ReactNode; title?: string}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0',
        active ? 'border-violet/45 bg-violet/20 text-violet shadow-[0_0_28px_-16px_var(--violet)]' : 'border-white/15 bg-white/[0.045] text-muted-foreground hover:border-cyan/35 hover:text-cyan',
      )}
    >
      {children}
    </button>
  )
}

function Journey({plan, catalogue, favourites, toggleFavourite}: {plan: PlanResult; catalogue: Catalogue; favourites: Set<string>; toggleFavourite: (id: string) => void}) {
  return (
    <GlassCard className="animate-rise p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Programme journey</p>
          <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">How participants move through the plan</h2>
        </div>
        <StatusPill label={`${plan.officialOfferings.length} activities`} tone="cyan" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {plan.officialOfferings.map((offering, index) => {
          const original = catalogue.offerings.find((item) => item.id === offering.id)
          const schedule = plan.schedules.find((s) => s.offeringId === offering.id)
          const coverage = plan.coverage.find((c) => c.offeringId === offering.id)
          const Icon = activityIcon(`${offering.title} ${coverage?.goal ?? ''}`)
          const favouriteId = `activity:${offering.id}`
          const favourite = favourites.has(favouriteId)
          return (
            <div key={offering.id} className="group rounded-3xl border border-cyan/20 bg-cyan/[0.05] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan/45 hover:shadow-[0_18px_55px_-40px_var(--cyan)]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-semibold text-cyan">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFavourite(favouriteId)}
                    aria-pressed={favourite}
                    className={cn('grid size-10 place-items-center rounded-2xl border transition-all', favourite ? 'border-violet/45 bg-violet/20 text-violet' : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:border-violet/30 hover:text-violet')}
                    title={favourite ? 'Remove favourite' : 'Favourite activity'}
                  >
                    <Star className={cn('size-4', favourite && 'fill-current')} />
                  </button>
                  <span className="grid size-12 place-items-center rounded-2xl border border-cyan/20 bg-cyan/10 text-cyan"><Icon className="size-5"/></span>
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{offering.title}</h3>
              <p className="mt-2 text-sm font-medium text-cyan">{schedule ? `${schedule.deliveryMin} min delivery` : shown(original?.fields.Standard_Duration_Min?.raw_value) + ' min'}</p>
              <p className="mt-4 text-base leading-6">{coverage?.goal ?? offering.learningOutcomes[0] ?? 'Official Petrosains activity'}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-cyan">Why selected</summary>
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
  const programmeFavouriteId = useMemo(() => `programme:${plan?.spec.offeringIds.join('|') ?? 'none'}`, [plan])
  const [favourites, setFavourites] = useState<Set<string>>(() => new Set())
  const [savedOpen, setSavedOpen] = useState(false)
  const savedActivityIds = new Set([...favourites].filter((id) => id.startsWith('activity:')).map((id) => id.slice('activity:'.length)))
  const savedActivities = catalogue.offerings.filter((offering) => savedActivityIds.has(offering.id))
  const savedProgrammes = [...favourites]
    .filter((id) => id.startsWith('programme:') && id !== 'programme:none')
    .map((id) => {
      const offeringIds = id.slice('programme:'.length).split('|').filter(Boolean)
      const titles = offeringIds.map((offeringId) => catalogue.offerings.find((offering) => offering.id === offeringId)?.title ?? offeringId)
      return {id, title: titles.length ? titles.join(' + ') : 'Saved programme'}
    })
  const savedCount = savedProgrammes.length + savedActivities.length
  const reality = [
    realityGroup(unique, 'capacity', 'Capacity', (c) => /participant|capacity|group|round/i.test(`${c.id} ${c.reason}`)),
    realityGroup(unique, 'duration', 'Duration', (c) => /duration|time|window|schedule/i.test(`${c.id} ${c.reason}`)),
    realityGroup(unique, 'venue', 'Venue', (c) => /venue|room|indoor|outdoor/i.test(`${c.id} ${c.reason}`)),
    realityGroup(unique, 'internet', 'Internet', (c) => /internet|offline/i.test(`${c.id} ${c.reason}`)),
    {id: 'materials', label: 'Materials', status: r.materials.some((m) => m.status === 'Insufficient') ? 'NOT FEASIBLE' : r.materials.some((m) => m.status === 'Unknown') || r.materials.length === 0 ? 'NEEDS VERIFICATION' : 'VERIFIED FEASIBLE', reason: 'Material rows are checked separately from programme suitability.'},
    realityGroup(unique, 'staff', 'Staff', (c) => /staff|facilitator|handling|safety|approval/i.test(`${c.id} ${c.reason}`)),
  ]
  const passedReality = reality.filter((item) => tone(item.status) === 'success').length
  const needsReality = reality.filter((item) => tone(item.status) === 'warning').length
  const failedReality = reality.filter((item) => tone(item.status) === 'danger').length

  useEffect(() => {
    try {
      setFavourites(new Set(JSON.parse(localStorage.getItem(favouriteKey) ?? '[]')))
    } catch {
      setFavourites(new Set())
    }
  }, [])

  function toggleFavourite(id: string) {
    setFavourites((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(favouriteKey, JSON.stringify([...next]))
      return next
    })
  }

  function exportReport() {
    const report = makeReportHtml({result: r, reality, unknowns})
    const printWindow = window.open('', '_blank', 'width=900,height=1200')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(report)
    printWindow.document.close()
  }

  return (
    <section aria-label="Programme evaluation" className="space-y-6">
      <GlassCard strong className="animate-rise overflow-hidden p-6 shadow-[0_28px_100px_-58px_var(--cyan)] sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Recommended Programme</p>
            <h2 className="mt-3 max-w-4xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{programmeTitle(plan)}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{changeNote || r.conclusion}</p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <StatusPill label={r.status} tone={tone(r.status)} />
            <div className="flex flex-wrap gap-2">
              <ActionButton active={favourites.has(programmeFavouriteId)} onClick={() => toggleFavourite(programmeFavouriteId)} title="Favourite this programme">
                <Bookmark className={cn('size-4', favourites.has(programmeFavouriteId) && 'fill-current')} /> Favourite
              </ActionButton>
              <ActionButton active={savedOpen} onClick={() => setSavedOpen((open) => !open)} title="View saved favourites">
                <Star className={cn('size-4', favourites.size > 0 && 'fill-current')} /> Saved {savedCount}
              </ActionButton>
              <ActionButton onClick={exportReport} title="Open a print-friendly report">
                <Download className="size-4" /> Export Report
              </ActionButton>
            </div>
          </div>
        </div>
        {stale && <p role="status" className="mt-5 rounded-2xl border border-warning/40 bg-warning/10 p-4 font-medium text-warning">OUT OF DATE — this result belongs to the previous input or calculation mode. Re-evaluate the current draft.</p>}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-cyan/15 bg-cyan/[0.055] p-5"><PackageCheck className="mb-3 size-5 text-cyan"/><p className="font-display text-3xl font-semibold text-cyan">{plan?.officialOfferings.length ?? 0}</p><p className="text-sm text-muted-foreground">Official activities</p></div>
          <div className="rounded-3xl border border-cyan/15 bg-cyan/[0.055] p-5"><Users className="mb-3 size-5 text-cyan"/><p className="font-display text-3xl font-semibold text-cyan">{plan?.participantDurationMin ?? '—'}</p><p className="text-sm text-muted-foreground">Participant minutes</p></div>
          <div className="rounded-3xl border border-cyan/15 bg-cyan/[0.055] p-5"><Route className="mb-3 size-5 text-cyan"/><p className="font-display text-3xl font-semibold text-cyan">{plan ? `${plan.operationalStartMin}–${plan.operationalEndMin}` : '—'}</p><p className="text-sm text-muted-foreground">Operational window</p></div>
          <div className="rounded-3xl border border-cyan/15 bg-cyan/[0.055] p-5"><Sparkles className="mb-3 size-5 text-cyan"/><p className="font-display text-3xl font-semibold text-cyan">{r.themeCoverage.length}</p><p className="text-sm text-muted-foreground">Goal evidence links</p></div>
        </div>
      </GlassCard>

      {savedOpen && (
        <GlassCard className="animate-rise p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet">Saved favourites</p>
              <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Your saved programme ideas</h2>
            </div>
            <span className="rounded-full border border-violet/30 bg-violet/10 px-3 py-1 text-sm font-semibold text-violet">{savedCount} saved</span>
          </div>

          {savedCount === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-center">
              <Star className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-semibold">No favourites yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Star a programme or activity to keep it here.</p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Bookmark className="size-5 text-violet" />
                  <h3 className="font-display text-xl font-semibold">Saved Programmes</h3>
                </div>
                {savedProgrammes.length ? (
                  <div className="space-y-3">
                    {savedProgrammes.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <p className="min-w-0 flex-1 font-medium">{item.title}</p>
                        <button type="button" onClick={() => toggleFavourite(item.id)} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-danger/30 hover:text-danger">Remove</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No saved programme yet.</p>}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Star className="size-5 fill-current text-violet" />
                  <h3 className="font-display text-xl font-semibold">Saved Activities</h3>
                </div>
                {savedActivities.length ? (
                  <div className="space-y-3">
                    {savedActivities.map((offering) => (
                      <div key={offering.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{offering.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{offering.id}</p>
                        </div>
                        <button type="button" onClick={() => toggleFavourite(`activity:${offering.id}`)} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-danger/30 hover:text-danger">Remove</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No saved activities yet.</p>}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {plan ? <Journey plan={plan} catalogue={catalogue} favourites={favourites} toggleFavourite={toggleFavourite} /> : <GlassCard className="p-6 sm:p-8"><p className="text-base">No acceptable programme found within this search. Review the hard failures and adjust the request or search scope.</p></GlassCard>}

      <GlassCard className="animate-rise p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Reality Check</p>
            <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Can this actually run?</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-success/25 bg-success/10 px-3 py-1 text-success">{passedReality} passed</span>
            <span className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-warning">{needsReality} verify</span>
            <span className="rounded-full border border-danger/25 bg-danger/10 px-3 py-1 text-danger">{failedReality} blocked</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reality.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-cyan/25">
              <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{item.label}</h3><StatusIcon status={item.status}/></div>
              <p className={cn('mt-3 text-base font-semibold', tone(item.status) === 'success' ? 'text-success' : tone(item.status) === 'danger' ? 'text-danger' : 'text-warning')}>{statusText(item.status)}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.reason}</p>
            </div>
          ))}
        </div>
        <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <summary className="cursor-pointer text-base font-medium text-cyan">View all checks, sources & next actions ({unique.length})</summary>
          <div className="mt-4 space-y-3">{unique.map((c) => <CheckRow key={`${c.id}:${c.reason}`} check={c}/>)}</div>
        </details>
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet">Plan B</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">If the preferred programme cannot run</h2>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">ORBIT revalidates an alternative against the same request and evidence.</p>
          </div>
          {r.planB && <StatusPill label={r.planB.status} tone={tone(r.planB.status)} />}
        </div>
        {r.planB ? (
          <>
            <div className="mt-5 rounded-3xl border border-violet/25 bg-violet/[0.075] p-5">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Alternative activities</p>
              <p className="mt-2 font-display text-2xl font-semibold">{r.planB.officialOfferings.map((o) => o.title).join(' → ')}</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {Object.entries(r.tradeOffs).map(([key, values]) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-violet">{key}</h3>
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{(values.length ? values.slice(0,4) : ['None identified']).map((text, index) => <li key={index}>{text}</li>)}</ul>
                </div>
              ))}
            </div>
            <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><summary className="cursor-pointer text-base font-medium text-cyan">View Plan B checks and material evidence</summary><div className="mt-4 space-y-4"><Schedule plan={r.planB}/><Materials rows={r.planBMaterials} sourceRows={sourceRows}/>{r.planB.checks.map((c) => <CheckRow key={c.id} check={c}/>)}</div></details>
          </>
        ) : <p className="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-base text-muted-foreground">No suitable distinct Plan B found within this bounded search. ORBIT is being honest: this does not prove no alternative exists.</p>}
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet">Proposed Enhancements</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Optional ideas, clearly labelled</h2>
        </div>
        {r.proposedEnhancements.length ? r.proposedEnhancements.map((enhancement, index) => (
          <div key={index} className="mt-3 rounded-3xl border border-violet/30 bg-violet/[0.045] p-5 text-base">
            <StatusPill label={enhancement.label} tone="violet" />
            <p className="mt-3 leading-7">{enhancement.description}</p>
            <p className="mt-3 text-sm text-warning">Needs verification: {enhancement.approvalsRequired.join(' · ')}</p>
            <details className="mt-3 text-sm"><summary className="cursor-pointer text-cyan">View benefits and trade-offs</summary><p className="mt-2 text-muted-foreground">Benefits: {enhancement.benefits.join(' · ') || 'None stated'} · Losses: {enhancement.losses.join(' · ') || 'None stated'}</p></details>
          </div>
        )) : <p className="text-base text-muted-foreground">No enhancement proposed for this request.</p>}
      </GlassCard>

      <GlassCard className="p-6 sm:p-8">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-cyan"><FileText className="size-4"/>View planning details</summary>
          <div className="mt-5 space-y-5 text-sm">
            <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4"><p>{r.inventory.explanation}</p><p className="mt-2 text-muted-foreground">Last inventory read: {r.inventory.readAt ?? 'Unavailable'}. {r.inventory.quantityVerification}</p></div>
            {failures.length > 0 && <div className="space-y-3"><h3 className="font-semibold text-danger">Known hard failures</h3>{failures.map((c) => <CheckRow key={`${c.id}:${c.reason}`} check={c}/>)}</div>}
            <div><h3 className="font-semibold">Key information to verify</h3>{unknowns.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No unresolved checks in this evaluation.</p> : <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{[...new Set(unknowns.map((c) => c.reason))].slice(0,6).map((text) => <li key={text}>{text}</li>)}</ul>}</div>
            <Understanding request={r.requestUnderstanding}/>
            <Materials rows={r.materials} sourceRows={sourceRows}/>
            <div className="rounded-2xl border border-white/10 p-4 text-xs leading-5 text-muted-foreground">
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
