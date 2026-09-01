import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvoicesList from './InvoicesList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '../../theme';
import { ToastProvider } from '../../contexts/ToastContext';

// Mock hooks
/* The page gained useUpdateInvoice; a factory mock must declare every export the module
   under test imports, or Vitest throws before a single test runs. */
vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
  useInvoicesPaged: vi.fn(),
  useDeleteInvoice: vi.fn(),
  useCreateInvoice: vi.fn(),
  useUpdateInvoice: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}) })),
}));

vi.mock('../../contexts/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Import hooks at module level (not top-level await)
import { useInvoicesPaged, useDeleteInvoice, useCreateInvoice } from '../../hooks/useInvoices';
import { UndoProvider } from '../../contexts/UndoContext';
import { SearchProvider } from '../../contexts/SearchContext';

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
          {/* The page gained useUndo (undoable delete), which throws outside its
              provider. Wrapping with the real UndoProvider rather than stubbing the
              hook keeps the tree the same shape as production. */}
          <SearchProvider>
              <UndoProvider>
            <BrowserRouter>{children}</BrowserRouter>
          </UndoProvider>
            </SearchProvider>
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
      /* The component calls refetch() from an effect when filters change, so a mock
         without it throws "refetch is not a function" before anything renders — which
         is why every test in this file failed identically. */
      refetch: vi.fn().mockResolvedValue({}),
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

    // The page now also renders a "3 invoices" count line, so a bare text match is
    // ambiguous. Target the heading itself — that is what this test means.
    expect(screen.getByRole('heading', { name: /^invoices$/i })).toBeInTheDocument();
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

      /* The test is about the COLUMN HEADER, but /store/i also matches the store
         names in the rows, so a bare text query is ambiguous. Ask for the header. */
      expect(screen.getByRole('columnheader', { name: /store/i })).toBeInTheDocument();
    });
  });

  it('should display all invoice columns', () => {
    render(
      <TestWrapper>
        <InvoicesList />
      </TestWrapper>,
    );

    /* These are COLUMN HEADERS, but each word also appears in the rows beneath them
       (client names, statuses, totals), so bare text queries became ambiguous the
       moment the table had data in it. The columnheader role says what the test
       actually means and stops matching the cells. */
    for (const header of [/number/i, /client/i, /status/i, /total/i, /issue date/i, /due date/i]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });
});

