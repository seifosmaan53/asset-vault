import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  recurringInvoicesApi,
  CreateRecurringInvoiceDto,
  UpdateRecurringInvoiceDto,
} from '../api/recurringInvoices';

export const useRecurringInvoices = () => {
  return useQuery({
    queryKey: ['recurring-invoices'],
    queryFn: () => recurringInvoicesApi.getAll(),
  });
};

export const useRecurringInvoice = (id: string) => {
  return useQuery({
    queryKey: ['recurring-invoices', id],
    queryFn: () => recurringInvoicesApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateRecurringInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringInvoiceDto) => recurringInvoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
    },
  });
};

export const useUpdateRecurringInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecurringInvoiceDto }) =>
      recurringInvoicesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices', variables.id] });
    },
  });
};

export const useDeleteRecurringInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
    },
  });
};

