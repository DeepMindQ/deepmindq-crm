'use client';

import { useState, useCallback } from 'react';
import { PageTransition } from '@/components/ui/animated-components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { TabBar } from '@/components/ui/animated-components';
import { TABS, CATEGORY_LABELS, SERVICE_LINE_LIST, goldAlpha } from './knowledge-library/knowledge-types';
import { LibraryTab } from './knowledge-library/library-tab';
import { GraphTab } from './knowledge-library/graph-tab';
import { SearchTab } from './knowledge-library/search-tab';
import { CoverageTab } from './knowledge-library/coverage-tab';
import { UploadTab } from './knowledge-library/upload-tab';

interface KnowledgeScreenProps { navigateTo?: (screen: string) => void; }

export default function KnowledgeLibraryScreen({ navigateTo }: KnowledgeScreenProps) {
  const [activeTab, setActiveTab] = useState('library');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '', summary: '', content: '', category: 'service_line',
    serviceLine: '', targetIndustries: '', targetRoles: '', problems: '', evidence: '',
  });
  const gold = 'var(--color-gold-dim)';
  const goldLight = 'var(--color-gold)';

  const handleAddAsset = useCallback(async () => {
    if (!addForm.title.trim() || !addForm.summary.trim()) { toast.error('Title and summary are required'); return; }
    try {
      await fetch('/api/capabilities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, serviceLine: addForm.serviceLine || null, targetIndustries: addForm.targetIndustries || null, targetRoles: addForm.targetRoles || null, problems: addForm.problems || null, evidence: addForm.evidence || null, content: addForm.content || null }),
      });
      toast.success('Knowledge asset added');
      setAddDialogOpen(false);
      setAddForm({ title: '', summary: '', content: '', category: 'service_line', serviceLine: '', targetIndustries: '', targetRoles: '', problems: '', evidence: '' });
    } catch { toast.error('Failed to add asset'); }
  }, [addForm]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, boxShadow: `0 0 20px ${goldAlpha(0.2)}` }}><Brain className="w-5 h-5 text-white" /></div>
              Knowledge Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-[52px]">RAG-powered knowledge base that fuels personalized email generation</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-10 text-xs gap-1.5 border border-primary/30 text-primary hover:bg-primary/10 min-h-[44px]" variant="outline" onClick={() => setAddDialogOpen(true)}><Plus className="w-3.5 h-3.5" />Add Asset</Button>
          </div>
        </div>

        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'library' && <LibraryTab onAssetsChanged={() => {}} onSwitchTab={setActiveTab} />}
        {activeTab === 'graph' && <GraphTab />}
        {activeTab === 'search' && <SearchTab navigateTo={navigateTo} />}
        {activeTab === 'coverage' && <CoverageTab />}
        {activeTab === 'upload' && <UploadTab onAssetsChanged={() => {}} />}

        {/* Add Asset Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Knowledge Asset</DialogTitle><DialogDescription>Manually add a capability, case study, proof point, or other knowledge to the RAG engine.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Title *</Label><Input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} className="h-10 text-sm bg-background border-border" placeholder="e.g. AI & Machine Learning" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Category *</Label><Select value={addForm.category} onValueChange={v => setAddForm(f => ({ ...f, category: v }))}><SelectTrigger className="h-10 text-sm bg-background border-border"><SelectValue /></SelectTrigger><SelectContent className="bg-card border-border">{Object.entries(CATEGORY_LABELS).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>))}</SelectContent></Select></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Summary *</Label><Textarea value={addForm.summary} onChange={e => setAddForm(f => ({ ...f, summary: e.target.value }))} className="min-h-[60px] text-sm bg-background border-border" placeholder="Brief 1-2 sentence description" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Service Line</Label><Select value={addForm.serviceLine} onValueChange={v => setAddForm(f => ({ ...f, serviceLine: v === '__none__' ? '' : v }))}><SelectTrigger className="h-10 text-sm bg-background border-border"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent className="bg-card border-border"><SelectItem value="__none__" className="text-xs">None</SelectItem>{SERVICE_LINE_LIST.map(sl => (<SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Target Industries</Label><Input value={addForm.targetIndustries} onChange={e => setAddForm(f => ({ ...f, targetIndustries: e.target.value }))} className="h-10 text-sm bg-background border-border" placeholder="e.g. Financial Services, Healthcare" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Target Roles</Label><Input value={addForm.targetRoles} onChange={e => setAddForm(f => ({ ...f, targetRoles: e.target.value }))} className="h-10 text-sm bg-background border-border" placeholder="e.g. CTO, VP of Engineering" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Evidence</Label><Input value={addForm.evidence} onChange={e => setAddForm(f => ({ ...f, evidence: e.target.value }))} className="h-10 text-sm bg-background border-border" placeholder="e.g. 85% reduction, $2M savings" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Problems Solved</Label><Input value={addForm.problems} onChange={e => setAddForm(f => ({ ...f, problems: e.target.value }))} className="h-10 text-sm bg-background border-border" placeholder="e.g. data silos, legacy infrastructure" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Full Content</Label><Textarea value={addForm.content} onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))} className="min-h-[100px] text-sm bg-background border-border" placeholder="Detailed content for RAG retrieval..." /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button size="sm" className="text-xs gap-1.5" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: 'var(--dmq-black)' }} disabled={!addForm.title.trim() || !addForm.summary.trim()} onClick={handleAddAsset}><Plus className="w-3.5 h-3.5" />Add Asset</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
