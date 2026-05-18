import { useParams, useNavigate } from 'react-router-dom';
import {Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Skeleton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import InventoryIcon from '@mui/icons-material/Inventory';
import StoreIcon from '@mui/icons-material/Store';
import { useInventoryItem, useStockMovements, useLinkedInvoices } from '../../hooks/useInventory';
import { useStoreItemSettingsByItem } from '../../hooks/useStoreItemSettings';
import { useRecentItems } from '../../hooks/useRecentItems';
import type { Invoice } from '../../types/invoice';
import type { Store, StoreItemSettings } from '../../types/store';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import StockAdjustmentModal from '../../components/inventory/StockAdjustmentModal';
import { useState, useEffect } from 'react';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Grid from '../../components/common/Grid';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';

const InventoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading } = useInventoryItem(id || '');
  const { data: movements, isLoading: movementsLoading } = useStockMovements(id || '');
  const { data: linkedInvoices, isLoading: invoicesLoading } = useLinkedInvoices(id || '');
  const { data: storeSettings, isLoading: storeSettingsLoading } = useStoreItemSettingsByItem(id || '');
  const { trackView } = useRecentItems();
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);

  // Track inventory item view in recent items
  useEffect(() => {
    if (item && id) {
      trackView(id, 'inventory', item.name, `/inventory/${id}`);
    }
  }, [item, id, trackView]);
  
  // Limit display items for better performance
  const DISPLAY_LIMIT = 20;
  const displayedMovements = movements?.slice(0, DISPLAY_LIMIT) || [];
  const displayedInvoices = linkedInvoices?.slice(0, DISPLAY_LIMIT) || [];
  const hasMoreMovements = movements && movements.length > DISPLAY_LIMIT;
  const hasMoreInvoices = linkedInvoices && linkedInvoices.length > DISPLAY_LIMIT;

  const totalStoreStock = (storeSettings || []).reduce(
    (sum: number, s: { currentStock?: number }) => sum + Math.max(0, Number(s.currentStock) || 0),
    0,
  );
  const unassignedStock = Math.max(0, (Number(item?.currentStock) || 0) - totalStoreStock);
  const storeSumExceedsGlobal = (Number(item?.currentStock) || 0) < totalStoreStock;

  const invoiceById = new Map<string, Invoice>(
    (linkedInvoices || []).map((inv: Invoice) => [inv.id, inv]),
  );

  const storeById = new Map<string, Store>(
    (storeSettings || [])
      .map((s: { store?: Store }) => s?.store)
      .filter((s: Store | undefined): s is Store => s?.id !== undefined)
      .map((s: Store) => [s.id, s]),
  );

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Skeleton variant="text" width={300} height={40} />
          <Box display="flex" gap={2}>
            <Skeleton variant="rectangular" width={140} height={40} />
            <Skeleton variant="rectangular" width={100} height={40} />
          </Box>
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} md={4} key={i}>
              <Paper sx={{ p: 2 }}>
                <Skeleton variant="text" width={100} height={30} />
                <Skeleton variant="rectangular" width="100%" height={200} sx={{ mt: 2 }} />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!item) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="text.secondary">
          Inventory item not found
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/inventory')}>
          Back to Inventory
        </Button>
      </Box>
    );
  }


  return (
    <Box component="main">
      <Breadcrumbs
        items={[
          { label: 'Inventory', path: '/inventory' },
          { label: item.name },
        ]}
      />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          {item.name}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<InventoryIcon />}
            onClick={() => setAdjustmentModalOpen(true)}
            size="large"
            aria-label="Adjust stock levels"
          >
            Adjust Stock
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              if (id) {
                navigate(`/inventory/${id}/edit`);
              }
            }}
            disabled={!id}
            size="large"
            aria-label="Edit inventory item"
          >
            Edit
          </Button>
        </Box>
      </Box>

      {/* Key Information Cards - Always Visible */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              SKU
            </Typography>
            <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>
              {item.sku}
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <Chip
                label={item.status}
                color={item.status === 'active' ? 'success' : 'default'}
                size="small"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              Total Inventory
            </Typography>
            <Typography 
              variant="h3" 
              fontWeight="bold" 
              color={item.currentStock <= item.reorderLevel ? 'error.main' : 'primary.main'}
              sx={{ mt: 0.5, fontSize: '2rem' }}
            >
              {Math.max(0, item.currentStock || 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Reorder: {item.reorderLevel}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Allocated to Stores: {totalStoreStock.toLocaleString()}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                {unassignedStock > 0 && (
                  <Typography variant="caption" color="info.main" sx={{ display: 'block', fontWeight: 500 }}>
                    Available: {unassignedStock.toLocaleString()}
                  </Typography>
                )}
                {storeSumExceedsGlobal && (
                  <Chip
                    label="⚠️ Data Issue"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
                  />
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              Unit Price
            </Typography>
            <Typography variant="h3" fontWeight="bold" color="success.main" sx={{ mt: 0.5, fontSize: '2rem' }}>
              {formatCurrency(item.defaultUnitPrice)}
            </Typography>
            {item.costPrice && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Cost: {formatCurrency(item.costPrice)}
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              Planning
            </Typography>
            {item.computed?.weeksOnHand !== null && item.computed?.weeksOnHand !== undefined ? (
              <>
                <Typography 
                  variant="h3" 
                  fontWeight="bold"
                  color={item.computed.weeksOnHand < (item.computed?.effectiveWeeksSupplyTarget || 4) ? 'warning.main' : 'success.main'}
                  sx={{ mt: 0.5, fontSize: '2rem' }}
                >
                  {item.computed.weeksOnHand.toFixed(1)}w
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Target: {item.computed?.effectiveWeeksSupplyTarget || 4}w
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                No usage data
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Expandable Sections */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Description & Physical Attributes */}
        {item.description && (
          <Paper sx={{ p: 2 }}>
            {item.description && (
              <>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {item.description}
                </Typography>
              </>
            )}
            {(item.sizeInches || item.material || item.shape || item.fluteType) && (
              <>
                {item.description && <Divider sx={{ my: 2 }} />}
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', mb: 1 }}>
                  Physical Attributes
                </Typography>
                <Grid container spacing={2.5}>
                  {item.sizeInches && (
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Size
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" sx={{ mt: 0.5 }}>
                        {item.sizeInches}
                      </Typography>
                    </Grid>
                  )}
                  {item.material && (
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Material
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" sx={{ mt: 0.5 }}>
                        {item.material}
                      </Typography>
                    </Grid>
                  )}
                  {item.shape && (
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Shape
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" sx={{ mt: 0.5 }}>
                        {item.shape}
                      </Typography>
                    </Grid>
                  )}
                  {item.fluteType && (
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                        Flute Type
                      </Typography>
                      <Typography variant="body2" fontWeight="medium" sx={{ mt: 0.5 }}>
                        {item.fluteType}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </>
            )}
          </Paper>
        )}

        {/* Item Attributes & Details - Accordion */}
        {(item.packSize || item.unitsPerContainer) && (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Item Attributes & Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2.5}>
                {item.packSize && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Pack Size</Typography>
                    <Typography variant="body1" fontWeight="medium">x{item.packSize}</Typography>
                  </Grid>
                )}
                {item.unitsPerContainer && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Units Per Container</Typography>
                    <Typography variant="body1" fontWeight="medium">{item.unitsPerContainer.toLocaleString()}</Typography>
                  </Grid>
                )}
                {item.computed?.containersNeeded !== null && item.computed?.containersNeeded !== undefined && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Containers Needed</Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary.main">
                      {item.computed.containersNeeded}
                    </Typography>
                  </Grid>
                )}
                {item.defaultTaxRate && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Default Tax Rate</Typography>
                    <Typography variant="body1" fontWeight="medium">{item.defaultTaxRate}%</Typography>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Planning & Supply - Accordion */}
        {(item.computed?.effectiveWeeksSupplyTarget || item.averageWeeklyUsage) && (
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Planning & Supply Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2.5}>
                {item.computed?.effectiveWeeksSupplyTarget && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Weeks Supply Target</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {item.computed.effectiveWeeksSupplyTarget} week{item.computed.effectiveWeeksSupplyTarget !== 1 ? 's' : ''}
                      {item.weeksSupplyTargetOverride && (
                        <Chip label="Override" size="small" sx={{ ml: 1 }} color="warning" variant="outlined" />
                      )}
                    </Typography>
                  </Grid>
                )}
                {item.averageWeeklyUsage && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Average Weekly Usage</Typography>
                    <Typography variant="body1" fontWeight="medium">{item.averageWeeklyUsage.toLocaleString()} units/week</Typography>
                  </Grid>
                )}
                {item.computed?.weeksOnHand !== null && item.computed?.weeksOnHand !== undefined && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">Weeks On Hand</Typography>
                    <Typography 
                      variant="body1" 
                      fontWeight="bold"
                      color={item.computed.weeksOnHand < (item.computed?.effectiveWeeksSupplyTarget || 4) ? 'warning.main' : 'success.main'}
                    >
                      {item.computed.weeksOnHand.toFixed(1)} week{item.computed.weeksOnHand !== 1 ? 's' : ''}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Store Supply - Accordion */}
        <Accordion defaultExpanded={true}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <StoreIcon color="primary" />
              <Typography variant="h6">
                Store Supply
              </Typography>
              {storeSettings && storeSettings.length > 0 && (
                <Chip label={storeSettings.length} size="small" sx={{ ml: 'auto' }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {storeSettingsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : storeSettings && storeSettings.length > 0 ? (
              <TableContainer 
                sx={{ 
                  maxHeight: 600,
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'grey.100',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'grey.400',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'grey.600',
                    },
                  },
                }}
              >
                <Table 
                  size="small" 
                  stickyHeader
                  sx={{ '& .MuiTableCell-root': { py: 1.5, px: 1.5 } }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Store</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Stock</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Weeks Supply</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Usage</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Min / Target</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem', minWidth: 120 }}>Progress</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {storeSettings.map((setting) => {
                      const currentStock = Math.max(0, setting.currentStock || 0);
                      const minQty = setting.minQty || 0;
                      const targetQty = setting.targetQty || 0;
                      const weeklyUsage = setting.weeklyUsage != null && !isNaN(Number(setting.weeklyUsage)) 
                        ? Number(setting.weeklyUsage) 
                        : null;
                      
                      // Calculate weeks of supply (most important metric)
                      const weeksSupply = weeklyUsage && weeklyUsage > 0 
                        ? (currentStock / weeklyUsage)
                        : null;
                      
                      // Determine overall status based on weeks supply (priority) and stock levels
                      const isCriticalStock = currentStock <= minQty;
                      const isLowWeeksSupply = weeksSupply !== null && weeksSupply < 2;
                      const isWarningWeeksSupply = weeksSupply !== null && weeksSupply < 4;
                      const isBelowTarget = targetQty > 0 && currentStock < targetQty;
                      
                      // Primary status: Critical > Low Weeks > Below Target > Good
                      let statusLabel: string;
                      let statusColor: 'error' | 'warning' | 'success' | 'default';
                      
                      if (isCriticalStock || isLowWeeksSupply) {
                        statusLabel = isCriticalStock ? 'Critical' : 'Low Supply';
                        statusColor = 'error';
                      } else if (isWarningWeeksSupply) {
                        statusLabel = 'Low Supply';
                        statusColor = 'warning';
                      } else if (isBelowTarget) {
                        statusLabel = 'Below Target';
                        statusColor = 'warning';
                      } else {
                        statusLabel = 'Good';
                        statusColor = 'success';
                      }
                      
                      // Calculate progress to target (0-100%)
                      const progressToTarget = targetQty > 0 
                        ? Math.min(100, Math.max(0, (currentStock / targetQty) * 100))
                        : 0;
                      
                      // Determine progress color based on weeks supply priority
                      const progressColor = (isCriticalStock || isLowWeeksSupply) ? 'error' 
                        : (isWarningWeeksSupply ? 'warning' : (isBelowTarget ? 'warning' : 'success'));
                      
                      return (
                        <TableRow 
                          key={setting.id} 
                          hover
                          sx={{
                            bgcolor: (isCriticalStock || isLowWeeksSupply) ? 'error.lighter' : 'inherit',
                            '&:hover': {
                              bgcolor: (isCriticalStock || isLowWeeksSupply) ? 'error.light' : 'action.hover',
                            }
                          }}
                        >
                          <TableCell>
                            <Box 
                              display="flex" 
                              alignItems="center" 
                              gap={1}
                              sx={{ 
                                cursor: setting.store?.id ? 'pointer' : 'default',
                                '&:hover': setting.store?.id ? { 
                                  color: 'primary.main',
                                  textDecoration: 'underline' 
                                } : {}
                              }}
                              onClick={() => {
                                if (setting.store?.id) {
                                  navigate(`/stores/${setting.store.id}`);
                                }
                              }}
                            >
                              <StoreIcon 
                                fontSize="small" 
                                color={(isCriticalStock || isLowWeeksSupply) ? 'error' : 'action'} 
                              />
                              <Typography variant="body2" fontWeight="medium">
                                {setting.store?.name || 'Unknown Store'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="h6" 
                              fontWeight="bold"
                              color={(isCriticalStock || isLowWeeksSupply) ? 'error.main' : (isWarningWeeksSupply ? 'warning.main' : 'inherit')}
                              sx={{ fontSize: '1.125rem' }}
                            >
                              {currentStock.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={statusLabel}
                              size="small" 
                              color={statusColor}
                              sx={{ 
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {weeksSupply !== null ? (
                              <Box>
                                <Typography 
                                  variant="h6" 
                                  fontWeight="bold"
                                  color={weeksSupply < 2 ? 'error.main' : (weeksSupply < 4 ? 'warning.main' : 'success.main')}
                                  sx={{ fontSize: '1.125rem', lineHeight: 1.2 }}
                                >
                                  {weeksSupply.toFixed(1)}w
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  color={weeksSupply < 2 ? 'error.main' : (weeksSupply < 4 ? 'warning.main' : 'text.secondary')}
                                  fontWeight={weeksSupply < 4 ? 600 : 400}
                                  sx={{ fontSize: '0.7rem' }}
                                >
                                  {weeksSupply < 2 ? 'CRITICAL' : (weeksSupply < 4 ? 'LOW' : 'GOOD')}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {weeklyUsage !== null ? (
                              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.875rem' }}>
                                {weeklyUsage.toFixed(1)}/wk
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                                <strong>{minQty}</strong> / <strong>{targetQty || '-'}</strong>
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ minWidth: 100 }}>
                              {targetQty > 0 ? (
                                <Box>
                                  <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                                    <Box sx={{ flexGrow: 1 }}>
                                      <LinearProgress 
                                        variant="determinate" 
                                        value={progressToTarget} 
                                        color={progressColor}
                                        sx={{ 
                                          height: 10, 
                                          borderRadius: 1,
                                          bgcolor: 'grey.200'
                                        }}
                                      />
                                    </Box>
                                    <Typography 
                                      variant="caption" 
                                      fontWeight="bold"
                                      sx={{ minWidth: 38, textAlign: 'right', fontSize: '0.75rem' }}
                                      color={progressColor === 'error' ? 'error.main' : (progressColor === 'warning' ? 'warning.main' : 'text.primary')}
                                    >
                                      {progressToTarget.toFixed(0)}%
                                    </Typography>
                                  </Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    of target
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                  No target
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No store supply data available. Add this item to stores to track supply.
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Linked Invoices - Accordion */}
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <ReceiptIcon color="primary" />
              <Typography variant="h6">
                Linked Invoices
              </Typography>
              {linkedInvoices && linkedInvoices.length > 0 && (
                <Chip label={linkedInvoices.length} size="small" sx={{ ml: 'auto' }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {invoicesLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : displayedInvoices && displayedInvoices.length > 0 ? (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice Number</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedInvoices.map((invoice: Invoice) => (
                        <TableRow key={invoice.id} hover>
                          <TableCell>{invoice.number}</TableCell>
                          <TableCell>{invoice.client?.name || '-'}</TableCell>
                          <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                          <TableCell align="right">{formatCurrency(invoice.total, invoice.currency)}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Invoice">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/invoices/${invoice.id}`)}
                                aria-label={`View invoice ${invoice.number}`}
                                sx={{
                                  '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                  },
                                }}
                              >
                                <ReceiptIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {hasMoreInvoices && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Showing {DISPLAY_LIMIT} of {linkedInvoices.length} invoices
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No invoices linked to this item
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Stock Movement History - Accordion */}
        <Accordion defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <InventoryIcon color="primary" />
              <Typography variant="h6">
                Stock Movement History
              </Typography>
              {movements && movements.length > 0 && (
                <Chip label={movements.length} size="small" sx={{ ml: 'auto' }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {movementsLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : displayedMovements && displayedMovements.length > 0 ? (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Source</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayedMovements.map((movement) => (
                        <TableRow key={movement.id} hover>
                          <TableCell>{formatDate(movement.createdAt)}</TableCell>
                          <TableCell>
                            <Chip 
                              label={movement.type} 
                              size="small" 
                              color={movement.type === 'sale' ? 'error' : movement.type === 'purchase' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {(() => {
                              let displayQuantity = movement.quantity;
                              if (movement.type === 'sale') {
                                displayQuantity = -Math.abs(movement.quantity);
                              } else if (movement.type === 'purchase') {
                                displayQuantity = Math.abs(movement.quantity);
                              }
                              const sign = displayQuantity >= 0 ? '+' : '';
                              return (
                                <Typography
                                  variant="body2"
                                  color={movement.type === 'sale' ? 'error.main' : movement.type === 'purchase' ? 'success.main' : 'inherit'}
                                  fontWeight="medium"
                                >
                                  {sign}{displayQuantity}
                                </Typography>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            {movement.sourceType === 'invoice' && movement.sourceId ? (
                              (() => {
                                const inv = invoiceById.get(movement.sourceId);
                                return (
                                  <Box display="flex" flexDirection="column" gap={0.25}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Typography variant="body2" fontWeight="medium">
                                        {inv?.number ? `Invoice ${inv.number}` : 'Invoice'}
                                      </Typography>
                                      {inv?.id && (
                                        <Tooltip title="Open invoice">
                                          <IconButton
                                            size="small"
                                            onClick={() => navigate(`/invoices/${inv.id}`)}
                                            aria-label="Open invoice"
                                            sx={{
                                              '&:hover': {
                                                bgcolor: 'primary.light',
                                                color: 'primary.contrastText',
                                              },
                                            }}
                                          >
                                            <ReceiptIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                    {movement.storeId && storeById.get(movement.storeId) && (
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        {storeById.get(movement.storeId).name} ({storeById.get(movement.storeId).code})
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })()
                            ) : (
                              <Box display="flex" flexDirection="column" gap={0.25}>
                                <Typography variant="body2">{movement.sourceType}</Typography>
                                {movement.storeId && storeById.get(movement.storeId) && (
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {storeById.get(movement.storeId).name} ({storeById.get(movement.storeId).code})
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {movement.note || '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {hasMoreMovements && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Showing {DISPLAY_LIMIT} of {movements.length} movements
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No movements found
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>

      <StockAdjustmentModal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        inventoryItemId={id || ''}
      />
    </Box>
  );
};

export default InventoryDetail;

