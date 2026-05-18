import { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  TextField,
  InputAdornment,
  alpha,
  Chip,
  useTheme,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Search as SearchIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  Language as LanguageIcon,
  AttachMoney as AttachMoneyIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  Email as EmailIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Backup as BackupIcon,
} from '@mui/icons-material';

export type SettingsCategory =
  | 'account'
  | 'company'
  | 'invoice'
  | 'localization'
  | 'tax'
  | 'clients'
  | 'inventory'
  | 'email'
  | 'notifications'
  | 'appearance'
  | 'backup';

interface CategoryGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  categories: {
    id: SettingsCategory;
    label: string;
    icon: React.ReactNode;
  }[];
}

const categoryGroups: CategoryGroup[] = [
  {
    id: 'account',
    label: 'Account',
    icon: <PersonIcon />,
    categories: [
      { id: 'account', label: 'Profile & Password', icon: <PersonIcon /> },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    icon: <BusinessIcon />,
    categories: [
      { id: 'company', label: 'Company Information', icon: <BusinessIcon /> },
      { id: 'invoice', label: 'Invoice Settings', icon: <ReceiptIcon /> },
      { id: 'clients', label: 'Client Defaults', icon: <PeopleIcon /> },
      { id: 'inventory', label: 'Inventory', icon: <InventoryIcon /> },
    ],
  },
  {
    id: 'localization',
    label: 'Localization',
    icon: <LanguageIcon />,
    categories: [
      { id: 'localization', label: 'Date, Time & Currency', icon: <LanguageIcon /> },
      { id: 'tax', label: 'Tax Settings', icon: <AttachMoneyIcon /> },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: <EmailIcon />,
    categories: [
      // Email functionality removed
      // { id: 'email', label: 'Email & SMTP', icon: <EmailIcon /> },
      { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
    ],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: <PaletteIcon />,
    categories: [
      { id: 'appearance', label: 'Appearance', icon: <PaletteIcon /> },
      { id: 'backup', label: 'Backup & Security', icon: <BackupIcon /> },
    ],
  },
];

interface SettingsSidebarProps {
  selectedCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const SettingsSidebar = ({
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: SettingsSidebarProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(categoryGroups.map((g) => g.id))
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const theme = useTheme();
  
  // Check active state against original groups (not filtered) to ensure it works even when search filters out the active category
  const hasActiveCategory = (group: CategoryGroup) => {
    const originalGroup = categoryGroups.find(g => g.id === group.id);
    return originalGroup?.categories.some(cat => cat.id === selectedCategory) ?? false;
  };

  const filteredGroups = categoryGroups.map((group) => ({
    ...group,
    categories: group.categories.filter((cat) =>
      cat.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.categories.length > 0);

  return (
    <Box
      sx={{
        width: 300,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <Box 
        sx={{ 
          p: 2.5, 
          borderBottom: '1px solid', 
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2, 
            fontWeight: 600,
            fontSize: '1.125rem',
            color: 'text.primary',
          }}
        >
          Settings
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
              '&:hover': {
                bgcolor: 'background.paper',
              },
              '&.Mui-focused': {
                bgcolor: 'background.paper',
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch',
        px: 2,
        py: 1.5,
        bgcolor: 'background.default',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: alpha(theme.palette.primary.main, 0.2),
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.3),
          },
        },
      }}>
        <List 
          dense 
          sx={{ 
            py: 0,
            px: 0,
            width: '100%',
            '& .MuiListItem-root': {
              mb: 0.75,
              '&:last-child': {
                mb: 0,
              },
            },
          }}
        >
          {filteredGroups.map((group) => {
            const isGroupActive = hasActiveCategory(group);
            const isExpanded = expandedGroups.has(group.id);
            // Calculate activeCount from original group, not filtered
            const originalGroup = categoryGroups.find(g => g.id === group.id);
            const activeCount = originalGroup?.categories.filter(cat => cat.id === selectedCategory).length ?? 0;
            // Show badge with category count for all groups
            const categoryCount = originalGroup?.categories.length ?? 0;
            
            return (
              <Box 
                key={group.id}
                sx={{
                  mb: 1.25,
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  bgcolor: isGroupActive && isExpanded 
                    ? alpha(theme.palette.primary.main, 0.06) 
                    : alpha(theme.palette.primary.main, 0.02),
                  transition: 'all 0.2s ease-in-out',
                  border: isGroupActive && isExpanded
                    ? `1px solid ${alpha(theme.palette.primary.main, 0.25)}`
                    : `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                  boxShadow: isGroupActive && isExpanded
                    ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`
                    : 'none',
                  '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.08)}`,
                  },
                }}
              >
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => toggleGroup(group.id)}
                    sx={{
                      py: 1.5,
                      px: 2.5,
                      borderRadius: 2.5,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        transform: 'translateX(3px)',
                      },
                    }}
                  >
                    <ListItemIcon 
                      sx={{ 
                        minWidth: 44, 
                        color: 'primary.main',
                        transition: 'color 0.2s ease-in-out',
                      }}
                    >
                      {group.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography 
                          variant="body2" 
                          fontWeight={isGroupActive ? 600 : 500}
                          sx={{
                            color: 'primary.main',
                            transition: 'all 0.2s ease-in-out',
                            fontSize: '0.9375rem',
                          }}
                        >
                          {group.label}
                        </Typography>
                      }
                    />
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {categoryCount > 0 && (
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            flexShrink: 0,
                            boxShadow: `0 2px 4px ${alpha(theme.palette.primary.main, 0.3)}`,
                          }}
                        >
                          {categoryCount}
                        </Box>
                      )}
                      <Box
                        sx={{
                          color: 'primary.main',
                          transition: 'all 0.2s ease-in-out',
                          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ExpandLess />
                      </Box>
                    </Box>
                  </ListItemButton>
                </ListItem>
                <Collapse 
                  in={expandedGroups.has(group.id)} 
                  timeout="auto" 
                  unmountOnExit
                  sx={{
                    '& .MuiCollapse-wrapper': {
                      pt: 0.75,
                      pb: 0.5,
                    },
                  }}
                >
                  <List component="div" disablePadding sx={{ pb: 0.75, px: 0.5 }}>
                    {group.categories.map((category) => {
                      const isSelected = selectedCategory === category.id;
                      return (
                        <ListItem 
                          key={category.id} 
                          disablePadding
                          sx={{
                            mb: 0.5,
                            '&:last-child': {
                              mb: 0,
                            },
                          }}
                        >
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => onCategoryChange(category.id)}
                            sx={{
                              pl: 5.5,
                              pr: 2.5,
                              py: 1.25,
                              mx: 0.75,
                              borderRadius: 2,
                              transition: 'all 0.2s ease-in-out',
                              position: 'relative',
                              '&::before': isSelected ? {
                                content: '""',
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 4,
                                height: '70%',
                                bgcolor: 'primary.main',
                                borderRadius: '0 3px 3px 0',
                                boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`,
                              } : {},
                              '&.Mui-selected': {
                                bgcolor: alpha(theme.palette.primary.main, 0.14),
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.18),
                                },
                                '& .MuiListItemIcon-root': {
                                  color: 'primary.main',
                                },
                                '& .MuiTypography-root': {
                                  color: 'primary.main',
                                  fontWeight: 600,
                                },
                              },
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                transform: 'translateX(5px)',
                                '& .MuiListItemIcon-root': {
                                  color: 'primary.main',
                                },
                                '& .MuiTypography-root': {
                                  color: 'primary.main',
                                },
                              },
                            }}
                          >
                            <ListItemIcon 
                              sx={{ 
                                minWidth: 42, 
                                color: isSelected ? 'primary.main' : alpha(theme.palette.primary.main, 0.7),
                                transition: 'color 0.2s ease-in-out',
                              }}
                            >
                              {category.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography 
                                  variant="body2" 
                                  fontSize="0.875rem"
                                  sx={{
                                    fontWeight: isSelected ? 600 : 500,
                                    color: isSelected ? 'primary.main' : alpha(theme.palette.primary.main, 0.85),
                                    transition: 'all 0.2s ease-in-out',
                                  }}
                                >
                                  {category.label}
                                </Typography>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>
    </Box>
  );
};

