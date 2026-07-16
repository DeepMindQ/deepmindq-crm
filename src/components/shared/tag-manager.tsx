'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { X, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagItem {
  id: string
  name: string
  color: string
}

interface TagManagerProps {
  entityType: 'company' | 'contact'
  entityId: string
  existingTags?: TagItem[]
  onTagsChange?: (tags: TagItem[]) => void
}

const TAG_COLORS = [
  { name: 'gray', bg: 'bg-gray-100 text-gray-800 dark:bg-gray-50 dark:text-gray-200', dot: 'bg-gray-400' },
  { name: 'red', bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-600', dot: 'bg-red-500' },
  { name: 'amber', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-700', dot: 'bg-amber-500' },
  { name: 'green', bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
  { name: 'emerald', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-700', dot: 'bg-emerald-500' },
  { name: 'violet', bg: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-700', dot: 'bg-violet-500' },
  { name: 'pink', bg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-700', dot: 'bg-pink-500' },
] as const

function getColorClasses(color: string) {
  return TAG_COLORS.find((c) => c.name === color) || TAG_COLORS[0]
}

export function TagManager({
  entityType,
  entityId,
  existingTags = [],
  onTagsChange,
}: TagManagerProps) {
  const [allTags, setAllTags] = useState<TagItem[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState('gray')
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  const syncTags = useCallback(
    (updatedTagIds: string[]) => {
      setLoading(true)
      fetch('/api/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagIds: updatedTagIds,
          entity: entityType,
          entityId,
        }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.data && onTagsChange) {
            const synced = json.data.map((a: { tag: TagItem }) => a.tag)
            onTagsChange(synced)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    },
    [entityType, entityId, onTagsChange],
  )

  const handlePopoverOpenChange = useCallback(
    (open: boolean) => {
      setPopoverOpen(open)
      if (open) {
        setSearchQuery('')
        setIsCreating(false)
        setNewTagName('')
        fetch('/api/tags')
          .then((r) => r.json())
          .then((json) => {
            if (json.data) setAllTags(json.data)
          })
          .catch(() => {})
      }
    },
    [],
  )

  const removeTag = useCallback(
    (tagId: string) => {
      const updatedTagIds = existingTags
        .filter((t) => t.id !== tagId)
        .map((t) => t.id)
      syncTags(updatedTagIds)
    },
    [existingTags, syncTags],
  )

  const addTag = useCallback(
    (tag: TagItem) => {
      if (existingTags.some((t) => t.id === tag.id)) return
      const updatedTagIds = [...existingTags.map((t) => t.id), tag.id]
      syncTags(updatedTagIds)
      setPopoverOpen(false)
    },
    [existingTags, syncTags],
  )

  const createAndAddTag = useCallback(async () => {
    const name = newTagName.trim()
    if (!name) return

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: selectedColor }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        const newTag = json.data as TagItem
        setAllTags((prev) =>
          [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)),
        )
        addTag(newTag)
        setNewTagName('')
        setIsCreating(false)
      }
    } catch {
      // silently fail
    }
  }, [newTagName, selectedColor, addTag])

  const filteredTags = allTags.filter((tag) => {
    const matchesSearch =
      !searchQuery ||
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    const notAssigned = !existingTags.some((t) => t.id === tag.id)
    return matchesSearch && notAssigned
  })

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Existing tags */}
      {existingTags.map((tag) => {
        const colorClasses = getColorClasses(tag.color)
        return (
          <Badge
            key={tag.id}
            variant="secondary"
            className={cn(
              'gap-1.5 px-2.5 py-1 text-xs font-medium transition-all',
              colorClasses.bg,
              loading && 'opacity-60',
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full inline-block',
                colorClasses.dot,
              )}
            />
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag.id)
              }}
              className="ml-0.5 hover:bg-gray-100 rounded-full p-0.5 transition-colors"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )
      })}

      {/* Add tag button */}
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-7 gap-1 text-xs', loading && 'opacity-60')}
            disabled={loading}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add tag</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Tag list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => {
                const colorClasses = getColorClasses(tag.color)
                return (
                  <button
                    key={tag.id}
                    onClick={() => addTag(tag)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full shrink-0',
                        colorClasses.dot,
                      )}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                )
              })
            ) : (
              !isCreating && (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                  {searchQuery
                    ? 'No matching tags found'
                    : 'No tags available'}
                </p>
              )
            )}
          </div>

          {/* Create new tag */}
          <div className="border-t p-2">
            {isCreating ? (
              <div className="space-y-2">
                <Input
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createAndAddTag()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <div className="flex items-center gap-1.5">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-all',
                        c.dot,
                        selectedColor === c.name
                          ? 'border-foreground scale-110'
                          : 'border-transparent',
                      )}
                      aria-label={`Color: ${c.name}`}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={createAndAddTag}
                    disabled={!newTagName.trim()}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Create new tag
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
