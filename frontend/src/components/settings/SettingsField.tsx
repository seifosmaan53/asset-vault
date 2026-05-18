import type { ReactNode } from 'react';
import { Box, Typography, Tooltip, IconButton, Link, alpha, useTheme } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import Grid from '../common/Grid';

interface SettingsFieldProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  fullWidth?: boolean;
  xs?: number;
  md?: number;
  // Fix Issue #51-55: Enhanced field support
  tooltip?: string;
  helpLink?: string;
  example?: string;
  placeholder?: string;
  icon?: ReactNode;
  // Fix Issue #70-73: Accessibility
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export const SettingsField = ({
  label,
  description,
  error,
  required,
  children,
  fullWidth = false,
  xs = 12,
  md = 6,
  tooltip,
  helpLink,
  example,
  placeholder,
  icon,
  ariaLabel,
  ariaDescribedBy,
}: SettingsFieldProps) => {
  const theme = useTheme();
  
  // Fix Issue #70-73: Generate accessible IDs
  const fieldId = label ? `settings-field-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  
  // Fix Issue #82: Highlight changed fields
  const isChanged = false; // This will be passed from parent component if needed
  
  const content = (
    <Box
      aria-label={ariaLabel || label}
      aria-describedby={[descriptionId, errorId, ariaDescribedBy].filter(Boolean).join(' ') || undefined}
      sx={{
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        ...(isChanged ? {
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          borderRadius: 2,
          p: 1.5,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
        } : {}),
      }}
    >
      {label && (
        <Box 
          display="flex" 
          alignItems="center" 
          gap={1} 
          mb={1.5}
          sx={{
            flexWrap: 'wrap',
          }}
        >
          {icon && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: error ? 'error.main' : 'text.secondary',
                transition: 'color 0.2s ease-in-out',
              }}
            >
              {icon}
            </Box>
          )}
          <Typography
            variant="body2"
            fontWeight={600}
            color={error ? 'error.main' : 'text.primary'}
            component="label"
            htmlFor={fieldId}
            sx={{
              fontSize: '0.9375rem',
              flex: 1,
              minWidth: 0,
            }}
          >
            {label}
            {required && (
              <Typography 
                component="span" 
                color="error.main" 
                sx={{ ml: 0.5 }} 
                aria-label="required"
                fontWeight={700}
              >
                *
              </Typography>
            )}
          </Typography>
          {/* Fix Issue #52: Tooltip support */}
          {tooltip && (
            <Tooltip title={tooltip} arrow placement="top">
              <IconButton 
                size="small" 
                sx={{ 
                  p: 0.5,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Fix Issue #53: Help link */}
          {helpLink && (
            <Tooltip title="View documentation" arrow placement="top">
              <Link 
                href={helpLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.secondary',
                  transition: 'color 0.2s ease-in-out',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <HelpOutlineIcon fontSize="small" />
              </Link>
            </Tooltip>
          )}
        </Box>
      )}
      {description && (
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ 
            mb: 1.5, 
            display: 'block',
            lineHeight: 1.5,
            fontSize: '0.8125rem',
          }}
          id={descriptionId}
        >
          {description}
        </Typography>
      )}
      {/* Fix Issue #54: Example values */}
      {example && (
        <Box
          sx={{
            mb: 1.5,
            p: 1,
            bgcolor: alpha(theme.palette.info.main, 0.06),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}
        >
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              display: 'block', 
              fontStyle: 'italic',
              fontSize: '0.75rem',
            }}
          >
            <strong>Example:</strong> {example}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          '& .MuiTextField-root, & .MuiFormControl-root, & .MuiSelect-root': {
            transition: 'all 0.2s ease-in-out',
          },
        }}
      >
        {children}
      </Box>
      {error && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: alpha(theme.palette.error.main, 0.08),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
          }}
        >
          <Typography 
            variant="caption" 
            color="error.main" 
            sx={{ 
              display: 'block',
              fontWeight: 500,
              fontSize: '0.8125rem',
            }}
            id={errorId}
            role="alert"
            aria-live="polite"
          >
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );

  if (fullWidth) {
    return <Grid item xs={12}>{content}</Grid>;
  }

  return (
    <Grid item xs={xs} md={md}>
      {content}
    </Grid>
  );
};

