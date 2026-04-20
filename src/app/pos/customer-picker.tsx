'use client';

import { useEffect, useRef, useState } from 'react';
import { searchCustomers, type CustomerSuggestion } from './customer-actions';

interface Props {
  name: string;
  email: string;
  phone: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  label?: string;
}

/**
 * Customer picker for POS: a name input with live suggestions.
 * Picking a suggestion fills name + email + phone at once, which avoids
 * creating duplicate customer rows with slight spelling variants.
 */
export function CustomerPicker({ name, email, phone, onName, onEmail, onPhone, label = 'Customer (optional)' }: Props) {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions as user types
  useEffect(() => {
    if (!focused || name.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchCustomers(name);
      if (!cancelled) {
        setSuggestions(res);
        setOpen(res.length > 0);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, focused]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(s: CustomerSuggestion) {
    onName(s.name ?? '');
    onEmail(s.email ?? '');
    onPhone(s.phone ?? '');
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="flex flex-col gap-1.5 relative" ref={boxRef}>
      <label className="tibi-label">{label}</label>
      <input
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Type a name…"
        className="tibi-input"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-30 bg-bg border border-hairline border-border rounded-input shadow-sm max-h-[220px] overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className="w-full text-left px-3 py-2 hover:bg-hover border-b border-hairline border-divider last:border-0"
              >
                <div className="text-[13px] text-ink">{s.name ?? '—'}</div>
                <div className="text-[11px] text-ink-hint">
                  {[s.email, s.phone].filter(Boolean).join(' · ') || '—'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
