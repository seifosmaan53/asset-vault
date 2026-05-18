import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceTemplatesApi } from '../api/invoiceTemplates';
import type { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from '../types/invoiceTemplate';
import { useAuthStore } from '../store/authStore';

export const useInvoiceTemplates = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  return useQuery({
    queryKey: ['invoice-templates'],
    queryFn: () => invoiceTemplatesApi.getAll(),
    enabled: isAuthenticated,
    staleTime: 30000,
  });
};

export const useInvoiceTemplate = (id: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  return useQuery({
    queryKey: ['invoice-templates', id],
    queryFn: () => invoiceTemplatesApi.getById(id),
    enabled: isAuthenticated && !!id,
  });
};

export const useDefaultInvoiceTemplate = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  return useQuery({
    queryKey: ['invoice-templates', 'default'],
    queryFn: () => invoiceTemplatesApi.getDefault(),
    enabled: isAuthenticated,
  });
};

export const useCreateInvoiceTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateInvoiceTemplateDto) => invoiceTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
    },
  });
};

export const useUpdateInvoiceTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceTemplateDto }) =>
      invoiceTemplatesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', variables.id] });
    },
  });
};

export const useDeleteInvoiceTemplate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => invoiceTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
    },
  });
};
