// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { Breadcrumbs } from '../common/Breadcrumbs';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Avatar,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import InventoryIcon from '@mui/icons-material/Inventory';
import StoreIcon from '@mui/icons-material/Store';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyIcon from '@mui/icons-material/Key';
import FeedbackIcon from '@mui/icons-material/Feedback';
import ArticleIcon from '@mui/icons-material/Article';
import LogoutIcon from '@mui/icons-material/Logout';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { logger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { SubscriptionStatus } from '../subscription/SubscriptionStatus';
import { useKeyboardShortcutsContext } from '../../contexts/KeyboardShortcutsContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { RecentItemsWidget } from '../common/RecentItemsWidget';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { settingsApi } from '../../api/settings';
import { settingsKeys } from '../../utils/queryKeys';

const DRAWER_WIDTH = 252;
const MENU_ORDER_STORAGE_KEY = 'menuItemOrder';

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  adminOnly: boolean;
  ownerOnly?: boolean;
}

const allMenuItems: MenuItem[] = [
  { text: 'Dashboard',        icon: <DashboardIcon  />, path: '/dashboard',          adminOnly: false },
  { text: 'Invoices',         icon: <ReceiptIcon    />, path: '/invoices',            adminOnly: false },
  { text: 'Inventory',        icon: <InventoryIcon  />, path: '/inventory',           adminOnly: false },
  { text: 'Stores',           icon: <StoreIcon      />, path: '/stores',              adminOnly: false },
  { text: 'Store Analytics',  icon: <AssessmentIcon />, path: '/analytics/stores',   adminOnly: false },
  { text: 'Clients',          icon: <PeopleIcon     />, path: '/clients',             adminOnly: false },
  { text: 'Inv. Templates',   icon: <ArticleIcon    />, path: '/invoice-templates',  adminOnly: false },
  { text: 'Feedback',         icon: <FeedbackIcon   />, path: '/feedback',            adminOnly: false },
  { text: 'Settings',         icon: <SettingsIcon   />, path: '/settings',            adminOnly: false },
  { text: 'API Keys',         icon: <KeyIcon        />, path: '/api-keys',            adminOnly: false },
];

// ─── Vault Logo SVG ───────────────────────────────────────────────────────────
const VaultLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="13" stroke="white" strokeWidth="2.2" strokeOpacity="0.95"/>
    <circle cx="18" cy="18" r="5.5" fill="white" fillOpacity="0.95"/>
    <line x1="18" y1="5"  x2="18" y2="9.5"  stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="18" y1="26.5" x2="18" y2="31" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="5"  y1="18" x2="9.5" y2="18"  stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="26.5" y1="18" x2="31" y2="18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="9.5"  y1="9.5"  x2="12.8" y2="12.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65"/>
    <line x1="23.2" y1="23.2" x2="26.5" y2="26.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65"/>
    <line x1="26.5" y1="9.5"  x2="23.2" y2="12.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65"/>
    <line x1="12.8" y1="23.2" x2="9.5"  y2="26.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.65"/>
  </svg>
);

// ─── Sortable Nav Item ────────────────────────────────────────────────────────
interface SortableMenuItemProps {
  item: MenuItem;
  isActive: boolean;
  onNavigate: (path: string) => void;
}

const SortableMenuItem = ({ item, isActive, onNavigate }: SortableMenuItemProps) => {
  const theme = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.text });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      sx={{ touchAction: 'pan-y', position: 'relative' }}
    >
      <ListItemButton
        selected={isActive}
        onClick={() => { if (!isDragging) onNavigate(item.path); }}
        sx={{
          cursor: isDragging ? 'grabbing' : 'pointer',
          pr: 5,
          mx: 1,
          my: '1px',
          borderRadius: 2,
          transition: 'all 0.15s ease',
          ...(isActive && {
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.1)} 0%, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.05)} 100%)`,
            color: theme.palette.primary.main,
            fontWeight: 700,
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 8,
              top: '18%',
              bottom: '18%',
              width: 3,
              borderRadius: '0 3px 3px 0',
              background: `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
            },
          }),
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 40,
            color: isActive
              ? theme.palette.primary.main
              : theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)',
            '& .MuiSvgIcon-root': { fontSize: 20 },
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.text}
          primaryTypographyProps={{
            fontSize: '0.875rem',
            fontWeight: isActive ? 700 : 500,
            letterSpacing: isActive ? '-0.01em' : 'inherit',
            color: isActive
              ? theme.palette.primary.main
              : theme.palette.text.primary,
          }}
        />
        {/* Drag handle */}
        <Box
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: isDragging ? 'grabbing' : 'grab',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            alignItems: 'center',
            opacity: 0,
            transition: 'opacity 0.15s',
            '.MuiListItem-root:hover &': { opacity: 0.5 },
            '&:hover': { opacity: '0.8 !important' },
          }}
        >
          {[0,1,2].map(i => (
            <Box key={i} sx={{ width: 14, height: 2, bgcolor: 'text.secondary', borderRadius: 1 }} />
          ))}
        </Box>
      </ListItemButton>
    </ListItem>
  );
};

