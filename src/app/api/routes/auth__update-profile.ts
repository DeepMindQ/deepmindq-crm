import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp, type OtpPurpose } from '@/lib/otp';
import { requireAuth, AuthError } from '@/lib/session';
import { db } from '@/lib/db';
import { sanitizeString } from '@/lib/sanitize';

const schema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6, 'Code must be 6 digits'),
  purpose: z.enum(['update_profile', 'change_email', 'change_password']),
  updates: z.object({
    name: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    company: z.string().max(100).optional(),
    designation: z.string().max(100).optional(),
    newEmail: z.string().email().optional(), // for change_email purpose
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, otpCode, purpose, updates } = parsed.data;

    // Verify OTP against the user's current email
    // For change_email, the OTP was sent to the OLD email
    const otpResult = await verifyOtp(email, otpCode, purpose as OtpPurpose);

    if (!otpResult.success) {
      return NextResponse.json({ error: otpResult.error || 'OTP verification failed' }, { status: 401 });
    }

    if (otpResult.userId !== user.id) {
      return NextResponse.json({ error: 'OTP does not match current user' }, { status: 403 });
    }

    // Apply updates based on purpose
    if (purpose === 'update_profile' && updates) {
      const updateData: Record<string, string> = {};
      if (updates.name !== undefined) updateData.name = sanitizeString(updates.name);
      if (updates.phone !== undefined) updateData.phone = sanitizeString(updates.phone);
      if (updates.company !== undefined) updateData.company = sanitizeString(updates.company);
      if (updates.designation !== undefined) updateData.designation = sanitizeString(updates.designation);

      await db.user.update({
        where: { id: user.id },
        data: updateData,
      });

      return NextResponse.json({ success: true, message: 'Profile updated' });
    }

    if (purpose === 'change_email' && updates?.newEmail) {
      // Check if new email is already taken
      const existing = await db.user.findUnique({ where: { email: updates.newEmail.toLowerCase() } });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }

      await db.user.update({
        where: { id: user.id },
        data: { email: updates.newEmail.toLowerCase().trim() },
      });

      return NextResponse.json({ success: true, message: 'Email updated' });
    }

    // change_password is handled by separate route
    return NextResponse.json({ success: true, message: 'Verified' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[auth/update-profile] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}