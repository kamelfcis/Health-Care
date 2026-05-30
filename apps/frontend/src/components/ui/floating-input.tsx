"use client";

import { forwardRef, InputHTMLAttributes, useCallback } from "react";
import { cn } from "@/lib/utils";

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  endAdornment?: React.ReactNode;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  function FloatingInput({ label, id, className, error, endAdornment, ...props }, forwardedRef) {
    const { ref: propsRef, ...inputProps } = props as FloatingInputProps & {
      ref?: React.Ref<HTMLInputElement>;
    };

    const mergedRef = useCallback(
      (node: HTMLInputElement | null) => {
        assignRef(forwardedRef, node);
        assignRef(propsRef, node);
      },
      [forwardedRef, propsRef]
    );

    return (
      <div className="relative">
        <input
          ref={mergedRef}
          id={id}
          placeholder=" "
          className={cn(
            "peer h-12 w-full rounded-2xl border border-slate-200 bg-white/70 px-4 pt-5 text-sm text-slate-800 outline-none transition duration-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100",
            endAdornment ? "pr-12" : "",
            error ? "border-red-400 focus:border-red-400 focus:ring-red-300/40" : "",
            className
          )}
          {...inputProps}
        />
        <label
          htmlFor={id}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-transparent px-1 text-base text-slate-500 transition-all duration-300 peer-placeholder-shown:top-1/2 peer-focus:top-3 peer-focus:text-sm peer-focus:text-orange-600 peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:text-sm dark:text-slate-400"
        >
          {label}
        </label>
        {endAdornment ? <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">{endAdornment}</div> : null}
        {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";
