import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, CreateInvoiceDto, UpdateInvoiceDto } from '../api/invoices';

export const useInvoices = (filters?: { status?: string; type?: string; search?: string }) => {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => invoicesApi.getAll(filters),
  });
};

export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => invoicesApi.getById(id),
    enabled: !!id,
  });
};

export const useInvoiceStats = () => {
  return useQuery({
    queryKey: ['invoices', 'stats'],
    queryFn: () => invoicesApi.getStats(),
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceDto) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'] });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceDto }) =>
      invoicesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'] });
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'] });
    },
  });
};

