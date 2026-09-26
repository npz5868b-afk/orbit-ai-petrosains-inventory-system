'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import { fetchInventoryForStoreFromApi, startCheckoutScan, type ApiScan } from '@/lib/api-client'
import { getInventory } from '@/lib/services/inventory-service'
import {
  getTeams as getScanTeams,
} from '@/lib/services/scan-service'
import { submitOrQueue } from '@/lib/offline-queue'
import type { InventoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Check,
  Camera,
  Minus,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Step = 0 | 1 | 2 | 3 | 4

type CartItem = { itemId: string; itemName: string; itemCode: string; qty: number; source: 'ai' | 'manual' }
type DetectedCheckoutItem = { itemId: string; itemName: string; itemCode: string; confidence: number }
type CheckoutScanState = 'idle' | 'scanning' | 'found' | 'error'

const STEP_LABELS = ['Assign', 'Scan', 'Review', 'Confirm', 'Done']

function storeOneInventoryFallback() {
  return getInventory().filter((item) => item.location.toLowerCase().startsWith('store 1'))
}

export function CheckoutFlow({ onExit }: { onExit: () => void }) {
  const teams = getScanTeams()
  const [step, setStep] = useState<Step>(0)
  const [who, setWho] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [scan, setScan] = useState<ApiScan | null>(null)
  const [scanState, setScanState] = useState<CheckoutScanState>('idle')
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [detectedItem, setDetectedItem] = useState<DetectedCheckoutItem | null>(null)
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'synced' | 'saved-offline'>('idle')
  const [error, setError] = useState<string | null>(null)
  const transactionId = useRef<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [cameraLive, setCameraLive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualPickerOpen, setManualPickerOpen] = useState(false)
  const [manualInventory, setManualInventory] = useState<InventoryItem[]>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (scanImageUrl) URL.revokeObjectURL(scanImageUrl)
    }
  }, [scanImageUrl])

  useEffect(() => {
    if (!cameraLive || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    void video.play().catch(() => {
      setCameraError('Camera preview could not start. Upload a photo instead.')
    })
  }, [cameraLive])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraLive(false)
  }

  async function startCameraPreview() {
    setCameraError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not available in this browser. Upload a photo instead.')
      return
    }
    try {
      stopCameraStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraLive(true)
    } catch {
      stopCameraStream()
      setCameraError('Camera access was not available. Upload a photo instead.')
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !streamRef.current || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera preview is not ready. Upload a photo instead.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Could not capture from the camera. Upload a photo instead.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      setCameraError('Could not capture from the camera. Upload a photo instead.')
      return
    }
    const image = new File([blob], `checkout-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    stopCameraStream()
    await scanCheckoutItem(image)
  }

  function chooseUploadPhoto() {
    fileInputRef.current?.click()
  }

  function resetCurrentScan() {
    setScan(null)
    setScanState('idle')
    setScanError(null)
    setDetectedItem(null)
    setScanImageUrl(null)
  }

  async function scanCheckoutItem(image: File) {
    setScanImageUrl(URL.createObjectURL(image))
    setScan(null)
    setScanState('scanning')
    setScanError(null)
    setDetectedItem(null)
    setManualPickerOpen(false)

    try {
      const nextScan = await startCheckoutScan(image)
      setScan(nextScan)
      const hasDetection = nextScan.items.some((item) => item.status !== 'rejected')
      const detected = nextScan.items.find((item) => item.status !== 'rejected' && item.item)

      if (!detected) {
        setScanState('error')
        setScanError(hasDetection ? 'AI could not match this item to the catalog. Please scan again.' : 'No item detected. Try again.')
        return
      }

      if (detected.status === 'review_needed') {
        setScanState('error')
        setScanError('AI is not confident enough to check out this item. Please scan again.')
        return
      }

      setDetectedItem({
        itemId: detected.item!.id,
        itemName: detected.item!.name,
        itemCode: detected.item!.sku,
        confidence: Math.round(detected.confidence * 100),
      })
      setScanState('found')
    } catch (cause) {
      setScanState('error')
      setScanError(cause instanceof Error ? cause.message : 'The scan could not be processed')
    }
  }

  function addCartItem(itemId: string, itemName: string, itemCode: string, quantity: number, source: CartItem['source']) {
    setCart((prev) => {
      const found = prev.find((c) => c.itemId === itemId)
      if (found) {
        return prev.map((c) =>
          c.itemId === itemId
            ? {
                ...c,
                qty: c.qty + quantity,
                source: c.source === 'manual' || source === 'manual' ? 'manual' : 'ai',
              }
            : c,
        )
      }
      return [...prev, { itemId, itemName, itemCode, qty: quantity, source }]
    })
  }

  function addToCart() {
    if (!detectedItem) return
    addCartItem(detectedItem.itemId, detectedItem.itemName, detectedItem.itemCode, 1, 'ai')
    resetCurrentScan()
  }

  async function openManualPicker() {
    setManualPickerOpen(true)
    setManualError(null)
    if (manualInventory.length) return
    setManualLoading(true)
    try {
      setManualInventory(await fetchInventoryForStoreFromApi('store-1'))
    } catch {
      setManualInventory(storeOneInventoryFallback())
      setManualError('Showing the saved Store 1 catalogue while the live catalogue is unavailable.')
    } finally {
      setManualLoading(false)
    }
  }

  function addManualItem(item: InventoryItem, quantity: number) {
    addCartItem(item.id, item.name, item.code, quantity, 'manual')
    setManualPickerOpen(false)
    setManualError(null)
    resetCurrentScan()
  }

  function setQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0),
    )
  }

  function goBack() {
    setStep((currentStep) => Math.max(0, currentStep - 1) as Step)
  }

  async function confirmCheckout() {
    if (submitState === 'submitting' || !who) return
    setSubmitState('submitting')
    setError(null)
    transactionId.current ??= crypto.randomUUID()
    try {
      const items = cart.map((item) => {
        return { item_id: item.itemId, quantity: item.qty, unit: 'unit' }
      })
      const result = await submitOrQueue('checkout', {
        client_transaction_id: transactionId.current,
        store_id: 'store-1',
        user_name: who,
        items,
        notes: null,
      })
      setSubmitState(result.state)
      setStep(3)
    } catch (cause) {
      setSubmitState('idle')
      setError(cause instanceof Error ? cause.message : 'Check-out could not be completed')
    }
  }

  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan">
            Check Out
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {['Select User or Team', 'Scan Item', 'Check-out Summary', 'Confirm Check-out', 'Complete'][step]}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {step > 0 && step < 4 && (
            <button
              onClick={goBack}
              className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Back
            </button>
          )}
          <button
            onClick={onExit}
            className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* stepper */}
      <div className="mb-6 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all',
                i < step && 'bg-cyan text-primary-foreground',
                i === step && 'border-2 border-cyan text-cyan',
                i > step && 'border border-border text-muted-foreground',
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-all duration-500',
                  i < step ? 'bg-cyan' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: assign */}
      {step === 0 && (
        <GlassCard strong className="animate-rise p-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-cyan" />
            Who is taking these items?
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {teams.map((t) => (
              <button
                key={t}
                onClick={() => setWho(t)}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-4 text-left transition-all',
                  who === t
                    ? 'border-cyan/50 bg-cyan/10'
                    : 'border-border bg-secondary/40 hover:border-border/80',
                )}
              >
                <span className="font-medium">{t}</span>
                <span
                  className={cn(
                    'grid h-5 w-5 place-items-center rounded-full border',
                    who === t ? 'border-cyan bg-cyan text-primary-foreground' : 'border-border',
                  )}
                >
                  {who === t && <Check className="h-3 w-3" />}
                </span>
              </button>
            ))}
          </div>
          <button
            disabled={!who}
            onClick={() => setStep(1)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all enabled:hover:shadow-[0_0_30px_-4px_var(--cyan)] disabled:opacity-40"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </GlassCard>
      )}

      {/* Step 1: scan */}
      {step === 1 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <GlassCard strong className="animate-rise flex flex-col p-5">
            <div className="relative grid min-h-[280px] flex-1 place-items-center overflow-hidden rounded-xl border border-cyan/25 bg-[oklch(0.12_0.02_264)] py-14">
              {cameraLive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : scanImageUrl ? (
                <img
                  src={scanImageUrl}
                  alt="Selected checkout scan"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_24%_18%,oklch(0.28_0.05_240),oklch(0.12_0.024_264)_68%,oklch(0.08_0.018_264)_100%)]" />
              )}
              {scanState === 'scanning' && (
                <div className="absolute inset-x-8 top-0 h-[3px] animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-cyan to-transparent" />
              )}
              <div className="text-center">
                <ScanLine className="mx-auto h-10 w-10 text-cyan" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {scanState === 'scanning'
                    ? 'ORBIT is checking this item.'
                    : scanState === 'found'
                      ? 'Item ready to add.'
                      : scanState === 'error'
                        ? 'Scan another item image.'
                        : 'Point at an item barcode'}
                </p>
              </div>
            </div>


            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const image = event.target.files?.[0]
                if (image) {
                  stopCameraStream()
                  void scanCheckoutItem(image)
                }
                event.currentTarget.value = ''
              }}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={scanState === 'scanning'}
                onClick={() => cameraLive ? void capturePhoto() : void startCameraPreview()}
                className={cn(
                  'group inline-flex flex-1 items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all disabled:opacity-60',
                  cameraLive
                    ? 'cta-sheen-cyan hover:shadow-[0_0_30px_-4px_var(--cyan)]'
                    : 'cta-sheen hover:shadow-[0_0_34px_-4px_var(--violet)]',
                )}
              >
                <Camera className="h-5 w-5" />
                {scanState === 'scanning' ? 'Scanning' : cameraLive ? 'Capture Photo' : scanImageUrl ? 'Scan Again' : 'Start Camera'}
                {!cameraLive && scanState !== 'scanning' && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
              <button
                type="button"
                disabled={scanState === 'scanning'}
                onClick={chooseUploadPhoto}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-secondary/70 px-6 py-3.5 text-sm font-medium transition-colors hover:text-cyan disabled:opacity-60"
              >
                Upload Photo
              </button>
            </div>
            {cameraError && (
              <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {cameraError}
              </p>
            )}

            {scanState === 'scanning' && (
              <div className="mt-4 animate-rise rounded-xl border border-cyan/30 bg-cyan/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-cyan">
                    AI Scan Active
                  </span>
                  <StatusPill label="Checking" tone="cyan" pulse />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  ORBIT is analysing the selected item image.
                </p>
              </div>
            )}

            {scanState === 'error' && scanError && (
              <div className="mt-4 animate-rise rounded-xl border border-warning/30 bg-warning/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-warning">
                    AI needs review
                  </span>
                  <StatusPill label="Try Again" tone="warning" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{scanError}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void openManualPicker()}
                    className="cta-sheen-cyan inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_26px_-8px_var(--cyan)]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item Manually
                  </button>
                  <button
                    type="button"
                    onClick={resetCurrentScan}
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium transition-colors hover:text-cyan"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {scanState === 'found' && detectedItem && (
              <div className="mt-4 animate-rise rounded-xl border border-cyan/30 bg-cyan/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-cyan">
                    Item Found
                  </span>
                  <StatusPill label={`${detectedItem.confidence}% match`} tone="success" />
                </div>
                <p className="mt-2 font-display text-lg font-semibold">{detectedItem.itemName}</p>
                <p className="text-sm text-muted-foreground">Code {detectedItem.itemCode}</p>
                <button
                  onClick={addToCart}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan/15 px-4 py-2.5 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/25"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={() => void openManualPicker()}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-border bg-secondary/55 px-4 py-2.5 text-sm font-medium transition-colors hover:text-cyan"
                >
                  Add Item Manually
                </button>
              </div>
            )}

            {manualPickerOpen && (
              <CheckoutManualItemPicker
                items={manualInventory}
                loading={manualLoading}
                error={manualError}
                onAdd={addManualItem}
                onClose={() => setManualPickerOpen(false)}
              />
            )}
          </GlassCard>

          {/* Cart */}
          <GlassCard strong className="flex flex-col p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">In this check-out</h3>
              <span className="text-sm text-muted-foreground">{totalItems} items</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Assigned to <span className="text-foreground">{who}</span>
            </p>

            <div className="mt-4 flex flex-1 flex-col gap-2">
              {cart.length === 0 ? (
                <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Scan and add items to build the list.
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.itemId}
                    className="animate-rise flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.itemCode}
                        {c.source === 'manual' && <span className="text-cyan"> · Manual</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`Remove one ${c.itemName}`}
                        onClick={() => setQty(c.itemId, -1)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{c.qty}</span>
                      <button
                        aria-label={`Add one ${c.itemName}`}
                        onClick={() => setQty(c.itemId, 1)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setStep(2)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all enabled:hover:shadow-[0_0_30px_-4px_var(--cyan)] disabled:opacity-40"
            >
              Review Check-out
              <ArrowRight className="h-4 w-4" />
            </button>
          </GlassCard>
        </div>
      )}

      {/* Step 2: summary */}
      {step === 2 && (
        <GlassCard strong className="mx-auto max-w-xl animate-rise p-6">
          <h3 className="font-display text-lg font-semibold">Check-out Summary</h3>
          <p className="text-sm text-muted-foreground">
            Assigned to <span className="text-foreground">{who}</span>
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {cart.map((c) => (
              <div
                key={c.itemId}
                className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3.5"
              >
                <div>
                  <p className="text-sm font-medium">{c.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.itemCode}
                    {c.source === 'manual' && <span className="text-cyan"> · Manual</span>}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">Qty {c.qty}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-cyan/30 bg-cyan/10 p-4">
            <span className="font-medium">Total items</span>
            <span className="font-display text-2xl font-bold text-cyan">{totalItems}</span>
          </div>
          <button
            onClick={confirmCheckout}
            disabled={submitState === 'submitting'}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
          >
            {submitState === 'submitting' ? 'Saving…' : 'Confirm Check-out'}
          </button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </GlassCard>
      )}

      {/* Step 3 -> confirm animation */}
      {step === 3 && (
        <GlassCard strong className="mx-auto max-w-md animate-rise p-8 text-center">
          <div className="relative mx-auto grid h-16 w-16 place-items-center">
            <span
              className="absolute inset-0 rounded-full bg-cyan/40"
              style={{ animation: 'pulse-ring 1.6s ease-out infinite' }}
            />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-cyan/20 text-cyan">
              <Sparkles className="h-7 w-7" />
            </span>
          </div>
          <p className="mt-4 font-medium">
            {submitState === 'saved-offline'
              ? 'Saved on this device. It will sync when the connection returns.'
              : `Items assigned to ${who}. Inventory was updated once.`}
          </p>
          <button
            onClick={() => setStep(4)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
          >
            Finish
          </button>
        </GlassCard>
      )}

      {/* Step 4: complete */}
      {step === 4 && (
        <GlassCard strong className="mx-auto max-w-md animate-rise p-8 text-center">
          <div className="relative mx-auto grid h-20 w-20 place-items-center">
            <span
              className="absolute inset-0 rounded-full bg-success/40"
              style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <span className="relative grid h-20 w-20 place-items-center rounded-full bg-success/20 text-success">
              <Check className="h-10 w-10" />
            </span>
          </div>
          <h3 className="mt-5 font-display text-2xl font-bold">Check-out Complete</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalItems} items assigned to {who}. {submitState === 'saved-offline' ? 'Saved Offline.' : 'Synced.'}
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={onExit}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
            >
              Done
            </button>
            <Link
              href="/activity"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan"
            >
              View Activity
            </Link>
          </div>
        </GlassCard>
      )}
    </div>
  )
}

function CheckoutManualItemPicker({
  items,
  loading,
  error,
  onAdd,
  onClose,
}: {
  items: InventoryItem[]
  loading: boolean
  error: string | null
  onAdd: (item: InventoryItem, quantity: number) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const filtered = items
    .filter((item) => {
      const term = query.trim().toLowerCase()
      return !term || item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)
    })
    .slice(0, 6)
  const selected = items.find((item) => item.id === selectedId) ?? filtered[0] ?? null
  const safeQuantity = Math.max(1, quantity)

  return (
    <div className="mt-4 animate-rise rounded-xl border border-cyan/25 bg-cyan/[0.045] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Add Item Manually</h3>
          <p className="text-sm text-muted-foreground">
            Select an existing catalogue item for this check-out.
          </p>
        </div>
        <StatusPill label="Verified catalogue only" tone="cyan" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedId('')
            }}
            placeholder="Search item or SKU..."
            className="h-11 w-full rounded-xl border border-border bg-secondary/45 pl-10 pr-3 text-sm outline-none transition focus:border-cyan/50"
          />
        </label>
        <div className="flex items-center rounded-xl border border-border bg-secondary/45 p-1">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            aria-label="Decrease manual quantity"
            className="grid h-9 w-9 place-items-center rounded-lg text-lg font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            value={safeQuantity}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10)
              setQuantity(Number.isFinite(parsed) ? Math.max(1, parsed) : 1)
            }}
            aria-label="Manual quantity"
            className="h-9 w-14 bg-transparent text-center font-display text-base font-semibold text-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((value) => value + 1)}
            aria-label="Increase manual quantity"
            className="grid h-9 w-9 place-items-center rounded-lg text-lg font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            +
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-2">
        {loading ? (
          <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            Loading verified inventory catalogue...
          </div>
        ) : filtered.length ? (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                selected?.id === item.id
                  ? 'border-cyan/50 bg-cyan/10'
                  : 'border-border bg-secondary/35 hover:border-cyan/30',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {item.code} · {item.rack}
                  </p>
                </div>
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                    selected?.id === item.id ? 'border-cyan bg-cyan text-primary-foreground' : 'border-border',
                  )}
                >
                  {selected?.id === item.id && <Check className="h-3 w-3" />}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            No inventory item found. Try another SKU or item name.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!selected || loading}
          onClick={() => selected && onAdd(selected, safeQuantity)}
          className="cta-sheen-cyan inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all enabled:hover:shadow-[0_0_30px_-4px_var(--cyan)] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add Selected Item
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
