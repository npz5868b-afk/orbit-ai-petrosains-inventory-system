'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import {ArrowLeft, ArrowRight, Check, ChevronDown, Compass, RefreshCw, Sparkles, WifiOff} from 'lucide-react'
import {GlassCard, StatusPill} from '@/components/ui-kit'
import {Button} from '@/components/ui/button'
import {adaptCatalogue} from '@/lib/programmes/catalogue'
import {normalizeRequest} from '@/lib/programmes/request'
import {validateConsultation} from '@/lib/programmes/protocol'
import {consultLocally, comparePlans, LatestEvaluation} from '@/lib/programmes/local'
import type {B1Bundle, Goal} from '@/lib/programmes/types'
import type {ConsultationResult} from '@/lib/programmes/consultation'
import {ProgrammeResults, Understanding} from './results'
import {cn} from '@/lib/utils'

const inputClass = 'mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-cyan'
const initial = {brief:'',audienceType:'',ages:'',participants:'',durationMin:'',eventStart:'',venue:'unknown',internet:'unknown',electricity:'unknown',water:'unknown',budgetBand:'unknown',accessibility:'',accessMode:'unknown',format:''}
type Draft = typeof initial
type Stage = 'request' | 'review' | 'programme'

const stepMeta: Array<{id: Stage; eyebrow: string; label: string}> = [
  {id:'request', eyebrow:'01', label:'Request'},
  {id:'review', eyebrow:'02', label:'Review'},
  {id:'programme', eyebrow:'03', label:'Programme'},
]

function formatAge(ages: ReturnType<typeof normalizeRequest>['request']['ages']) {
  return ages ? `${ages.min}${ages.max === null ? '+' : `–${ages.max}`}` : 'Unknown'
}

