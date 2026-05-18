// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Box, Typography, Button, Paper } from '@mui/material';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  onboardingTips?: string[];
  variant?: 'default' | 'minimal' | 'card';
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  onboardingTips,
  variant = 'default',
}: EmptyStateProps) => {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: variant === 'minimal' ? 4 : 8,
        px: 2,
        textAlign: 'center',
      }}
    >
      {icon && (
        <Box
          sx={{
            p: 3,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h6" color="text.primary" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
        {description}
      </Typography>
      {(action || secondaryAction) && (
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          {action && (
            <Button
              variant="contained"
              startIcon={action.icon}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outlined" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </Box>
      )}
      {onboardingTips && onboardingTips.length > 0 && (
        <Box
          sx={{
            mt: 4,
            p: 2,
            bgcolor: 'info.light',
            borderRadius: 2,
            maxWidth: 500,
            textAlign: 'left',
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Quick Tips:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {onboardingTips.map((tip, index) => (
              <Typography
                key={index}
                component="li"
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                {tip}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );

  if (variant === 'card') {
    return (
      <Paper elevation={1} sx={{ p: 4 }}>
        {content}
      </Paper>
    );
  }

  return content;
};
