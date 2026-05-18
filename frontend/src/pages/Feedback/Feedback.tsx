import { useForm, Controller } from 'react-hook-form';
import {Box,
  Typography,
  TextField,
  Button,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Alert,
  Divider,
  Container,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BuildIcon from '@mui/icons-material/Build';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { feedbackApi } from '../../api/feedback';
import type { CreateFeedbackDto } from '../../api/feedback';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import Grid from '../../components/common/Grid';

const Feedback = () => {
  const { showToast } = useToast();

  const {
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<CreateFeedbackDto>({
    defaultValues: {
      type: 'other',
    },
  });

  const submitFeedback = useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: () => {
      showToast('Thank you for your feedback!', 'success');
      reset();
    },
    onError: (error: unknown) => {
      const errorMessage = getErrorMessage(error, 'Failed to submit feedback');
      showToast(errorMessage, 'error');
    },
  });

  const onSubmit = async (data: CreateFeedbackDto) => {
    try {
      await submitFeedback.mutateAsync(data);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'bug':
        return <BugReportIcon />;
      case 'feature':
        return <LightbulbIcon />;
      case 'improvement':
        return <BuildIcon />;
      default:
        return <ChatIcon />;
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'bug':
        return 'Bug Report';
      case 'feature':
        return 'Feature Request';
      case 'improvement':
        return 'Improvement';
      default:
        return 'Other';
    }
  };


  return (
    <Container maxWidth="lg">
      <Box sx={{ 
        width: '100%',
        mx: 'auto',
        p: { xs: 3, sm: 4, md: 5 },
      }}>
      <Box 
        display="flex" 
        alignItems="center" 
        gap={2.5} 
        mb={4}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            boxShadow: 3,
          }}
        >
          <FeedbackIcon sx={{ fontSize: 40 }} />
        </Box>
        <Box>
          <Typography variant="h3" component="h1" fontWeight={700} sx={{ mb: 0.5, lineHeight: 1.2 }}>
            Feedback
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem' }}>
            Share your thoughts, report issues, or suggest improvements
          </Typography>
        </Box>
      </Box>

      <Paper 
        elevation={3}
        sx={{ 
          p: { xs: 4, sm: 5, md: 6 }, 
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Controller
                name="type"
                control={control}
                defaultValue="other"
                render={({ field }) => (
                  <FormControl fullWidth size="medium">
                    <InputLabel sx={{ fontSize: '1.1rem', fontWeight: 600 }}>Feedback Type</InputLabel>
                    <Select
                      {...field}
                      label="Feedback Type"
                      size="medium"
                      sx={{
                        fontSize: '1.05rem',
                        '& .MuiSelect-select': {
                          py: 1.5,
                        },
                      }}
                      renderValue={(value) => (
                        <Box display="flex" alignItems="center" gap={1.5}>
                          {getTypeIcon(value)}
                          <Typography sx={{ fontSize: '1.05rem', fontWeight: 500 }}>
                            {getTypeLabel(value)}
                          </Typography>
                        </Box>
                      )}
                    >
                      <MenuItem value="bug">
                        <Box display="flex" alignItems="center" gap={1}>
                          <BugReportIcon fontSize="small" color="error" />
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              Bug Report
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Report a problem or error
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      <MenuItem value="feature">
                        <Box display="flex" alignItems="center" gap={1}>
                          <LightbulbIcon fontSize="small" color="primary" />
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              Feature Request
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Suggest a new feature
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      <MenuItem value="improvement">
                        <Box display="flex" alignItems="center" gap={1}>
                          <BuildIcon fontSize="small" color="warning" />
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              Improvement
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Suggest an enhancement
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      <MenuItem value="other">
                        <Box display="flex" alignItems="center" gap={1}>
                          <ChatIcon fontSize="small" color="info" />
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              Other
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              General feedback or comments
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="message"
                control={control}
                rules={{ required: 'Message is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Your Feedback *"
                    placeholder="Please share your thoughts, describe the issue, or suggest improvements..."
                    multiline
                    rows={16}
                    required
                    error={!!errors.message}
                    helperText={errors.message?.message || 'Be as detailed as possible to help us understand your feedback'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 2 }}>
                          <ChatIcon sx={{ fontSize: 28 }} color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    InputLabelProps={{
                      sx: {
                        fontSize: '1.1rem',
                        fontWeight: 600,
                      },
                    }}
                    sx={{
                      '& .MuiInputBase-root': {
                        alignItems: 'flex-start',
                        fontSize: '1.05rem',
                        minHeight: '400px',
                        py: 1,
                      },
                      '& .MuiInputBase-input': {
                        fontSize: '1.05rem',
                        lineHeight: 1.6,
                        padding: '16px 14px',
                      },
                      '& .MuiInputAdornment-root': {
                        height: 'auto',
                      },
                      '& .MuiFormHelperText-root': {
                        fontSize: '0.95rem',
                      },
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Alert 
                severity="info"
                sx={{
                  py: 2,
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
              >
                <Typography variant="body1" sx={{ fontSize: '1.05rem' }}>
                  <strong>Thank you for your feedback!</strong> We value your input and will review your submission carefully.
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={2}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => reset()}
                  disabled={submitFeedback.isPending}
                  size="large"
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitFeedback.isPending}
                  size="large"
                  startIcon={<SendIcon />}
                  sx={{ minWidth: 160 }}
                >
                  {submitFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
    </Container>
  );
};

export default Feedback;

