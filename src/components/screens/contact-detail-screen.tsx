'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  User, Mail, Phone, Building2, Briefcase, Globe, Linkedin, Twitter,
  Loader2, Zap, BrainCircuit, Clock, Save, Pencil, MessageSquare, StickyNote,
} from 'lucide-react';

const contact = {
  name: 'Sarah Chen',
  title: 'Chief Executive Officer',
  email: 'sarah.chen@acmecorp.com',
  phone: '+1 (415) 555-0192',
  company: 'Acme Corp',
  domain: 'acmecorp.com',
  role: 'Decision Maker',
  department: 'Executive',
  location: 'San Francisco, CA',
  linkedin: 'linkedin.com/in/sarahchen',
  twitter: '@sarahchen_ceo',
};

const interactions = [
  { date: 'Jan 12', type: 'Email', summary: 'Discussed Q2 expansion plans and potential partnership opportunities.', direction: 'inbound' },
  { date: 'Jan 05', type: 'Meeting', summary: 'Discovery call — reviewed Acme\'s current tech stack and pain points.', direction: 'outbound' },
  { date: 'Dec 18', type: 'Email', summary: 'Follow-up on initial outreach with product overview deck.', direction: 'outbound' },
  { date: 'Dec 10', type: 'Call', summary: 'Brief introductory call, expressed interest in analytics solutions.', direction: 'inbound' },
];

const associatedSignals = [
  { id: 'SIG-007', title: 'Executive leadership change at Acme', type: 'Leadership', confidence: 92, time: '1w ago' },
  { id: 'SIG-012', title: 'Sarah Chen speaking at SaaStr Annual', type: 'Event', confidence: 88, time: '2w ago' },
];

const associatedInsights = [
  { title: 'Active Buying Cycle', detail: 'Acme is evaluating cloud infrastructure solutions. Sarah is the economic buyer.', confidence: 'high' as const },
  { title: 'Relationship Warmth', detail: 'Strong rapport established through 4 interactions in the past month.', confidence: 'high' as const },
];

export default function ContactDetail() {
  const [loading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('Sarah is the primary decision maker at Acme. She\'s very interested in AI-driven analytics. Key concern: data migration timeline. Next step: send case study from similar SaaS customer.');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile Card + Contact Info */}
        <div className="space-y-4">
          {/* Profile Card */}
          <Card className="py-0 gap-0">
            <CardContent className="p-6 text-center">
              <div className="size-16 rounded-full mx-auto flex items-center justify-center text-lg font-bold" style={{ backgroundColor: tokens.accent.subtle, color: tokens.accent.primary }}>
                {contact.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h2 className="text-lg font-bold mt-3" style={{ color: tokens.text.primary }}>{contact.name}</h2>
              <p className="text-sm" style={{ color: tokens.text.secondary }}>{contact.title}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Building2 className="size-3" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.text.secondary }}>{contact.company}</span>
              </div>
              <Badge className="mt-2 border-emerald-500/40 bg-emerald-500/15 text-emerald-400">{contact.role}</Badge>
            </CardContent>
          </Card>

          {/* Contact Info Sidebar */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <Mail className="size-4" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.text.primary }}>{contact.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="size-4" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.text.primary }}>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Globe className="size-4" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.accent.primary }}>{contact.domain}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Briefcase className="size-4" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.text.secondary }}>{contact.department}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Linkedin className="size-4" style={{ color: '#0A66C2' }} />
                <span className="text-sm" style={{ color: tokens.accent.primary }}>{contact.linkedin}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Twitter className="size-4" style={{ color: tokens.text.muted }} />
                <span className="text-sm" style={{ color: tokens.accent.primary }}>{contact.twitter}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Interactions, Signals, Insights, Notes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Interactions */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="size-4" style={{ color: tokens.accent.primary }} />
                Recent Interactions
              </CardTitle>
              <CardDescription>{interactions.length} interactions</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="max-h-[260px] overflow-y-auto">
                {interactions.map((int, i) => (
                  <div key={i} className="flex items-start gap-3 px-6 py-3 border-b last:border-b-0" style={{ borderColor: tokens.borderFaint }}>
                    <div className="rounded-lg p-1.5 mt-0.5 shrink-0" style={{ backgroundColor: int.direction === 'inbound' ? tokens.confidence.high.bg : tokens.accent.subtle }}>
                      <MessageSquare className="size-3" style={{ color: int.direction === 'inbound' ? tokens.confidence.high.value : tokens.accent.primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-xs">{int.type}</Badge>
                        <Badge className={int.direction === 'inbound' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-xs' : 'border-sky-500/40 bg-sky-500/15 text-sky-400 text-xs'}>
                          {int.direction}
                        </Badge>
                        <span className="text-xs" style={{ color: tokens.text.muted }}>{int.date}</span>
                      </div>
                      <p className="text-sm" style={{ color: tokens.text.secondary }}>{int.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Associated Signals */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Zap className="size-3.5" style={{ color: tokens.domain.opportunity }} /> Associated Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {associatedSignals.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm" style={{ color: tokens.text.primary }}>{s.title}</p>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>{s.type} · {s.time}</p>
                  </div>
                  <Badge className={s.confidence >= 90 ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-amber-500/40 bg-amber-500/15 text-amber-400'}>
                    {s.confidence}%
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Associated Insights */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <BrainCircuit className="size-3.5" style={{ color: tokens.domain.value }} /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {associatedInsights.map((ins, i) => (
                <div key={i} className="rounded-lg border p-3" style={{ borderColor: tokens.borderFaint }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{ins.title}</p>
                    <Badge className={ins.confidence === 'high' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-amber-500/40 bg-amber-500/15 text-amber-400'}>{ins.confidence}</Badge>
                  </div>
                  <p className="text-xs" style={{ color: tokens.text.secondary }}>{ins.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="py-0 gap-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <StickyNote className="size-3.5" /> Notes
                </CardTitle>
                {!editing && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                    <Pencil className="size-3" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                disabled={!editing}
                placeholder="Add notes..."
              />
              {editing && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSave} className="gap-1.5">
                    <Save className="size-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              )}
              {saved && <span className="text-xs text-emerald-400">Saved successfully!</span>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
