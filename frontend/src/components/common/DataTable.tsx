// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ColumnSizingState,
  type ColumnOrderState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Checkbox,
  Typography,
  Tooltip,
  useTheme,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useState, useMemo, useEffect } from 'react';
import { useTableColumns } from '../../hooks/useTableColumns';

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  tableId: string;
  enableColumnResizing?: boolean;
  enableColumnVisibility?: boolean;
  enableColumnReordering?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  tableId,
  enableColumnResizing = true,
  enableColumnVisibility = true,
  enableColumnReordering = false,
  enableSorting = true,
  enableFiltering = false,
  enablePagination = false,
  pageSize = 100,
  emptyMessage = 'No data available',
  onRowClick,
  stickyHeader = false,
}: DataTableProps<T>) {
  const theme = useTheme();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  // Get column IDs for preferences
  const columnIds = useMemo(() => columns.map((col) => col.id || '').filter(Boolean), [columns]);

  const {
    preferences,
    toggleColumnVisibility: toggleVisibility,
    setColumnWidth,
    getVisibleColumns,
  } = useTableColumns(tableId, columnIds);

  // Sync column visibility with preferences
  useEffect(() => {
    const visibleCols: VisibilityState = {};
    columnIds.forEach((colId) => {
      visibleCols[colId] = preferences[colId]?.visible !== false;
    });
    setColumnVisibility(visibleCols);
  }, [preferences, columnIds]);

  // Sync column widths with preferences
  useEffect(() => {
    const sizing: ColumnSizingState = {};
    columnIds.forEach((colId) => {
      if (preferences[colId]?.width) {
        sizing[colId] = preferences[colId].width!;
      }
    });
    setColumnSizing(sizing);
  }, [preferences, columnIds]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnOrder,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
    enableColumnResizing,
    columnResizeMode: 'onChange',
  });

  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColumnMenuAnchor(event.currentTarget);
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
  };

  const handleToggleColumn = (columnId: string) => {
    toggleVisibility(columnId);
  };

  return (
    <Box>
      {enableColumnVisibility && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Tooltip title="Column visibility">
            <IconButton onClick={handleColumnMenuOpen} size="small">
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={columnMenuAnchor}
            open={Boolean(columnMenuAnchor)}
            onClose={handleColumnMenuClose}
          >
            {table.getAllColumns().map((column) => {
              if (!column.id) return null;
              return (
                <MenuItem key={column.id} dense>
                  <Checkbox
                    checked={column.getIsVisible()}
                    onChange={() => handleToggleColumn(column.id!)}
                    size="small"
                  />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </Typography>
                </MenuItem>
              );
            })}
          </Menu>
        </Box>
      )}

      <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 200px)' }}>
        <Table stickyHeader={stickyHeader} sx={{ minWidth: 650 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    sx={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      maxWidth: header.getSize(),
                      position: 'relative',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <Typography variant="caption" color="text.secondary">
                          {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                        </Typography>
                      )}
                    </Box>
                    {enableColumnResizing && (
                      <Box
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '4px',
                          cursor: 'col-resize',
                          backgroundColor: header.isResizing
                            ? theme.palette.primary.main
                            : 'transparent',
                          '&:hover': {
                            backgroundColor: theme.palette.divider,
                          },
                        }}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => onRowClick?.(row.original)}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      sx={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
