import {
  readInvoiceListFilters,
  readInvoicePageParams,
} from './invoice-list-query.util';

describe('invoice list query reading', () => {
  it('keeps known single-valued filters exactly as sent', () => {
    expect(
      readInvoiceListFilters({
        status: 'paid',
        search: 'acme',
        issueDateFrom: '2026-01-01',
        totalMin: '10.5',
      }),
    ).toEqual({
      status: 'paid',
      search: 'acme',
      issueDateFrom: '2026-01-01',
      totalMin: '10.5',
    });
  });

  it('ignores unknown keys and repeated or bracketed parameters', () => {
    expect(
      readInvoiceListFilters({
        clientId: 'c-1',
        status: ['paid', 'sent'],
        type: { $ne: 'x' },
        search: '',
      }),
    ).toEqual({ search: '' });
  });

  it('adds page and limit only for the paged endpoint', () => {
    const query = { page: '2', limit: '50', status: 'draft' };
    expect(readInvoiceListFilters(query)).toEqual({ status: 'draft' });
    expect(readInvoicePageParams(query)).toEqual({
      page: '2',
      limit: '50',
      status: 'draft',
    });
  });
});
