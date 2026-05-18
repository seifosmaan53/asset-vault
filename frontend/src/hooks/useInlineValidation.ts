// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useEffect, useState } from 'react';
import { useFormState, type FieldValues, type UseFormReturn, type Control } from 'react-hook-form';

/**
 * Hook for inline validation that shows errors as user types
 * Works with react-hook-form
 */
export const useInlineValidation = <T extends FieldValues>(
  form: UseFormReturn<T> | { control: Control<T>; formState: { errors: any; touchedFields: any } },
  mode: 'onChange' | 'onBlur' | 'onTouched' = 'onChange',
) => {
  const formState = 'formState' in form ? form.formState : useFormState({ control: form.control });
  const { errors, touchedFields } = formState;
  const [showErrors, setShowErrors] = useState<Record<string, boolean>>({});

  // Show errors for touched fields or when mode is onChange
  useEffect(() => {
    if (mode === 'onChange') {
      // Show errors immediately when they appear
      const newShowErrors: Record<string, boolean> = {};
      Object.keys(errors).forEach((key) => {
        if (errors[key]) {
          newShowErrors[key] = true;
        }
      });
      setShowErrors(newShowErrors);
    } else if (mode === 'onBlur' || mode === 'onTouched') {
      // Show errors only for touched fields
      const newShowErrors: Record<string, boolean> = {};
      Object.keys(touchedFields).forEach((key) => {
        if (touchedFields[key] && errors[key]) {
          newShowErrors[key] = true;
        }
      });
      setShowErrors(newShowErrors);
    }
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
