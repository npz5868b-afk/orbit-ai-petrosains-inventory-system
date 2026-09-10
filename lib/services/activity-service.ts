import { activities, activityStatusMeta } from '@/lib/mock-data'
import type { ActivityRecord, ActivityType } from '@/lib/types'

export type ActivityFilter = 'all' | ActivityType

export function getActivities() {
  return activities
}

export function getActivityStatusMeta() {
  return activityStatusMeta
}

export function filterActivities(filter: ActivityFilter, source: ActivityRecord[] = activities): ActivityRecord[] {
  if (filter === 'all') return source
  return source.filter((activity) => activity.type === filter)
}
