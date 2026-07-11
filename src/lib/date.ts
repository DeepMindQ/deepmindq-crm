import { formatDistanceToNow } from 'date-fns'

export function relativeDate(dateStr: string | Date): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

export function formatDate(dateStr: string | Date, _format = 'MMM d, yyyy'): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}