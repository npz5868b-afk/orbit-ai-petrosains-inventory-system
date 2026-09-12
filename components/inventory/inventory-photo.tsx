'use client'

import type { InventoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'
import { useState } from 'react'

type InventoryPhotoProps = {
  item: Pick<InventoryItem, 'code' | 'imageUrl' | 'name'>
  variant?: 'thumb' | 'detail'
  className?: string
}

export function InventoryPhoto({ item, variant = 'thumb', className }: InventoryPhotoProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(item.imageUrl && !failed)

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/45',
        variant === 'thumb'
          ? 'grid h-16 w-16 place-items-center sm:h-[72px] sm:w-[72px]'
          : 'aspect-[4/3] w-full',
        className,
      )}
    >
      {showImage ? (
        <img
          src={item.imageUrl ?? undefined}
          alt={`${item.name} representative photo`}
          className="h-full w-full object-contain"
          loading={variant === 'thumb' ? 'lazy' : 'eager'}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,oklch(0.25_0.05_230),oklch(0.13_0.024_264))] text-center">
          <div>
            <Package className="mx-auto h-5 w-5 text-cyan/70" />
            <p className="mt-1 font-mono text-xs font-semibold text-muted-foreground">{item.code}</p>
          </div>
        </div>
      )}
    </div>
  )
}
