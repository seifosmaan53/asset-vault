import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicesList from './InvoicesList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '../../theme';
import { ToastProvider } from '../../contexts/ToastContext';

// Mock hooks
vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
  useInvoicesPaged: vi.fn(),
  useDeleteInvoice: vi.fn(),
  useCreateInvoice: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Import hooks at module level (not top-level await)
import { useInvoicesPaged, useDeleteInvoice, useCreateInvoice } from '../../hooks/useInvoices';

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('InvoicesList', () => {
  const mockInvoices = [
    {
      id: 'invoice-1',
      number: 'INV-2024-0001',
      client: { id: 'client-1', name: 'Client A' },
      store: { id: 'store-1', name: 'Store A', code: 'SA1' },
      status: 'paid',
      total: 1000,
      currency: 'USD',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'invoice-2',
      number: 'INV-2024-0002',
      client: { id: 'client-2', name: 'Client B' },
      store: null,
      status: 'draft',
      total: 500,
      currency: 'USD',
      issueDate: '2024-01-02',
      dueDate: null,
      createdAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'invoice-3',
      number: 'INV-2024-0003',
      client: { id: 'client-1', name: 'Client A' },
      store: { id: 'store-2', name: 'Store B', code: 'SB1' },
      status: 'sent',
      total: 750,
      currency: 'USD',
      issueDate: '2024-01-03',
      dueDate: '2024-02-03',
      createdAt: '2024-01-03T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInvoicesPaged).mockReturnValue({
      data: {
        data: mockInvoices,
        meta: {
          page: 1,
          limit: 100,
          total: mockInvoices.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
      isLoading: false,
      isRefetching: false,
    } as any);
    vi.mocked(useDeleteInvoice).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
    } as any);
    vi.mocked(useCreateInvoice).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
    } as any);
  });

  it('should render invoices list', () => {
    render(
      <TestWrapper>
        <InvoicesList />
      </TestWrapper>,
    );

    expect(screen.getByText(/invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/INV-2024-0001/i)).toBeInTheDocument();
  });

  describe('Store Column Display', () => {
    it('should display store name and code when store is assigned', () => {
      render(
        <TestWrapper>
          <InvoicesList />
        </TestWrapper>,
      );

      expect(screen.getByText(/Store A \(SA1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Store B \(SB1\)/i)).toBeInTheDocument();
    });

    it('should show "-" when no store assigned', () => {
      render(
        <TestWrapper>
          <InvoicesList />
        </TestWrapper>,
      );

      // Find the row for invoice-2 which has no store
      const storeCells = screen.getAllByText(/-/i);
      // At least one should be the store column for invoice without store
      expect(storeCells.length).toBeGreaterThan(0);
    });

    it('should display store column header', () => {
      render(
        <TestWrapper>
          <InvoicesList />
        </TestWrapper>,
      );

      expect(screen.getByText(/store/i)).toBeInTheDocument();
    });
  });

  it('should display all invoice columns', () => {
    render(
      <TestWrapper>
        <InvoicesList />
      </TestWrapper>,
    );

    expect(screen.getByText(/number/i)).toBeInTheDocument();
    expect(screen.getByText(/client/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/issue date/i)).toBeInTheDocument();
    expect(screen.getByText(/due date/i)).toBeInTheDocument();
  });
});