function StepProgress({stage}: {stage: Stage}) {
  const current = stepMeta.findIndex((s) => s.id === stage)
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-3 sm:text-sm">
      {stepMeta.map((step, index) => {
        const complete = index < current
        const active = index === current
        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all',
              active
                ? 'border-cyan/45 bg-cyan/10 text-foreground shadow-[0_0_34px_-22px_var(--cyan)]'
                : complete
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-white/10 bg-white/[0.03] text-muted-foreground',
            )}
          >
            <span className={cn('grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold', active ? 'border-cyan text-cyan' : complete ? 'border-success bg-success text-primary-foreground' : 'border-white/15')}>
              {complete ? <Check className="size-3.5" /> : step.eyebrow}
            </span>
            <span className="font-medium">{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function storeOneLine(values: string[]) {
  return values.filter(Boolean).join(' · ') || 'Still open'
}

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return <label className="block min-w-0 text-sm font-medium">{label}{children}</label>
}

function SectionTitle({eyebrow, title, subtitle}: {eyebrow: string; title: string; subtitle: string}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">{eyebrow}</p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

export function ProgrammeConsultant() {
  const [stage, setStage] = useState<Stage>('request')
  const [draft, setDraft] = useState<Draft>(initial)
  const [themes, setThemes] = useState<Goal[]>([])
  const [objectives, setObjectives] = useState<Goal[]>([])
  const [themeInput, setThemeInput] = useState('')
  const [objectiveInput, setObjectiveInput] = useState('')
  const [themePriority, setThemePriority] = useState<Goal['priority']>('preference')
  const [objectivePriority, setObjectivePriority] = useState<Goal['priority']>('preference')
  const [hardBudget, setHardBudget] = useState(false)
  const [participantLed, setParticipantLed] = useState(false)
  const [bundle, setBundle] = useState<B1Bundle | null>(null)
  const [catalogueError, setCatalogueError] = useState('')
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const [localMode, setLocalMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ConsultationResult | null>(null)
  const [resultKey, setResultKey] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [resultOutdated, setResultOutdated] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [keepPlan, setKeepPlan] = useState(true)
  const [maxActivities, setMaxActivities] = useState(2)
  const latest = useRef(new LatestEvaluation())
  const controller = useRef<AbortController | null>(null)
  const loader = useRef<AbortController | null>(null)
  const lastRead = useRef<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)

  const catalogue = useMemo(() => bundle ? adaptCatalogue(bundle) : null, [bundle])
  const themeOptions = useMemo(() => [...new Set(catalogue?.offerings.flatMap((o) => String(o.fields.Suitable_Themes?.value ?? '').split(/[;,]/).map((t) => t.trim()).filter(Boolean)) ?? [])], [catalogue])
  const raw = useMemo(() => ({
    ...draft,
    participants: draft.participants === '' ? null : Number(draft.participants),
    durationMin: draft.durationMin === '' ? null : Number(draft.durationMin),
    ages: draft.ages || null,
    eventStart: draft.eventStart ? `${draft.eventStart}:00+08:00` : null,
    accessibility: draft.accessMode === 'unknown' ? null : draft.accessMode === 'none' ? [] : draft.accessibility.split('\n').map((t) => t.trim()).filter(Boolean),
    themes,
    objectives,
    budgetIsHardLimit: hardBudget,
    participantLed,
  }), [draft, themes, objectives, hardBudget, participantLed])
  const request = useMemo(() => { const {accessMode:_, ...value} = raw; return value }, [raw])
  const understanding = useMemo(() => normalizeRequest(request), [request])
  const draftKey = JSON.stringify({request, selected, maxActivities, keepPlan, localMode, online})
  const stale = !!result && (resultOutdated || draftKey !== resultKey)

  function invalidate() {
    setResultOutdated(true)
    latest.current.invalidate()
    controller.current?.abort()
    setBusy(false)
    setError('')
  }
  function field<K extends keyof Draft>(key: K, value: Draft[K]) { invalidate(); setDraft((v) => ({...v, [key]: value})) }
  function input(key: keyof Draft, label: string, type = 'text', extra: Record<string, unknown> = {}) {
    return <Field label={label}><input className={inputClass} type={type} value={draft[key]} maxLength={200} onChange={(e) => field(key, e.target.value)} {...extra}/></Field>
  }
  function select(key: keyof Draft, label: string, options: string[]) {
    return <Field label={label}><select className={inputClass} value={draft[key]} onChange={(e) => field(key, e.target.value)}>{['unknown', ...options].map((v) => <option key={v} value={v}>{v === 'unknown' ? 'Unknown' : v.replaceAll('_', ' ')}</option>)}</select></Field>
  }
  function addGoal(kind: 'theme' | 'objective') {
    const text = (kind === 'theme' ? themeInput : objectiveInput).trim()
    if (!text) return
    invalidate()
    if (kind === 'theme' && themes.length < 8) { setThemes([...themes, {text, priority:themePriority}]); setThemeInput('') }
    if (kind === 'objective' && objectives.length < 8) { setObjectives([...objectives, {text, priority:objectivePriority}]); setObjectiveInput('') }
  }
  function chipList(kind: 'theme' | 'objective', values: Goal[], setValues: (values: Goal[]) => void, inputValue: string, setInputValue: (value: string) => void) {
    const id = kind === 'theme' ? 'programme-themes' : undefined
    return (
      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{kind === 'theme' ? 'Themes' : 'Objectives'}</p>
          <span className="text-xs text-muted-foreground">{values.length}/8</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((goal, index) => (
            <button
              key={`${goal.text}:${index}`}
              type="button"
              onClick={() => { invalidate(); setValues(values.filter((_, i) => i !== index)) }}
              className={cn('rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-danger/40 hover:text-danger', goal.priority === 'critical' ? 'border-violet/35 bg-violet/15 text-violet' : 'border-cyan/25 bg-cyan/10 text-cyan')}
              title="Remove"
            >
              {goal.text}
            </button>
          ))}
          {values.length === 0 && <span className="text-xs text-muted-foreground">Unknown until added</span>}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            list={id}
            className={inputClass + ' !mt-0'}
            value={inputValue}
            maxLength={200}
            placeholder={kind === 'theme' ? 'Add theme' : 'Add objective'}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGoal(kind) } }}
          />
          <select
            aria-label={`${kind} priority`}
            className={inputClass + ' !mt-0 !px-2'}
            value={kind === 'theme' ? themePriority : objectivePriority}
            onChange={(event) => kind === 'theme' ? setThemePriority(event.target.value as Goal['priority']) : setObjectivePriority(event.target.value as Goal['priority'])}
          >
            <option value="preference">Preference</option>
          </select>
          <Button type="button" variant="outline" disabled={values.length >= 8} onClick={() => addGoal(kind)}>+ Add</Button>
        </div>
      </div>
    )
  }

  async function loadCatalogue() {
    loader.current?.abort()
    const abort = new AbortController()
    loader.current = abort
    setCatalogueLoading(true)
    setCatalogueError('')
    const timer = setTimeout(() => abort.abort(), 10000)
    try {
      const response = await fetch('/api/programmes/offerings?include=offline', {signal:abort.signal, cache:'no-store'})
      if (!response.ok) throw new Error('unavailable')
      const data = await response.json()
      if (data.schema !== 'orbit-programme-browser-v1') throw new Error('schema')
      adaptCatalogue(data.bundle)
      if (loader.current === abort) setBundle(data.bundle)
    } catch {
      if (loader.current === abort) setCatalogueError('Catalogue could not be loaded. Connect and retry; local calculation needs this catalogue first.')
    } finally {
      clearTimeout(timer)
      if (loader.current === abort) setCatalogueLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalogue()
    setOnline(navigator.onLine)
    const connection = () => { setResultOutdated(true); setOnline(navigator.onLine); latest.current.invalidate(); controller.current?.abort(); setBusy(false) }
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    return () => { loader.current?.abort(); loader.current = null; latest.current.invalidate(); controller.current?.abort(); window.removeEventListener('online', connection); window.removeEventListener('offline', connection) }
  }, [])

  function reviewRequest() {
    setError('')
    setStage('review')
    window.setTimeout(() => reviewRef.current?.focus(), 0)
  }

  async function evaluate() {
    invalidate()
    if (draft.accessMode === 'specified' && !draft.accessibility.trim()) { setError('Describe the accessibility needs, or choose Unknown / No specific needs reported.'); return }
    if (!bundle || !catalogue) { setError('Load the official catalogue before evaluating.'); return }
    const ticket = latest.current.invalidate()
    const key = draftKey
    const previous = result?.programme ?? null
    const planIds = selected.length ? selected : keepPlan ? previous?.spec.offeringIds : undefined
    const payload = {request, ...(planIds?.length ? {plan:{offeringIds:planIds}} : {}), search:{maxActivities}}
    try { validateConsultation(payload, catalogue.offerings.map((o) => o.id)) } catch (e) { setError(e instanceof Error ? e.message : 'Correct the highlighted request.'); return }
    setBusy(true)
    setStage('programme')
    const abort = new AbortController()
    controller.current = abort
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      let next: ConsultationResult
      if (localMode || !online) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (!latest.current.isCurrent(ticket)) return
        next = consultLocally(bundle, payload, new Date().toISOString(), lastRead.current)
      } else {
        timer = setTimeout(() => abort.abort(), 15000)
        const response = await fetch('/api/programmes/consult', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:abort.signal})
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? 'Programme API unavailable. Retry or use loaded-page local calculation.')
        next = data
      }
      if (!latest.current.isCurrent(ticket)) return
      if (next.inventory.state === 'read') lastRead.current = next.inventory.readAt
      setResult(next)
      setResultOutdated(false)
      setResultKey(key)
      setChangeNote(comparePlans(previous, next.programme, next.planB))
      setTimeout(() => { if (latest.current.isCurrent(ticket)) resultsRef.current?.focus() }, 0)
    } catch (e) {
      if (latest.current.isCurrent(ticket)) {
        setError(e instanceof Error && e.name !== 'AbortError' && e.name !== 'TypeError' ? e.message : 'Programme request failed or timed out. Retry, or select local calculation with Unknown resources.')
        setStage('review')
      }
    } finally {
      clearTimeout(timer)
      if (latest.current.isCurrent(ticket)) setBusy(false)
    }
  }

  const requestSummary = understanding.request
  const unknownPrimary = [
    !requestSummary.eventStart && 'Start time',
    requestSummary.budgetBand === 'unknown' && 'Budget',
    requestSummary.electricity === 'unknown' && 'Electricity',
    requestSummary.water === 'unknown' && 'Water',
    requestSummary.internet === 'unknown' && 'Internet',
    requestSummary.venue === 'unknown' && 'Venue',
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-4">
      <header className="animate-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-cyan"><Compass className="size-4"/>ORBIT PROGRAMME TWIN</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">Build the right programme</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Tell us who it is for and what you want to achieve. ORBIT will match official Petrosains activities and check whether the plan can actually work.</p>
        </div>
        <StatusPill label={!online ? 'Device offline' : localMode ? 'Local calculation' : 'API calculation'} tone={!online || localMode ? 'warning' : 'cyan'} />
      </header>

      <StepProgress stage={stage} />

      <div aria-live="polite" className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{catalogueLoading ? 'Loading official catalogue...' : catalogue ? `${catalogue.offerings.length} official offerings loaded` : catalogueError}</span>
        {catalogueError && <Button variant="outline" className="!h-8" onClick={() => void loadCatalogue()}>Retry catalogue</Button>}
      </div>

      {stage === 'request' && (
        <form onSubmit={(e) => { e.preventDefault(); reviewRequest() }} className="space-y-5">
          <GlassCard strong className="animate-rise overflow-hidden p-5 sm:p-7">
            <SectionTitle eyebrow="1 · Tell us what you need" title="Start with the essentials" subtitle="Start with the essentials. You can leave anything unknown." />
            <div className="grid gap-4 xl:grid-cols-2">
              {chipList('theme', themes, setThemes, themeInput, setThemeInput)}
              {chipList('objective', objectives, setObjectives, objectiveInput, setObjectiveInput)}
            </div>
            <datalist id="programme-themes">{themeOptions.map((t) => <option key={t} value={t}/>)}</datalist>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {input('participants','Participants','number',{min:1,max:1000,step:1,placeholder:'Unknown'})}
              {input('ages','Age range','text',{placeholder:'e.g. 13–17'})}
              {input('durationMin','Duration · minutes','number',{min:0.001,max:1440,step:'any',placeholder:'Unknown'})}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {select('venue','Venue',['indoor','outdoor','sheltered_outdoor'])}
              {select('internet','Internet',['stable','unstable','none'])}
            </div>
            <div className="mt-5">
              <Field label="Extra context">
                <textarea className={inputClass} rows={2} maxLength={4000} value={draft.brief} onChange={(e) => field('brief', e.target.value)} placeholder="e.g. 200 secondary students, sustainability focus, indoor programme, unreliable internet"/>
              </Field>
              <p className="mt-2 text-xs text-muted-foreground">Optional context only — structured fields drive the evaluation.</p>
            </div>
            <details className="group mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                More details & constraints
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {input('audienceType','Audience / group')}
                {input('eventStart','Event start · Malaysia time (UTC+08)','datetime-local')}
                {select('electricity','Electricity',['yes','no'])}
                {select('water','Water',['yes','no'])}
                {select('budgetBand','Budget',['Low','Medium','High'])}
                {input('format','Preferences / format')}
                <Field label="Accessibility">
                  <select className={inputClass} value={draft.accessMode} onChange={(e) => field('accessMode', e.target.value)}>
                    <option value="unknown">Unknown</option>
                    <option value="none">No specific needs reported</option>
                    <option value="specified">Specify needs</option>
                  </select>
                </Field>
                {draft.accessMode === 'specified' && <Field label="Needs · one per line"><textarea className={inputClass} rows={3} value={draft.accessibility} onChange={(e) => field('accessibility', e.target.value)}/></Field>}
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"><input type="checkbox" checked={hardBudget} onChange={(e) => { invalidate(); setHardBudget(e.target.checked) }}/>Budget is a hard limit</label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"><input type="checkbox" checked={participantLed} onChange={(e) => { invalidate(); setParticipantLed(e.target.checked) }}/>Require participant-led delivery</label>
              </div>
              <details className="mt-4 rounded-xl border border-white/10 p-4">
                <summary className="cursor-pointer text-sm font-medium text-cyan">Manual official offering selection & search scope</summary>
                <p className="my-3 text-sm text-muted-foreground">Optional: choose up to 3 offerings to test a specific plan. Availability is unconfirmed; selecting an activity does not approve it.</p>
                <div className="grid max-h-72 gap-3 overflow-auto pr-1 md:grid-cols-2">
                  {catalogue?.offerings.map((o) => <label key={o.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => { invalidate(); setSelected(e.target.checked ? [...selected, o.id] : selected.filter((v) => v !== o.id)) }}/><span>{o.id} · {o.title}</span></label>)}
                </div>
                <Field label="Maximum activities to search"><select className={inputClass} value={maxActivities} onChange={(e) => { invalidate(); setMaxActivities(Number(e.target.value)) }}>{[1,2,3].map((n) => <option key={n}>{n}</option>)}</select></Field>
              </details>
            </details>
            {error && <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="submit" className="cta-sheen inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_34px_-4px_var(--violet)]">
                Review Request <ArrowRight className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground">{storeOneLine([requestSummary.participants ? `${requestSummary.participants} participants` : '', requestSummary.ages ? `${formatAge(requestSummary.ages)} years` : '', requestSummary.durationMin ? `${requestSummary.durationMin} min` : ''])}</span>
            </div>
          </GlassCard>
        </form>
      )}

      {stage === 'review' && (
        <div ref={reviewRef} tabIndex={-1} className="outline-none">
          <GlassCard strong className="animate-rise p-5 sm:p-7">
            <SectionTitle eyebrow="2 · ORBIT understood" title="Check the request before we build the programme" subtitle="Missing information stays visible. ORBIT will not treat unknowns as approvals." />
            <Understanding request={requestSummary} compactUnknowns={unknownPrimary} />
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={localMode} onChange={(e) => { invalidate(); setLocalMode(e.target.checked) }}/>Use loaded-page local calculation</label>
              {result?.programme && <label className="flex items-center gap-2"><input type="checkbox" checked={keepPlan} onChange={(e) => { invalidate(); setKeepPlan(e.target.checked) }}/>Recheck original plan for What-if</label>}
            </div>
            {(!online || localMode) && <p className="mt-3 flex gap-2 text-sm text-warning"><WifiOff className="size-4 shrink-0"/>Local computation uses the loaded catalogue. Inventory and operational evidence stay Unknown.</p>}
            {error && <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setStage('request')}><ArrowLeft className="size-4"/>Edit request</Button>
              <Button type="button" size="lg" disabled={!bundle || busy} onClick={() => void evaluate()}>{busy ? <RefreshCw className="size-4 animate-spin"/> : <ArrowRight className="size-4"/>}{busy ? 'Building programme' : 'Build Programme'}</Button>
            </div>
          </GlassCard>
        </div>
      )}

      {stage === 'programme' && (
        <div ref={resultsRef} tabIndex={-1} className="space-y-5 outline-none">
          {busy && !result && <GlassCard className="p-8 text-center"><RefreshCw className="mx-auto mb-3 size-7 animate-spin text-cyan"/><h2 className="font-semibold">Building your programme</h2><p className="mt-2 text-sm text-muted-foreground">ORBIT is matching official activities and checking constraints.</p></GlassCard>}
          {error && <GlassCard className="border-danger/30 p-5"><p className="text-sm text-danger">{error}</p><Button className="mt-4" variant="outline" onClick={() => setStage('review')}>Back to review</Button></GlassCard>}
          {result && catalogue && bundle && <ProgrammeResults result={result} catalogue={catalogue} sourceRows={bundle.materials.sheets.flatMap((s) => s.records)} stale={stale} changeNote={changeNote}/>}
          {result && (
            <GlassCard className="p-5 sm:p-7">
              <SectionTitle eyebrow="What if things change?" title="Recheck the same programme" subtitle="Change the main constraints, then ORBIT will re-evaluate the current plan before searching for an alternative." />
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                {input('participants','Participants','number',{min:1,max:1000,step:1,placeholder:'Unknown'})}
                {input('durationMin','Duration · minutes','number',{min:0.001,max:1440,step:'any',placeholder:'Unknown'})}
                <Button className="self-end" type="button" onClick={() => { setKeepPlan(true); void evaluate() }} disabled={busy}>{busy ? <RefreshCw className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}Recalculate</Button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{stale ? 'The request changed. Recalculate to see the impact.' : changeNote || 'The current programme still works under the latest evaluated request, subject to unresolved evidence.'}</p>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  )
}
