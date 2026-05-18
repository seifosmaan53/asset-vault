// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Paper,
  Divider,
  Chip,
  Tooltip,
} from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonIcon from '@mui/icons-material/Person';
import InventoryIcon from '@mui/icons-material/Inventory';
import StoreIcon from '@mui/icons-material/Store';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import { useRecentItems } from '../../hooks/useRecentItems';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { RecentItemType } from '../../contexts/RecentItemsContext';

interface RecentItemsWidgetProps {
  maxItems?: number;
  types?: RecentItemType[];
  title?: string;
}

const typeIcons = {
  invoice: ReceiptIcon,
  client: PersonIcon,
  inventory: InventoryIcon,
  store: StoreIcon,
};

const typeLabels = {
  invoice: 'Invoice',
  client: 'Client',
  inventory: 'Item',
  store: 'Store',
};

const typeColors = {
  invoice: 'primary',
  client: 'info',
  inventory: 'success',
  store: 'warning',
} as const;

export const RecentItemsWidget = ({
  maxItems = 5,
  types,
  title = 'Recent Items',
}: RecentItemsWidgetProps) => {
  const { recentItems, removeItem, clearAll } = useRecentItems();
  const navigate = useNavigate();

  const filteredItems = types
    ? recentItems.filter((item) => types.includes(item.type))
    : recentItems;

  const displayItems = filteredItems
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, maxItems);

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2.5,
        borderRadius: 2.5,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%)',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HistoryIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography 
            variant="subtitle1" 
            fontWeight={700}
            sx={{
              fontSize: '0.9375rem',
              color: 'text.primary',
              letterSpacing: '0.3px',
            }}
          >
            {title}
          </Typography>
        </Box>
        {recentItems.length > 0 && (
          <Tooltip title="Clear all recent items" arrow>
            <IconButton 
              size="small" 
              onClick={clearAll}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'error.50',
                  color: 'error.main',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider 
        sx={{ 
          mb: 1.5,
          borderColor: 'divider',
        }} 
      />
      <List 
        dense
        sx={{
          '& .MuiListItem-root': {
            mb: 0.5,
          },
        }}
      >
        {displayItems.map((item) => {
          const Icon = typeIcons[item.type];
          const color = typeColors[item.type];
          return (
            <ListItem
              key={`${item.type}-${item.id}`}
              disablePadding
              sx={{ mb: 0.5 }}
              secondaryAction={
                <Tooltip title="Remove from recent" arrow>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id, item.type);
                    }}
                    sx={{
                      color: 'text.secondary',
                      opacity: 0.6,
                      '&:hover': {
                        bgcolor: 'error.50',
                        color: 'error.main',
                        opacity: 1,
                      },
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemButton
                onClick={() => navigate(item.url)}
                sx={{ 
                  borderRadius: 2,
                  py: 1,
                  px: 1.5,
                  mb: 0.5,
                  '&:hover': {
                    bgcolor: 'primary.50',
                    transform: 'translateX(4px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      bgcolor: `${color}.50`,
                      color: `${color}.main`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        fontSize: '0.875rem',
                        lineHeight: 1.4,
                        color: 'text.primary',
                        mb: 0.25,
                      }}
                    >
                      {item.name}
                    </Typography>
                  }
                  secondary={
                    <Box 
                      component="span" 
                      sx={{ 
                        display: 'flex', 
                        gap: 1, 
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        mt: 0.5,
                      }}
                    >
                      <Chip
                        label={typeLabels[item.type]}
                        size="small"
                        color={color}
                        variant="outlined"
                        sx={{ 
                          height: 20, 
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          borderWidth: 1.5,
                          '& .MuiChip-label': {
                            px: 1,
                          },
                        }}
                        component="span"
                      />
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        component="span"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {formatDistanceToNow(new Date(item.viewedAt), { addSuffix: true })}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
};
