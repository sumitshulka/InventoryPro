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

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return currencySymbol + (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return currencySymbol + (value / 1000).toFixed(1) + 'K';
    }
    return currencySymbol + value.toFixed(2);
  };

  const formatCurrencyFull = (value: number): string => {
    return currencySymbol + value.toFixed(2);
  };

  return {
    currency,
    currencySymbol,
    formatCurrency,
    formatCurrencyFull,
  };
}