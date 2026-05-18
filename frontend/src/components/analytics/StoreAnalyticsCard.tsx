import { Card, CardContent, Typography, Box, Chip, IconButton, Divider, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';
import type { StoreSummary } from '../../api/analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StoreIcon from '@mui/icons-material/Store';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { logger } from '../../utils/logger';

interface StoreAnalyticsCardProps {
  store: StoreSummary;
  onClick?: (storeId: string) => void;
}

// Helper function to validate and clean store name
const getStoreDisplayName = (storeName: string | undefined, storeCode: string | undefined): string => {
  if (!storeName || storeName.trim() === '') {
    return storeCode && storeCode.trim() !== '' ? `Store ${storeCode}` : 'Unnamed Store';
  }
  // Check if the name looks like corrupted data (very short random characters)
  if (storeName.length < 3 && /^[a-z]+$/i.test(storeName)) {
    return storeCode && storeCode.trim() !== '' ? `Store ${storeCode}` : storeName;
  }
  return storeName;
};

// Helper function to validate store code
const getStoreDisplayCode = (storeCode: string | undefined): string => {
  if (!storeCode || storeCode.trim() === '') {
    return 'N/A';
  }
  return storeCode;
};

const StoreAnalyticsCard = ({ store, onClick }: StoreAnalyticsCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, [role="button"], input, select, textarea, .MuiIconButton-root');
    
    if (isInteractive) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (onClick) {
        onClick(store.storeId);
      } else {
        navigate(`/analytics/stores/${store.storeId}`);
      }
    } catch (error) {
      logger.error('Error navigating to store analytics:', error);
      // Fallback navigation
      try {
        navigate(`/analytics/stores/${store.storeId}`);
      } catch (navError) {
        logger.error('Navigation failed:', navError);
        // Last resort - use window.location
        window.location.href = `/analytics/stores/${store.storeId}`;
      }
    }
  };

  const displayName = getStoreDisplayName(store.storeName, store.storeCode);
  const displayCode = getStoreDisplayCode(store.storeCode);
  // FIX: Ensure numeric values are properly parsed and validated
  const totalRevenue = typeof store.totalRevenue === 'number' ? store.totalRevenue : parseFloat(String(store.totalRevenue || 0)) || 0;
  const paidRevenue = typeof store.paidRevenue === 'number' ? store.paidRevenue : parseFloat(String(store.paidRevenue || 0)) || 0;
  const totalInvoices = typeof store.totalInvoices === 'number' ? store.totalInvoices : parseInt(String(store.totalInvoices || 0), 10) || 0;
  const averageInvoiceValue = typeof store.averageInvoiceValue === 'number' ? store.averageInvoiceValue : (totalInvoices > 0 ? totalRevenue / totalInvoices : 0);
  
  const hasRevenue = totalRevenue > 0;
  const hasInvoices = totalInvoices > 0;
  const outstandingRevenue = totalRevenue - paidRevenue;
  const paymentRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;

  return (
    <Box
      onClick={handleCardClick}
      sx={{
        height: '100%',
        cursor: 'pointer',
      }}
    >
    <Card
      elevation={2}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '2px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'relative',
        pointerEvents: 'auto',
        borderRadius: 3,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
          opacity: 1,
        },
        '&:hover': {
          boxShadow: 8,
          transform: 'translateY(-6px)',
          borderColor: 'primary.main',
          '&::before': {
            height: 5,
          },
        },
        '&:active': {
          transform: 'translateY(-3px)',
        },
      }}
    >
      <CardContent 
        sx={{ 
          flexGrow: 1, 
          position: 'relative', 
          p: 2.5,
          '&:last-child': { pb: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {/* Header Section */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box display="flex" alignItems="center" gap={1.25} flex={1} minWidth={0}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 2,
                flexShrink: 0,
              }}
            >
              <StoreIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box flex={1} minWidth={0}>
              <Tooltip title={displayName} arrow>
                <Typography
                  variant="subtitle1"
                  component="h3"
                  fontWeight={700}
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '1rem',
                    lineHeight: 1.3,
                    mb: 0.25,
                  }}
                >
                  {displayName}
                </Typography>
              </Tooltip>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  display: 'block',
                }}
              >
                {displayCode}
              </Typography>
            </Box>
          </Box>
          {/* Active status removed - all stores are always active */}
        </Box>

        {/* Revenue Section */}
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: hasRevenue ? 'primary.light' : 'action.hover',
            background: hasRevenue
              ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.12) 0%, rgba(25, 118, 210, 0.05) 100%)'
              : 'transparent',
            border: hasRevenue ? '2px solid' : '1px dashed',
            borderColor: hasRevenue ? 'primary.light' : 'divider',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: hasRevenue ? 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)' : 'transparent',
            },
          }}
        >
          <Box display="flex" alignItems="center" gap={0.75} mb={1.25}>
            <AttachMoneyIcon sx={{ fontSize: 20, color: hasRevenue ? 'primary.main' : 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
              Total Revenue
            </Typography>
          </Box>
          <Typography
            variant="h6"
            fontWeight={700}
            color={hasRevenue ? 'primary.dark' : 'text.disabled'}
            sx={{ mb: 0.75, lineHeight: 1.2, fontSize: '1.15rem' }}
          >
            {formatCurrency(totalRevenue, 'USD')}
          </Typography>
          {hasRevenue && (
            <Box 
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                pt: 0.75,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="success.main" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                  Paid: {formatCurrency(paidRevenue, 'USD')}
                </Typography>
                <Chip
                  label={`${paymentRate.toFixed(1)}%`}
                  size="small"
                  color={paymentRate >= 90 ? 'success' : paymentRate >= 70 ? 'warning' : 'error'}
                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                />
              </Box>
              {outstandingRevenue > 0 && (
                <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                  Outstanding: {formatCurrency(outstandingRevenue, 'USD')}
                </Typography>
              )}
            </Box>
          )}
          {!hasRevenue && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
              No revenue yet
            </Typography>
          )}
        </Box>

        {/* Stats Section */}
        <Box
          display="flex"
          justifyContent="space-between"
          gap={1.5}
          sx={{
            p: 1.75,
            borderRadius: 2,
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
            mt: 'auto',
          }}
        >
          <Box flex={1} sx={{ position: 'relative' }}>
            <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
              <ReceiptIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.8 }}>
                Invoices
              </Typography>
            </Box>
            <Typography variant="subtitle1" fontWeight={700} color={hasInvoices ? 'text.primary' : 'text.disabled'} sx={{ fontSize: '1rem', lineHeight: 1.2 }}>
              {totalInvoices.toLocaleString()}
            </Typography>
          </Box>
          <Box 
            flex={1} 
            sx={{ 
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '10%',
                bottom: '10%',
                width: 1,
                bgcolor: 'divider',
              },
              pl: 1.75,
            }}
          >
            <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
              <AssessmentIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.8 }}>
                Avg. Value
              </Typography>
            </Box>
            <Typography variant="subtitle1" fontWeight={700} color={hasRevenue ? 'text.primary' : 'text.disabled'} sx={{ fontSize: '1rem', lineHeight: 1.2 }}>
              {formatCurrency(averageInvoiceValue, 'USD')}
            </Typography>
          </Box>
        </Box>

        {/* Action Button */}
        <Tooltip title="View detailed analytics" arrow placement="top">
          <IconButton
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                if (onClick) {
                  onClick(store.storeId);
                } else {
                  navigate(`/analytics/stores/${store.storeId}`);
                }
              } catch (error) {
                logger.error('Error navigating from button:', error);
                navigate(`/analytics/stores/${store.storeId}`);
              }
            }}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              color: 'white',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              zIndex: 10,
              boxShadow: 3,
              width: 36,
              height: 36,
              '&:hover': {
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                transform: 'scale(1.15) rotate(5deg)',
                boxShadow: 6,
              },
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            size="small"
          >
            <ArrowForwardIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </CardContent>
    </Card>
    </Box>
  );
};

export default StoreAnalyticsCard;

