import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { useProfile, useUpdateProfile } from '../../hooks/useAuth';
import { settingsApi, UserSettings } from '../../api/settings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings = () => {
  const [tabValue, setTabValue] = useState(0);
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  const updateSettings = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      showToast('Settings updated successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to update settings', 'error');
    },
  });

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm({
    defaultValues: profile,
  });

  const {
    register: registerSettings,
    handleSubmit: handleSubmitSettings,
    formState: { errors: settingsErrors },
    reset: resetSettings,
  } = useForm<UserSettings>({
    defaultValues: settings,
  });

  useEffect(() => {
    if (profile) {
      resetProfile(profile);
    }
  }, [profile, resetProfile]);

  useEffect(() => {
    if (settings) {
      resetSettings(settings);
    }
  }, [settings, resetSettings]);

  const onProfileSubmit = async (data: any) => {
    try {
      await updateProfile.mutateAsync(data);
      showToast('Profile updated successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update profile', 'error');
    }
  };

  const onSettingsSubmit = async (data: UserSettings) => {
    try {
      await updateSettings.mutateAsync(data);
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ mt: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Profile" />
          <Tab label="Company" />
          <Tab label="Invoice Settings" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <form onSubmit={handleSubmitProfile(onProfileSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  {...registerProfile('name', { required: 'Name is required' })}
                  error={!!profileErrors.name}
                  helperText={profileErrors.name?.message}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  {...registerProfile('email', { required: 'Email is required' })}
                  error={!!profileErrors.email}
                  helperText={profileErrors.email?.message}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Company Name"
                  {...registerProfile('companyName')}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained">
                  Update Profile
                </Button>
              </Grid>
            </Grid>
          </form>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <form onSubmit={handleSubmitSettings(onSettingsSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Company Name"
                  {...registerSettings('companyName')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Company Address"
                  multiline
                  rows={3}
                  {...registerSettings('companyAddress')}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Phone"
                  {...registerSettings('companyPhone')}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Company Email"
                  type="email"
                  {...registerSettings('companyEmail')}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained">
                  Update Company Info
                </Button>
              </Grid>
            </Grid>
          </form>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <form onSubmit={handleSubmitSettings(onSettingsSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Invoice Number Format"
                  placeholder="INV-{YYYY}-{####}"
                  {...registerSettings('invoiceNumberFormat')}
                  helperText="Use {YYYY} for year, {####} for number"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Default Currency"
                  {...registerSettings('defaultCurrency')}
                  defaultValue="USD"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Default Tax Rate (%)"
                  type="number"
                  {...registerSettings('defaultTaxRate', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained">
                  Update Settings
                </Button>
              </Grid>
            </Grid>
          </form>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Settings;

