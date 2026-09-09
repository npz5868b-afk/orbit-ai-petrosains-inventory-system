import { AppShell } from '@/components/app-shell'
import { ScanExperience } from '@/components/scan/scan-experience'
import { Suspense } from 'react'

export default function ScanPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ScanExperience />
      </Suspense>
    </AppShell>
  )
}
