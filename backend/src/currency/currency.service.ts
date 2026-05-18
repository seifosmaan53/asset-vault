import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: Date;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl = 'https://api.exchangerate-api.com/v4';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY') || null;
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(from: string, to: string, date?: Date): Promise<number> {
    if (from === to) return 1;

    try {
      // Use free exchangerate-api.com (no API key required)
      const dateStr = date ? date.toISOString().split('T')[0] : 'latest';
      const url = `${this.baseUrl}/${dateStr}/${from}`;

      const response = await axios.get(url);
      const rates = response.data.rates;

      if (!rates || !rates[to]) {
        this.logger.warn(`Exchange rate not found for ${from} to ${to}`);
        return 1; // Fallback to 1:1 if rate not found
      }

      return rates[to];
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate: ${error}`);
      return 1; // Fallback to 1:1 on error
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertAmount(
    amount: number,
    from: string,
    to: string,
    date?: Date,
  ): Promise<number> {
    if (from === to) return amount;

    const rate = await this.getExchangeRate(from, to, date);
    return amount * rate;
  }

  /**
   * Get multiple exchange rates at once
   */
  async getExchangeRates(baseCurrency: string, targetCurrencies: string[]): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};

    for (const currency of targetCurrencies) {
      if (currency !== baseCurrency) {
        rates[currency] = await this.getExchangeRate(baseCurrency, currency);
      } else {
        rates[currency] = 1;
      }
    }

    return rates;
  }

  /**
   * Get list of supported currencies
   */
  getSupportedCurrencies(): string[] {
    return [
      'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'NZD',
      'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'MXN', 'BRL', 'ZAR', 'KRW',
      'TRY', 'RUB', 'AED', 'SAR', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'ILS',
    ];
  }
}
