import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      {label && <span className="tibi-label">{label}</span>}
      <input ref={ref} id={id} className={cn('tibi-input', className)} {...rest} />
      {error ? (
        <span className="text-[11px] text-danger-fg">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-hint">{hint}</span>
      ) : null}
    </label>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      {label && <span className="tibi-label">{label}</span>}
      <textarea ref={ref} id={id} className={cn('tibi-input', className)} {...rest} />
      {error ? (
        <span className="text-[11px] text-danger-fg">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-hint">{hint}</span>
      ) : null}
    </label>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...rest },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      {label && <span className="tibi-label">{label}</span>}
      <select ref={ref} id={id} className={cn('tibi-input', 'pr-8', className)} {...rest}>
        {children}
      </select>
      {error ? (
        <span className="text-[11px] text-danger-fg">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-hint">{hint}</span>
      ) : null}
    </label>
  );
});
