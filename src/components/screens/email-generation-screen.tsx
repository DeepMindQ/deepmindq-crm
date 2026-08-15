'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/ui/screen-states';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Send,
  CalendarClock,
  Mail,
  Building2,
  User,
  PenLine,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

/* ── Types ── */
interface CompanyOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  name: string;
  title: string;
  companyId: string;
}

/* ── Mock data ── */
const COMPANIES: CompanyOption[] = [
  { id: '1', name: 'Acme Corp' },
  { id: '2', name: 'TechVenture Inc' },
  { id: '3', name: 'DataFlow Systems' },
  { id: '4', name: 'CloudPeak' },
  { id: '5', name: 'HealthFirst' },
];

const CONTACTS: ContactOption[] = [
  { id: 'c1', name: 'Marcus Johnson', title: 'CIO', companyId: '1' },
  { id: 'c2', name: 'Sarah Chen', title: 'VP Engineering', companyId: '1' },
  { id: 'c3', name: 'Emily Rodriguez', title: 'Head of Procurement', companyId: '1' },
  { id: 'c4', name: 'Lisa Park', title: 'VP Sales', companyId: '2' },
  { id: 'c5', name: 'Tom Wright', title: 'CTO', companyId: '2' },
  { id: 'c6', name: 'Anna Lee', title: 'VP Data', companyId: '3' },
  { id: 'c7', name: 'Amy Wong', title: 'VP Engineering', companyId: '4' },
];

const PURPOSES = [
  { value: 'intro', label: 'Introduction' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'meeting', label: 'Meeting Request' },
  { value: 'proposal', label: 'Proposal' },
];

const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
];

const MOCK_EMAILS: Record<string, string> = {
  'intro-formal': `Subject: Intelligence Platform for {company}

Dear {contact},

I hope this message finds you well. My name is Sarah Chen, and I lead the enterprise partnerships team at DeepMindQ.

I've been following {company}'s recent growth and was particularly impressed by your commitment to innovation in the {industry} space. Our intelligence platform has helped organizations like yours automate competitive analysis and reduce research time by up to 80%.

I would welcome the opportunity to share how DeepMindQ might support {company}'s strategic objectives. Would a brief 15-minute call be possible this week?

Thank you for your consideration.

Best regards,
Sarah Chen
Enterprise Partnerships, DeepMindQ`,
  'intro-friendly': `Subject: Quick thought on {company}'s growth

Hi {contact},

I saw the news about {company} and couldn't help but think we should connect. I'm Sarah from DeepMindQ — we build AI-powered intelligence platforms that help sales teams work smarter.

Companies similar to {company} have seen some really impressive results using our platform, and I think there could be a great fit here.

Would you be open to a quick chat? No pressure, just an exploratory conversation.

Cheers,
Sarah`,
  'intro-casual': `Subject: {company} + DeepMindQ?

Hey {contact}!

Quick intro — I'm Sarah from DeepMindQ. We make an AI platform that automates the boring parts of sales intelligence so your team can focus on actually selling.

Saw what {company} is up to and thought there might be a connection. Worth a 10-min call to explore?

Let me know!

Sarah`,
  'followup-formal': `Subject: Re: Our conversation — next steps

Dear {contact},

Thank you for the valuable discussion on {date}. I wanted to follow up on the key points we covered regarding {company}'s intelligence needs.

As discussed, I've attached the case study that demonstrates how we helped a similar {industry} organization achieve a 45% improvement in pipeline velocity. I believe the parallels to {company}'s situation are compelling.

I'd suggest we schedule a follow-up demonstration at your earliest convenience. Would next Tuesday or Wednesday work for your team?

Best regards,
Sarah Chen`,
  'followup-friendly': `Subject: Great chatting with you, {contact}!

Hi {contact},

Thanks again for the great conversation! I really enjoyed learning more about what {company} is working on.

I've put together a few resources that I think you'll find relevant based on what we discussed. The case study in particular shows results that are pretty aligned with the outcomes you mentioned.

Want to grab 20 minutes next week for a quick walkthrough? I think you'll find it valuable.

Best,
Sarah`,
  'followup-casual': `Subject: following up! + that case study I mentioned

Hey {contact},

Thanks for the chat! Really enjoyed it.

Here's that case study I mentioned — the results are pretty solid and I think super relevant to what {company} is doing. Would love to walk you through it.

Free for a quick call next week?

Sarah`,
  'meeting-formal': `Subject: Meeting Request: Intelligence Platform Demo

Dear {contact},

I would like to request a meeting to present DeepMindQ's intelligence platform to you and your team at {company}.

Based on our previous conversations, I believe a structured demonstration would be valuable to showcase how our platform addresses {company}'s specific challenges in competitive intelligence and account research.

I propose the following time slots for your consideration:
• Tuesday, January 21 at 2:00 PM ET
• Wednesday, January 22 at 10:00 AM ET
• Thursday, January 23 at 3:00 PM ET

Please advise on your availability.

Best regards,
Sarah Chen`,
  'meeting-friendly': `Subject: How about a demo? 🎯

Hi {contact},

I'd love to show you what DeepMindQ can do for {company} in a quick demo. I think seeing the platform in action will make everything click.

Do any of these work for you?
• Tue Jan 21 at 2pm ET
• Wed Jan 22 at 10am ET
• Thu Jan 23 at 3pm ET

Happy to adjust if none of these fit your schedule!

Best,
Sarah`,
  'meeting-casual': `Subject: demo time? 🚀

Hey {contact}!

Wanna see the platform in action? I think a 20-min demo would be the fastest way to see if it's a fit for {company}.

How's Tue at 2pm, Wed at 10am, or Thu at 3pm?

Lmk!

Sarah`,
  'proposal-formal': `Subject: Proposal: Enterprise Intelligence Platform for {company}

Dear {contact},

Following our discussions and the successful demonstration, I am pleased to present DeepMindQ's formal proposal for {company}.

**Executive Summary:**
This proposal outlines an enterprise-grade intelligence platform deployment designed to address {company}'s strategic need for automated competitive analysis and account intelligence.

**Proposed Solution:**
• DeepMindQ Enterprise Platform — full license for {teamSize} users
• Dedicated AI model fine-tuned for {industry}
• Integration with existing CRM and data sources
• 12-month implementation with dedicated success manager

**Investment:** Custom enterprise pricing based on scope

I would welcome the opportunity to discuss any questions or adjustments.

Best regards,
Sarah Chen`,
  'proposal-friendly': `Subject: Our proposal for {company}! 📋

Hi {contact},

Excited to share our proposal! I've tailored everything based on what we've discussed.

**The highlights:**
• Full enterprise platform for your team
• AI customized for {industry}
• Seamless CRM integration
• Dedicated support throughout

I've attached the full proposal doc — take a look and let me know your thoughts. Happy to hop on a call to walk through anything!

Best,
Sarah`,
  'proposal-casual': `Subject: the proposal! 📄

Hey {contact},

Here's the proposal I promised! Tailored it specifically for {company} based on everything we've talked about.

Key points:
• Full platform access for your team
• AI custom-built for {industry}
• CRM integration included
• 12mo dedicated support

Take a look and let me know what you think. Always happy to chat through any questions!

Sarah`,
};

