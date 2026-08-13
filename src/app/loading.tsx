export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    </div>
  );
}
