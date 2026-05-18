// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SetMetadata } from '@nestjs/common';

export const SKIP_QUOTA_KEY = 'skip-quota';
export const SkipQuota = () => SetMetadata(SKIP_QUOTA_KEY, true);