// ─── Main Layout ──────────────────────────────────────────────────────────────
const AppLayout = () => {
  const navigate     = useNavigate();
  const location     = useLocation();
  const theme        = useTheme();
  const isDark       = theme.palette.mode === 'dark';
  const { showToast } = useToast();
  const queryClient  = useQueryClient();
  const { signOut }  = useClerk();
  const sidebarOpen  = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const logout       = useAuthStore((state) => state.logout);
  const user         = useAuthStore((state) => state.user);
  const isAdmin      = useAuthStore((state) => state.isAdmin);
  const isOwner      = useAuthStore((state) => state.isOwner);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const syncUser     = useAuthStore((state) => state.syncUser);
  const { openShortcutsDialog } = useKeyboardShortcutsContext();
  useSettingsContext(); // settings are applied globally via ThemeProvider

  const themeMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });

  // Quick dark/light toggle
  const handleThemeToggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    themeMutation.mutate({ theme: next });
  }, [isDark, themeMutation]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: '?', ctrl: true, meta: true, handler: () => openShortcutsDialog(), description: 'Show keyboard shortcuts' },
      { key: '/', ctrl: true, meta: true, handler: () => openShortcutsDialog(), description: 'Show keyboard shortcuts' },
    ],
  });

  const handleNavigate = useCallback((path: string) => {
    if (location.pathname === path) return;
    navigate(path);
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (isAuthenticated) syncUser();
  }, [isAuthenticated, syncUser]);

  const filteredMenuItems = useMemo(() =>
    allMenuItems.filter((item) => {
      if (item.ownerOnly) return isOwner();
      if (item.adminOnly) return isAdmin();
      return true;
    }),
    [isAdmin, isOwner, user?.role]
  );

  const [orderedMenuItems, setOrderedMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const applySavedOrder = (items: MenuItem[]) => {
      try {
        const savedOrder = localStorage.getItem(MENU_ORDER_STORAGE_KEY);
        if (savedOrder) {
          const orderArray: string[] = JSON.parse(savedOrder);
          const itemMap = new Map(items.map(item => [item.text, item]));
          const ordered = orderArray
            .map(text => itemMap.get(text))
            .filter((item): item is MenuItem => item !== undefined);
          const newItems = items.filter(item => !orderArray.includes(item.text));
          return [...ordered, ...newItems];
        }
      } catch (error) {
        logger.error('Error loading menu order:', error);
      }
      return items;
    };
    setOrderedMenuItems(applySavedOrder(filteredMenuItems));
  }, [filteredMenuItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedMenuItems((items) => {
        const oldIndex = items.findIndex((item) => item.text === active.id);
        const newIndex = items.findIndex((item) => item.text === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        try {
          localStorage.setItem(MENU_ORDER_STORAGE_KEY, JSON.stringify(newOrder.map(i => i.text)));
        } catch (error) {
          logger.error('Error saving menu order:', error);
        }
        return newOrder;
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      logout();
      queryClient.clear();
      queryClient.removeQueries();
      navigate('/login');
    } catch (error) {
      logger.error('Error during logout:', error);
      logout();
      queryClient.clear();
      navigate('/login');
    }
  };

  // User avatar initials
  const userInitials = useMemo(() => {
    if (!user?.email) return 'AV';
    const parts = user.email.split('@')[0].split(/[._-]/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : user.email.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const sidebarBg = isDark
    ? 'linear-gradient(180deg, rgba(10,14,26,0.98) 0%, rgba(8,11,20,0.98) 100%)'
    : 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFF 100%)';

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* ─── AppBar ──────────────────────────────────────────────────────── */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: '100%',
          bgcolor: 'transparent',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: '58px !important', px: { xs: 1.5, sm: 2 } }}>
          {/* Sidebar toggle */}
          <Tooltip title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
            <IconButton
              color="inherit"
              aria-label="toggle sidebar"
              edge="start"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr: 1 }}
            >
              {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>

          {/* Brand - shown in appbar only when sidebar is closed */}
          {!sidebarOpen && (
            <Box display="flex" alignItems="center" gap={1.25} sx={{ mr: 2 }}>
              <Box
                sx={{
                  width: 32, height: 32,
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  borderRadius: '9px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  flexShrink: 0,
                }}
              >
                <VaultLogo size={20} />
              </Box>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontSize: '1.05rem',
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Asset Vault
              </Typography>
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* Dark/Light mode toggle */}
          <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              onClick={handleThemeToggle}
              size="small"
              sx={{
                color: 'text.secondary',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: '8px',
                width: 36, height: 36,
              }}
            >
              {isDark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>

          {/* Subscription status */}
          {user && (
            <Box sx={{ ml: 0.5 }}>
              <SubscriptionStatus />
            </Box>
          )}

          {/* User chip */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 0.5 }}>
              <Avatar
                sx={{
                  width: 32, height: 32,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  display: { xs: 'none', sm: 'flex' },
                }}
              >
                {userInitials}
              </Avatar>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: 'text.secondary',
                  display: { xs: 'none', md: 'block' },
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </Typography>
              {isOwner() && (
                <Chip
                  icon={<AdminPanelSettingsIcon sx={{ fontSize: '14px !important' }} />}
                  label="Owner"
                  size="small"
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 24,
                    '& .MuiChip-icon': { color: 'rgba(255,255,255,0.85)' },
                  }}
                />
              )}
              {isAdmin() && !isOwner() && (
                <Chip
                  icon={<AdminPanelSettingsIcon sx={{ fontSize: '14px !important' }} />}
                  label="Admin"
                  size="small"
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    bgcolor: alpha('#F59E0B', 0.15),
                    color: '#F59E0B',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 24,
                    border: '1px solid',
                    borderColor: alpha('#F59E0B', 0.3),
                    '& .MuiChip-icon': { color: '#F59E0B' },
                  }}
                />
              )}
            </Box>
          )}

          {/* Logout */}
          <Tooltip title="Sign out">
            <IconButton
              color="inherit"
              onClick={handleLogout}
              size="small"
              sx={{
                ml: 0.5,
                color: 'text.secondary',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '8px',
                width: 36, height: 36,
                '&:hover': {
                  color: 'error.main',
                  borderColor: 'error.main',
                  bgcolor: alpha('#EF4444', 0.08),
                },
              }}
            >
              <LogoutIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <Drawer
        variant="persistent"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          zIndex: (t) => t.zIndex.drawer,
          transition: (t) => t.transitions.create('width', {
            easing: t.transitions.easing.sharp,
            duration: t.transitions.duration.enteringScreen,
          }),
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: (t) => t.zIndex.drawer,
            background: sidebarBg,
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            transition: (t) => t.transitions.create('width', {
              easing: t.transitions.easing.sharp,
              duration: t.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
          },
        }}
      >
        {/* Spacer for AppBar */}
        <Toolbar sx={{ minHeight: '58px !important' }} />

        {/* ─ Brand Logo ─ */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(99,102,241,0.45)',
              flexShrink: 0,
            }}
          >
            <VaultLogo size={24} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: '1.0625rem',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                background: isDark
                  ? 'linear-gradient(135deg, #A5B4FC 0%, #C4B5FD 100%)'
                  : 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Asset Vault
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Business Suite
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mx: 2, opacity: 0.6 }} />

        {/* ─ Navigation ─ */}
        <Box sx={{ flex: 1, overflow: 'auto', pt: 1, pb: 2 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedMenuItems.map(item => item.text)}
              strategy={verticalListSortingStrategy}
            >
              <List disablePadding>
                {orderedMenuItems.map((item) => (
                  <SortableMenuItem
                    key={item.text}
                    item={item}
                    isActive={location.pathname.startsWith(item.path)}
                    onNavigate={handleNavigate}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>

          {/* Recent Items */}
          <Box sx={{ px: 2, mt: 2 }}>
            <Divider sx={{ mb: 2, opacity: 0.5 }} />
            <Typography
              variant="overline"
              sx={{
                color: 'text.disabled',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                px: 1,
                display: 'block',
                mb: 1,
              }}
            >
              Recent
            </Typography>
            <RecentItemsWidget maxItems={5} />
          </Box>
        </Box>

        {/* ─ Sidebar Footer ─ */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar
              sx={{
                width: 34, height: 34,
                fontSize: '0.75rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                flexShrink: 0,
              }}
            >
              {userInitials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'text.primary',
                }}
              >
                {user?.email?.split('@')[0] ?? 'User'}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.7rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {user?.email ?? ''}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton
                size="small"
                onClick={handleLogout}
                sx={{
                  width: 30, height: 30,
                  color: 'text.disabled',
                  borderRadius: '8px',
                  '&:hover': { color: 'error.main', bgcolor: alpha('#EF4444', 0.1) },
                }}
              >
                <LogoutIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Drawer>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 2.5, md: 3 },
          width: { sm: sidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          position: 'relative',
          zIndex: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          transition: (t) => t.transitions.create('width', {
            easing: t.transitions.easing.sharp,
            duration: t.transitions.duration.enteringScreen,
          }),
          background: isDark
            ? `radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.06) 0%, transparent 60%), ${theme.palette.background.default}`
            : `radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.04) 0%, transparent 60%), ${theme.palette.background.default}`,
        }}
      >
        {/* Spacer for AppBar */}
        <Toolbar sx={{ minHeight: '58px !important', flexShrink: 0 }} />

        {/* Skip to content */}
        <Box
          component="a"
          href="#page-title"
          sx={{
            position: 'absolute', top: -40, left: 0,
            bgcolor: 'primary.main', color: 'primary.contrastText',
            padding: '8px 16px', textDecoration: 'none', borderRadius: 1,
            zIndex: 1000,
            '&:focus': { top: 0, position: 'fixed' },
          }}
        >
          Skip to main content
        </Box>

        <Breadcrumbs />

        <Box
          role="region"
          aria-labelledby="page-title"
          aria-live="polite"
          sx={{
            position: 'relative',
            zIndex: 0,
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
          }}
        >
          <Outlet key={location.pathname} />
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
