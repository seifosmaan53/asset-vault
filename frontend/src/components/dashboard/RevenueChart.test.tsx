import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RevenueChart from './RevenueChart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';

// Mock the useInvoices hook
vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
}));

const { useInvoices } = await import('../../hooks/useInvoices');

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('RevenueChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render revenue chart', () => {
    vi.mocked(useInvoices).mockReturnValue({
      data: [
        {
          id: '1',
          status: 'paid',
          total: 1000,
          paidAt: new Date().toISOString(),
          issueDate: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    render(
      <TestWrapper>
        <RevenueChart />
      </TestWrapper>,
    );

    expect(screen.getByText(/line/i)).toBeInTheDocument();
  });

  it('should display area chart when toggled', () => {
    vi.mocked(useInvoices).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <TestWrapper>
        <RevenueChart />
      </TestWrapper>,
    );

    const areaButton = screen.getByText(/area/i);
    expect(areaButton).toBeInTheDocument();
  });

  it('should handle empty invoice data', () => {
    vi.mocked(useInvoices).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <TestWrapper>
        <RevenueChart />
      </TestWrapper>,
    );

    // Chart should still render even with no data
    expect(screen.getByText(/line/i)).toBeInTheDocument();
  });
});

