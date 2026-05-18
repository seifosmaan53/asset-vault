import { Box, Button, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import { alpha, useTheme } from '@mui/material';

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
  resourceName?: string;
}

export const BulkActionsBar = ({
  selectedCount,
  onDelete,
  onClearSelection,
  isLoading = false,
  resourceName = 'items',
}: BulkActionsBarProps) => {
  const theme = useTheme();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        p: 2,
        mb: 2,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.1),
        border: `2px solid ${theme.palette.primary.main}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box display="flex" alignItems="center" gap={2}>
        <Typography variant="body1" fontWeight={600} sx={{ color: 'primary.main' }}>
          {selectedCount} {selectedCount === 1 ? resourceName.slice(0, -1) : resourceName} selected
        </Typography>
      </Box>
      <Box display="flex" gap={1}>
        <Tooltip title={`Delete ${selectedCount} ${resourceName}`}>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            disabled={isLoading}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Delete ({selectedCount})
          </Button>
        </Tooltip>
        <Tooltip title="Clear selection">
          <IconButton
            onClick={onClearSelection}
            disabled={isLoading}
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ClearIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};
