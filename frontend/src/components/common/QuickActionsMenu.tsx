// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  divider?: boolean;
}

interface QuickActionsMenuProps {
  actions: QuickAction[];
  size?: 'small' | 'medium' | 'large';
  ariaLabel?: string;
}

export const QuickActionsMenu = ({
  actions,
  size = 'small',
  ariaLabel = 'Quick actions',
}: QuickActionsMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleActionClick = (action: QuickAction) => {
    action.onClick();
    handleClose();
  };

  return (
    <>
      <Tooltip title="Quick actions">
        <IconButton
          onClick={handleClick}
          size={size}
          aria-label={ariaLabel}
          aria-controls={open ? 'quick-actions-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="quick-actions-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {actions.map((action, index) => (
          <div key={action.id}>
            {action.divider && index > 0 && <Divider />}
            <MenuItem
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
              sx={{
                color: action.color === 'error' ? 'error.main' : undefined,
              }}
            >
              {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
              <ListItemText>{action.label}</ListItemText>
            </MenuItem>
          </div>
        ))}
      </Menu>
    </>
  );
};
