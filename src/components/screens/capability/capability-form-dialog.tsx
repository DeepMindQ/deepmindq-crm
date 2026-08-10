'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Capability, CapabilityFormState } from './capability-shared';
import { GlassDialog, TagInput } from './capability-shared';

interface CapabilityFormDialogProps {
  open: boolean;
  editingId: string | null;
  form: CapabilityFormState;
  saving: boolean;
  items: Capability[];
  allTags: string[];
  onSave: () => void;
  onClose: () => void;
  onFormChange: (updater: (prev: CapabilityFormState) => CapabilityFormState) => void;
}

export function CapabilityFormDialog({
  open, editingId, form, saving, items, allTags, onSave, onClose, onFormChange,
}: CapabilityFormDialogProps) {
  if (!open) return null;

  return (
    <GlassDialog
      title={editingId ? 'Edit Capability' : 'New Capability'}
      subtitle={editingId ? 'Update the details of this capability' : 'Add a new knowledge asset to the library'}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-sm">
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="text-sm shadow-lg shadow-primary/10">
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" />
            ) : null}
            {editingId ? 'Update' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-title" className="text-sm">Title <span className="text-red-600">*</span></Label>
          <Input
            id="cap-title"
            value={form.title}
            onChange={e => onFormChange(f => ({ ...f, title: e.target.value }))}
            placeholder="Capability title"
            className="h-10 text-sm bg-gray-50 border-gray-200 focus:border-primary/40"
          />
        </div>

        {/* Category + Active */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Category <span className="text-red-600">*</span></Label>
            <Select value={form.category} onValueChange={v => onFormChange(f => ({ ...f, category: v }))}>
              <SelectTrigger className="h-10 text-sm bg-gray-50 border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service_line">Service Line</SelectItem>
                <SelectItem value="case_study">Case Study</SelectItem>
                <SelectItem value="proof_point">Proof Point</SelectItem>
                <SelectItem value="objection_response">Objection Response</SelectItem>
                <SelectItem value="cta">CTA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch
              checked={form.isActive}
              onCheckedChange={v => onFormChange(f => ({ ...f, isActive: v }))}
            />
            <Label className="text-sm text-muted-foreground">Active</Label>
          </div>
        </div>

        {/* Service Line */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-sl" className="text-sm">Service Line</Label>
          <Input
            id="cap-sl"
            value={form.serviceLine}
            onChange={e => onFormChange(f => ({ ...f, serviceLine: e.target.value }))}
            placeholder="e.g., AI & Data, Cloud & Infrastructure"
            className="h-10 text-sm bg-gray-50 border-gray-200 focus:border-primary/40"
          />
        </div>

        {/* Parent Asset dropdown */}
        {(form.category === 'case_study' || form.category === 'proof_point' || form.category === 'objection_response') && (
          <div className="space-y-1.5">
            <Label className="text-sm">Parent Asset <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={form.parentAssetId} onValueChange={v => onFormChange(f => ({ ...f, parentAssetId: v }))}>
              <SelectTrigger className="h-10 text-sm bg-gray-50 border-gray-200">
                <SelectValue placeholder="Select a parent service line..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {items
                  .filter(i => i.category === 'service_line')
                  .map(sl => (
                    <SelectItem key={sl.id} value={sl.id}>{sl.title}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Link this asset to a parent service line</p>
          </div>
        )}

        {/* Tag Input */}
        <TagInput tags={form.tags} onChange={tags => onFormChange(f => ({ ...f, tags }))} allTags={allTags} />

        {/* Target Company Sizes */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-cs" className="text-sm">Target Company Sizes</Label>
          <Input
            id="cap-cs"
            value={form.targetCompanySizes}
            onChange={e => onFormChange(f => ({ ...f, targetCompanySizes: e.target.value }))}
            placeholder="Comma-separated: Startup, Mid-Market, Enterprise"
            className="h-10 text-sm bg-gray-50 border-gray-200 focus:border-primary/40"
          />
        </div>

        {/* Target Industries + Target Roles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cap-ind" className="text-sm">Target Industries</Label>
            <Input
              id="cap-ind"
              value={form.targetIndustries}
              onChange={e => onFormChange(f => ({ ...f, targetIndustries: e.target.value }))}
              placeholder="Comma-separated"
              className="h-10 text-sm bg-gray-50 border-gray-200 focus:border-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cap-roles" className="text-sm">Target Roles</Label>
            <Input
              id="cap-roles"
              value={form.targetRoles}
              onChange={e => onFormChange(f => ({ ...f, targetRoles: e.target.value }))}
              placeholder="Comma-separated"
              className="h-10 text-sm bg-gray-50 border-gray-200 focus:border-primary/40"
            />
          </div>
        </div>

        {/* Problems Addressed */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-problems" className="text-sm">Problems Addressed</Label>
          <Textarea
            id="cap-problems"
            value={form.problems}
            onChange={e => onFormChange(f => ({ ...f, problems: e.target.value }))}
            placeholder="Key problems this capability solves"
            className="text-sm min-h-[60px] bg-gray-50 border-gray-200 focus:border-primary/40"
            rows={2}
          />
        </div>

        {/* Evidence */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-evidence" className="text-sm">Evidence / Proof</Label>
          <Textarea
            id="cap-evidence"
            value={form.evidence}
            onChange={e => onFormChange(f => ({ ...f, evidence: e.target.value }))}
            placeholder="Supporting evidence, metrics, or proof points"
            className="text-sm min-h-[60px] bg-gray-50 border-gray-200 focus:border-primary/40"
            rows={2}
          />
        </div>

        {/* Summary */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-summary" className="text-sm">Summary <span className="text-red-600">*</span></Label>
          <Textarea
            id="cap-summary"
            value={form.summary}
            onChange={e => onFormChange(f => ({ ...f, summary: e.target.value }))}
            placeholder="Brief summary of the capability"
            className="text-sm min-h-[80px] bg-gray-50 border-gray-200 focus:border-primary/40"
            rows={3}
          />
        </div>

        {/* Full Content */}
        <div className="space-y-1.5">
          <Label htmlFor="cap-content" className="text-sm">Full Content</Label>
          <Textarea
            id="cap-content"
            value={form.content}
            onChange={e => onFormChange(f => ({ ...f, content: e.target.value }))}
            placeholder="Detailed content (optional)"
            className="text-sm min-h-[100px] bg-gray-50 border-gray-200 focus:border-primary/40"
            rows={4}
          />
        </div>
      </div>
    </GlassDialog>
  );
}
