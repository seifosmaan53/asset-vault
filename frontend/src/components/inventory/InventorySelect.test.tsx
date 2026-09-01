import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventorySelect from './InventorySelect';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';

// Mock the useInventory hook
vi.mock('../../hooks/useInventory', () => ({
  useInventory: vi.fn(),
}));

const { useInventory } = await import('../../hooks/useInventory');

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe('InventorySelect', () => {
  const mockItems = [
    {
      id: '1',
      name: 'Product A',
      sku: 'SKU-001',
      currentStock: 100,
      defaultUnitPrice: 50,
    },
    {
      id: '2',
      name: 'Product B',
      sku: 'SKU-002',
      currentStock: 50,
      defaultUnitPrice: 75,
    },
  ];

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input', () => {
    vi.mocked(useInventory).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    expect(screen.getByLabelText(/select product/i)).toBeInTheDocument();
  });

  it('should display inventory items when loaded', async () => {
    vi.mocked(useInventory).mockReturnValue({
      data: mockItems,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText(/Product A/i)).toBeInTheDocument();
      expect(screen.getByText(/Product B/i)).toBeInTheDocument();
    });
  });

  it('should show stock availability in options', async () => {
    vi.mocked(useInventory).mockReturnValue({
      data: mockItems,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    await userEvent.click(input);

    await waitFor(() => {
      /* Was "Stock: 90" — 100 global minus 10 reserved. Stock reservation was removed
         from the service entirely, so the option now shows the global figure. */
      expect(screen.getByText(/Stock: 100/i)).toBeInTheDocument();
      expect(screen.getByText(/Stock: 50/i)).toBeInTheDocument();
    });
  });

  it('should call onChange when item is selected', async () => {
    vi.mocked(useInventory).mockReturnValue({
      data: mockItems,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText(/Product A/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/Product A/i));

    expect(mockOnChange).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should show loading state', () => {
    vi.mocked(useInventory).mockReturnValue({
      data: [],
      isLoading: true,
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    expect(input).toBeInTheDocument();
  });

  it('should filter items based on search', async () => {
    vi.mocked(useInventory).mockReturnValue({
      data: mockItems,
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    /* The component deliberately does NOT search on every keystroke — see "only
       update searchQuery when user types and presses Enter" in the source, which is
       what stops a request per character. Typing alone never reaches the hook, so
       this asserted an interaction the component does not have. Press Enter, the
       way a user actually submits the search. */
    await userEvent.type(input, 'Product A{Enter}');

    // The search should trigger useInventory with the search parameter
    await waitFor(() => {
      expect(useInventory).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Product A' }),
      );
    });
  });
});