/* ── Component ── */
export default function EmailGenerationScreen() {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [purpose, setPurpose] = useState('intro');
  const [tone, setTone] = useState('friendly');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filteredContacts = companyId ? CONTACTS.filter((c) => c.companyId === companyId) : CONTACTS;

  const company = COMPANIES.find((c) => c.id === companyId);
  const contact = CONTACTS.find((c) => c.id === contactId);

  const handleGenerate = () => {
    if (!companyId || !contactId) return;
    setIsGenerating(true);
    setSent(false);
    setShowSchedule(false);
    setTimeout(() => {
      const key = `${purpose}-${tone}`;
      const template = MOCK_EMAILS[key] || MOCK_EMAILS['intro-friendly'];
      const filled = template
        .replace(/\{company\}/g, company?.name || 'your company')
        .replace(/\{contact\}/g, contact?.name?.split(' ')[0] || 'there')
        .replace(/\{industry\}/g, company?.name === 'TechVenture Inc' ? 'FinTech' : 'technology')
        .replace(/\{date\}/g, 'our previous call')
        .replace(/\{teamSize\}/g, '25')
        .replace(/\{\w+\}/g, (match) => match);
      setGeneratedEmail(filled);
      setEditedEmail(filled);
      setIsGenerating(false);
    }, 2000);
  };

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSent(true);
    }, 1000);
  };

  const handleSchedule = () => {
    if (!scheduleDate) return;
    setIsScheduling(true);
    setTimeout(() => {
      setIsScheduling(false);
      setSent(true);
      setShowSchedule(false);
    }, 1000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              AI Email Generator
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Generate personalized outreach emails with AI
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Config Panel */}
            <div className="lg:col-span-2 space-y-5">
              {/* Company */}
              <div
                className="rounded-xl border p-5"
                style={{
                  borderColor: tokens.border.default,
                  backgroundColor: tokens.surface.primary,
                }}
              >
                <h3
                  className="text-sm font-semibold mb-4 flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <Building2 className="w-4 h-4" style={{ color: tokens.accent.DEFAULT }} />{' '}
                  Recipient Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Company</Label>
                    <Select
                      value={companyId}
                      onValueChange={(v) => {
                        setCompanyId(v);
                        setContactId('');
                        setGeneratedEmail('');
                        setSent(false);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select company..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Contact</Label>
                    <Select
                      value={contactId}
                      onValueChange={(v) => {
                        setContactId(v);
                        setGeneratedEmail('');
                        setSent(false);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm" disabled={!companyId}>
                        <SelectValue
                          placeholder={companyId ? 'Select contact...' : 'Select company first'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Email Settings */}
              <div
                className="rounded-xl border p-5"
                style={{
                  borderColor: tokens.border.default,
                  backgroundColor: tokens.surface.primary,
                }}
              >
                <h3
                  className="text-sm font-semibold mb-4 flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <PenLine className="w-4 h-4" style={{ color: tokens.domain.reasoning }} /> Email
                  Settings
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Purpose</Label>
                    <Select
                      value={purpose}
                      onValueChange={(v) => {
                        setPurpose(v);
                        setGeneratedEmail('');
                        setSent(false);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tone</Label>
                    <div className="flex gap-2">
                      {TONES.map((t) => (
                        <Button
                          key={t.value}
                          variant={tone === t.value ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 text-xs flex-1"
                          onClick={() => {
                            setTone(t.value);
                            setGeneratedEmail('');
                            setSent(false);
                          }}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={!companyId || !contactId || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Generate Email
                  </>
                )}
              </Button>
            </div>

            {/* Preview / Edit Panel */}
            <div className="lg:col-span-3">
              <div
                className="rounded-xl border h-full flex flex-col"
                style={{
                  borderColor: tokens.border.default,
                  backgroundColor: tokens.surface.primary,
                }}
              >
                <div
                  className="px-5 py-4 border-b flex items-center justify-between"
                  style={{ borderColor: tokens.border.default }}
                >
                  <h3
                    className="text-sm font-semibold flex items-center gap-2"
                    style={{ color: tokens.text.primary }}
                  >
                    <Mail className="w-4 h-4" style={{ color: tokens.accent.DEFAULT }} />{' '}
                    {generatedEmail ? 'Edit & Send' : 'Email Preview'}
                  </h3>
                  {generatedEmail && !sent && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 mr-1" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex-1 p-5">
                  {sent ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                        style={{ backgroundColor: tokens.confidence.high.bg }}
                      >
                        <Check
                          className="w-8 h-8"
                          style={{ color: tokens.confidence.high.value }}
                        />
                      </div>
                      <h3
                        className="text-base font-semibold mb-1"
                        style={{ color: tokens.text.primary }}
                      >
                        Email {showSchedule && scheduleDate ? 'Scheduled' : 'Sent'}!
                      </h3>
                      <p className="text-sm mb-4" style={{ color: tokens.text.muted }}>
                        {showSchedule && scheduleDate
                          ? `Scheduled for ${scheduleDate}`
                          : 'Your email has been sent successfully'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSent(false);
                          setGeneratedEmail('');
                          setEditedEmail('');
                        }}
                      >
                        Generate Another
                      </Button>
                    </div>
                  ) : generatedEmail ? (
                    <div className="space-y-3">
                      {/* Recipient info */}
                      <div
                        className="flex items-center gap-2 p-3 rounded-lg"
                        style={{ backgroundColor: tokens.surface.secondary }}
                      >
                        <User className="w-4 h-4" style={{ color: tokens.text.muted }} />
                        <span className="text-xs" style={{ color: tokens.text.muted }}>
                          To: {contact?.name} ({contact?.title}) at {company?.name}
                        </span>
                      </div>

                      {/* Editable email */}
                      <Textarea
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        rows={16}
                        className="text-sm resize-none font-mono"
                      />

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button onClick={handleSend} disabled={isSending}>
                          {isSending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" /> Send Now
                            </>
                          )}
                        </Button>
                        {showSchedule ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="h-9 rounded-md border bg-transparent px-3 text-sm"
                              style={{
                                borderColor: tokens.border.default,
                                color: tokens.text.primary,
                              }}
                            />
                            <Button
                              variant="outline"
                              onClick={handleSchedule}
                              disabled={isScheduling || !scheduleDate}
                            >
                              {isScheduling ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling...
                                </>
                              ) : (
                                'Confirm'
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowSchedule(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" onClick={() => setShowSchedule(true)}>
                            <CalendarClock className="w-4 h-4 mr-2" /> Schedule
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ backgroundColor: tokens.surface.secondary }}
                      >
                        <Sparkles className="w-8 h-8" style={{ color: tokens.text.muted }} />
                      </div>
                      <h3
                        className="text-sm font-medium mb-1"
                        style={{ color: tokens.text.secondary }}
                      >
                        Ready to generate
                      </h3>
                      <p className="text-xs max-w-xs" style={{ color: tokens.text.muted }}>
                        Select a company, contact, purpose, and tone, then click Generate to create
                        a personalized AI email.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
