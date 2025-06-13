// Number formatting utilities
export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatNumberCompact(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

export function formatCapacity(value: number): string {
  return formatNumber(value);
}

// Note: This function is deprecated. Use useCurrency hook instead for consistent currency formatting
export function formatCurrency(value: number | null | undefined, symbol: string = '₹'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return symbol + '0.00';
  }
  
  if (value >= 1000000) {
    return symbol + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return symbol + (value / 1000).toFixed(1) + 'K';
  }
  return symbol + value.toFixed(2);
}