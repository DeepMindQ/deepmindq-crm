'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CalendarDays,
  Mail,
  Phone,
  MessageSquare,
  Video,
  Plus,
  X,
  Check,
  Clock,
  User,
} from 'lucide-react';

/* ── Types ── */
type TouchType = 'email' | 'call' | 'social' | 'meeting';

interface PlannedTouch {
  id: string;
  contactId: string;
  week: number;
  day: number;
  type: TouchType;
  title: string;
  status: 'planned' | 'completed' | 'skipped';
}

interface Contact {
  id: string;
  name: string;
  company: string;
  avatar: string;
}

/* ── Constants ── */
const TOUCH_TYPES: { type: TouchType; icon: typeof Mail; label: string; color: string }[] = [
  { type: 'email', icon: Mail, label: 'Email', color: tokens.accent.DEFAULT },
  { type: 'call', icon: Phone, label: 'Call', color: tokens.domain.opportunity },
  { type: 'social', icon: MessageSquare, label: 'Social', color: tokens.domain.reasoning },
  { type: 'meeting', icon: Video, label: 'Meeting', color: tokens.confidence.high.value },
];

const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/* ── Mock data ── */
const CONTACTS: Contact[] = [
  { id: '1', name: 'Marcus Johnson', company: 'Acme Corp', avatar: 'MJ' },
  { id: '2', name: 'Lisa Park', company: 'TechVenture Inc', avatar: 'LP' },
  { id: '3', name: 'Anna Lee', company: 'DataFlow Systems', avatar: 'AL' },
  { id: '4', name: 'Amy Wong', company: 'CloudPeak', avatar: 'AW' },
  { id: '5', name: 'Tom Wright', company: 'TechVenture Inc', avatar: 'TW' },
];

const INITIAL_TOUCHES: PlannedTouch[] = [
  { id: 't1', contactId: '1', week: 1, day: 1, type: 'email', title: 'Intro email with value prop', status: 'completed' },
  { id: 't2', contactId: '1', week: 1, day: 4, type: 'social', title: 'LinkedIn engagement', status: 'completed' },
  { id: 't3', contactId: '1', week: 2, day: 2, type: 'call', title: 'Follow-up phone call', status: 'planned' },
  { id: 't4', contactId: '1', week: 3, day: 1, type: 'email', title: 'Case study share', status: 'planned' },
  { id: 't5', contactId: '1', week: 4, day: 3, type: 'meeting', title: 'Demo meeting', status: 'planned' },
  { id: 't6', contactId: '2', week: 1, day: 2, type: 'email', title: 'Personalized outreach', status: 'completed' },
  { id: 't7', contactId: '2', week: 2, day: 3, type: 'call', title: 'Discovery call', status: 'planned' },
  { id: 't8', contactId: '2', week: 3, day: 5, type: 'social', title: 'Share relevant content', status: 'planned' },
  { id: 't9', contactId: '3', week: 1, day: 3, type: 'email', title: 'Data intelligence intro', status: 'completed' },
  { id: 't10', contactId: '3', week: 2, day: 1, type: 'call', title: 'Technical discussion', status: 'planned' },
  { id: 't11', contactId: '3', week: 2, day: 4, type: 'meeting', title: 'Technical deep-dive', status: 'planned' },
  { id: 't12', contactId: '3', week: 3, day: 2, type: 'email', title: 'Follow-up summary', status: 'planned' },
  { id: 't13', contactId: '4', week: 1, day: 5, type: 'email', title: 'Cloud migration value prop', status: 'planned' },
  { id: 't14', contactId: '4', week: 2, day: 2, type: 'social', title: 'LinkedIn connection', status: 'planned' },
  { id: 't15', contactId: '4', week: 3, day: 4, type: 'call', title: 'Qualification call', status: 'planned' },
  { id: 't16', contactId: '5', week: 1, day: 1, type: 'email', title: 'Exec intro email', status: 'planned' },
  { id: 't17', contactId: '5', week: 2, day: 3, type: 'call', title: 'Strategy alignment call', status: 'planned' },
  { id: 't18', contactId: '5', week: 3, day: 1, type: 'meeting', title: 'Executive meeting', status: 'planned' },
  { id: 't19', contactId: '5', week: 4, day: 2, type: 'email', title: 'Post-meeting recap', status: 'planned' },
];

