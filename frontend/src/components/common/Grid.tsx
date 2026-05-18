// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Grid Component
 * 
 * Wrapper that supports the old Grid API (container/item with xs, sm, etc.)
 * Uses GridLegacy for backward compatibility. The deprecation warning is expected
 * and can be safely ignored until a full migration to Grid2 is completed.
 */

import { GridLegacy as MuiGrid } from '@mui/material';
import { forwardRef } from 'react';
import type { ComponentProps } from 'react';

// Get props type from GridLegacy
type GridProps = ComponentProps<typeof MuiGrid>;

// Simple wrapper that passes through all props to GridLegacy
const GridComponent = forwardRef<HTMLDivElement, GridProps>((props, ref) => {
  return <MuiGrid ref={ref} {...props} />;
});

GridComponent.displayName = 'Grid';

export { GridComponent as Grid };
export default GridComponent;
export type { GridProps };

