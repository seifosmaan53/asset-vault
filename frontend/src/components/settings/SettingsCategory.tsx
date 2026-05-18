import type { ReactNode } from 'react';
import { Box, Typography, Breadcrumbs, Link, Chip, alpha, useTheme } from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

interface SettingsCategoryProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  children: ReactNode;
  hasUnsavedChanges?: boolean;
}

export const SettingsCategory = ({
  title,
  description,
  breadcrumbs,
  children,
  hasUnsavedChanges = false,
}: SettingsCategoryProps) => {
  const theme = useTheme();

  return (
    <Box 
      data-settings-category-wrapper
      sx={{ 
        flex: 1, 
        overflowY: 'auto',
        overflowX: 'hidden',
        bgcolor: alpha(theme.palette.background.default, 0.4),
        backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.02), rgba(0,0,0,0.01))',
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&::-webkit-scrollbar': {
          width: '10px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: alpha(theme.palette.text.primary, 0.2),
          borderRadius: '5px',
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.3),
          },
        },
      }}
    >
      <Box 
        sx={{ 
          maxWidth: 1200, 
          mx: 'auto', 
          p: { xs: 3, sm: 4, md: 5 }, 
          flex: '1 1 auto', 
          minHeight: 'min-content',
          width: '100%',
        }}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            sx={{ 
              mb: 3,
              '& .MuiBreadcrumbs-ol': {
                flexWrap: 'nowrap',
              },
            }}
          >
            {breadcrumbs.map((crumb, index) => (
              <Link
                key={index}
                component="button"
                variant="body2"
                color={index === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                onClick={crumb.onClick}
                sx={{
                  cursor: crumb.onClick ? 'pointer' : 'default',
                  textDecoration: 'none',
                  fontWeight: index === breadcrumbs.length - 1 ? 500 : 400,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: crumb.onClick ? 'underline' : 'none',
                  },
                }}
              >
                {crumb.label}
              </Link>
            ))}
          </Breadcrumbs>
        )}

        <Box 
          sx={{ 
            mb: 5, 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: 2, 
            flexWrap: 'wrap',
            pb: 3,
            borderBottom: `2px solid ${alpha(theme.palette.divider, 0.5)}`,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              fontWeight={700}
              sx={{
                fontSize: { xs: '1.75rem', sm: '2rem' },
                mb: 1,
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${alpha(theme.palette.text.primary, 0.8)} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {title}
            </Typography>
            {description && (
              <Typography 
                variant="body1" 
                color="text.secondary" 
                sx={{ 
                  mt: 1,
                  lineHeight: 1.6,
                  maxWidth: '80ch',
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
          {hasUnsavedChanges && (
            <Chip
              label="Unsaved changes"
              color="warning"
              size="medium"
              sx={{ 
                fontWeight: 600,
                height: 32,
                boxShadow: `0 2px 8px ${alpha(theme.palette.warning.main, 0.3)}`,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.8,
                  },
                },
              }}
            />
          )}
        </Box>

        <Box
          sx={{
            '& > *:last-child': {
              mb: 0,
            },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

