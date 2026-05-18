// Copyright (c) 2025 Asset Vault. All rights reserved.

import { createTheme, type Theme, alpha } from '@mui/material/styles';
import type { UserSettings } from './api/settings';

// ─── Asset Vault Design Tokens ───────────────────────────────────────────────
const AV = {
  indigo: {
    50:  '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
  },
  violet: {
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
  },
  amber: {
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    850: '#162032',
    900: '#0F172A',
    950: '#080B14',
  },
  emerald: '#10B981',
  red:     '#EF4444',
  blue:    '#3B82F6',
} as const;

// ─── Default (fallback) theme used before settings load ──────────────────────
export const defaultTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: AV.indigo[500] },
    secondary: { main: AV.amber[500] },
  },
  typography: { fontFamily: '"Inter", "SF Pro Display", -apple-system, sans-serif' },
});

// ─── Dynamic theme built from user settings ───────────────────────────────────
export const createDynamicTheme = (settings?: UserSettings, systemTheme?: 'light' | 'dark'): Theme => {
  // Resolve theme mode
  let themeMode: 'light' | 'dark' = 'light';
  const themeSetting = settings?.theme ?? 'light';

  if (themeSetting === 'auto') {
    themeMode = systemTheme
      ?? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light');
  } else {
    themeMode = themeSetting as 'light' | 'dark';
  }

  const isDark = themeMode === 'dark';
  const primaryColor   = settings?.primaryColor   ?? AV.indigo[500];
  const secondaryColor = settings?.secondaryColor ?? AV.amber[500];
  const fontSize       = settings?.fontSize       ?? 'medium';
  const compactMode    = settings?.compactMode    ?? false;

  const fsm = fontSize === 'small' ? 0.875 : fontSize === 'large' ? 1.125 : 1.0;
  const base = 15 * fsm;
  const sp   = compactMode ? 4 : 6;

  return createTheme({
    // ─── Palette ──────────────────────────────────────────────────────────────
    palette: {
      mode: themeMode,
      primary: {
        main:          primaryColor,
        light:         AV.indigo[400],
        dark:          AV.indigo[700],
        contrastText:  '#FFFFFF',
      },
      secondary: {
        main:         secondaryColor,
        light:        AV.amber[400],
        dark:         AV.amber[600],
        contrastText: '#000000',
      },
      success: { main: AV.emerald },
      error:   { main: AV.red },
      warning: { main: AV.amber[500] },
      info:    { main: AV.blue },
      background: isDark ? {
        default: AV.slate[950],
        paper:   AV.slate[900],
      } : {
        default: AV.slate[50],
        paper:   '#FFFFFF',
      },
      text: isDark ? {
        primary:   '#F1F5F9',
        secondary: '#94A3B8',
        disabled:  '#475569',
      } : {
        primary:   AV.slate[900],
        secondary: AV.slate[500],
        disabled:  AV.slate[300],
      },
      divider: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
      action: {
        hover:    isDark ? 'rgba(99,102,241,0.08)'  : 'rgba(79,70,229,0.06)',
        selected: isDark ? 'rgba(99,102,241,0.16)'  : 'rgba(79,70,229,0.11)',
        focus:    isDark ? 'rgba(99,102,241,0.24)'  : 'rgba(79,70,229,0.17)',
        disabled: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.26)',
      },
    },

    // ─── Spacing / Shape ──────────────────────────────────────────────────────
    spacing: sp,
    shape: { borderRadius: 10 },

    // ─── Typography ───────────────────────────────────────────────────────────
    typography: {
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      htmlFontSize: base,
      fontSize: base,
      h1: { fontSize: `${1.9375 * fsm}rem`, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 },
      h2: { fontSize: `${1.6875 * fsm}rem`, fontWeight: 700, letterSpacing: '-0.02em',  lineHeight: 1.25 },
      h3: { fontSize: `${1.375  * fsm}rem`, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.3 },
      h4: { fontSize: `${1.1875 * fsm}rem`, fontWeight: 600, letterSpacing: '-0.01em',  lineHeight: 1.35 },
      h5: { fontSize: `${1.0625 * fsm}rem`, fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: `${0.96875 * fsm}rem`,fontWeight: 600, lineHeight: 1.4 },
      subtitle1: { fontSize: `${0.9375 * fsm}rem`,  fontWeight: 500, lineHeight: 1.5 },
      subtitle2: { fontSize: `${0.84375 * fsm}rem`, fontWeight: 500, lineHeight: 1.5 },
      body1:     { fontSize: `${0.9375 * fsm}rem`,  lineHeight: 1.6 },
      body2:     { fontSize: `${0.875 * fsm}rem`,   lineHeight: 1.6 },
      button: {
        fontSize: `${0.84375 * fsm}rem`,
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.01em',
      },
      caption:  { fontSize: `${0.75 * fsm}rem`,    lineHeight: 1.5 },
      overline: { fontSize: `${0.71875 * fsm}rem`, letterSpacing: '0.1em', fontWeight: 600 },
    },

    // ─── Shadows ──────────────────────────────────────────────────────────────
    shadows: [
      'none',
      isDark ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.07)',
      isDark ? '0 3px 8px rgba(0,0,0,0.5)' : '0 3px 8px rgba(0,0,0,0.08)',
      isDark ? '0 6px 16px rgba(0,0,0,0.5)' : '0 6px 16px rgba(0,0,0,0.08)',
      isDark ? '0 10px 24px rgba(0,0,0,0.5)' : '0 10px 24px rgba(0,0,0,0.09)',
      isDark ? '0 14px 32px rgba(0,0,0,0.5)' : '0 14px 32px rgba(0,0,0,0.09)',
      isDark ? '0 18px 40px rgba(0,0,0,0.5)' : '0 18px 40px rgba(0,0,0,0.1)',
      isDark ? '0 22px 48px rgba(0,0,0,0.5)' : '0 22px 48px rgba(0,0,0,0.1)',
      isDark ? '0 26px 56px rgba(0,0,0,0.5)' : '0 26px 56px rgba(0,0,0,0.1)',
      isDark ? '0 30px 64px rgba(0,0,0,0.5)' : '0 30px 64px rgba(0,0,0,0.11)',
      isDark ? '0 34px 72px rgba(0,0,0,0.5)' : '0 34px 72px rgba(0,0,0,0.11)',
      isDark ? '0 38px 80px rgba(0,0,0,0.5)' : '0 38px 80px rgba(0,0,0,0.11)',
      isDark ? '0 42px 88px rgba(0,0,0,0.5)' : '0 42px 88px rgba(0,0,0,0.12)',
      isDark ? '0 46px 96px rgba(0,0,0,0.5)' : '0 46px 96px rgba(0,0,0,0.12)',
      isDark ? '0 50px 104px rgba(0,0,0,0.5)' : '0 50px 104px rgba(0,0,0,0.12)',
      isDark ? '0 54px 112px rgba(0,0,0,0.5)' : '0 54px 112px rgba(0,0,0,0.13)',
      isDark ? '0 58px 120px rgba(0,0,0,0.5)' : '0 58px 120px rgba(0,0,0,0.13)',
      isDark ? '0 62px 128px rgba(0,0,0,0.5)' : '0 62px 128px rgba(0,0,0,0.13)',
      isDark ? '0 66px 136px rgba(0,0,0,0.5)' : '0 66px 136px rgba(0,0,0,0.14)',
      isDark ? '0 70px 144px rgba(0,0,0,0.5)' : '0 70px 144px rgba(0,0,0,0.14)',
      isDark ? '0 74px 152px rgba(0,0,0,0.5)' : '0 74px 152px rgba(0,0,0,0.14)',
      isDark ? '0 78px 160px rgba(0,0,0,0.5)' : '0 78px 160px rgba(0,0,0,0.15)',
      isDark ? '0 82px 168px rgba(0,0,0,0.5)' : '0 82px 168px rgba(0,0,0,0.15)',
      isDark ? '0 86px 176px rgba(0,0,0,0.5)' : '0 86px 176px rgba(0,0,0,0.15)',
      // Elevation 24: colored primary glow
      `0 20px 60px ${alpha(primaryColor, isDark ? 0.45 : 0.22)}, 0 8px 20px ${alpha(primaryColor, isDark ? 0.3 : 0.14)}`,
    ],

    // ─── Component Overrides ──────────────────────────────────────────────────
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? `${AV.slate[700]} transparent` : `${AV.slate[300]} transparent`,
            '&::-webkit-scrollbar':        { width: 7, height: 7 },
            '&::-webkit-scrollbar-track':  { background: 'transparent' },
            '&::-webkit-scrollbar-thumb':  {
              background: isDark ? AV.slate[700] : AV.slate[300],
              borderRadius: 4,
              '&:hover': { background: isDark ? AV.slate[600] : AV.slate[400] },
            },
            '&::-webkit-scrollbar-corner': { background: 'transparent' },
          },
        },
      },

      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            background: isDark
              ? 'rgba(8,11,20,0.88)'
              : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: 'none',
            color: isDark ? AV.slate[100] : AV.slate[900],
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: isDark
              ? 'rgba(10,14,26,0.96)'
              : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: isDark
              ? '4px 0 24px rgba(0,0,0,0.4)'
              : '4px 0 24px rgba(0,0,0,0.06)',
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            padding: compactMode ? '6px 14px' : '7px 18px',
            fontSize: `${0.84375 * fsm}rem`,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': { transform: 'scale(0.98)' },
          },
          contained: {
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${alpha(primaryColor, 0.85)} 100%)`,
            boxShadow: `0 4px 14px ${alpha(primaryColor, isDark ? 0.4 : 0.3)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${AV.indigo[600]} 0%, ${primaryColor} 100%)`,
              boxShadow: `0 6px 20px ${alpha(primaryColor, isDark ? 0.55 : 0.4)}`,
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderColor: alpha(primaryColor, isDark ? 0.4 : 0.35),
            color: primaryColor,
            '&:hover': {
              borderColor: primaryColor,
              background: alpha(primaryColor, isDark ? 0.1 : 0.06),
              transform: 'translateY(-1px)',
            },
          },
          text: {
            '&:hover': { background: alpha(primaryColor, isDark ? 0.1 : 0.06) },
          },
          sizeLarge: {
            padding: compactMode ? '10px 22px' : '11px 26px',
            fontSize: `${0.9375 * fsm}rem`,
            borderRadius: 10,
          },
          sizeSmall: {
            padding: compactMode ? '4px 10px' : '5px 13px',
            fontSize: `${0.78125 * fsm}rem`,
            borderRadius: 6,
          },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            background: isDark
              ? 'rgba(22,27,39,0.82)'
              : '#FFFFFF',
            backdropFilter: isDark ? 'blur(20px)' : 'none',
            WebkitBackdropFilter: isDark ? 'blur(20px)' : 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 14,
            transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s, border-color 0.22s',
            '&:hover': {
              borderColor: isDark ? alpha(primaryColor, 0.28) : alpha(primaryColor, 0.18),
            },
          },
        },
      },

      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: compactMode ? '14px' : '18px',
            '&:last-child': { paddingBottom: compactMode ? '14px' : '18px' },
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            background: isDark ? AV.slate[900] : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 12,
          },
          elevation1: {
            boxShadow: isDark
              ? '0 4px 16px rgba(0,0,0,0.4)'
              : '0 4px 16px rgba(0,0,0,0.07)',
          },
          elevation2: {
            boxShadow: isDark
              ? '0 8px 24px rgba(0,0,0,0.45)'
              : '0 8px 24px rgba(0,0,0,0.08)',
          },
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              transition: 'box-shadow 0.2s ease',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
              },
              '&:hover fieldset': {
                borderColor: alpha(primaryColor, 0.5),
              },
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${alpha(primaryColor, isDark ? 0.22 : 0.14)}`,
              },
              '&.Mui-focused fieldset': {
                borderColor: primaryColor,
                borderWidth: 1,
              },
            },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            fontSize: `${0.78125 * fsm}rem`,
            fontWeight: 600,
            height: compactMode ? 26 : 28,
            borderRadius: 6,
          },
          sizeSmall: {
            height: compactMode ? 20 : 22,
            fontSize: `${0.71875 * fsm}rem`,
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '1px 8px',
            padding: '8px 12px',
            transition: 'all 0.15s ease',
            position: 'relative',
            '&.Mui-selected': {
              background: `linear-gradient(135deg, ${alpha(primaryColor, isDark ? 0.22 : 0.1)} 0%, ${alpha(primaryColor, isDark ? 0.12 : 0.06)} 100%)`,
              color: primaryColor,
              '&:hover': {
                background: `linear-gradient(135deg, ${alpha(primaryColor, isDark ? 0.3 : 0.15)} 0%, ${alpha(primaryColor, isDark ? 0.18 : 0.1)} 100%)`,
              },
              '& .MuiListItemIcon-root': { color: primaryColor },
              '&::before': {
                content: '""',
                position: 'absolute',
                left: -8,
                top: '20%',
                bottom: '20%',
                width: 3,
                borderRadius: '0 3px 3px 0',
                background: `linear-gradient(180deg, ${primaryColor}, ${AV.violet[500]})`,
              },
            },
            '&:hover': {
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            },
          },
        },
      },

      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 40,
            color: isDark ? AV.slate[400] : AV.slate[500],
          },
        },
      },

      MuiTableContainer: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            padding: compactMode ? '10px 14px' : '13px 16px',
          },
          head: {
            fontWeight: 600,
            fontSize: `${0.75 * fsm}rem`,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: isDark ? AV.slate[400] : AV.slate[500],
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.15s ease',
            '&:hover': {
              background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
            },
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            background: isDark ? AV.slate[700] : AV.slate[800],
            borderRadius: 6,
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '6px 10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          },
          arrow: {
            color: isDark ? AV.slate[700] : AV.slate[800],
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500 },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, height: 6 },
        },
      },

      MuiSkeleton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            background: isDark ? AV.slate[900] : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            backgroundImage: 'none',
          },
        },
      },

      MuiDialogTitle: {
        styleOverrides: {
          root: { fontWeight: 700, fontSize: `${1.0625 * fsm}rem` },
        },
      },

      MuiSelect: {
        styleOverrides: {
          outlined: {
            borderRadius: 8,
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            background: isDark ? AV.slate[900] : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            backgroundImage: 'none',
            boxShadow: isDark
              ? '0 16px 40px rgba(0,0,0,0.5)'
              : '0 16px 40px rgba(0,0,0,0.1)',
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            margin: '2px 6px',
            padding: '8px 12px',
            fontSize: `${0.875 * fsm}rem`,
            '&:hover': {
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            },
            '&.Mui-selected': {
              background: alpha(primaryColor, isDark ? 0.18 : 0.1),
              '&:hover': { background: alpha(primaryColor, isDark ? 0.24 : 0.14) },
            },
          },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          root: {
            '& .MuiSwitch-track': {
              borderRadius: 10,
              opacity: isDark ? 0.35 : 0.25,
            },
            '& .MuiSwitch-thumb': {
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            },
          },
        },
      },

      MuiAccordion: {
        defaultProps: { disableGutters: true, elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: '10px !important',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: isDark ? AV.slate[900] : '#FFFFFF',
            backgroundImage: 'none',
            '&:before': { display: 'none' },
            marginBottom: 8,
          },
        },
      },

      MuiBreadcrumbs: {
        styleOverrides: {
          li: {
            fontSize: `${0.8125 * fsm}rem`,
            fontWeight: 500,
          },
          separator: {
            color: isDark ? AV.slate[600] : AV.slate[400],
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'all 0.15s ease',
            '&:hover': {
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              transform: 'scale(1.05)',
            },
          },
        },
      },

      MuiFab: {
        styleOverrides: {
          root: {
            background: `linear-gradient(135deg, ${primaryColor}, ${AV.violet[500]})`,
            boxShadow: `0 8px 24px ${alpha(primaryColor, 0.45)}`,
            '&:hover': {
              boxShadow: `0 12px 32px ${alpha(primaryColor, 0.55)}`,
              transform: 'scale(1.04)',
            },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: '3px 3px 0 0',
            background: `linear-gradient(90deg, ${primaryColor}, ${AV.violet[500]})`,
          },
          root: {
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: `${0.875 * fsm}rem`,
              minWidth: 80,
            },
          },
        },
      },

      MuiBadge: {
        styleOverrides: {
          badge: {
            fontWeight: 700,
            fontSize: '0.625rem',
          },
        },
      },
    },
  });
};

export const theme = defaultTheme;
