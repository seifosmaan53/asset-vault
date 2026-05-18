import { ReactNode } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { TableContainer, Paper, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';

interface ResponsiveTableProps {
  children: ReactNode;
  minWidth?: number;
  stickyHeader?: boolean;
}

/**
 * Responsive table wrapper that handles mobile layouts
 * On mobile (< 960px), tables should be replaced with card views
 */
export const ResponsiveTable = ({ children, minWidth = 600, stickyHeader = false }: ResponsiveTableProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 2,
        boxShadow: 1,
        overflow: 'auto',
        border: '1px solid',
        borderColor: 'divider',
        ...(isMobile && {
          display: 'none', // Hide table on mobile - use card view instead
        }),
      }}
    >
      <Table stickyHeader={stickyHeader} sx={{ minWidth }}>
        {children}
      </Table>
    </TableContainer>
  );
};

export { TableHead, TableBody, TableRow, TableCell };
