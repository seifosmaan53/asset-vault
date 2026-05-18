// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Box,
  Typography,
  Divider,
  Chip,
  Popper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState, useRef, useEffect } from 'react';
import { useSearch } from '../../contexts/SearchContext';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  context?: string;
  showHistory?: boolean;
  showSuggestions?: boolean;
  suggestions?: string[];
  autoFocus?: boolean;
}

export const SearchBar = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  context = 'global',
  showHistory = true,
  showSuggestions = true,
  suggestions = [],
  autoFocus = false,
}: SearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { searchHistory, addToHistory, clearHistory, savedSearches, removeSavedSearch } = useSearch();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    setShowDropdown(true);
  };

  const handleSearch = (searchTerm: string) => {
    if (searchTerm.trim()) {
      addToHistory(searchTerm, context);
      onSearch?.(searchTerm);
    }
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(value);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    onChange('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const filteredHistory = searchHistory.filter((item) =>
    item.toLowerCase().includes(value.toLowerCase()),
  );
  const filteredSuggestions = suggestions.filter((item) =>
    item.toLowerCase().includes(value.toLowerCase()),
  );
  const filteredSaved = savedSearches.filter((item) =>
    item.toLowerCase().includes(value.toLowerCase()),
  );

  const hasResults =
    showHistory && (filteredHistory.length > 0 || filteredSaved.length > 0) ||
    showSuggestions && filteredSuggestions.length > 0;

  return (
    <Box ref={anchorRef} sx={{ position: 'relative', width: '100%' }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsFocused(true);
          if (hasResults) {
            setShowDropdown(true);
          }
        }}
        onBlur={() => {
          // Delay to allow click events on dropdown items
          setTimeout(() => setIsFocused(false), 200);
        }}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} edge="end">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      {isFocused && showDropdown && hasResults && (
        <Popper
          open={showDropdown}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1300, width: anchorRef.current?.clientWidth }}
        >
          <Paper
            elevation={8}
            sx={{
              mt: 1,
              maxHeight: 400,
              overflow: 'auto',
              width: '100%',
            }}
          >
            {showHistory && filteredSaved.length > 0 && (
              <>
                <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Saved Searches
                  </Typography>
                </Box>
                <List dense>
                  {filteredSaved.map((item, index) => (
                    <ListItem
                      key={`saved-${index}`}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedSearch(item, context);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        onClick={() => {
                          onChange(item);
                          handleSearch(item);
                        }}
                      >
                        <ListItemIcon>
                          <BookmarkIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={item} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
                <Divider />
              </>
            )}
            {showHistory && filteredHistory.length > 0 && (
              <>
                <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Recent Searches
                  </Typography>
                  {searchHistory.length > 0 && (
                    <Chip
                      label="Clear"
                      size="small"
                      onClick={clearHistory}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
                <List dense>
                  {filteredHistory.slice(0, 5).map((item, index) => (
                    <ListItemButton
                      key={`history-${index}`}
                      onClick={() => {
                        onChange(item);
                        handleSearch(item);
                      }}
                    >
                      <ListItemIcon>
                        <HistoryIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItemButton>
                  ))}
                </List>
                {showSuggestions && filteredSuggestions.length > 0 && <Divider />}
              </>
            )}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <>
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Suggestions
                  </Typography>
                </Box>
                <List dense>
                  {filteredSuggestions.slice(0, 5).map((item, index) => (
                    <ListItemButton
                      key={`suggestion-${index}`}
                      onClick={() => {
                        onChange(item);
                        handleSearch(item);
                      }}
                    >
                      <ListItemIcon>
                        <SearchIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}
          </Paper>
        </Popper>
      )}
    </Box>
  );
};
