export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-bg p-6 text-center">
      <div className="max-w-sm">
        <div className="text-[15px] font-medium tracking-[0.18em] text-ink mb-3">TIBI</div>
        <h1 className="tibi-page-title mb-3">You are offline.</h1>
        <p className="text-[13px] text-ink-body">
          POS still works — any sales made while offline will queue locally and send automatically
          when the connection comes back.
        </p>
      </div>
    </main>
  );
}
