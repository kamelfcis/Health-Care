const COUNTRY_LOCALE: Record<string, string> = {
  EG: "ar-EG",
  SA: "ar-SA",
  AE: "ar-AE",
  US: "en-US",
  GB: "en-GB",
  DE: "de-DE",
  FR: "fr-FR"
};

export function localeForCountry(countryCode?: string | null): string | undefined {
  if (!countryCode?.trim()) return undefined;
  return COUNTRY_LOCALE[countryCode.trim().toUpperCase()];
}

export const formatCurrency = (
  amount: number,
  currencyCode = "USD",
  countryCode?: string | null
) => {
  const currency = currencyCode.toUpperCase();
  const locale = localeForCountry(countryCode);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};
