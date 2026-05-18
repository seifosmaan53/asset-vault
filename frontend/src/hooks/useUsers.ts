import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users';
import type { CreateUserDto, UpdateUserDto } from '../api/users';

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });
};

export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserDto) => usersApi.create(data),
    onSuccess: async () => {
      // CRITICAL: Refetch user queries to ensure data is persisted and fresh
      queryClient.invalidateQueries({ queryKey: ['users'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['users'], exact: false });
    },
    onError: (_error) => {
      // Error handling - could show toast notification here if needed
      // The error will be handled by the component using this hook
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
      usersApi.update(id, data),
    onSuccess: async () => {
      // CRITICAL: Refetch user queries to ensure data is persisted and fresh
      queryClient.invalidateQueries({ queryKey: ['users'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['users'], exact: false });
    },
    onError: (_error) => {
      // Error handling - could show toast notification here if needed
      // The error will be handled by the component using this hook
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousUsers = queryClient.getQueryData(['users']);
      queryClient.setQueriesData({ queryKey: ['users'] }, (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.filter((item: { id?: string }) => item.id !== id);
        }
        return old;
      });
      return { previousUsers };
    },
    onError: (_err, _id, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['users'], context.previousUsers);
      }
    },
    onSuccess: async () => {
      // CRITICAL: Refetch user queries to ensure data is persisted and fresh
      queryClient.invalidateQueries({ queryKey: ['users'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['users'], exact: false });
    },
  });
};

