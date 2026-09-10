import { AppShell } from '@/components/app-shell'
import { ItemDetail } from '@/components/inventory/item-detail'
import { getInventory, getInventoryItem } from '@/lib/services/inventory-service'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return getInventory().map((item) => ({ id: item.id }))
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = getInventoryItem(id)
  if (!item) notFound()

  return (
    <AppShell>
      <ItemDetail item={item} />
    </AppShell>
  )
}
