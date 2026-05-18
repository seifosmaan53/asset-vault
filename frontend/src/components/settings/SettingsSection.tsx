import type { ReactNode } from 'react';
import { Box, Typography, Paper, Divider, alpha, useTheme } from '@mui/material';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export const SettingsSection = ({
  title,
  description,
  children,
  defaultExpanded = true,
}: SettingsSectionProps) => {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        borderRadius: 3,
        bgcolor: 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.08)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
        },
      }}
    >
      <Box 
        sx={{ 
          p: { xs: 2.5, sm: 3.5, md: 4 },
          background: `linear-gradient(to bottom, ${alpha(theme.palette.primary.main, 0.02)}, transparent)`,
        }}
      >
        <Box sx={{ mb: description ? 2 : 3 }}>
          <Typography 
            variant="h6" 
            fontWeight={600}
            sx={{
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
              color: 'text.primary',
              mb: description ? 1 : 0,
            }}
          >
            {title}
          </Typography>
          {description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                lineHeight: 1.6,
                maxWidth: '70ch',
              }}
            >
              {description}
            </Typography>
          )}
        </Box>
        {description && (
          <Divider 
            sx={{ 
              mb: 3,
              borderColor: alpha(theme.palette.divider, 0.3),
            }} 
          />
        )}
        <Box
          sx={{
            '& .MuiGrid-container': {
              '& > .MuiGrid-item': {
                '&:last-child': {
                  mb: 0,
                },
              },
            },
          }}
        >
          {children}
        </Box>
      </Box>
    </Paper>
  );
};

