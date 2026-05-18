import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {Box,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useProfile, useUpdateProfile } from '../../hooks/useAuth';
import { settingsApi } from '../../api/settings';
import type { UserSettings } from '../../api/settings';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { authApi } from '../../api/auth';
import { passwordSchema } from '../../utils/validators';
import { settingsSchema } from '../../utils/settingsValidationSchema';
import { SettingsSidebar, type SettingsCategory } from '../../components/settings/SettingsSidebar';
import { SettingsCategory as SettingsCategoryWrapper } from '../../components/settings/SettingsCategory';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsField } from '../../components/settings/SettingsField';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandling';
import Grid from '../../components/common/Grid';
import { TIMEOUTS } from '../../constants/timeouts';

// Profile validation schema
// Note: email is not included as it cannot be updated through this endpoint
const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).superRefine((data, ctx) => {
  // Only validate password match if both fields have values
  if (data.newPassword && data.confirmPassword && data.newPassword !== data.confirmPassword) {
    ctx.addIssue({
      code: 'custom' as const,
      message: "Passwords don't match",
      path: ['confirmPassword'],
    });
  }
});

// Bug #82: Improved type definition for error handling
interface ErrorWithResponse {
  response?: {
    data?: {
      message?: string;
      error?: string;
      errors?: Record<string, string[] | string>;
      statusCode?: number;
    };
    status?: number;
    statusText?: string;
  };
  message?: string;
  code?: string;
  config?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorResponseData = (error: unknown): unknown => {
  const err = error as ErrorWithResponse;
  return err?.response?.data;
};

interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Valid enum values for validation
const VALID_PAYMENT_METHODS = ['cash', 'check', 'credit_card', 'bank_transfer', 'paypal', 'stripe', 'other'] as const;
const VALID_INVENTORY_UNITS = ['piece', 'kg', 'g', 'lb', 'oz', 'l', 'ml', 'm', 'cm', 'ft', 'in', 'box', 'pack', 'case', 'pallet', 'other'] as const;

// Helper function to validate and normalize enum values
const validateEnum = <T extends readonly string[]>(value: string | undefined | null, validValues: T): T[number] | undefined => {
  if (!value || value === '') return undefined;
  return validValues.includes(value as T[number]) ? (value as T[number]) : undefined;
};

// Helper function to create reset values with defaults
const createResetValues = (settings: UserSettings) => {
  return {
    ...settings,
    autoGenerateInvoiceNumber: settings.autoGenerateInvoiceNumber ?? true,
    showInvoiceNumberOnPDF: settings.showInvoiceNumberOnPDF ?? true,
    showPaymentInstructions: settings.showPaymentInstructions ?? true,
    showCurrencySymbol: settings.showCurrencySymbol ?? true,
    taxInclusive: settings.taxInclusive ?? false,
    trackInventory: settings.trackInventory ?? true,
    allowNegativeStock: settings.allowNegativeStock ?? true,
    smtpSecure: settings.smtpSecure ?? false,
    emailInvoiceSent: settings.emailInvoiceSent ?? true,
    emailInvoicePaid: settings.emailInvoicePaid ?? true,
    emailInvoiceOverdue: settings.emailInvoiceOverdue ?? true,
    emailLowStockAlert: settings.emailLowStockAlert ?? true,
    emailInvoiceReminder: settings.emailInvoiceReminder ?? true,
    emailWeeklyReport: settings.emailWeeklyReport ?? true,
    emailMonthlyReport: settings.emailMonthlyReport ?? true,
    dateFormat: settings.dateFormat || 'MM/DD/YYYY',
    timeFormat: settings.timeFormat || '12',
    timezone: settings.timezone || 'America/New_York',
    decimalSeparator: settings.decimalSeparator || '.',
    thousandsSeparator: settings.thousandsSeparator || ',',
    currencySymbolPosition: settings.currencySymbolPosition || 'left',
    theme: settings.theme || 'light',
    itemsPerPage: settings.itemsPerPage ?? 10,
    defaultPaymentTermsDays: settings.defaultPaymentTermsDays ?? 30,
    defaultReorderLevel: settings.defaultReorderLevel ?? 0,
    stockAlertThreshold: settings.stockAlertThreshold ?? 10,
    autoReorderEnabled: settings.autoReorderEnabled ?? false,
    language: settings.language || 'en',
    primaryColor: settings.primaryColor || '#1976d2',
    secondaryColor: settings.secondaryColor || '#dc004e',
    // Validate and normalize enum fields - convert invalid values to undefined
    defaultInventoryUnit: validateEnum(settings.defaultInventoryUnit, VALID_INVENTORY_UNITS),
    // Ensure optional string fields that need validation are undefined if empty
    invoiceNumberFormat: settings.invoiceNumberFormat || undefined,
    companyTaxId: settings.companyTaxId || undefined,
    companyRegistrationNumber: settings.companyRegistrationNumber || undefined,
    companyVatNumber: settings.companyVatNumber || undefined,
    taxRegistrationNumber: settings.taxRegistrationNumber || undefined,
  };
};

const Settings = () => {
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>('account');
  
  // Track category changes and scroll to top when switching tabs
  const categoryScrollRef = useRef<{ scrollToTop: () => void } | null>(null);
  const handleCategoryChange = (category: SettingsCategory) => {
    setSelectedCategory(category);
    // Scroll to top when switching categories - use a small delay to ensure DOM is updated
    setTimeout(() => {
      // Find the SettingsCategoryWrapper element and scroll it to top
      const categoryWrapper = document.querySelector('[data-settings-category-wrapper]') as HTMLElement;
      if (categoryWrapper) {
        categoryWrapper.scrollTop = 0;
      }
    }, 0);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  
  // 2FA state
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState(0);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string>('');
  const [twoFactorQRCode, setTwoFactorQRCode] = useState<string>('');
  const [twoFactorVerificationCode, setTwoFactorVerificationCode] = useState('');
  const [isGenerating2FA, setIsGenerating2FA] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  
  // Fix Issue #78: Inline success feedback state
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  
  // Fix Issue #81-82: Track specific field changes for highlighting
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const previousValuesRef = useRef<Partial<UserSettings>>({});
  
  // Fix Memory Leak: Store timeout refs for cleanup
  const successFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryInvalidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const corruptionFixAttemptedRef = useRef<string>('');
  const isSubmittingProfileRef = useRef(false);
  const lastResetSettingsRef = useRef<string>('');
  
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Use settings from context instead of duplicate query
  const { settings, isLoading: settingsLoading } = useSettingsContext();
  
  // Fix Memory Leak: Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (successFeedbackTimeoutRef.current) {
        clearTimeout(successFeedbackTimeoutRef.current);
        successFeedbackTimeoutRef.current = null;
      }
      if (queryInvalidationTimeoutRef.current) {
        clearTimeout(queryInvalidationTimeoutRef.current);
        queryInvalidationTimeoutRef.current = null;
      }
    };
  }, []);

  const updateSettings = useMutation({
    mutationFn: settingsApi.updateSettings,
    // Fix Issue #7: Improved optimistic update with conflict detection
    onMutate: async (newSettings) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['settings'] });

      // Snapshot the previous value for rollback
      const previousSettings = queryClient.getQueryData<UserSettings>(['settings']);
      
      // Fix Issue #7: Store timestamp to detect concurrent changes
      const updateTimestamp = Date.now();

      // Optimistically update the cache
      queryClient.setQueryData(['settings'], (old: UserSettings | undefined) => ({
        ...old,
        ...newSettings,
      } as UserSettings));

      // Return context with the snapshotted value and timestamp
      return { previousSettings, updateTimestamp };
    },
    onSuccess: async (updatedSettings) => {
      // Fix Issue #8: Comprehensive response validation
      const errorResponseProperties = ['statusCode', 'timestamp', 'path', 'message', 'error'];
      const hasErrorProperties = errorResponseProperties.some(prop => prop in updatedSettings);
      
      // Additional validation: check if it's actually a UserSettings object
      const isSettingsObject = updatedSettings && typeof updatedSettings === 'object' && 
        !Array.isArray(updatedSettings) &&
        (updatedSettings.hasOwnProperty('defaultCurrency') || 
         updatedSettings.hasOwnProperty('dateFormat') || 
         updatedSettings.hasOwnProperty('companyName'));
      
      if (hasErrorProperties || !isSettingsObject) {
        logger.error('Received invalid response in onSuccess handler:', updatedSettings);
        showToast('Settings update failed: Invalid response from server', 'error');
        // Rollback optimistic update
        queryClient.invalidateQueries({ queryKey: ['settings'] });
        return;
      }
      
      // Fix Issue #7: The optimistic update already handles most race conditions
      // Update the cache with the actual server response
      queryClient.setQueryData(['settings'], updatedSettings);
      
      // Fix Race Condition & Memory Leak: Clear any existing timeout before setting new one
      if (queryInvalidationTimeoutRef.current) {
        clearTimeout(queryInvalidationTimeoutRef.current);
      }
      
      // CRITICAL: Refetch settings queries to ensure data is persisted and fresh
      // Invalidate settings queries immediately to ensure context updates
      // This ensures settings propagate throughout the app immediately
      queryClient.invalidateQueries({ queryKey: ['settings'], exact: false });
      // Also refetch to ensure all components get the latest settings
      await queryClient.refetchQueries({ queryKey: ['settings'], exact: false });
      
      // Reset form with updated settings to clear isDirty flag
      const resetValues = createResetValues(updatedSettings);
      reset(resetValues, { keepDefaultValues: false });
      
      // Fix Issue #78: Show inline success feedback
      setShowSuccessFeedback(true);
      setLastSavedTime(new Date());
      setChangedFields(new Set()); // Clear changed fields after save
      previousValuesRef.current = resetValues;
      
      // Fix Memory Leak: Clear any existing timeout before setting new one
      if (successFeedbackTimeoutRef.current) {
        clearTimeout(successFeedbackTimeoutRef.current);
      }
      
      // Hide success feedback after 5 seconds
      successFeedbackTimeoutRef.current = setTimeout(() => {
        setShowSuccessFeedback(false);
        successFeedbackTimeoutRef.current = null;
      }, TIMEOUTS.SUCCESS_FEEDBACK_DURATION);
      
      showToast('Settings saved successfully. Changes are now applied throughout the app.', 'success');
    },
    // Rollback on error
    onError: (error: unknown, _newSettings, context) => {
      // Rollback to previous settings if update fails
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
      }
      
      const errorData = getErrorResponseData(error);
      // Fix Bug #43: Proper type guard instead of unsafe type assertion
      const errorDataErrors = isRecord(errorData) && 'errors' in errorData 
        ? (typeof errorData.errors === 'object' && errorData.errors !== null 
          ? errorData.errors as Record<string, unknown> 
          : undefined)
        : undefined;

      if (isRecord(errorDataErrors)) {
        const errorMessages: string[] = [];
        Object.entries(errorDataErrors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach((msg: string) => {
              errorMessages.push(`${field}: ${msg}`);
            });
          }
        });
        showToast(
          errorMessages.length > 0 
            ? `Settings update failed: ${errorMessages.join('; ')}` 
            : 'Failed to save settings. Please try again.', 
          'error'
        );
      } else {
        showToast(
          getErrorMessage(error, 'Failed to save settings. Your changes have been reverted. Please try again.'),
          'error'
        );
      }
    },
  });

  // Single form for all settings
  const {
    register,
    formState: { errors, isDirty, dirtyFields },
    reset,
    control,
    watch,
    getValues,
    setValue,
    handleSubmit: handleSettingsSubmitForm,
  } = useForm<UserSettings>({
    // Note: 'as any' is required here due to TypeScript type incompatibility between zod schema and UserSettings
    // This is a known limitation when using zodResolver with complex schemas
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: settings ? createResetValues(settings) : {},
    mode: 'onBlur', // Validate on blur to avoid blocking saves with unrelated field errors
    reValidateMode: 'onChange', // Re-validate on change after first blur
    shouldUnregister: false, // Keep all field values even when not rendered
    criteriaMode: 'firstError', // Only show first error per field
  });
  
  // Check if form has changes - use dirtyFields as fallback if isDirty doesn't work
  const hasChanges = isDirty || Object.keys(dirtyFields).length > 0;
  
  // Fix Issue #81-82: Track specific field changes for highlighting and summary
  useEffect(() => {
    if (!settings) return;
    
    const currentValues = getValues();
    const newChangedFields = new Set<string>();
    
    // Compare current values with previous values
    Object.keys(dirtyFields).forEach((field) => {
      const currentValue = currentValues[field as keyof UserSettings];
      const previousValue = previousValuesRef.current[field as keyof UserSettings];
      
      if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
        newChangedFields.add(field);
      }
    });
    
    setChangedFields(newChangedFields);
  }, [dirtyFields, getValues, settings]);
  
  // Fix Issue #83: Generate change summary
  const changeSummary = useMemo(() => {
    if (changedFields.size === 0) return null;
    
    const summary: string[] = [];
    changedFields.forEach((field) => {
      const fieldLabel = field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      summary.push(fieldLabel);
    });
    
    return summary.length > 0 ? summary.join(', ') : null;
  }, [changedFields]);
  
  // Helper function to clean data before validation
  const cleanDataBeforeValidation = (data: Partial<UserSettings>): Partial<UserSettings> => {
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        // Special handling for invoiceNumberFormat - must be undefined if empty or invalid
        if (key === 'invoiceNumberFormat') {
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return [key, undefined];
          }
          // Check if it has a placeholder
          const placeholders = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{NUM}', '{####}'];
          const hasPlaceholder = placeholders.some(placeholder => String(value).includes(placeholder));
          if (!hasPlaceholder) {
            return [key, undefined]; // Remove invalid format
          }
          return [key, typeof value === 'string' ? value.trim() : value];
        }
        
        // Special handling for numeric fields - convert strings to numbers
        const numericFields = ['defaultTaxRate', 'defaultPaymentTermsDays', 'defaultReorderLevel', 
          'stockAlertThreshold', 'itemsPerPage', 'smtpPort'];
        if (numericFields.includes(key)) {
          if (value === null || value === undefined || value === '') {
            return [key, undefined];
          }
          const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
          if (isNaN(numValue)) {
            return [key, undefined];
          }
          return [key, numValue];
        }
        
        // Convert empty strings, null, or whitespace-only strings to undefined
        if (value === null || value === undefined) return [key, undefined];
        if (typeof value === 'string' && value.trim() === '') return [key, undefined];
        return [key, value];
      })
    ) as Partial<UserSettings>;
    
    // Remove undefined values
    return Object.fromEntries(
      Object.entries(cleaned).filter(([key, value]) => value !== undefined)
    ) as Partial<UserSettings>;
  };

  // Custom submit handler that validates and transforms data before submission
  const handleSettingsSubmit = handleSettingsSubmitForm(
    async (validatedData) => {
      // Data is already validated and cleaned by zod schema transforms
      await onSettingsSubmit(validatedData);
    },
    (errors) => {
      // Fix Issue #34: Display validation errors to user, but still allow submission
      const errorFields = Object.keys(errors);
      if (errorFields.length > 0) {
        logger.warn('Form validation errors:', errors);
        
        // Get all form values and clean them
        const allFormValues = getValues();
        const cleanedData = cleanDataBeforeValidation(allFormValues);
        
        // Try to submit cleaned data even with validation errors
        // Server will do final validation
        onSettingsSubmit(cleanedData as UserSettings).catch((err) => {
          logger.error('Failed to submit cleaned data:', err);
          showToast(getErrorMessage(err, 'Failed to save settings'), 'error');
        });
        
        // Show validation warnings but don't block submission
        const errorMessages: string[] = [];
        errorFields.forEach((field) => {
          const error = (errors as Record<string, any>)[field];
          if (error && typeof error === 'object' && 'message' in error) {
            errorMessages.push(`${field}: ${error.message}`);
          } else if (typeof error === 'string') {
            errorMessages.push(`${field}: ${error}`);
          }
        });
        
        if (errorMessages.length > 0) {
          logger.warn('Validation warnings (submitting anyway):', errorMessages);
        }
      }
    }
  );

  // Optimized watch calls - only watch fields needed for conditional rendering or dynamic behavior

  // Simplified profile form - using simple state instead of react-hook-form
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    phone: '',
    timezone: '',
    address: '',
    bio: '',
  });

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile && !isSubmittingProfileRef.current) {
      setProfileFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        timezone: profile.timezone || '',
        address: profile.address || '',
        bio: profile.bio || '',
      });
    }
  }, [profile?.id, profile?.name, profile?.phone, profile?.timezone, profile?.address, profile?.bio]);

  // Separate form for password
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch: watchPassword,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Watch password fields - use password form watch, not settings form watch
  const newPassword = watchPassword('newPassword');
  const passwordStrength = useMemo(() => {
    if (!newPassword) return '';
    if (newPassword.length < 8) return 'Weak';
    if (newPassword.length < 12) return 'Medium';
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword)) {
      return 'Strong';
    }
    return 'Medium';
  }, [newPassword]);


  // Auto-fix corrupted enum values in database
  useEffect(() => {
    if (!settings) return;
    
    const needsFix: Partial<UserSettings> = {};
    let hasCorruption = false;
    
    // Check for invalid payment method value
    if (settings.defaultClientPaymentMethod && 
        !VALID_PAYMENT_METHODS.includes(settings.defaultClientPaymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
      needsFix.defaultClientPaymentMethod = undefined;
      hasCorruption = true;
    }
    
    // Check for invalid inventory unit value
    if (settings.defaultInventoryUnit && 
        !VALID_INVENTORY_UNITS.includes(settings.defaultInventoryUnit as typeof VALID_INVENTORY_UNITS[number])) {
      needsFix.defaultInventoryUnit = undefined;
      hasCorruption = true;
    }
    
    // Create a unique key for this corruption state to prevent duplicate fix attempts
    const corruptionKey = `${settings.defaultClientPaymentMethod || ''}_${settings.defaultInventoryUnit || ''}`;
    
    // Auto-fix corrupted data silently (only if no unsaved changes and we haven't already attempted to fix this)
    if (hasCorruption && !isDirty && Object.keys(dirtyFields).length === 0 && corruptionFixAttemptedRef.current !== corruptionKey) {
      corruptionFixAttemptedRef.current = corruptionKey;
      updateSettings.mutate(needsFix, {
        onSuccess: () => {
          // Silently fix - no toast needed for data corruption fixes
          queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
        onError: (error) => {
          logger.warn('Failed to auto-fix corrupted settings:', error);
          // Reset the ref on error so we can retry if needed
          corruptionFixAttemptedRef.current = '';
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultClientPaymentMethod, settings?.defaultInventoryUnit, isDirty, dirtyFields]);

  // Fix Issue #11: Improved infinite loop prevention with better dependency management
  useEffect(() => {
    if (settings) {
      try {
        // Serialize settings to compare with last reset
        const settingsKey = JSON.stringify(settings);
        
        // Fix Issue #11: More robust check to prevent infinite loops
        // Only reset if:
        // 1. There are no unsaved changes
        // 2. Settings have actually changed (not just a refetch with same data)
        // 3. We haven't reset with these exact settings before
        const hasUnsavedChanges = isDirty || Object.keys(dirtyFields).length > 0;
        const settingsChanged = lastResetSettingsRef.current !== settingsKey;
        
        if (!hasUnsavedChanges && settingsChanged) {
          // Validate settings structure before reset
          const resetValues = createResetValues(settings);
          if (resetValues && typeof resetValues === 'object' && !Array.isArray(resetValues)) {
            // Reset form with new values and update defaultValues so isDirty works correctly
            reset(resetValues, { keepDefaultValues: false });
            // Update ref to track this reset - do this AFTER reset to prevent loops
            lastResetSettingsRef.current = settingsKey;
          } else {
            logger.warn('Invalid settings structure, skipping form reset:', settings);
          }
        }
      } catch (error) {
        logger.error('Error validating settings before reset:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileFormData.name?.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    try {
      isSubmittingProfileRef.current = true;
      logger.info('Submitting profile:', profileFormData);
      
      // Prepare data for API - trim all values and convert empty strings to undefined
      const submitData: Record<string, string> = {
        name: profileFormData.name.trim(),
      };
      
      // Only include fields that have values
      if (profileFormData.phone?.trim()) {
        submitData.phone = profileFormData.phone.trim();
      }
      if (profileFormData.timezone?.trim()) {
        submitData.timezone = profileFormData.timezone.trim();
      }
      if (profileFormData.address?.trim()) {
        submitData.address = profileFormData.address.trim();
      }
      if (profileFormData.bio?.trim()) {
        submitData.bio = profileFormData.bio.trim();
      }

      logger.info('Sending to API:', submitData);
      
      const updatedProfile = await updateProfile.mutateAsync(submitData);
      logger.info('Profile updated successfully:', updatedProfile);
      
      // Update local state with response
      if (updatedProfile) {
        isSubmittingProfileRef.current = true; // Prevent useEffect from resetting
        setProfileFormData({
          name: updatedProfile.name || '',
          phone: updatedProfile.phone || '',
          timezone: updatedProfile.timezone || '',
          address: updatedProfile.address || '',
          bio: updatedProfile.bio || '',
        });
        
        // Allow useEffect to run after a delay
        setTimeout(() => {
          isSubmittingProfileRef.current = false;
        }, 1000);
      }
      
      // Invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
      await queryClient.refetchQueries({ queryKey: ['user', 'profile'] });
      
      showToast('Profile updated successfully', 'success');
    } catch (error: unknown) {
      isSubmittingProfileRef.current = false;
      logger.error('Profile update failed:', error);
      const errorMessage = getErrorMessage(error, 'Failed to update profile');
      showToast(errorMessage, 'error');
      
      // Show detailed error if available
      const errorData = getErrorResponseData(error);
      if (isRecord(errorData) && 'message' in errorData && typeof errorData.message === 'string') {
        showToast(errorData.message, 'error');
      }
    }
  };

  const onSettingsSubmit = async (data: UserSettings) => {
    try {
      // Get all current form values to ensure we capture everything, including fields not in current view
      const allFormValues = getValues();
      
      // Merge submitted data with all form values to ensure we don't lose any fields
      const mergedData = { ...allFormValues, ...data };
      
      // List of error response properties that should never be sent as settings
      const errorResponseProperties = ['statusCode', 'timestamp', 'path', 'message', 'error', 'errors'];
      
      // Ensure empty strings, null, and undefined values are removed or converted
      const cleanedData = Object.fromEntries(
        Object.entries(mergedData)
          // First, filter out error response properties and sensitive fields that shouldn't be updated via settings
          .filter(([key]) => {
            // Exclude error response properties
            if (errorResponseProperties.includes(key)) return false;
            // Exclude removed fields that no longer exist in the backend
            const removedFields = [
              'twoFactorSecret',
              'enableTwoFactorAuth',
              'fontSize',
              'compactMode',
              'showDashboardCharts',
              'showNotifications',
              'autoBackup',
              'backupRetentionDays',
              'allowDataExport',
              'backupSchedule',
              'backupTime',
              'exportFormats',
              'notificationFrequency',
              'quietHoursStart',
              'quietHoursEnd',
              'additionalTaxRates',
              'inventoryUnitConversion',
              'weeksSupplyTarget',
              'autoCreateClients',
              'defaultClientNotes',
              'defaultClientPaymentMethod',
              'defaultClientCreditLimit',
              'defaultClientCurrency',
              'invoiceHeaderText',
              'showInvoiceWatermark',
              'invoiceWatermarkText',
            ];
            if (removedFields.includes(key)) return false;
            return true;
          })
          .map(([key, value]) => {
            // Special handling for exportFormats - keep it even if it's a string
            if (key === 'exportFormats' && value) {
              // Ensure exportFormats is always a JSON string
              if (Array.isArray(value)) {
                return [key, JSON.stringify(value)];
              }
              if (typeof value === 'string' && value.trim() !== '') {
                return [key, value];
              }
            }
            
            // Special handling for invoiceNumberFormat - must be undefined if empty or invalid
            if (key === 'invoiceNumberFormat') {
              if (!value || (typeof value === 'string' && value.trim() === '')) {
                return [key, undefined];
              }
              // Check if it has a placeholder
              const placeholders = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{NUM}', '{####}'];
              const hasPlaceholder = placeholders.some(placeholder => String(value).includes(placeholder));
              if (!hasPlaceholder) {
                return [key, undefined]; // Remove invalid format
              }
              return [key, typeof value === 'string' ? value.trim() : value];
            }
            
            // Special handling for numeric fields - convert strings to numbers
            const numericFields = ['defaultTaxRate', 'defaultPaymentTermsDays', 'defaultReorderLevel',
              'stockAlertThreshold', 'itemsPerPage', 'smtpPort'];
            if (numericFields.includes(key)) {
              if (value === null || value === undefined || value === '') {
                return [key, undefined];
              }
              const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
              if (isNaN(numValue)) {
                return [key, undefined];
              }
              return [key, numValue];
            }
            
            // Convert empty strings, null, or whitespace-only strings to undefined
            if (value === null || value === undefined) return [key, undefined];
            if (typeof value === 'string' && value.trim() === '') return [key, undefined];
            return [key, value];
          })
          // Remove undefined values from the object to avoid sending them (except exportFormats)
          .filter(([key, value]) => {
            if (key === 'exportFormats') return true; // Always include exportFormats
            return value !== undefined;
          })
      ) as UserSettings;
      
      await updateSettings.mutateAsync(cleanedData);
    } catch (error: unknown) {
      // Fix Bug #13: Use logger instead of console.error
      logger.error('Settings submit error:', error);
      // Error is handled in mutation's onError handler
      throw error;
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordFormData) => {
    try {
      setIsPasswordChanging(true);
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      showToast('Password changed successfully', 'success');
      // Clear all password fields after successful change
      resetPassword({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password';
      showToast(errorMessage, 'error');
    } finally {
      setIsPasswordChanging(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      // Reset form and update defaultValues so isDirty works correctly
      reset(createResetValues(settings), { keepDefaultValues: false });
      showToast('Settings reset to saved values', 'info');
    }
  };


  // Render Account & Profile category
  const renderAccountCategory = () => (
    <SettingsCategoryWrapper
      title="Account & Profile"
      description="Manage your personal information and account security"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Account & Profile' }]}
    >
          <form onSubmit={handleProfileSubmit}>
        <SettingsSection
          title="Profile Information"
          description="Update your personal information and account details"
        >
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6} label="Name" required>
                  <TextField
                    fullWidth
                    value={profileFormData.name}
                    onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                    required
                    InputLabelProps={{ shrink: true }}
                  />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Email" description="Email cannot be changed. Contact support if you need to update your email address.">
                  <TextField
                    fullWidth
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    InputLabelProps={{ shrink: true }}
                  />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Phone" description="Your contact phone number">
                  <TextField
                    fullWidth
                    type="tel"
                    value={profileFormData.phone}
                    onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                    InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Timezone" description="Your local timezone">
                  <TextField
                    fullWidth
                    value={profileFormData.timezone}
                    onChange={(e) => setProfileFormData({ ...profileFormData, timezone: e.target.value })}
                    InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} label="Address">
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    value={profileFormData.address}
                    onChange={(e) => setProfileFormData({ ...profileFormData, address: e.target.value })}
                InputLabelProps={{ shrink: true }}
                  />
            </SettingsField>
            <SettingsField xs={12} label="Bio" description="Brief description about yourself">
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={profileFormData.bio}
                    onChange={(e) => setProfileFormData({ ...profileFormData, bio: e.target.value })}
                    placeholder="Brief description about yourself..."
                InputLabelProps={{ shrink: true }}
                  />
            </SettingsField>
                </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
                onClick={() => {
                  if (profile) {
                    setProfileFormData({
                      name: profile.name || '',
                      phone: profile.phone || '',
                      timezone: profile.timezone || '',
                      address: profile.address || '',
                      bio: profile.bio || '',
                    });
                    showToast('Profile reset to saved values', 'info');
                  }
                }}
                disabled={updateProfile.isPending || !profile}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
                disabled={updateProfile.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>

      <form onSubmit={handleSubmitPassword(onPasswordSubmit)}>
        {/* Hidden username field for accessibility and autofill */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={profile?.email || ''}
          readOnly
          style={{ display: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
        />
        <SettingsSection
          title="Change Password"
          description="Update your account password to keep your account secure"
        >
          <Grid container spacing={3}>
            <SettingsField xs={12} label="Current Password" required error={passwordErrors.currentPassword?.message}>
              <TextField
                fullWidth
                type="password"
                {...registerPassword('currentPassword')}
                error={!!passwordErrors.currentPassword}
                autoComplete="current-password"
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField
              xs={12}
              label="New Password"
              required
              error={passwordErrors.newPassword?.message}
              description={passwordStrength ? `Password strength: ${passwordStrength}` : undefined}
            >
              <TextField
                fullWidth
                type="password"
                {...registerPassword('newPassword')}
                error={!!passwordErrors.newPassword}
                autoComplete="new-password"
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} label="Confirm New Password" required error={passwordErrors.confirmPassword?.message}>
              <TextField
                fullWidth
                type="password"
                {...registerPassword('confirmPassword')}
                error={!!passwordErrors.confirmPassword}
                autoComplete="new-password"
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
          </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => {
              resetPassword({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
              });
            }}
            disabled={isPasswordChanging}
          >
            Clear
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isPasswordChanging}
            sx={{ minWidth: 120 }}
          >
            {isPasswordChanging ? 'Changing...' : 'Change Password'}
          </Button>
        </Box>
      </form>


      <SettingsSection title="Two-Factor Authentication (2FA)" description="Add an extra layer of security to your account">
        {/* Fix Issue #95: Security warning for 2FA */}
        {!watch('enableTwoFactorAuth') && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Security Recommendation:</strong> Enable two-factor authentication to protect your account from unauthorized access.
            </Typography>
          </Alert>
        )}
        <Grid container spacing={3}>
          <SettingsField 
            xs={12}
            description={settings?.enableTwoFactorAuth ? "Two-factor authentication is enabled. Disable it to remove the extra security layer." : "Enable two-factor authentication for enhanced account security"}
            tooltip="2FA adds an extra layer of security by requiring a code from your authenticator app"
            helpLink="https://docs.example.com/2fa"
          >
            <Box>
              <Controller
                name="enableTwoFactorAuth"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value ?? settings?.enableTwoFactorAuth ?? false}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          // Fix 2FA Switch Form State: Update form value immediately to trigger dirty state
                          field.onChange(newValue);
                          
                          if (newValue) {
                            // Opening setup dialog
                            setTwoFactorDialogOpen(true);
                            setTwoFactorStep(0);
                            setTwoFactorVerificationCode('');
                          } else {
                            // Disabling 2FA - need verification code
                            setTwoFactorDialogOpen(true);
                            setTwoFactorStep(3); // Go to disable step
                            setTwoFactorVerificationCode('');
                          }
                        }}
                        disabled={updateSettings.isPending || isEnabling2FA || isDisabling2FA}
                      />
                    }
                    label={settings?.enableTwoFactorAuth ? "Two-Factor Authentication (Enabled)" : "Enable Two-Factor Authentication"}
                  />
                )}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                {settings?.enableTwoFactorAuth 
                  ? "Your account is protected with two-factor authentication. You'll need a verification code from your authenticator app to sign in."
                  : "Add an extra layer of security by requiring a verification code in addition to your password."}
              </Typography>
            </Box>
          </SettingsField>
        </Grid>
      </SettingsSection>
    </SettingsCategoryWrapper>
  );

  // Render Company Information category
  const renderCompanyCategory = () => (
    <SettingsCategoryWrapper
      title="Company Information"
      description="Update your company details that will appear on invoices and documents"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Company Information' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      {/* Fix Issue #83: Change summary before save */}
      {hasChanges && changeSummary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Unsaved changes:</strong> {changeSummary}
          </Typography>
        </Alert>
      )}
      
      <form onSubmit={handleSettingsSubmit}>
        <SettingsSection
          title="Company Details"
          description="Basic company information for invoices and documents"
        >
              <Grid container spacing={3}>
            <SettingsField xs={12} label="Company Name">
                  <TextField
                    fullWidth
                {...register('companyName')}
                error={!!errors.companyName}
                helperText={errors.companyName?.message}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} label="Company Address">
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                {...register('companyAddress')}
                InputLabelProps={{ shrink: true }}
                  />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Company Phone">
                  <TextField
                    fullWidth
                {...register('companyPhone')}
                error={!!errors.companyPhone}
                helperText={errors.companyPhone?.message}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            {/* Fix Issue #51-55: Add descriptions, tooltips, examples, placeholders */}
            <SettingsField 
              xs={12} 
              md={6} 
              label="Company Email"
              description="Email address for your company. Used in invoices and communications."
              example="contact@example.com"
              placeholder="contact@example.com"
            >
              <TextField
                fullWidth
                type="email"
                {...register('companyEmail')}
                error={!!errors.companyEmail}
                helperText={errors.companyEmail?.message}
                InputLabelProps={{ shrink: true }}
                placeholder="contact@example.com"
              />
            </SettingsField>
            <SettingsField 
              xs={12} 
              md={6} 
              label="Website"
              description="Your company website URL"
              example="https://www.example.com"
              placeholder="https://www.example.com"
            >
              <TextField
                fullWidth
                type="url"
                placeholder="https://www.example.com"
                {...register('companyWebsite')}
                error={!!errors.companyWebsite}
                helperText={errors.companyWebsite?.message}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField 
              xs={12} 
              md={6} 
              label="Company Logo URL"
              description="URL to your company logo image. Will be displayed on invoices."
              example="https://example.com/logo.png"
              placeholder="https://example.com/logo.png"
            >
              <TextField
                fullWidth
                type="url"
                placeholder="https://example.com/logo.png"
                {...register('companyLogo')}
                error={!!errors.companyLogo}
                helperText={errors.companyLogo?.message || 'URL to your company logo image'}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} md={4} label="Tax ID / EIN">
                  <TextField
                    fullWidth
                {...register('companyTaxId')}
                error={!!errors.companyTaxId}
                helperText={errors.companyTaxId?.message}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} md={4} label="Registration Number">
                  <TextField
                    fullWidth
                {...register('companyRegistrationNumber')}
                error={!!errors.companyRegistrationNumber}
                helperText={errors.companyRegistrationNumber?.message}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField xs={12} md={4} label="VAT Number">
                  <TextField
                    fullWidth
                {...register('companyVatNumber')}
                error={!!errors.companyVatNumber}
                helperText={errors.companyVatNumber?.message}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
                </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );

  // Render Invoice Settings category
  const renderInvoiceCategory = () => (
    <SettingsCategoryWrapper
      title="Invoice Settings"
      description="Configure default invoice settings, numbering, and display options"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Invoice Settings' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit}>
        <SettingsSection
          title="Invoice Defaults"
          description="Default values for new invoices"
        >
              <Grid container spacing={3}>
            {/* Fix Issue #51-55, #64-65: Enhanced invoice number format field with preview */}
            <SettingsField
              xs={12}
              md={6}
              label="Invoice Number Format"
              description="Use {YYYY} for year, {YY} for 2-digit year, {####} for number, {MM} for month, {DD} for day"
              example="INV-{YYYY}-{####} → INV-2024-0001"
              tooltip="Placeholders: {YYYY} = full year, {YY} = 2-digit year, {####} = sequential number, {MM} = month, {DD} = day"
              error={errors.invoiceNumberFormat?.message}
            >
              <Box>
                <TextField
                  fullWidth
                  placeholder="INV-{YYYY}-{####}"
                  {...register('invoiceNumberFormat')}
                  error={!!errors.invoiceNumberFormat}
                  helperText={errors.invoiceNumberFormat?.message}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ maxLength: 100 }}
                />
                {/* Fix Issue #65: Format preview */}
                {watch('invoiceNumberFormat') && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Preview: {watch('invoiceNumberFormat')
                      ?.replace(/\{YYYY\}/g, new Date().getFullYear().toString())
                      ?.replace(/\{YY\}/g, new Date().getFullYear().toString().slice(-2))
                      ?.replace(/\{MM\}/g, String(new Date().getMonth() + 1).padStart(2, '0'))
                      ?.replace(/\{DD\}/g, String(new Date().getDate()).padStart(2, '0'))
                      ?.replace(/\{####\}/g, '0001') || 'Enter format to see preview'}
                  </Typography>
                )}
              </Box>
            </SettingsField>
            <SettingsField xs={12} md={6} label="Default Currency" error={errors.defaultCurrency?.message}>
                <Controller
                  name="defaultCurrency"
                control={control}
                  render={({ field }) => (
                  <FormControl fullWidth error={!!errors.defaultCurrency}>
                    <Select {...field} value={field.value || 'USD'} displayEmpty>
                        <MenuItem value="USD">USD - US Dollar ($)</MenuItem>
                        <MenuItem value="EUR">EUR - Euro (€)</MenuItem>
                        <MenuItem value="GBP">GBP - British Pound (£)</MenuItem>
                        <MenuItem value="JPY">JPY - Japanese Yen (¥)</MenuItem>
                        <MenuItem value="AUD">AUD - Australian Dollar (A$)</MenuItem>
                        <MenuItem value="CAD">CAD - Canadian Dollar (C$)</MenuItem>
                        <MenuItem value="CHF">CHF - Swiss Franc</MenuItem>
                        <MenuItem value="CNY">CNY - Chinese Yuan (¥)</MenuItem>
                        <MenuItem value="INR">INR - Indian Rupee (₹)</MenuItem>
                        <MenuItem value="SGD">SGD - Singapore Dollar (S$)</MenuItem>
                        <MenuItem value="HKD">HKD - Hong Kong Dollar (HK$)</MenuItem>
                        <MenuItem value="NZD">NZD - New Zealand Dollar (NZ$)</MenuItem>
                        <MenuItem value="MXN">MXN - Mexican Peso ($)</MenuItem>
                        <MenuItem value="BRL">BRL - Brazilian Real (R$)</MenuItem>
                        <MenuItem value="ZAR">ZAR - South African Rand (R)</MenuItem>
                        <MenuItem value="SEK">SEK - Swedish Krona (kr)</MenuItem>
                        <MenuItem value="NOK">NOK - Norwegian Krone (kr)</MenuItem>
                        <MenuItem value="DKK">DKK - Danish Krone (kr)</MenuItem>
                        <MenuItem value="PLN">PLN - Polish Zloty (zł)</MenuItem>
                        <MenuItem value="RUB">RUB - Russian Ruble (₽)</MenuItem>
                        <MenuItem value="TRY">TRY - Turkish Lira (₺)</MenuItem>
                        <MenuItem value="AED">AED - UAE Dirham (د.إ)</MenuItem>
                        <MenuItem value="SAR">SAR - Saudi Riyal (﷼)</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            {/* Fix Issue #86-87: Add unit and range display */}
            <SettingsField 
              xs={12} 
              md={6} 
              label="Default Tax Rate"
              description="Default tax rate applied to invoices"
              tooltip="Enter a value between 0 and 100"
            >
                <TextField
                  fullWidth
                  type="number"
                inputProps={{ step: '0.01', min: 0, max: 100 }}
                {...register('defaultTaxRate', { valueAsNumber: true })}
                InputLabelProps={{ shrink: true }}
                helperText="Range: 0-100%"
                InputProps={{
                  endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>%</Typography>
                }}
              />
            </SettingsField>
            <SettingsField 
              xs={12} 
              md={6} 
              label="Default Payment Terms"
              description="Number of days until payment is due"
              tooltip="Enter a value between 0 and 365 days"
            >
                <TextField
                  fullWidth
                  type="number"
                {...register('defaultPaymentTermsDays', { valueAsNumber: true })}
                  InputLabelProps={{ shrink: true }}
                  helperText="Range: 0-365 days"
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>days</Typography>
                  }}
                />
            </SettingsField>
            <SettingsField xs={12} label="Default Invoice Notes">
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                {...register('defaultInvoiceNotes')}
                  placeholder="Default notes to include on all invoices..."
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} label="Default Terms & Conditions">
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                {...register('defaultInvoiceTerms')}
                  placeholder="Default terms and conditions to include on all invoices..."
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <SettingsSection title="Invoice Options" description="Control invoice behavior and display">
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6}>
                <Controller
                  name="autoGenerateInvoiceNumber"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.autoGenerateInvoiceNumber ?? true}
                          onChange={field.onChange}
                        />
                      }
                      label="Auto-generate Invoice Numbers"
                    />
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6}>
                <Controller
                  name="showInvoiceNumberOnPDF"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.showInvoiceNumberOnPDF ?? true}
                          onChange={field.onChange}
                        />
                      }
                      label="Show Invoice Number on PDF"
                    />
                  )}
                />
            </SettingsField>
            <SettingsField xs={12}>
                <Controller
                  name="showPaymentInstructions"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.showPaymentInstructions ?? true}
                          onChange={field.onChange}
                        />
                      }
                      label="Show Payment Instructions on Invoices"
                    />
                  )}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <SettingsSection title="Invoice Customization" description="Customize invoice appearance">
              <Grid container spacing={3}>
            <SettingsField xs={12} label="Invoice Footer Text">
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                {...register('invoiceFooterText')}
                    placeholder="Custom text to appear at the bottom of invoices..."
                InputLabelProps={{ shrink: true }}
                  />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );

  // Render Localization category
  const renderLocalizationCategory = () => (
    <SettingsCategoryWrapper
      title="Date, Time & Currency"
      description="Configure how dates, times, and currency are displayed throughout the application"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Localization' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit}>
        <SettingsSection title="Date & Time Format" description="Configure date and time display formats">
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6} label="Date Format">
                <Controller
                  name="dateFormat"
                control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                    <Select {...field} value={field.value || 'MM/DD/YYYY'} displayEmpty>
                        <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                        <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                        <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                        <MenuItem value="DD-MM-YYYY">DD-MM-YYYY</MenuItem>
                        <MenuItem value="MMM DD, YYYY">MMM DD, YYYY</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Time Format">
                <Controller
                  name="timeFormat"
                control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                    <Select {...field} value={field.value || '12'} displayEmpty>
                        <MenuItem value="12">12-hour (AM/PM)</MenuItem>
                        <MenuItem value="24">24-hour</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} label="Timezone" error={errors.timezone?.message}>
                <Controller
                  name="timezone"
                control={control}
                  render={({ field }) => (
                  <FormControl fullWidth error={!!errors.timezone}>
                    <Select {...field} value={field.value || 'America/New_York'} displayEmpty>
                        <MenuItem value="America/New_York">Eastern Time (ET)</MenuItem>
                        <MenuItem value="America/Chicago">Central Time (CT)</MenuItem>
                        <MenuItem value="America/Denver">Mountain Time (MT)</MenuItem>
                        <MenuItem value="America/Los_Angeles">Pacific Time (PT)</MenuItem>
                        <MenuItem value="America/Phoenix">Arizona Time</MenuItem>
                        <MenuItem value="America/Anchorage">Alaska Time</MenuItem>
                        <MenuItem value="Pacific/Honolulu">Hawaii Time</MenuItem>
                        <MenuItem value="Europe/London">London (GMT)</MenuItem>
                        <MenuItem value="Europe/Paris">Paris (CET)</MenuItem>
                        <MenuItem value="Europe/Berlin">Berlin (CET)</MenuItem>
                        <MenuItem value="Europe/Rome">Rome (CET)</MenuItem>
                        <MenuItem value="Europe/Madrid">Madrid (CET)</MenuItem>
                        <MenuItem value="Asia/Tokyo">Tokyo (JST)</MenuItem>
                        <MenuItem value="Asia/Shanghai">Shanghai (CST)</MenuItem>
                        <MenuItem value="Asia/Hong_Kong">Hong Kong (HKT)</MenuItem>
                        <MenuItem value="Asia/Dubai">Dubai (GST)</MenuItem>
                        <MenuItem value="Asia/Kolkata">Mumbai (IST)</MenuItem>
                        <MenuItem value="Australia/Sydney">Sydney (AEST)</MenuItem>
                        <MenuItem value="Australia/Melbourne">Melbourne (AEST)</MenuItem>
                        <MenuItem value="America/Toronto">Toronto (ET)</MenuItem>
                        <MenuItem value="America/Vancouver">Vancouver (PT)</MenuItem>
                        <MenuItem value="America/Mexico_City">Mexico City (CST)</MenuItem>
                        <MenuItem value="America/Sao_Paulo">São Paulo (BRT)</MenuItem>
                        <MenuItem value="America/Buenos_Aires">Buenos Aires (ART)</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <SettingsSection title="Currency Format" description="Configure currency display format">
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6} label="Decimal Separator">
                <TextField
                  fullWidth
                {...register('decimalSeparator')}
                  inputProps={{ maxLength: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Thousands Separator">
                <TextField
                  fullWidth
                {...register('thousandsSeparator')}
                  inputProps={{ maxLength: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Currency Symbol Position">
                <Controller
                  name="currencySymbolPosition"
                control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                    <Select {...field} value={field.value || 'left'} displayEmpty>
                        <MenuItem value="left">Left ($100)</MenuItem>
                        <MenuItem value="right">Right (100$)</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6}>
                <Controller
                  name="showCurrencySymbol"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.showCurrencySymbol ?? true}
                          onChange={field.onChange}
                        />
                      }
                      label="Show Currency Symbol"
                    />
                  )}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
          <Button
            type="button"
            variant="outlined"
            onClick={handleReset}
            disabled={updateSettings.isPending}
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={updateSettings.isPending || !hasChanges}
            sx={{ minWidth: 120 }}
          >
            {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </form>
    </SettingsCategoryWrapper>
  );

  // Render Tax Settings category
  const renderTaxCategory = () => (
    <SettingsCategoryWrapper
      title="Tax Settings"
      description="Configure tax calculation preferences and tax registration information"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Tax Settings' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit}>
        <SettingsSection title="Tax Configuration" description="Tax calculation and display settings">
              <Grid container spacing={3}>
            <SettingsField xs={12}>
                <Controller
                  name="taxInclusive"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.taxInclusive ?? false}
                          onChange={field.onChange}
                        />
                      }
                      label="Prices Include Tax (Tax Inclusive)"
                    />
                  )}
                />
            </SettingsField>
            <SettingsField
              xs={12}
              label="Tax Registration Number"
              error={errors.taxRegistrationNumber?.message}
            >
                <TextField
                  fullWidth
                {...register('taxRegistrationNumber')}
                error={!!errors.taxRegistrationNumber}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );

  // Render Client Defaults category - removed, no longer needed
  const renderClientsCategory = () => (
    <SettingsCategoryWrapper
      title="Client Defaults"
      description="Client default settings have been simplified"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Client Defaults' }]}
      hasUnsavedChanges={hasChanges}
    >
      <Alert severity="info">
        Client default settings have been removed. You can configure client-specific settings when creating or editing clients.
      </Alert>
    </SettingsCategoryWrapper>
  );

  // Render Inventory category
  const renderInventoryCategory = () => (
    <SettingsCategoryWrapper
      title="Inventory Settings"
      description="Configure default inventory management settings and tracking options"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Inventory' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit}>
        <SettingsSection title="Inventory Defaults" description="Default settings for inventory management">
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6} label="Default Reorder Level">
                <TextField
                  fullWidth
                  type="number"
                {...register('defaultReorderLevel', { valueAsNumber: true })}
                  InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField
              xs={12}
              md={6}
              label="Default Inventory Unit"
              error={errors.defaultInventoryUnit?.message}
            >
                <Controller
                  name="defaultInventoryUnit"
                control={control}
                  render={({ field }) => {
                    // Validate value to prevent MUI warnings for invalid enum values
                    const validValue = field.value && VALID_INVENTORY_UNITS.includes(field.value as typeof VALID_INVENTORY_UNITS[number])
                      ? field.value
                      : '';
                    return (
                  <FormControl fullWidth error={!!errors.defaultInventoryUnit}>
                    <Select {...field} value={validValue} displayEmpty>
                        <MenuItem value="" disabled>
                          <em>Select unit</em>
                        </MenuItem>
                        <MenuItem value="piece">Piece</MenuItem>
                        <MenuItem value="kg">Kilogram (kg)</MenuItem>
                        <MenuItem value="g">Gram (g)</MenuItem>
                        <MenuItem value="lb">Pound (lb)</MenuItem>
                        <MenuItem value="oz">Ounce (oz)</MenuItem>
                        <MenuItem value="l">Liter (l)</MenuItem>
                        <MenuItem value="ml">Milliliter (ml)</MenuItem>
                        <MenuItem value="m">Meter (m)</MenuItem>
                        <MenuItem value="cm">Centimeter (cm)</MenuItem>
                        <MenuItem value="ft">Foot (ft)</MenuItem>
                        <MenuItem value="in">Inch (in)</MenuItem>
                        <MenuItem value="box">Box</MenuItem>
                        <MenuItem value="pack">Pack</MenuItem>
                        <MenuItem value="case">Case</MenuItem>
                        <MenuItem value="pallet">Pallet</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                    );
                  }}
                />
            </SettingsField>
            <SettingsField xs={12}>
                <Controller
                  name="trackInventory"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.trackInventory ?? true}
                          onChange={field.onChange}
                        />
                      }
                      label="Track Inventory Automatically"
                    />
                  )}
                />
            </SettingsField>
            {/* Fix Issue #95: Warning for negative stock */}
            <SettingsField 
              xs={12}
              description="Allow inventory to go below zero"
              tooltip="When enabled, you can sell items even if stock is insufficient"
            >
              {watch('allowNegativeStock') && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Warning:</strong> Allowing negative stock can lead to overselling and inventory discrepancies. 
                    Consider enabling automatic reorder alerts instead.
                  </Typography>
                </Alert>
              )}
              <Controller
                name="allowNegativeStock"
              control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value ?? settings?.allowNegativeStock ?? true}
                        onChange={field.onChange}
                      />
                    }
                    label="Allow Negative Stock"
                  />
                )}
              />
            </SettingsField>
            <SettingsField xs={12}>
                <Controller
                  name="autoReorderEnabled"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.autoReorderEnabled ?? false}
                          onChange={field.onChange}
                        />
                      }
                      label="Enable Auto-Reorder When Stock is Low"
                    />
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Stock Alert Threshold" description="Alert when stock falls below this number">
                <TextField
                  fullWidth
                  type="number"
                {...register('stockAlertThreshold', { valueAsNumber: true })}
                  InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );

  // Email functionality removed
  // const renderEmailCategory = () => (
    <SettingsCategoryWrapper
      title="Email & SMTP Settings"
      description="Configure SMTP settings to send invoices and notifications via email"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Email & SMTP' }]}
      hasUnsavedChanges={hasChanges}
    >
      <form onSubmit={handleSettingsSubmit}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure SMTP settings to send invoices and notifications via email. After saving, you can test your configuration.
          </Alert>

        <SettingsSection title="SMTP Configuration" description="Email server settings">
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6} label="SMTP Host">
                <TextField
                  fullWidth
                  placeholder="smtp.gmail.com"
                {...register('smtpHost')}
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="SMTP Port">
                <TextField
                  fullWidth
                  type="number"
                  placeholder="587"
                {...register('smtpPort', { valueAsNumber: true })}
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6}>
                <Controller
                  name="smtpSecure"
                control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value ?? settings?.smtpSecure ?? false}
                          onChange={field.onChange}
                        />
                      }
                      label="Use Secure Connection (TLS/SSL)"
                    />
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="SMTP Username">
                <TextField
                  fullWidth
                {...register('smtpUser')}
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="SMTP Password">
                {/* Hidden username field for accessibility */}
                <input
                  type="text"
                  name="smtp-username"
                  autoComplete="username"
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <TextField
                  fullWidth
                  type="password"
                {...register('smtpPassword')}
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="From Name" description="Display name for sent emails">
                <TextField
                  fullWidth
                  placeholder="Your Company Name"
                {...register('emailFromName')}
                InputLabelProps={{ shrink: true }}
              />
            </SettingsField>
            <SettingsField
              xs={12}
              md={6}
              label="From Email Address"
              error={errors.emailFromAddress?.message}
            >
                <TextField
                  fullWidth
                  type="email"
                  placeholder="noreply@yourcompany.com"
                {...register('emailFromAddress')}
                error={!!errors.emailFromAddress}
                InputLabelProps={{ shrink: true }}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="button"
                variant="outlined"
                disabled={updateSettings.isPending}
                onClick={async () => {
                  try {
                    // Get current form values for testing
                    const formValues = getValues();
                    const testCredentials = {
                      smtpHost: formValues.smtpHost,
                      smtpPort: formValues.smtpPort,
                      smtpSecure: formValues.smtpSecure,
                      smtpUser: formValues.smtpUser,
                      smtpPassword: formValues.smtpPassword,
                      emailFromAddress: formValues.emailFromAddress,
                      emailFromName: formValues.emailFromName,
                    };

                    // Test connection using provided credentials or environment variables
                    const result = await settingsApi.testEmail(
                      (testCredentials.smtpHost || testCredentials.smtpUser || testCredentials.smtpPassword)
                        ? testCredentials
                        : undefined
                    );

                    if (result.success) {
                      showToast(result.message || 'Email connection test successful!', 'success');
                    } else {
                      showToast(result.message || 'Email connection test failed', 'error');
                    }
                  } catch (error: unknown) {
                    showToast(getErrorMessage(error, 'Failed to test email connection'), 'error');
                  }
                }}
              >
                Test Connection
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  // );

  // Render Notifications category
  const renderNotificationsCategory = () => (
    <SettingsCategoryWrapper
      title="Notification Preferences"
      description="Choose which email notifications you want to receive"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Notifications' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit}>
        <SettingsSection title="Notifications" description="Email functionality has been disabled">
              <Grid container spacing={3}>
            <SettingsField xs={12}>
              <Alert severity="info">
                Email notifications have been disabled. All notification preferences are now handled through the application interface.
              </Alert>
            </SettingsField>
              </Grid>
        </SettingsSection>


        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );

  // Render Appearance category
  const renderAppearanceCategory = () => (
    <SettingsCategoryWrapper
      title="Appearance & Display"
      description="Customize the appearance and behavior of the user interface"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Appearance' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit} style={{ pointerEvents: 'auto' }}>
        <SettingsSection title="Display Settings" description="Configure UI appearance and behavior">
              <Grid container spacing={3}>
            <SettingsField xs={12} md={6} label="Theme">
                <Controller
                  name="theme"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <Select 
                        {...field} 
                        value={field.value || 'light'} 
                        displayEmpty
                        disabled={updateSettings.isPending}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                      >
                        <MenuItem value="light">Light</MenuItem>
                        <MenuItem value="dark">Dark</MenuItem>
                        <MenuItem value="auto">Auto (System)</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Items Per Page">
                <Controller
                  name="itemsPerPage"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <Select
                        {...field}
                        value={field.value ?? 10}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          // Select component value can be string or number - convert to string first
                          const valueStr = String(rawValue || '').trim();
                          if (!valueStr) {
                            field.onChange(10);
                            return;
                          }
                          const num = Number(valueStr);
                          if (Number.isFinite(num) && num >= 0 && num <= 1000) {
                            field.onChange(num);
                          } else {
                            field.onChange(num < 0 ? 0 : 1000);
                          }
                        }}
                        displayEmpty
                        disabled={updateSettings.isPending}
                      >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Language" error={errors.language?.message}>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.language}>
                      <Select 
                        {...field} 
                        value={field.value || 'en'} 
                        displayEmpty
                        disabled={updateSettings.isPending}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                      >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="es">Español</MenuItem>
                        <MenuItem value="fr">Français</MenuItem>
                        <MenuItem value="de">Deutsch</MenuItem>
                        <MenuItem value="it">Italiano</MenuItem>
                        <MenuItem value="pt">Português</MenuItem>
                        <MenuItem value="zh">中文</MenuItem>
                        <MenuItem value="ja">日本語</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Primary Color" error={errors.primaryColor?.message}>
                <Controller
                  name="primaryColor"
                  control={control}
                  render={({ field }) => {
                    const currentValue = field.value || settings?.primaryColor || '#1976d2';
                    return (
                      <TextField
                        fullWidth
                        type="color"
                        value={currentValue}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          field.onChange(newValue || undefined);
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        disabled={updateSettings.isPending}
                        error={!!errors.primaryColor}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                          '& input[type="color"]': {
                            height: '56px',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                          },
                        }}
                      />
                    );
                  }}
                />
            </SettingsField>
            <SettingsField xs={12} md={6} label="Secondary Color" error={errors.secondaryColor?.message}>
                <Controller
                  name="secondaryColor"
                  control={control}
                  render={({ field }) => {
                    const currentValue = field.value || settings?.secondaryColor || '#dc004e';
                    return (
                      <TextField
                        fullWidth
                        type="color"
                        value={currentValue}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          field.onChange(newValue || undefined);
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        disabled={updateSettings.isPending}
                        error={!!errors.secondaryColor}
                        InputLabelProps={{ shrink: true }}
                        sx={{
                          '& input[type="color"]': {
                            height: '56px',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                          },
                        }}
                      />
                    );
                  }}
                />
            </SettingsField>
              </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );

  // Render Backup & Security category - simplified, backup features removed
  const renderBackupCategory = () => {

    return (
    <SettingsCategoryWrapper
      title="Backup & Security"
      description="Configure automatic backups and data export options"
      breadcrumbs={[{ label: 'Settings' }, { label: 'Backup & Security' }]}
      hasUnsavedChanges={hasChanges}
    >
      {renderSuccessFeedback()}
      <form onSubmit={handleSettingsSubmit} style={{ pointerEvents: 'auto' }}>
        <SettingsSection title="Automatic Backups" description="Configure scheduled backups to protect your data">
              <Grid container spacing={3}>
            <SettingsField xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', pointerEvents: 'auto' }}>
                  <Box sx={{ pointerEvents: 'auto' }}>
                    <Typography variant="body1" fontWeight={600} gutterBottom>
                      Enable Automatic Backups
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically create backups on a schedule to protect your data
                    </Typography>
                  </Box>
                  <Box sx={{ pointerEvents: 'auto' }}>
                    <Controller
                      name="autoBackup"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          {...field}
                          checked={field.value ?? settings?.autoBackup ?? true}
                          onChange={(e) => {
                            field.onChange(e.target.checked);
                          }}
                          size="medium"
                          disabled={updateSettings.isPending}
                        />
                      )}
                    />
                  </Box>
                </Box>
            </SettingsField>
            
            {false && (
              <>
                {/* Fix Issue #95, #98: Add warnings and best practices */}
                <SettingsField 
                  xs={12} 
                  md={6} 
                  label="Backup Schedule"
                  description="How often backups should be created"
                  tooltip="Daily backups provide the best protection but use more storage. Weekly or monthly backups are more storage-efficient."
                  error={errors.backupSchedule?.message}
                >
                    <Controller
                      name="backupSchedule"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth error={!!errors.backupSchedule}>
                          <Select 
                            {...field} 
                            value={field.value ?? ''} 
                            displayEmpty
                            disabled={updateSettings.isPending}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : e.target.value;
                              field.onChange(value);
                              // Clear backupTime if schedule is disabled, set default if enabled
                              if (!value) {
                                setValue('backupTime', undefined, { shouldDirty: true });
                              } else if (!getValues('backupTime')) {
                                // Set default time if schedule is enabled but no time is set
                                setValue('backupTime', '02:00', { shouldDirty: true });
                              }
                            }}
                          >
                            <MenuItem value="">
                              <em>Disabled</em>
                            </MenuItem>
                            <MenuItem value="daily">Daily - Every day</MenuItem>
                            <MenuItem value="weekly">Weekly - Once per week</MenuItem>
                            <MenuItem value="monthly">Monthly - Once per month</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                </SettingsField>
                
                {false && (
                  <>
                    <SettingsField 
                      xs={12} 
                      md={6} 
                      label="Backup Time"
                      description={`Backups will run at this time (${settings?.timezone || 'America/New_York'})`}
                    >
                        <Controller
                          name="backupTime"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              type="time"
                              {...field}
                              value={field.value || '02:00'}
                              disabled={updateSettings.isPending}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                              }}
                              InputLabelProps={{ shrink: true }}
                              inputProps={{ step: 300 }}
                            />
                          )}
                        />
                    </SettingsField>
                  </>
                )}
                
                {/* Fix Issue #86-87: Add unit and range display */}
                <SettingsField 
                  xs={12} 
                  md={6} 
                  label="Backup Retention"
                  description="How many days to keep backups before automatic deletion"
                  tooltip="Recommended: 7-30 days for daily backups, 30-90 days for weekly/monthly"
                >
                    <Controller
                      name="backupRetentionDays"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          type="number"
                          {...field}
                          value={field.value ?? 7}
                          disabled={updateSettings.isPending}
                          onChange={(e) => {
                            const value = e.target.value.trim();
                            if (value === '') {
                              field.onChange(undefined);
                              return;
                            }
                            const numValue = Number(value);
                            if (Number.isFinite(numValue) && numValue >= 0 && numValue <= 3650) {
                              field.onChange(numValue);
                            } else {
                              field.onChange(numValue < 0 ? 0 : 3650);
                            }
                          }}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ min: 1, max: 365, step: 1 }}
                          error={!!errors.backupRetentionDays}
                          helperText={errors.backupRetentionDays?.message || `Range: 1-365 days. Backups older than this will be automatically deleted.`}
                          InputProps={{
                            endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>days</Typography>
                          }}
                        />
                      )}
                    />
                </SettingsField>
              </>
            )}
              </Grid>
        </SettingsSection>

        <SettingsSection title="Data Export" description="Control data export capabilities and formats">
              <Grid container spacing={3}>
            <SettingsField xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', pointerEvents: 'auto' }}>
                  <Box sx={{ pointerEvents: 'auto' }}>
                    <Typography variant="body1" fontWeight={600} gutterBottom>
                      Allow Data Export
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enable users to export data in various formats
                    </Typography>
                  </Box>
                  <Box sx={{ pointerEvents: 'auto' }}>
                    <Controller
                      name="allowDataExport"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          {...field}
                          checked={field.value ?? settings?.allowDataExport ?? true}
                          onChange={(e) => {
                            field.onChange(e.target.checked);
                          }}
                          size="medium"
                          disabled={updateSettings.isPending}
                        />
                      )}
                    />
                  </Box>
                </Box>
            </SettingsField>
            
            {watch('allowDataExport') && (
              <SettingsField
                xs={12}
                label="Default Export Formats"
                description="Select which formats should be available for data export. Users can export in any of these formats."
                error={errors.exportFormats?.message}
              >
                  <Controller
                    name="exportFormats"
                  control={control}
                    render={({ field }) => {
                      const formats = ['CSV', 'JSON', 'PDF', 'Excel'];
                      
                      // Parse the field value safely
                      let currentFormats: string[] = ['CSV', 'JSON', 'PDF']; // default
                      if (field.value) {
                        try {
                          if (typeof field.value === 'string') {
                            currentFormats = JSON.parse(field.value);
                          } else if (Array.isArray(field.value)) {
                            currentFormats = field.value;
                          }
                        } catch {
                          // Invalid JSON, use default
                        }
                      }
                      
                      const handleFormatToggle = (format: string) => {
                        const newFormats = currentFormats.includes(format)
                          ? currentFormats.filter((f: string) => f !== format)
                          : [...currentFormats, format];
                        const jsonString = JSON.stringify(newFormats);
                        field.onChange(jsonString);
                      };
                      
                      return (
                        <Box sx={{ pointerEvents: 'auto' }}>
                          <Box display="flex" flexWrap="wrap" gap={1.5} mb={2} sx={{ pointerEvents: 'auto' }}>
                            {formats.map((format) => {
                              const isSelected = currentFormats.includes(format);
                              return (
                                <Box
                                  key={format}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleFormatToggle(format);
                                  }}
                                  sx={{
                                    px: 2.5,
                                    py: 1,
                                    borderRadius: 2,
                                    border: '2px solid',
                                    borderColor: isSelected ? 'primary.main' : 'divider',
                                    bgcolor: isSelected ? 'primary.50' : 'transparent',
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    userSelect: 'none',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                      borderColor: 'primary.main',
                                      bgcolor: isSelected ? 'primary.100' : 'action.hover',
                                      transform: 'translateY(-1px)',
                                      boxShadow: 1,
                                    },
                                    '&:active': {
                                      transform: 'translateY(0px)',
                                    },
                                  }}
                                >
                                  <Typography 
                                    variant="body2" 
                                    fontWeight={isSelected ? 600 : 500}
                                    color={isSelected ? 'primary.main' : 'text.secondary'}
                                    sx={{ pointerEvents: 'none' }}
                                  >
                                    {format}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            // Fix Bug #44: Input sanitization - JSON.stringify is safe here as it's just for display
                            // The actual validation happens in onChange handler
                            value={JSON.stringify(currentFormats, null, 2)}
                            disabled={updateSettings.isPending}
                            onChange={(e) => {
                              try {
                                // Fix Bug #44: Validate and sanitize input before parsing
                                const inputValue = e.target.value.trim();
                                if (!inputValue) {
                                  // Empty input - reset to default
                                  field.onChange(JSON.stringify(['CSV', 'JSON', 'PDF']));
                                  return;
                                }
                                const parsed = JSON.parse(inputValue);
                                if (Array.isArray(parsed)) {
                                  // Validate array contains only strings
                                  const validFormats = parsed.filter(f => typeof f === 'string' && f.trim() !== '');
                                  if (validFormats.length > 0) {
                                    field.onChange(JSON.stringify(validFormats));
                                  }
                                  // If no valid formats, keep current value (handled by catch)
                                }
                              } catch {
                                // Invalid JSON, keep current value - user will see error in UI
                              }
                            }}
                            placeholder='["CSV", "JSON", "PDF"]'
                            error={!!errors.exportFormats}
                            helperText={errors.exportFormats?.message || 'Click format chips above to toggle, or edit the JSON array manually. Selected formats will be available for export.'}
                            InputLabelProps={{ shrink: true }}
                            sx={{ 
                              fontFamily: 'monospace', 
                              fontSize: '0.875rem',
                              pointerEvents: 'auto',
                              '& .MuiInputBase-input': {
                                fontFamily: 'monospace',
                              },
                            }}
                          />
                        </Box>
                      );
                    }}
                  />
              </SettingsField>
            )}
              </Grid>
        </SettingsSection>

        <SettingsSection title="Manual Backup & Export" description="Create a complete backup of all your data including user info, settings, clients, stores, inventory, invoices, and more. Backups are downloaded directly to your device.">
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                <Typography variant="body2">
                  <strong>Complete Data Backup:</strong> Your backup includes all data:
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 3 }}>
                  <li>User information and settings</li>
                  <li>All clients</li>
                  <li>All stores and store item settings</li>
                  <li>All inventory items and stock movements</li>
                  <li>All invoices and invoice items</li>
                  <li>Recurring invoices</li>
                  <li>Invoice templates</li>
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Click "Create Backup Now" to download a complete JSON backup file to your device. Available export formats are based on your settings above.
                </Typography>
              </Alert>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                size="large"
                disabled={isBackupLoading}
                startIcon={isBackupLoading ? <CircularProgress size={20} /> : undefined}
                onClick={async () => {
                  try {
                    setIsBackupLoading(true);
                    const result = await settingsApi.createBackup({ includeSqlBackup: false });
                    showToast(result.message || 'Backup created successfully', 'success');
                    
                    // If data is available, offer to download
                    if (result.data) {
                      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `invoiceme_backup_${result.backupId}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }
                  } catch (error: unknown) {
                    showToast(getErrorMessage(error, 'Failed to create backup'), 'error');
                  } finally {
                    setIsBackupLoading(false);
                  }
                }}
                sx={{ py: 1.5 }}
              >
                {isBackupLoading ? 'Creating Backup...' : 'Create Backup Now'}
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Export Data (Available formats based on your settings):
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={2}>
                {(() => {
                  // Parse export formats from form values (current) or settings (fallback)
                  let availableFormats: string[] = ['CSV', 'JSON', 'PDF']; // Default formats
                  const exportFormatsValue = watch('exportFormats') || settings?.exportFormats;
                  
                  if (exportFormatsValue) {
                    try {
                      if (typeof exportFormatsValue === 'string') {
                        availableFormats = JSON.parse(exportFormatsValue);
                      } else if (Array.isArray(exportFormatsValue)) {
                        availableFormats = exportFormatsValue;
                      }
                    } catch {
                      // Invalid JSON, use default
                    }
                  }
                  
                  // Ensure we always have at least JSON format
                  if (!availableFormats || availableFormats.length === 0) {
                    availableFormats = ['JSON'];
                  }

                  const formatConfigs: { [key: string]: { label: string; color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'; extension: string } } = {
                    JSON: { label: 'Export as JSON', color: 'primary', extension: 'json' },
                    CSV: { label: 'Export as CSV', color: 'secondary', extension: 'csv' },
                    Excel: { label: 'Export as Excel', color: 'success', extension: 'xlsx' },
                    PDF: { label: 'Export as PDF', color: 'error', extension: 'pdf' },
                  };

                  return availableFormats.map((format: string) => {
                    const config = formatConfigs[format];
                    if (!config) return null;

                    const formatKey = format.toLowerCase() as 'json' | 'csv' | 'excel' | 'pdf';
                    const apiFormat = formatKey === 'excel' ? 'excel' : formatKey;

                    return (
                      <Button
                        key={format}
                        variant="outlined"
                        color={config.color}
                        size="medium"
                        disabled={isBackupLoading}
                        startIcon={isBackupLoading ? <CircularProgress size={16} /> : undefined}
                        onClick={async () => {
                          try {
                            setIsBackupLoading(true);
                            const blob = await settingsApi.exportData(apiFormat);
                            
                            // Check if the blob is actually an error JSON response
                            if (blob.type === 'application/json') {
                              const text = await blob.text();
                              try {
                                const errorData = JSON.parse(text);
                                showToast(errorData.message || `Failed to export data as ${format}`, 'error');
                                return;
                              } catch {
                                // Not JSON, continue with download
                              }
                            }
                            
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            link.href = url;
                            link.download = `invoiceme_export_${timestamp}.${config.extension}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                            showToast(`Data exported as ${format} and downloaded successfully`, 'success');
                          } catch (error: unknown) {
                            const errorMessage = getErrorMessage(error, `Failed to export data as ${format}`);
                            showToast(errorMessage, 'error');
                            // Fix Bug #13: Use logger instead of console.error
                            logger.error('Export error:', error);
                          } finally {
                            setIsBackupLoading(false);
                          }
                        }}
                        sx={{ minWidth: 140 }}
                      >
                        {isBackupLoading ? 'Exporting...' : config.label}
                      </Button>
                    );
                  });
                })()}
              </Box>
              {(() => {
                const exportFormatsValue = watch('exportFormats') || settings?.exportFormats;
                let hasFormats = false;
                if (exportFormatsValue) {
                  try {
                    const parsed = typeof exportFormatsValue === 'string' 
                      ? JSON.parse(exportFormatsValue) 
                      : exportFormatsValue;
                    hasFormats = Array.isArray(parsed) && parsed.length > 0;
                  } catch {
                    hasFormats = false;
                  }
                }
                return !hasFormats && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    No export formats selected. Please configure export formats above to enable format-specific exports.
                  </Typography>
                );
              })()}
            </Grid>
          </Grid>
        </SettingsSection>

        <Box display="flex" justifyContent="flex-end" gap={2} mb={4}>
              <Button 
                type="button" 
                variant="outlined"
            onClick={handleReset}
                disabled={updateSettings.isPending}
              >
                Reset
              </Button>
              <Button 
                type="submit" 
                variant="contained"
            disabled={updateSettings.isPending}
                sx={{ minWidth: 120 }}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </form>
    </SettingsCategoryWrapper>
  );
  };

  // Enhanced success feedback component - shown for all categories
  const renderSuccessFeedback = () => {
    if (!showSuccessFeedback) return null;
    
    return (
      <Alert 
        severity="success" 
        sx={{ 
          mb: 2,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: 2,
          animation: 'slideDown 0.3s ease-out',
          '@keyframes slideDown': {
            from: { transform: 'translateY(-20px)', opacity: 0 },
            to: { transform: 'translateY(0)', opacity: 1 },
          },
        }}
        onClose={() => setShowSuccessFeedback(false)}
        icon={<CheckCircleIcon />}
      >
        <Box>
          <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
            ✓ Settings saved successfully!
          </Typography>
          {lastSavedTime && (
            <Typography variant="body2" color="text.secondary">
              Saved at {lastSavedTime.toLocaleTimeString()} • Changes are now applied throughout the app
            </Typography>
          )}
        </Box>
      </Alert>
    );
  };

  // Render category content based on selection
  const renderCategoryContent = () => {
    if (settingsLoading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          </Box>
      );
    }

    // Wrap all category content with success feedback
    const categoryContent = (() => {
      switch (selectedCategory) {
        case 'account':
          return renderAccountCategory();
        case 'company':
          return renderCompanyCategory();
        case 'invoice':
          return renderInvoiceCategory();
        case 'localization':
          return renderLocalizationCategory();
        case 'tax':
          return renderTaxCategory();
        case 'clients':
          return renderClientsCategory();
        case 'inventory':
          return renderInventoryCategory();
        // Email functionality removed
        // case 'email':
        //   return renderEmailCategory();
        case 'notifications':
          return renderNotificationsCategory();
        case 'appearance':
          return renderAppearanceCategory();
        case 'backup':
          return renderBackupCategory();
        default:
          return renderAccountCategory();
      }
    })();

    // Success feedback is now rendered inside each category's SettingsCategoryWrapper
    // This ensures it scrolls with the content and is properly contained
    return categoryContent;
  };

  return (
    <>
      {/* 2FA Setup Dialog */}
      <Dialog 
        open={twoFactorDialogOpen} 
        onClose={() => {
          if (!isGenerating2FA && !isVerifying2FA && !isEnabling2FA && !isDisabling2FA) {
            setTwoFactorDialogOpen(false);
            setTwoFactorStep(0);
            setTwoFactorSecret('');
            setTwoFactorQRCode('');
            setTwoFactorVerificationCode('');
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {settings?.enableTwoFactorAuth ? 'Disable Two-Factor Authentication' : 'Set Up Two-Factor Authentication'}
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={twoFactorStep} sx={{ mt: 2, mb: 3 }}>
            <Step>
              <StepLabel>Generate QR Code</StepLabel>
            </Step>
            <Step>
              <StepLabel>Scan QR Code</StepLabel>
            </Step>
            <Step>
              <StepLabel>Verify Code</StepLabel>
            </Step>
            {settings?.enableTwoFactorAuth && (
              <Step>
                <StepLabel>Disable 2FA</StepLabel>
              </Step>
            )}
          </Stepper>

          {twoFactorStep === 0 && !settings?.enableTwoFactorAuth && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Click the button below to generate a QR code for your authenticator app.
              </Typography>
              <Button
                variant="contained"
                onClick={async () => {
                  setIsGenerating2FA(true);
                  try {
                    const result = await settingsApi.generate2FA();
                    setTwoFactorSecret(result.secret);
                    setTwoFactorQRCode(result.qrCode);
                    setTwoFactorStep(1);
                  } catch (error: unknown) {
                    showToast(getErrorMessage(error, 'Failed to generate 2FA setup'), 'error');
                  } finally {
                    setIsGenerating2FA(false);
                  }
                }}
                disabled={isGenerating2FA}
                fullWidth
                sx={{ mt: 2 }}
              >
                {isGenerating2FA ? <CircularProgress size={24} /> : 'Generate QR Code'}
              </Button>
            </Box>
          )}

          {twoFactorStep === 1 && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                {twoFactorQRCode && (
                  <img src={twoFactorQRCode} alt="2FA QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
                )}
              </Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Manual Entry:</strong> If you can't scan the QR code, enter this secret key manually:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                  {twoFactorSecret}
                </Typography>
              </Alert>
              <Button
                variant="contained"
                onClick={() => setTwoFactorStep(2)}
                fullWidth
              >
                I've Scanned the QR Code
              </Button>
            </Box>
          )}

          {twoFactorStep === 2 && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Enter the 6-digit code from your authenticator app to verify the setup:
              </Typography>
              <TextField
                fullWidth
                label="Verification Code"
                value={twoFactorVerificationCode}
                onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
                sx={{ mt: 2, mb: 2 }}
                placeholder="000000"
              />
              <Button
                variant="contained"
                onClick={async () => {
                  if (twoFactorVerificationCode.length !== 6) {
                    showToast('Please enter a 6-digit verification code', 'error');
                    return;
                  }
                  setIsVerifying2FA(true);
                  try {
                    await settingsApi.verify2FA(twoFactorVerificationCode, twoFactorSecret);
                    // If verification succeeds, enable 2FA
                    setIsEnabling2FA(true);
                    await settingsApi.enable2FA(twoFactorVerificationCode, twoFactorSecret);
                    showToast('Two-factor authentication has been enabled successfully!', 'success');
                    queryClient.invalidateQueries({ queryKey: ['settings'] });
                    setTwoFactorDialogOpen(false);
                    setTwoFactorStep(0);
                    setTwoFactorSecret('');
                    setTwoFactorQRCode('');
                    setTwoFactorVerificationCode('');
                    // Update form
                    setValue('enableTwoFactorAuth', true);
                  } catch (error: unknown) {
                    showToast(getErrorMessage(error, 'Failed to verify or enable 2FA'), 'error');
                  } finally {
                    setIsVerifying2FA(false);
                    setIsEnabling2FA(false);
                  }
                }}
                disabled={isVerifying2FA || isEnabling2FA || twoFactorVerificationCode.length !== 6}
                fullWidth
              >
                {isVerifying2FA || isEnabling2FA ? <CircularProgress size={24} /> : 'Verify and Enable 2FA'}
              </Button>
            </Box>
          )}

          {twoFactorStep === 3 && settings?.enableTwoFactorAuth && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Warning:</strong> Disabling two-factor authentication will reduce your account security.
                </Typography>
              </Alert>
              <Typography variant="body1" gutterBottom>
                Enter the 6-digit code from your authenticator app to disable 2FA:
              </Typography>
              <TextField
                fullWidth
                label="Verification Code"
                value={twoFactorVerificationCode}
                onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
                sx={{ mt: 2, mb: 2 }}
                placeholder="000000"
              />
              <Button
                variant="contained"
                color="error"
                onClick={async () => {
                  if (twoFactorVerificationCode.length !== 6) {
                    showToast('Please enter a 6-digit verification code', 'error');
                    return;
                  }
                  setIsDisabling2FA(true);
                  try {
                    await settingsApi.disable2FA(twoFactorVerificationCode);
                    showToast('Two-factor authentication has been disabled', 'success');
                    queryClient.invalidateQueries({ queryKey: ['settings'] });
                    setTwoFactorDialogOpen(false);
                    setTwoFactorStep(0);
                    setTwoFactorVerificationCode('');
                    // Update form
                    setValue('enableTwoFactorAuth', false);
                  } catch (error: unknown) {
                    showToast(getErrorMessage(error, 'Failed to disable 2FA'), 'error');
                  } finally {
                    setIsDisabling2FA(false);
                  }
                }}
                disabled={isDisabling2FA || twoFactorVerificationCode.length !== 6}
                fullWidth
              >
                {isDisabling2FA ? <CircularProgress size={24} /> : 'Disable 2FA'}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTwoFactorDialogOpen(false);
              setTwoFactorStep(0);
              setTwoFactorSecret('');
              setTwoFactorQRCode('');
              setTwoFactorVerificationCode('');
            }}
            disabled={isGenerating2FA || isVerifying2FA || isEnabling2FA || isDisabling2FA}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Box 
        sx={{ 
          display: 'flex', 
          height: '100%', // Use 100% of parent container, not viewport
          overflow: 'hidden',
          position: 'relative',
          zIndex: 0, // Ensure it doesn't block the sidebar menu
          width: '100%',
          pointerEvents: 'auto',
          minHeight: 0, // Critical for flex children to allow scrolling
        }}
      >
      <SettingsSidebar
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {renderCategoryContent()}
    </Box>
    </>
  );
};

export default Settings;
