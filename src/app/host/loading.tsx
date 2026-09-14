import { BrandMark, PinDisplay } from '@/components/brand/BrandMark';

export default function HostLoading() {
  return (
    <div className="arena-stage arena-noise relative flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4">
      <BrandMark tone="light" size="sm" />
      <div className="border-2 border-arena-ink bg-white p-5 text-center shadow-[8px_8px_0_rgba(0,0,0,0.35)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-arena-ink/40">Room PIN</p>
        <div className="mt-3">
          <PinDisplay pin="" large />
        </div>
      </div>
      <p className="text-sm font-medium text-white/55">Opening live lobby…</p>
    </div>
  );
}
