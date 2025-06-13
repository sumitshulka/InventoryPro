import { useQuery } from '@tanstack/react-query';

interface OrganizationSettings {
  id: number;
  organizationName: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  defaultUnits: string[];
  allowedCategories: string[];
}

export function useCurrency() {
  const { data: organizationSettings } = useQuery<OrganizationSettings>({
    queryKey: ['/api/organization-settings'],
  });

  const currency = organizationSettings?.currency || 'USD';
  const currencySymbol = organizationSettings?.currencySymbol || '$';

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return currencySymbol + '0.00';
    }
    return currencySymbol + value.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatCurrencyCompact = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return currencySymbol + '0.00';
    }
    if (value >= 1000000) {
      return currencySymbol + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return currencySymbol + (value / 1000).toFixed(1) + 'K';
    }
    return currencySymbol + value.toFixed(2);
  };

  const formatCurrencyFull = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return currencySymbol + '0.00';
    }
    return currencySymbol + value.toFixed(2);
  };

  return {
    currency,
    currencySymbol,
    formatCurrency,
    formatCurrencyCompact,
    formatCurrencyFull,
  };
}