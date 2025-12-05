import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import { feedbackApi, CreateFeedbackDto } from '../../api/feedback';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';

const Feedback = () => {
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
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
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to submit feedback', 'error');
    },
  });

  const onSubmit = async (data: CreateFeedbackDto) => {
    try {
      await submitFeedback.mutateAsync(data);
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Feedback
      </Typography>

      <Paper sx={{ p: 3, mt: 2, maxWidth: 600 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              {...register('type')}
              label="Type"
              defaultValue="other"
            >
              <MenuItem value="bug">Bug Report</MenuItem>
              <MenuItem value="feature">Feature Request</MenuItem>
              <MenuItem value="improvement">Improvement</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Message"
            multiline
            rows={6}
            {...register('message', { required: 'Message is required' })}
            error={!!errors.message}
            helperText={errors.message?.message}
            sx={{ mb: 2 }}
          />

          <Button type="submit" variant="contained" disabled={submitFeedback.isPending}>
            {submitFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default Feedback;