/* ── Component ── */
export default function ConversationPlannerScreen() {
  const [touches, setTouches] = useState<PlannedTouch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addContactId, setAddContactId] = useState('1');
  const [addWeek, setAddWeek] = useState(1);
  const [addDay, setAddDay] = useState(1);
  const [addType, setAddType] = useState<TouchType>('email');
  const [addTitle, setAddTitle] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setTouches(INITIAL_TOUCHES); setLoading(false); }, 500);
    return () => clearTimeout(t);
  }, []);

  const getTouchForCell = (contactId: string, week: number, day: number) => {
    return touches.find((t) => t.contactId === contactId && t.week === week && t.day === day);
  };

  const toggleTouchStatus = (touchId: string) => {
    setTouches((prev) => prev.map((t) => {
      if (t.id !== touchId) return t;
      if (t.status === 'planned') return { ...t, status: 'completed' as const };
      if (t.status === 'completed') return { ...t, status: 'skipped' as const };
      return { ...t, status: 'planned' as const };
    }));
  };

  const handleAddTouch = () => {
    if (!addTitle.trim()) return;
    const newTouch: PlannedTouch = {
      id: `t${Date.now()}`, contactId: addContactId, week: addWeek, day: addDay, type: addType, title: addTitle, status: 'planned',
    };
    setTouches((prev) => [...prev, newTouch]);
    setModalOpen(false);
    setAddTitle('');
  };

  const getTouchIcon = (type: TouchType) => TOUCH_TYPES.find((t) => t.type === type);

  const statusStyles: Record<string, string> = {
    planned: 'opacity-100',
    completed: 'opacity-60',
    skipped: 'opacity-40 line-through',
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: tokens.border.default }}>
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5" style={{ color: tokens.domain.action }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>Conversation Planner</h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>Plan multi-touch conversation sequences across contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs" style={{ color: tokens.text.muted }}>
            <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: tokens.confidence.high.value }} /> {touches.filter((t) => t.status === 'completed').length} completed</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {touches.filter((t) => t.status === 'planned').length} planned</span>
          </div>
          <Button onClick={() => setModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Add Touch
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 border-b" style={{ borderColor: tokens.borderFaint }}>
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Touch types:</span>
        {TOUCH_TYPES.map((tt) => (
          <span key={tt.type} className="flex items-center gap-1.5 text-xs" style={{ color: tt.color }}>
            <tt.icon className="w-3.5 h-3.5" /> {tt.label}
          </span>
        ))}
      </div>

      {/* Timeline Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Column headers: Weeks and days */}
          <div className="sticky top-0 z-10" style={{ backgroundColor: tokens.surface.primary }}>
            <div className="flex border-b" style={{ borderColor: tokens.border.default }}>
              <div className="w-52 shrink-0 px-4 py-3 border-r" style={{ borderColor: tokens.border.default }}>
                <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Contact / Account</span>
              </div>
              {WEEKS.map((_, wi) => (
                <div key={wi} className="flex-1 min-w-[400px]">
                  <div className="text-center text-xs font-semibold py-2 border-b" style={{ color: tokens.text.primary, borderColor: tokens.border.default }}>
                    {WEEKS[wi]}
                  </div>
                  <div className="flex">
                    {DAYS.map((day, di) => (
                      <div key={di} className="flex-1 text-center text-xs py-2 border-r last:border-r-0" style={{ color: tokens.text.muted, borderColor: tokens.borderFaint }}>
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {CONTACTS.map((contact) => (
            <div key={contact.id} className="flex border-b" style={{ borderColor: tokens.borderFaint }}>
              {/* Contact cell */}
              <div className="w-52 shrink-0 px-4 py-3 border-r flex items-center gap-3" style={{ borderColor: tokens.border.default }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: tokens.accent.subtle, color: tokens.accent.DEFAULT }}>
                  {contact.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: tokens.text.primary }}>{contact.name}</p>
                  <p className="text-xs truncate" style={{ color: tokens.text.muted }}>{contact.company}</p>
                </div>
              </div>

              {/* Timeline cells */}
              {WEEKS.map((_, wi) => (
                <div key={wi} className="flex-1 min-w-[400px] flex">
                  {DAYS.map((_, di) => {
                    const touch = getTouchForCell(contact.id, wi + 1, di + 1);
                    const touchCfg = touch ? getTouchIcon(touch.type) : null;
                    return (
                      <div
                        key={di}
                        className="flex-1 min-h-[64px] p-1.5 border-r last:border-r-0 hover:bg-muted/30 transition-colors"
                        style={{ borderColor: tokens.borderFaint }}
                      >
                        {touch && touchCfg && (
                          <button
                            className={`w-full h-full rounded-md p-1.5 text-left transition-all ${statusStyles[touch.status]}`}
                            style={{
                              backgroundColor: `${touchCfg.color}10`,
                              border: `1px solid ${touchCfg.color}30`,
                            }}
                            onClick={() => toggleTouchStatus(touch.id)}
                            title={touch.title}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <touchCfg.icon className="w-3 h-3 shrink-0" style={{ color: touchCfg.color }} />
                              {touch.status === 'completed' && <Check className="w-3 h-3 ml-auto" style={{ color: tokens.confidence.high.value }} />}
                              {touch.status === 'skipped' && <X className="w-3 h-3 ml-auto" style={{ color: tokens.confidence.low.value }} />}
                            </div>
                            <p className="text-xs leading-tight truncate" style={{ color: tokens.text.primary }}>{touch.title}</p>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Add Touch Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add Planned Touch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Contact</Label>
              <select value={addContactId} onChange={(e) => setAddContactId(e.target.value)} className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: tokens.border.default, color: tokens.text.primary }}>
                {CONTACTS.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.company}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Week</Label>
                <select value={addWeek} onChange={(e) => setAddWeek(Number(e.target.value))} className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: tokens.border.default, color: tokens.text.primary }}>
                  {WEEKS.map((w, i) => <option key={i} value={i + 1}>{w}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Day</Label>
                <select value={addDay} onChange={(e) => setAddDay(Number(e.target.value))} className="w-full h-9 rounded-md border bg-transparent px-3 text-sm" style={{ borderColor: tokens.border.default, color: tokens.text.primary }}>
                  {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Touch Type</Label>
              <div className="flex gap-2">
                {TOUCH_TYPES.map((tt) => (
                  <Button key={tt.type} variant={addType === tt.type ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setAddType(tt.type)}>
                    <tt.icon className="w-3.5 h-3.5 mr-1" /> {tt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="e.g. Follow-up email with case study" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTouch} disabled={!addTitle.trim()}>Add Touch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
