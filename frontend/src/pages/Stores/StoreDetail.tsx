import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Skeleton,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import CodeIcon from '@mui/icons-material/Code';
import NotesIcon from '@mui/icons-material/Notes';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import UpdateIcon from '@mui/icons-material/Update';
import { useStore } from '../../hooks/useStore';
import { useRecentItems } from '../../hooks/useRecentItems';
import { formatDate } from '../../utils/dates';
import StoreInventory from './StoreInventory';
import StoreAlertsList from '../../components/inventory/StoreAlertsList';
import Grid from '../../components/common/Grid';

const StoreDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: store, isLoading } = useStore(id || '');
  const { trackView } = useRecentItems();
  const [activeTab, setActiveTab] = useState(0);

  // Track store view in recent items
  useEffect(() => {
    if (store && id) {
      trackView(id, 'store', store.name, `/stores/${id}`);
    }
  }, [store, id, trackView]);

  // Check if we should open a specific tab from URL parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'inventory') {
      setActiveTab(1);
    } else if (tab === 'alerts') {
      setActiveTab(2);
    } else if (!tab) {
      // Only reset to 0 if there's no tab param and we're not already on a tab
      // This prevents resetting when user manually switches tabs
      if (activeTab !== 0 && activeTab !== 1 && activeTab !== 2) {
        setActiveTab(0);
      }
    }
  }, [searchParams]); // Removed activeTab from deps to prevent loops

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  if (!store) {
    return (
      <Box>
        <Typography variant="h4">Store not found</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <StoreIcon color="primary" />
          <Typography variant="h4" component="h1">
            {store.name}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              if (store?.id) {
                navigate(`/stores/${store.id}/edit`);
              }
            }}
            disabled={!store?.id}
          >
            Edit Store
          </Button>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => {
            setActiveTab(newValue);
            // Update URL to reflect tab change
            const params = new URLSearchParams(searchParams);
            if (newValue === 1) {
              params.set('tab', 'inventory');
            } else if (newValue === 2) {
              params.set('tab', 'alerts');
            } else {
              params.delete('tab');
            }
            navigate(`?${params.toString()}`, { replace: true });
          }}
        >
          <Tab 
            icon={<InfoIcon />} 
            iconPosition="start"
            label="Details" 
            sx={{ textTransform: 'none', minHeight: 64 }}
          />
          <Tab 
            icon={<InventoryIcon />} 
            iconPosition="start"
            label="Inventory" 
            sx={{ textTransform: 'none', minHeight: 64 }}
          />
          <Tab 
            icon={<WarningIcon />} 
            iconPosition="start"
            label="Alerts" 
            sx={{ textTransform: 'none', minHeight: 64 }}
          />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>
          {/* Store Header Card */}
          <Paper 
            sx={{ 
              p: 4, 
              mb: 3,
              bgcolor: store.active ? 'primary.main' : 'grey.700',
              color: 'primary.contrastText',
              boxShadow: 2,
            }}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StoreIcon sx={{ fontSize: 40 }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                    {store.name}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <CodeIcon sx={{ fontSize: 18, opacity: 0.9 }} />
                      <Chip
                        label={store.code}
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          bgcolor: 'rgba(255, 255, 255, 0.25)',
                          color: 'white',
                          fontSize: '0.875rem',
                          height: 28,
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>

          <Grid container spacing={3}>
            {/* Contact Information Card */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocationOnIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Contact Information
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                {/* Address */}
                <Box mb={3}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                    Address
                  </Typography>
                  {store.address || store.city || store.state || store.zip || store.country ? (
                    <Box>
                      {store.address && (
                        <Typography variant="body1" sx={{ mb: 0.5 }}>
                          {store.address}
                        </Typography>
                      )}
                      {(store.city || store.state || store.zip) && (
                        <Typography variant="body1" color="text.secondary">
                          {[store.city, store.state, store.zip].filter(Boolean).join(', ')}
                          {store.country && `, ${store.country}`}
                        </Typography>
                      )}
                      {!store.address && !store.city && !store.state && store.country && (
                        <Typography variant="body1" color="text.secondary">
                          {store.country}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No address provided
                    </Typography>
                  )}
                </Box>

                {/* Phone */}
                {store.phone && (
                  <Box mb={3}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                      Phone
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body1">{store.phone}</Typography>
                    </Box>
                  </Box>
                )}

                {/* Email */}
                {store.email && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                      Email
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body1">{store.email}</Typography>
                    </Box>
                  </Box>
                )}

                {!store.phone && !store.email && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No contact information provided
                  </Typography>
                )}
              </Paper>
            </Grid>

            {/* Additional Information Card */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <InfoIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Additional Information
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="flex-start" gap={1.5}>
                      <CalendarTodayIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                      <Box flex={1}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                          Created
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {formatDate(store.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="flex-start" gap={1.5}>
                      <UpdateIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                      <Box flex={1}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                          Last Updated
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {formatDate(store.updatedAt)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Notes Card */}
            {store.notes && (
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <NotesIcon color="primary" />
                    <Typography variant="h6" fontWeight={600}>
                      Notes
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {store.notes}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {activeTab === 1 && <StoreInventory />}

      {activeTab === 2 && <StoreAlertsList storeId={store.id} showStoreColumn={false} />}

      <Box mt={3}>
        <Button
          variant="outlined"
          onClick={() => navigate('/stores')}
        >
          Back to Stores
        </Button>
      </Box>

    </Box>
  );
};

export default StoreDetail;

