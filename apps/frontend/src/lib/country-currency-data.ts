import countries from "world-countries";

export interface CountryCurrencyOption {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string;
  flag: string;
}

const options = countries
  .flatMap((country) => {
    const countryCode = country.cca2?.toUpperCase();
    const countryName = country.name?.common?.trim();
    const flag = country.flag || "";
    const currencies = country.currencies ? Object.entries(country.currencies) : [];
    if (!countryCode || !countryName || !currencies.length) {
      return [];
    }

    return currencies
      .filter(([currencyCode]) => Boolean(currencyCode))
      .map(([currencyCode, currency]) => ({
        countryCode,
        countryName,
        currencyCode: currencyCode.toUpperCase(),
        currencyName: currency?.name?.trim() || currencyCode.toUpperCase(),
        flag
      }));
  })
  .sort((a, b) => a.countryName.localeCompare(b.countryName));

const uniqueByCountryCurrency = new Map<string, CountryCurrencyOption>();
for (const option of options) {
  uniqueByCountryCurrency.set(`${option.countryCode}-${option.currencyCode}`, option);
}

export const COUNTRY_CURRENCY_OPTIONS = Array.from(uniqueByCountryCurrency.values());

const uniqueCurrencies = new Map<string, { currencyCode: string; currencyName: string }>();
for (const option of COUNTRY_CURRENCY_OPTIONS) {
  if (!uniqueCurrencies.has(option.currencyCode)) {
    uniqueCurrencies.set(option.currencyCode, {
      currencyCode: option.currencyCode,
      currencyName: option.currencyName
    });
  }
}

export const CURRENCY_OPTIONS = Array.from(uniqueCurrencies.values()).sort((a, b) =>
  a.currencyCode.localeCompare(b.currencyCode)
);

const countryMap = new Map<string, CountryCurrencyOption>();
for (const option of COUNTRY_CURRENCY_OPTIONS) {
  if (!countryMap.has(option.countryCode)) {
    countryMap.set(option.countryCode, option);
  }
}

export const COUNTRY_OPTIONS = Array.from(countryMap.values()).sort((a, b) =>
  a.countryName.localeCompare(b.countryName)
);
