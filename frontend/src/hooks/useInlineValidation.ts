// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useMemo } from 'react';
import { type FieldValues, type UseFormReturn, type Control, type FieldErrors } from 'react-hook-form';

/**
 * Hook for inline validation that shows errors as user types
 * Works with react-hook-form
 */
export const useInlineValidation = <T extends FieldValues>(
  form:
    | UseFormReturn<T>
    | {
        control: Control<T>;
        formState: { errors: FieldErrors<T>; touchedFields: Partial<Record<keyof T, unknown>> };
      },
  mode: 'onChange' | 'onBlur' | 'onTouched' = 'onChange',
) => {
  // Both accepted shapes carry formState, so this never needed a conditional
  // hook call -- the branch that made one was unreachable.
  const formState = form.formState;
  const errors: Record<string, FieldErrors<T>[string]> = formState.errors;
  const touchedFields: Record<string, unknown> = formState.touchedFields;

  // Show errors immediately (onChange) or only for touched fields (onBlur/onTouched)
  const showErrors = useMemo(() => {
    const next: Record<string, boolean> = {};
    Object.keys(mode === 'onChange' ? errors : touchedFields).forEach((key) => {
      if (errors[key] && (mode === 'onChange' || touchedFields[key])) {
        next[key] = true;
      }
    });
    return next;
  }, [errors, touchedFields, mode]);

  const getFieldError = (fieldName: string): string | undefined => {
    if (!showErrors[fieldName]) return undefined;
    const error = errors[fieldName];
    if (!error) return undefined;
    if (typeof error.message === 'string') return error.message;
    return 'Invalid value';
  };

  const shouldShowError = (fieldName: string): boolean => {
    return showErrors[fieldName] === true;
  };

  return {
    getFieldError,
    shouldShowError,
    errors,
  };
};
