import { apiClient } from './apiClient';

export interface CreateFeedbackDto {
  message: string;
  type?: 'bug' | 'feature' | 'improvement' | 'other';
}

export const feedbackApi = {
  create: async (data: CreateFeedbackDto): Promise<void> => {
    await apiClient.post('/feedback', data);
  },
};

