import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Triggers a re-playable horizontal shake animation whenever `triggerKey` increments
 * while `active` is true, without remounting the input element (preserving focus).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useShakeAnimation(active: boolean, triggerKey: number): boolean {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!active || triggerKey <= 0) return;
    let rafId = 0;
    let timerId = 0;

    rafId = window.requestAnimationFrame(() => {
      setShaking(false);
      rafId = window.requestAnimationFrame(() => {
        setShaking(true);
        timerId = window.setTimeout(() => {
          setShaking(false);
        }, 420);
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [active, triggerKey]);

  return shaking;
}

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  labelRight?: ReactNode;
  error?: string | null;
  shakeKey?: number;
  containerClassName?: string;
  inputClassName?: string;
  mono?: boolean;
}

export function PasswordInput({
  label,
  labelRight,
  error,
  shakeKey = 0,
  containerClassName = '',
  inputClassName = '',
  mono = false,
  className,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error && error.trim());
  const shaking = useShakeAnimation(hasError, shakeKey);

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {(label || hasError || labelRight) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {hasError ? (
            <span
              role="alert"
              className="text-[12px] font-semibold text-[#e5322d]"
            >
              {error}
            </span>
          ) : label ? (
            <span className="text-[12px] font-semibold text-black">
              {label}
            </span>
          ) : (
            <span />
          )}
          {labelRight}
        </div>
      )}

      <div className={`relative ${shaking ? 'kova-input-shake' : ''}`}>
        <input
          {...rest}
          type={visible ? 'text' : 'password'}
          aria-invalid={hasError || undefined}
          className={`w-full h-[42px] border rounded-full pl-4 pr-11 text-[13.5px] outline-none transition-colors ${
            mono ? 'font-mono text-[13px]' : ''
          } ${
            hasError
              ? 'kova-input-error border-[#e5322d] focus:border-[#e5322d]'
              : 'border-[#ececec] focus:border-[#ff6e20]'
          } ${inputClassName} ${className || ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#767676] hover:text-black transition-colors cursor-pointer"
        >
          {visible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
