import { AppShell } from '@/components/app-shell'
import { ItemDetail } from '@/components/inventory/item-detail'
import { inventory } from '@/lib/mock-data'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return inventory.map((item) => ({ id: item.id }))
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = inventory.find((i) => i.id === id)
  if (!item) notFound()

  return (
    <AppShell>
      <ItemDetail item={item} />
    </AppShell>
  )
}
