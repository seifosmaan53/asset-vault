// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * UserSettingsService.getSettings() returns the serialized settings as Record<string, unknown>.
 * These read one field with the type the invoice code expects, and give undefined when the field
 * is missing or holds something else, so callers keep their existing `|| default` fallbacks.
 */
export type SerializedSettings = Record<string, unknown> | null | undefined;

export function settingString(
  settings: SerializedSettings,
  key: string,
): string | undefined {
  const value = settings?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function settingNumber(
  settings: SerializedSettings,
  key: string,
): number | undefined {
  const value = settings?.[key];
  return typeof value === 'number' ? value : undefined;
}

export function settingBoolean(
  settings: SerializedSettings,
  key: string,
): boolean | undefined {
  const value = settings?.[key];
  return typeof value === 'boolean' ? value : undefined;
}
