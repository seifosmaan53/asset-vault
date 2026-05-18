// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Divider,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ClearIcon from '@mui/icons-material/Clear';
import { useSearch } from '../../contexts/SearchContext';

interface SearchHistoryDropdownProps {
  open: boolean;
  onClose: () => void;
  onSelect: (term: string) => void;
  anchorEl?: HTMLElement | null;
  maxItems?: number;
}

export const SearchHistoryDropdown = ({
  open,
  onClose,
  onSelect,
  anchorEl,
  maxItems = 10,
}: SearchHistoryDropdownProps) => {
  const { searchHistory, removeFromHistory, clearHistory } = useSearch();
  const [displayedHistory, setDisplayedHistory] = useState<string[]>([]);

  useEffect(() => {
    if (open && searchHistory.length > 0) {
      setDisplayedHistory(searchHistory.slice(0, maxItems));
    } else {
      setDisplayedHistory([]);
    }
  }, [open, searchHistory, maxItems]);

  const handleSelect = (term: string) => {
    onSelect(term);
    onClose();
  };

  const handleRemove = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeFromHistory(term);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearHistory();
  };

  if (!open || displayedHistory.length === 0) {
    return null;
  }

  const anchorPosition = anchorEl
    ? {
        top: anchorEl.getBoundingClientRect().bottom + window.scrollY,
        left: anchorEl.getBoundingClientRect().left + window.scrollX,
        width: anchorEl.getBoundingClientRect().width,
      }
    : undefined;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        zIndex: 1300,
        mt: 0.5,
        maxHeight: 300,
        overflow: 'auto',
        minWidth: anchorPosition?.width || 300,
        ...(anchorPosition && {
          top: anchorPosition.top,
          left: anchorPosition.left,
        }),
      }}
    >
      <Box sx={{ p: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" px={1} py={0.5}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Recent Searches
            </Typography>
          </Box>
          {displayedHistory.length > 0 && (
            <IconButton
              size="small"
              onClick={handleClearAll}
              sx={{ p: 0.5 }}
              title="Clear all history"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>
      <Divider />
      <List dense sx={{ py: 0 }}>
        {displayedHistory.map((term, index) => (
          <ListItem
            key={`${term}-${index}`}
            disablePadding
            secondaryAction={
              <IconButton
                edge="end"
                size="small"
                onClick={(e) => handleRemove(e, term)}
                sx={{ mr: 0.5 }}
                title="Remove from history"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemButton onClick={() => handleSelect(term)}>
              <ListItemText
                primary={term}
                primaryTypographyProps={{
                  variant: 'body2',
                  sx: {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};
