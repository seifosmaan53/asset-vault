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
      reservedStock: 10,
      defaultUnitPrice: 50,
    },
    {
      id: '2',
      name: 'Product B',
      sku: 'SKU-002',
      currentStock: 50,
      reservedStock: 5,
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
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText(/Stock: 90/i)).toBeInTheDocument(); // 100 - 10
      expect(screen.getByText(/Stock: 45/i)).toBeInTheDocument(); // 50 - 5
    });
  });

  it('should call onChange when item is selected', async () => {
    vi.mocked(useInventory).mockReturnValue({
      data: mockItems,
      isLoading: false,
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
    } as any);

    render(
      <TestWrapper>
        <InventorySelect value={null} onChange={mockOnChange} />
      </TestWrapper>,
    );

    const input = screen.getByLabelText(/select product/i);
    await userEvent.type(input, 'Product A');

    // The search should trigger useInventory with the search parameter
    await waitFor(() => {
      expect(useInventory).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Product A' }),
      );
    });
  });
});

