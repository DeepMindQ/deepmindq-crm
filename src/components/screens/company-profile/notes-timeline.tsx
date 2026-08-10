'use client'

import { formatDistanceToNow } from 'date-fns'
import { StickyNote, Clock, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, getActivityIcon } from '@/components/shared/design-system'
import type { CompanyNote, TimelineEntry } from '@/lib/types'

export function NotesTimeline({
  notes, timeline, onAddNote, onDeleteNote,
}: {
  notes: CompanyNote[]
  timeline: TimelineEntry[]
  onAddNote: () => void
  onDeleteNote: (id: string) => void
}) {
  return (
    <>
      {/* Notes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="size-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-gray-900">Notes<span className="text-xs font-normal text-gray-500 ml-1.5">({notes.length})</span></h3>
          </div>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs text-xs" onClick={onAddNote}>
            <Plus className="size-3.5 mr-1.5" /> Add Note
          </Button>
        </div>
        {notes.length === 0 ? (
          <EmptyState icon={StickyNote} title="No notes yet" description="Add notes to track conversations and insights." actionLabel="Add Note" onAction={onAddNote} />
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-gray-200" />
            <div className="space-y-3">
              {notes.map((n, idx) => (
                <div key={n.id} className="relative flex items-start gap-4 slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div className="absolute -left-6 top-2 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                  <div className="flex-1 rounded-xl bg-white p-4 card-rest min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap flex-1">{n.body}</p>
                      <button onClick={() => onDeleteNote(n.id)} className="shrink-0 text-gray-700 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50" aria-label="Delete note" title="Delete note">
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {n.noteType && <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[11px] font-normal border-0 rounded-md capitalize">{n.noteType}</Badge>}
                      <span className="text-[11px] text-gray-600">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      {timeline.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Activity<span className="text-xs font-normal text-gray-500 ml-1.5">({timeline.length})</span></h3>
          </div>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-gray-200" />
            <div className="space-y-3">
              {timeline.slice(0, 10).map((t, idx) => {
                const iconData = getActivityIcon(t.action)
                const Icon = iconData.icon
                return (
                  <div key={t.id} className="relative flex items-start gap-4 slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                    <div className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${iconData.bg}`}><Icon className={`size-3.5 ${iconData.color}`} /></div>
                    <div className="min-w-0 flex-1 rounded-lg bg-white p-3.5 card-rest">
                      <p className="text-sm font-medium text-gray-900 capitalize">{t.action.replace(/_/g, ' ')}</p>
                      {t.details && <p className="text-xs text-gray-500 mt-0.5">{t.details}</p>}
                      <p className="text-[11px] text-gray-600 mt-1">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
