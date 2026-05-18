// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Box, Typography, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useState } from 'react';

interface OnboardingTipsProps {
  tips: string[];
  title?: string;
  defaultExpanded?: boolean;
}

export const OnboardingTips = ({
  tips,
  title = 'Quick Tips',
  defaultExpanded = false,
}: OnboardingTipsProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (tips.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'action.hover',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightbulbIcon sx={{ color: 'warning.main' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {tips.map((tip, index) => (
              <Typography
                key={index}
                component="li"
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {tip}
              </Typography>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};
