// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  IconButton,
  Menu,
  MenuItem,
  Checkbox,
  Typography,
  Box,
  Tooltip,
  Divider,
  Button,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SettingsIcon from '@mui/icons-material/Settings';
import RestoreIcon from '@mui/icons-material/Restore';
import { useState } from 'react';

export interface ColumnControl {
  id: string;
  label: string;
  visible: boolean;
}

interface TableColumnControlsProps {
  columns: ColumnControl[];
  onToggleVisibility: (columnId: string) => void;
  onReset?: () => void;
}

export const TableColumnControls = ({
  columns,
  onToggleVisibility,
  onReset,
}: TableColumnControlsProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const visibleCount = columns.filter((col) => col.visible).length;

  return (
    <>
      <Tooltip title="Column visibility">
        <IconButton onClick={handleClick} size="small" aria-label="Column visibility">
          <ViewColumnIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 200, maxHeight: 400 },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Visible Columns ({visibleCount}/{columns.length})
          </Typography>
        </Box>
        <Divider />
        {columns.map((column) => (
          <MenuItem
            key={column.id}
            dense
            onClick={() => {
              onToggleVisibility(column.id);
            }}
          >
            <Checkbox checked={column.visible} size="small" />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {column.label}
            </Typography>
          </MenuItem>
        ))}
        {onReset && (
          <Divider key="reset-divider" />
        )}
        {onReset && (
          <Box key="reset-box" sx={{ px: 2, py: 1 }}>
            <Button
              size="small"
              startIcon={<RestoreIcon />}
              onClick={() => {
                onReset();
                handleClose();
              }}
              fullWidth
            >
              Reset to Defaults
            </Button>
          </Box>
        )}
      </Menu>
    </>
  );
};
