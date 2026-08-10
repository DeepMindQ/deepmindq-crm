'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  StaggerGrid, StaggerItem, GlassPanel, GradientCard,
} from '@/components/ui/animated-components';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import {
  UserCircle, Lock, Phone, Building2, Briefcase, KeyRound, Eye,
  ShieldCheck, RefreshCw, Save, Mail, ArrowRightLeft, XCircle,
} from 'lucide-react';
import { INPUT_CLS } from './settings-constants';

const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;

export function ProfileTab({ showToast }: { showToast: (msg: string) => void }) {
  const [profileUser, setProfileUser] = useState<any>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profileDesignation, setProfileDesignation] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [profileOtpCode, setProfileOtpCode] = useState('');
  const [profileOtpPurpose, setProfileOtpPurpose] = useState<string>('');
  const [profileOtpSent, setProfileOtpSent] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileOtpCountdown, setProfileOtpCountdown] = useState(0);
  const [profileDevCode, setProfileDevCode] = useState<string | null>(null);
  const [newPasswordFields, setNewPasswordFields] = useState({ current: '', next: '', confirm: '' });
  const [showNewPasswords, setShowNewPasswords] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setProfileUser(u);
          setProfileName(u.name || '');
          setProfilePhone(u.phone || '');
          setProfileCompany(u.company || '');
          setProfileDesignation(u.designation || '');
          setProfileEmail(u.email || '');
          setNewEmail(u.email || '');
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (profileOtpCountdown > 0) {
      const t = setTimeout(() => setProfileOtpCountdown(profileOtpCountdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [profileOtpCountdown]);

  const handleProfileOtpRequest = async (purpose: string, targetEmail?: string) => {
    const emailToSend = targetEmail || profileEmail;
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSend, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to send OTP'); return; }
      if (data.devCode) setProfileDevCode(data.devCode);
      setProfileOtpPurpose(purpose);
      setProfileOtpSent(true);
      setProfileOtpCode('');
      setProfileOtpCountdown(60);
      showToast('OTP sent to ' + emailToSend);
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const handleProfileUpdate = async () => {
    if (!profileOtpCode || profileOtpCode.length !== 6) { showToast('Enter the 6-digit OTP'); return; }
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileEmail, otpCode: profileOtpCode, purpose: 'update_profile',
          updates: { name: profileName, phone: profilePhone, company: profileCompany, designation: profileDesignation },
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Update failed'); return; }
      setProfileOtpSent(false); setProfileOtpCode(''); setProfileDevCode(null);
      showToast('Profile updated successfully!');
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const handleEmailChange = async () => {
    if (!newEmail || newEmail === profileEmail) { showToast('Enter a different email'); return; }
    if (!profileOtpCode || profileOtpCode.length !== 6) { showToast('Enter the 6-digit OTP'); return; }
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profileEmail, otpCode: profileOtpCode, purpose: 'change_email', updates: { newEmail: newEmail.toLowerCase().trim() } }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Email change failed'); return; }
      setProfileEmail(newEmail.toLowerCase().trim());
      setProfileOtpSent(false); setProfileOtpCode(''); setProfileDevCode(null);
      showToast('Email updated! Use new email next login.');
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  const handlePasswordChange = async () => {
    if (!profileOtpCode || profileOtpCode.length !== 6) { showToast('Enter the 6-digit OTP'); return; }
    if (newPasswordFields.next.length < 8) { showToast('Password must be at least 8 characters'); return; }
    if (newPasswordFields.next !== newPasswordFields.confirm) { showToast('Passwords do not match'); return; }
    setProfileLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profileEmail, otpCode: profileOtpCode, newPassword: newPasswordFields.next }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Password change failed'); return; }
      setProfileOtpSent(false); setProfileOtpCode(''); setProfileDevCode(null);
      setNewPasswordFields({ current: '', next: '', confirm: '' });
      setShowNewPasswords(false);
      showToast('Password changed successfully!');
    } catch { showToast('Network error'); }
    finally { setProfileLoading(false); }
  };

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      {/* Personal Info Card */}
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${goldAlpha(0.1)}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
                <UserCircle className="size-4.5" style={{ color: 'var(--color-gold)' }} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground tracking-tight">Personal Information</h3>
                <p className="text-xs text-muted-foreground">Your basic details — requires OTP to save changes</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><UserCircle className="w-3.5 h-3.5" /> Full Name</Label>
                <Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" className={INPUT_CLS} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Mobile Number</Label>
                <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+91 98765 43210" className={INPUT_CLS} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Company</Label>
                <Input value={profileCompany} onChange={e => setProfileCompany(e.target.value)} placeholder="Your company" className={INPUT_CLS} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Designation</Label>
                <Input value={profileDesignation} onChange={e => setProfileDesignation(e.target.value)} placeholder="Your role" className={INPUT_CLS} />
              </div>
            </div>
            <div className="border-t border-border/50 pt-5">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                Verify with OTP sent to <span className="font-medium text-foreground">{profileEmail}</span>
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <div className="flex justify-center mb-3">
                    <InputOTP maxLength={6} value={profileOtpCode} onChange={v => { setProfileOtpCode(v); setProfileDevCode(null); }}>
                      <InputOTPGroup>{[0,1,2].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}</InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>{[3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}</InputOTPGroup>
                    </InputOTP>
                  </div>
                  {profileDevCode && profileOtpPurpose === 'update_profile' && (
                    <p className="text-center text-xs text-amber-400/80 bg-amber-500/10 rounded px-2 py-1 mb-2">Your code: <span className="font-mono font-bold">{profileDevCode}</span></p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={() => handleProfileOtpRequest('update_profile')} disabled={profileOtpCountdown > 0 || profileLoading} variant="outline" className="gap-1.5">
                    {profileOtpCountdown > 0 ? `${profileOtpCountdown}s` : <><RefreshCw className="w-3.5 h-3.5" /> Send OTP</>}
                  </Button>
                  <Button size="sm" onClick={handleProfileUpdate} disabled={profileOtpCode.length !== 6 || profileLoading} className="gap-1.5" style={{ background: 'linear-gradient(135deg, var(--ios-gold-mid), var(--color-gold))', color: 'var(--dmq-white)' }}>
                    <Save className="w-3.5 h-3.5" /> Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </GlassPanel>
      </StaggerItem>

      {/* Email Change Card */}
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${goldAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
              <Mail className="size-4.5" style={{ color: 'var(--color-gold)' }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">Change Email</h3>
              <p className="text-xs text-muted-foreground">OTP verified — code sent to current email</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Current Email</Label>
              <Input value={profileEmail} disabled className={INPUT_CLS + ' opacity-60'} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">New Email</Label>
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" className={INPUT_CLS} />
            </div>
            <div className="border-t border-border/50 pt-5">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                OTP will be sent to <span className="font-medium text-foreground">{profileEmail}</span> to authorize this change
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <div className="flex justify-center mb-2">
                    <InputOTP maxLength={6} value={profileOtpPurpose === 'change_email' ? profileOtpCode : ''} onChange={v => { setProfileOtpCode(v); setProfileDevCode(null); setProfileOtpPurpose('change_email'); }}>
                      <InputOTPGroup>{[0,1,2].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}</InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>{[3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}</InputOTPGroup>
                    </InputOTP>
                  </div>
                  {profileDevCode && profileOtpPurpose === 'change_email' && (
                    <p className="text-center text-xs text-amber-400/80 bg-amber-500/10 rounded px-2 py-1">Your code: <span className="font-mono font-bold">{profileDevCode}</span></p>
                  )}
                </div>
                <Button size="sm" onClick={() => { setProfileOtpPurpose('change_email'); handleProfileOtpRequest('change_email'); }} disabled={profileOtpCountdown > 0 || profileLoading} variant="outline" className="gap-1.5">
                  {profileOtpCountdown > 0 ? `${profileOtpCountdown}s` : <><RefreshCw className="w-3.5 h-3.5" /> Send OTP</>}
                </Button>
                <Button size="sm" onClick={handleEmailChange} disabled={profileOtpCode.length !== 6 || profileLoading || profileOtpPurpose !== 'change_email'} className="gap-1.5" style={{ background: 'linear-gradient(135deg, var(--ios-gold-mid), var(--color-gold))', color: 'var(--dmq-white)' }}>
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Update Email
                </Button>
              </div>
            </div>
          </div>
        </GlassPanel>
      </StaggerItem>

      {/* Password Change Card */}
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${goldAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
              <Lock className="size-4.5" style={{ color: 'var(--color-gold)' }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">Change Password</h3>
              <p className="text-xs text-muted-foreground">OTP verified — code sent to {profileEmail}</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">New Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type={showNewPasswords ? 'text' : 'password'} value={newPasswordFields.next} onChange={e => setNewPasswordFields(p => ({...p, next: e.target.value}))} placeholder="Min. 8 characters" className={INPUT_CLS + ' pl-9 pr-9'} />
                <button type="button" onClick={() => setShowNewPasswords(!showNewPasswords)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPasswords ? <XCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Confirm New Password</Label>
              <Input type={showNewPasswords ? 'text' : 'password'} value={newPasswordFields.confirm} onChange={e => setNewPasswordFields(p => ({...p, confirm: e.target.value}))} placeholder="Re-enter password" className={INPUT_CLS} />
            </div>
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                Verify with OTP to change your password
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <div className="flex justify-center mb-2">
                    <InputOTP maxLength={6} value={profileOtpPurpose === 'change_password' ? profileOtpCode : ''} onChange={v => { setProfileOtpCode(v); setProfileDevCode(null); setProfileOtpPurpose('change_password'); }}>
                      <InputOTPGroup>{[0,1,2].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}</InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>{[3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base" />)}</InputOTPGroup>
                    </InputOTP>
                  </div>
                  {profileDevCode && profileOtpPurpose === 'change_password' && (
                    <p className="text-center text-xs text-amber-400/80 bg-amber-500/10 rounded px-2 py-1">Your code: <span className="font-mono font-bold">{profileDevCode}</span></p>
                  )}
                </div>
                <Button size="sm" onClick={() => { setProfileOtpPurpose('change_password'); handleProfileOtpRequest('change_password'); }} disabled={profileOtpCountdown > 0 || profileLoading} variant="outline" className="gap-1.5">
                  {profileOtpCountdown > 0 ? `${profileOtpCountdown}s` : <><RefreshCw className="w-3.5 h-3.5" /> Send OTP</>}
                </Button>
                <Button size="sm" onClick={handlePasswordChange} disabled={profileOtpCode.length !== 6 || profileLoading || profileOtpPurpose !== 'change_password'} className="gap-1.5" style={{ background: 'linear-gradient(135deg, var(--ios-gold-mid), var(--color-gold))', color: 'var(--dmq-white)' }}>
                  <KeyRound className="w-3.5 h-3.5" /> Update
                </Button>
              </div>
            </div>
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}
