// Centralized currency utilities to ensure consistent formatting across the application
export const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€", 
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  CNY: "¥",
  INR: "₹"
} as const;

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode as keyof typeof CURRENCY_SYMBOLS] || "$";
}

export function formatCurrencyValue(value: number, currencySymbol: string): string {
  if (value >= 1000000) {
    return currencySymbol + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return currencySymbol + (value / 1000).toFixed(1) + 'K';
  }
  return currencySymbol + value.toFixed(2);
}

export function formatCurrencyFull(value: number, currencySymbol: string): string {
  return currencySymbol + value.toFixed(2);
}