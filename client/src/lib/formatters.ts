// Number formatting utilities
export function formatNumber(value: number): string {
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

export function formatCurrency(value: number, symbol: string = '$'): string {
  if (value >= 1000000) {
    return symbol + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return symbol + (value / 1000).toFixed(1) + 'K';
  }
  return symbol + value.toFixed(2);
}