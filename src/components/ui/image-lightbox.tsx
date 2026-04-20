'use client';

import { useState } from 'react';

/**
 * Click-to-zoom image. Thumbnail stays inline; clicking opens a fullscreen overlay.
 */
export function ZoomableImage({ src, alt = '', className }: { src: string; alt?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{ cursor: 'zoom-in' }}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-input"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 h-9 w-9 rounded-pill bg-bg text-ink text-[18px] flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
