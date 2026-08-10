import { tokens } from '@/components/intelligence-os/design-tokens';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.surface.base }}>
      <div style={{ textAlign: 'center' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: tokens.accent.DEFAULT }} />
        <p className="text-sm" style={{ color: tokens.text.secondary }}>Loading...</p>
      </div>
    </div>
  );
}
