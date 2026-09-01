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

  it('offers the area/line toggle once there is revenue to chart', () => {
    /* This passed `data: []` and then looked for the Area toggle. With no revenue the
       component deliberately renders an empty state instead of an empty chart, so the
       toggle genuinely is not there — the test was asserting against its own setup.
       Give it revenue, which is the situation the toggle exists for. */
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

    expect(screen.getByRole('button', { name: /area/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /line/i })).toBeInTheDocument();
  });

  it('shows an empty state rather than an empty chart when there is no revenue', () => {
    /* This expected the Line toggle with no data. Rendering an axis-only chart for
       nothing is worse than saying so plainly, and the component now says so. */
    vi.mocked(useInvoices).mockReturnValue({ data: [], isLoading: false } as any);

    render(
      <TestWrapper>
        <RevenueChart />
      </TestWrapper>,
    );

    expect(screen.getByText(/no revenue data available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /area/i })).not.toBeInTheDocument();
  });
});

