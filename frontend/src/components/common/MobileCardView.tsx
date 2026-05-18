import { ReactNode } from 'react';
import { Box, Card, CardContent, Typography, useTheme, useMediaQuery, Divider } from '@mui/material';

interface MobileCardViewProps {
  children: ReactNode;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
}

/**
 * Mobile card view wrapper for displaying data in card format on mobile devices
 * Only visible on mobile (< 960px)
 */
export const MobileCardView = ({ children, emptyMessage, emptyIcon }: MobileCardViewProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (!isMobile) {
    return null; // Hide on desktop - use table instead
  }

  if (!children || (Array.isArray(children) && children.length === 0)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          px: 2,
        }}
      >
        {emptyIcon}
        {emptyMessage && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            {emptyMessage}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pb: 2,
      }}
    >
      {children}
    </Box>
  );
};

interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

export const MobileCard = ({ children, onClick, selected = false }: MobileCardProps) => {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': onClick
          ? {
              boxShadow: 4,
              transform: 'translateY(-2px)',
            }
          : {},
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>{children}</CardContent>
    </Card>
  );
};

interface MobileCardRowProps {
  label: string;
  value: ReactNode;
  divider?: boolean;
}

export const MobileCardRow = ({ label, value, divider = false }: MobileCardRowProps) => {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          py: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, minWidth: 100 }}>
          {label}
        </Typography>
        <Box sx={{ flex: 1, textAlign: 'right' }}>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {value}
            </Typography>
          ) : (
            value
          )}
        </Box>
      </Box>
      {divider && <Divider />}
    </>
  );
};
