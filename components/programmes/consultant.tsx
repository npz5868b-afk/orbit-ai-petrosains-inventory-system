'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import {ArrowRight, Compass, RefreshCw, WifiOff} from 'lucide-react'
import {GlassCard, StatusPill} from '@/components/ui-kit'
import {Button} from '@/components/ui/button'
import {adaptCatalogue} from '@/lib/programmes/catalogue'
import {normalizeRequest} from '@/lib/programmes/request'
import {validateConsultation} from '@/lib/programmes/protocol'
import {consultLocally, comparePlans, LatestEvaluation} from '@/lib/programmes/local'
import type {B1Bundle, Goal} from '@/lib/programmes/types'
import type {ConsultationResult} from '@/lib/programmes/consultation'
import {ProgrammeResults, Understanding} from './results'

const inputClass='mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-background/80 px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-cyan'
const initial={brief:'',audienceType:'',ages:'',participants:'',durationMin:'',eventStart:'',venue:'unknown',internet:'unknown',electricity:'unknown',water:'unknown',budgetBand:'unknown',accessibility:'',accessMode:'unknown',format:''}
type Draft=typeof initial

export function ProgrammeConsultant() {
 const [draft,setDraft]=useState<Draft>(initial), [themes,setThemes]=useState<Goal[]>([]), [objectives,setObjectives]=useState<Goal[]>([])
 const [hardBudget,setHardBudget]=useState(false), [participantLed,setParticipantLed]=useState(false)
 const [bundle,setBundle]=useState<B1Bundle|null>(null),[catalogueError,setCatalogueError]=useState(''),[catalogueLoading,setCatalogueLoading]=useState(true)
 const [online,setOnline]=useState(true),[localMode,setLocalMode]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [result,setResult]=useState<ConsultationResult|null>(null),[resultKey,setResultKey]=useState(''),[changeNote,setChangeNote]=useState(''),[resultOutdated,setResultOutdated]=useState(false)
 const [selected,setSelected]=useState<string[]>([]),[keepPlan,setKeepPlan]=useState(true),[maxActivities,setMaxActivities]=useState(2)
 const latest=useRef(new LatestEvaluation()), controller=useRef<AbortController|null>(null),loader=useRef<AbortController|null>(null),lastRead=useRef<string|null>(null)
 const resultsRef=useRef<HTMLDivElement>(null)
 const catalogue=useMemo(()=>bundle?adaptCatalogue(bundle):null,[bundle])
 const themeOptions=useMemo(()=>[...new Set(catalogue?.offerings.flatMap(o=>String(o.fields.Suitable_Themes?.value??'').split(/[;,]/).map(t=>t.trim()).filter(Boolean))??[])],[catalogue])
 const raw=useMemo(()=>({...draft,participants:draft.participants===''?null:Number(draft.participants),durationMin:draft.durationMin===''?null:Number(draft.durationMin),ages:draft.ages||null,eventStart:draft.eventStart?`${draft.eventStart}:00+08:00`:null,accessibility:draft.accessMode==='unknown'?null:draft.accessMode==='none'?[]:draft.accessibility.split('\n').map(t=>t.trim()).filter(Boolean),themes,objectives,budgetIsHardLimit:hardBudget,participantLed}),[draft,themes,objectives,hardBudget,participantLed])
 // accessMode is a form control, not part of the API request contract.
 const request=useMemo(()=>{const {accessMode:_,...v}=raw;return v},[raw])
 const understanding=useMemo(()=>normalizeRequest(request),[request])
 const draftKey=JSON.stringify({request,selected,maxActivities,keepPlan,localMode,online})
 const stale=!!result&&(resultOutdated||draftKey!==resultKey)
 function invalidate(){setResultOutdated(true);latest.current.invalidate();controller.current?.abort();setBusy(false);setError('')}
 function field<K extends keyof Draft>(key:K,value:Draft[K]){invalidate();setDraft(v=>({...v,[key]:value}))}
 async function loadCatalogue(){
  loader.current?.abort();const abort=new AbortController();loader.current=abort;setCatalogueLoading(true);setCatalogueError('')
  const timer=setTimeout(()=>abort.abort(),10000)
  try {const response=await fetch('/api/programmes/offerings?include=offline',{signal:abort.signal,cache:'no-store'});if(!response.ok)throw new Error('unavailable');const data=await response.json();if(data.schema!=='orbit-programme-browser-v1')throw new Error('schema');adaptCatalogue(data.bundle);if(loader.current===abort)setBundle(data.bundle)}
  catch {if(loader.current===abort)setCatalogueError('Catalogue could not be loaded. Connect and retry; local calculation needs this catalogue first.')}
  finally {clearTimeout(timer);if(loader.current===abort)setCatalogueLoading(false)}
 }
 useEffect(()=>{
  void loadCatalogue();setOnline(navigator.onLine)
  const connection=()=>{setResultOutdated(true);setOnline(navigator.onLine);latest.current.invalidate();controller.current?.abort();setBusy(false)}
  window.addEventListener('online',connection);window.addEventListener('offline',connection)
  return()=>{loader.current?.abort();loader.current=null;latest.current.invalidate();controller.current?.abort();window.removeEventListener('online',connection);window.removeEventListener('offline',connection)}
 },[])
 async function evaluate(){
  invalidate();if(draft.accessMode==='specified'&&!draft.accessibility.trim()){setError('Describe the accessibility needs, or choose Unknown / No specific needs reported.');return}if(!bundle||!catalogue){setError('Load the official catalogue before evaluating.');return}
  const ticket=latest.current.invalidate(), key=draftKey, previous=result?.programme??null
  const planIds=selected.length?selected:keepPlan?previous?.spec.offeringIds:undefined
  const payload={request,...(planIds?.length?{plan:{offeringIds:planIds}}:{}),search:{maxActivities}}
  try {validateConsultation(payload,catalogue.offerings.map(o=>o.id))}catch(e){setError(e instanceof Error?e.message:'Correct the highlighted request.');return}
  setBusy(true);const abort=new AbortController();controller.current=abort
  let timer:ReturnType<typeof setTimeout>|undefined
  try {
   let next:ConsultationResult
   if(localMode||!online){await new Promise(resolve=>setTimeout(resolve,0));if(!latest.current.isCurrent(ticket))return;next=consultLocally(bundle,payload,new Date().toISOString(),lastRead.current)}
   else {
    timer=setTimeout(()=>abort.abort(),15000)
    const response=await fetch('/api/programmes/consult',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abort.signal})
    const data=await response.json();if(!response.ok)throw new Error(data.error?.message??'Programme API unavailable. Retry or use loaded-page local calculation.');next=data
   }
   if(!latest.current.isCurrent(ticket))return
   if(next.inventory.state==='read')lastRead.current=next.inventory.readAt
   setResult(next);setResultOutdated(false);setResultKey(key);setChangeNote(comparePlans(previous,next.programme,next.planB))
   setTimeout(()=>{if(latest.current.isCurrent(ticket))resultsRef.current?.focus()},0)
  }catch(e){if(latest.current.isCurrent(ticket))setError(e instanceof Error&&e.name!=='AbortError'&&e.name!=='TypeError'?e.message:'Programme request failed or timed out. Retry, or select local calculation with Unknown resources.')}
  finally{clearTimeout(timer);if(latest.current.isCurrent(ticket))setBusy(false)}
 }
 function goals(kind:'themes'|'objectives',values:Goal[],update:(v:Goal[])=>void){return <fieldset className="min-w-0"><legend className="font-medium">{kind==='themes'?'Themes':'Learning objectives'} <span className="text-xs text-muted-foreground">{values.length}/8</span></legend>
  {values.length===0&&<p className="mt-2 text-sm text-muted-foreground">Unknown until you add a {kind==='themes'?'theme':'learning objective'}.</p>}
  <div className="space-y-2">{values.map((g,i)=><div key={i} className="mt-2 grid grid-cols-[minmax(0,1fr)_110px_32px] gap-2">
   <input aria-label={`${kind} ${i+1}`} list={kind==='themes'?'programme-themes':undefined} className={inputClass+' !mt-0'} maxLength={200} value={g.text} onChange={e=>{invalidate();update(values.map((v,j)=>i===j?{...v,text:e.target.value}:v))}} />
   <select aria-label={`${kind} ${i+1} priority`} className={inputClass+' !mt-0 !px-2'} value={g.priority} onChange={e=>{invalidate();update(values.map((v,j)=>i===j?{...v,priority:e.target.value as Goal['priority']}:v))}}><option value="preference">Preference</option><option value="critical">Critical</option></select>
   <Button type="button" variant="ghost" aria-label={`Remove ${kind} ${i+1}`} onClick={()=>{invalidate();update(values.filter((_,j)=>i!==j))}}>×</Button>
  </div>)}</div><Button className="mt-3" type="button" variant="outline" disabled={values.length>=8} onClick={()=>{invalidate();update([...values,{text:'',priority:'preference'}])}}>Add {kind==='themes'?'theme':'objective'}</Button>
 </fieldset>}
 function input(key:keyof Draft,label:string,type='text',extra:Record<string,unknown>={}){return <label className="block min-w-0 text-sm font-medium">{label}<input className={inputClass} type={type} value={draft[key]} maxLength={200} onChange={e=>field(key,e.target.value)} {...extra}/></label>}
 function select(key:keyof Draft,label:string,options:string[]){return <label className="block min-w-0 text-sm font-medium">{label}<select className={inputClass} value={draft[key]} onChange={e=>field(key,e.target.value)}>{['unknown',...options].map(v=><option key={v} value={v}>{v==='unknown'?'Unknown':v.replaceAll('_',' ')}</option>)}</select></label>}
 return <div className="space-y-6 pb-4">
  <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-cyan"><Compass className="size-4"/>ORBIT PROGRAMME TWIN</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Programme Consultant</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Turn a learning request into a programme you can check. Official activities, clear trade-offs, and operational questions that stay visible.</p></div><StatusPill label={!online?'Device offline':localMode?'Local calculation':'API calculation'} tone={!online||localMode?'warning':'cyan'}/></header>
  <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">{['01 · Shape the request','02 · Confirm understanding','03 · Check the programme'].map(t=><div key={t} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-muted-foreground">{t}</div>)}</div>
  <div aria-live="polite" className="text-sm text-muted-foreground">{catalogueLoading?'Loading official catalogue…':catalogue?`${catalogue.offerings.length} official offerings loaded · Catalogue availability and theme mappings remain pending.`:catalogueError}
   {catalogueError&&<Button variant="outline" className="ml-3" onClick={()=>void loadCatalogue()}>Retry catalogue</Button>}
  </div>
  <form onSubmit={e=>{e.preventDefault();void evaluate()}} className="space-y-5">
   <GlassCard className="p-5 sm:p-7"><div className="mb-6"><h2 className="text-lg font-semibold">Shape your request</h2><p className="mt-1 text-sm text-muted-foreground">Blank fields stay Unknown. Brief text is context only and is not automatically parsed.</p></div>
    <label className="block text-sm font-medium">Stakeholder brief <span className="text-muted-foreground">· optional context</span><textarea className={inputClass} rows={2} maxLength={4000} value={draft.brief} onChange={e=>field('brief',e.target.value)} placeholder="Add context, then complete the structured fields below."/></label>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">{goals('themes',themes,setThemes)}{goals('objectives',objectives,setObjectives)}</div><datalist id="programme-themes">{themeOptions.map(t=><option key={t} value={t}/>)}</datalist>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
     {input('audienceType','Audience / group')}{input('ages','Age range (e.g. 4–8 or 12+)')}{input('participants','Participants · max 1,000','number',{min:1,max:1000,step:1,placeholder:'Unknown'})}
     {input('durationMin','Attendance window · minutes','number',{min:0.001,max:1440,step:'any',placeholder:'Unknown'})}{input('eventStart','Event start · Malaysia time (UTC+08)','datetime-local')}{select('venue','Venue',['indoor','outdoor','sheltered_outdoor'])}
     {select('internet','Internet',['stable','unstable','none'])}{select('electricity','Electricity',['yes','no'])}{select('water','Water',['yes','no'])}
    </div>
    <details className="mt-6 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-cyan">Budget, accessibility & preferences</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
     {select('budgetBand','Budget band',['Low','Medium','High'])}{input('format','Preferred activity format')}
     <label className="text-sm">Accessibility needs<select className={inputClass} value={draft.accessMode} onChange={e=>field('accessMode',e.target.value)}><option value="unknown">Unknown</option><option value="none">No specific needs reported</option><option value="specified">Specify needs</option></select></label>
     {draft.accessMode==='specified'&&<label className="text-sm">Needs · one per line, max 12<textarea className={inputClass} rows={3} value={draft.accessibility} onChange={e=>field('accessibility',e.target.value)}/></label>}
     <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={hardBudget} onChange={e=>{invalidate();setHardBudget(e.target.checked)}}/>Budget is a hard limit</label>
     <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={participantLed} onChange={e=>{invalidate();setParticipantLed(e.target.checked)}}/>Require participant-led delivery</label>
    </div></details>
    <details className="mt-3 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-medium">Select official offerings & search scope</summary><p className="my-3 text-sm text-muted-foreground">Optional: choose up to 3 offerings to test a specific plan. Availability is unconfirmed; selecting an activity does not approve it.</p><div className="grid gap-3 sm:grid-cols-2">{catalogue?.offerings.map(o=><label key={o.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>{invalidate();setSelected(e.target.checked?[...selected,o.id]:selected.filter(v=>v!==o.id))}}/><span>{o.id} · {o.title}</span></label>)}</div>
     <label className="mt-4 block text-sm">Maximum activities to search<select className={inputClass} value={maxActivities} onChange={e=>{invalidate();setMaxActivities(Number(e.target.value))}}>{[1,2,3].map(n=><option key={n}>{n}</option>)}</select></label>
     <p className="mt-2 text-xs text-muted-foreground">Bounded search: up to 100 evaluations, reduced for larger participant counts. A search failure does not prove that no possible programme exists.</p>
    </details>
   </GlassCard>
   <GlassCard className="border-cyan/20 p-5 sm:p-7"><div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold">Request Understanding</h2><StatusPill label="Current draft" tone="cyan"/></div><Understanding request={understanding.request}/>
    <p className="mt-4 text-sm text-muted-foreground">Confirm this structured understanding before evaluating. {understanding.checks.filter(c=>c.id.endsWith('.missing')).length} request fields need clarification; missing information is allowed and stays visible.</p>
    <div className="mt-5 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={localMode} onChange={e=>{invalidate();setLocalMode(e.target.checked)}}/>Use loaded-page local calculation</label>{result?.programme&&<label className="flex items-center gap-2"><input type="checkbox" checked={keepPlan} onChange={e=>{invalidate();setKeepPlan(e.target.checked)}}/>Recheck original plan for What-if</label>}</div>
    {(!online||localMode)&&<p className="mt-3 flex gap-2 text-sm text-warning"><WifiOff className="size-4 shrink-0"/>Local computation uses the loaded catalogue. Inventory and operational evidence stay Unknown. Cold start and page refresh offline are not supported.</p>}
    {error&&<p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</p>}
    <div className="mt-5 flex flex-wrap items-center gap-4"><Button type="submit" size="lg" disabled={!bundle} className="!h-11 !px-5">{busy?<RefreshCw className="size-4 animate-spin"/>:<ArrowRight className="size-4"/>}{busy?'Re-evaluate latest input':result?'Re-evaluate / What-if':'Confirm & evaluate'}</Button><span role="status" className="text-sm text-muted-foreground">{busy?'Evaluating your current request…':stale?'Draft or calculation mode changed. The previous result is out of date.':'No operational approval is inferred from this form.'}</span></div>
   </GlassCard>
  </form>
  <div ref={resultsRef} tabIndex={-1} className="outline-none">{result?<ProgrammeResults result={result} catalogue={catalogue!} sourceRows={bundle!.materials.sheets.flatMap(s=>s.records)} stale={stale} changeNote={changeNote}/>:<GlassCard className="p-7 text-center"><Compass className="mx-auto mb-3 size-7 text-cyan"/><h2 className="font-semibold">Your programme starts with a request</h2><p className="mt-2 text-sm text-muted-foreground">Add the themes and conditions you know, confirm the understanding, and evaluate.</p></GlassCard>}</div>
 </div>
}
