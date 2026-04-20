'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface Props {
  onScan: (text: string) => void;
}

export function BarcodeScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let controls: { stop: () => void } | null = null;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (!active || !result) return;
          onScan(result.getText());
        });
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Camera unavailable');
      }
    })();

    return () => {
      active = false;
      controls?.stop();
    };
  }, [onScan]);

  return (
    <div className="flex flex-col gap-2">
      <video ref={videoRef} className="w-full h-40 bg-ink/5 rounded-input object-cover" playsInline muted />
      <p className="text-[10px] text-ink-hint text-center">Align the barcode in the frame. Code 128 is auto-detected.</p>
      {err && <p className="text-[11px] text-danger-fg text-center">{err}</p>}
    </div>
  );
}
