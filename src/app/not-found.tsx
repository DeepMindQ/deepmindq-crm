import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center px-6">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6 bg-zinc-800/60 border border-zinc-700/40">
          <span className="text-2xl font-bold text-zinc-300">404</span>
        </div>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4 text-emerald-400">
          Not Found
        </p>
        <h1 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-[-0.025em] mb-4 text-zinc-100">
          Page not found
        </h1>
        <p className="text-[16px] font-light max-w-[400px] mx-auto mb-8 text-zinc-400">
          This page doesn&apos;t exist, or it&apos;s been moved. Let&apos;s get you back to familiar
          ground.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-[14px] font-semibold transition-colors bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to DeepMindQ
        </Link>
      </div>
    </main>
  );
}
