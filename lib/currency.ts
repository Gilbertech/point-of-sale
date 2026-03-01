// KSH (Kenyan Shilling) Currency Formatter

export const CURRENCY = {
  CODE: 'KSH',
  SYMBOL: 'KSh',
  NAME: 'Kenyan Shilling',
  DECIMAL_PLACES: 2,
};

/**
 * Format number as KSH currency
 * @param value - Number to format
 * @returns Formatted currency string (e.g., "KSh 1,234.50")
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: CURRENCY.CODE,
    minimumFractionDigits: CURRENCY.DECIMAL_PLACES,
    maximumFractionDigits: CURRENCY.DECIMAL_PLACES,
  }).format(value);
};

/**
 * Format number as KSH with symbol (e.g., "KSh 1,234.50")
 * @param value - Number to format
 * @returns Formatted currency string
 */
export const formatKSH = (value: number): string => {
  return formatCurrency(value);
};

/**
 * Format number as KSH short format (e.g., "KSh1,234.50")
 * @param value - Number to format
 * @returns Formatted currency string without space
 */
export const formatKSHShort = (value: number): string => {
  const formatted = formatCurrency(value);
  return formatted.replace('KSh ', 'KSh');
};

/**
 * Format number as KSH with no decimals (e.g., "KSh 1,235")
 * @param value - Number to format
 * @returns Formatted currency string
 */
export const formatKSHNoDecimals = (value: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: CURRENCY.CODE,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Format chart tooltip value in KSH
 * @param value - Number to format
 * @returns Formatted currency string
 */
export const formatChartValue = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'KSh 0.00';
  return formatCurrency(numValue);
};

/**
 * Parse KSH string to number
 * @param value - Currency string (e.g., "KSh 1,234.50")
 * @returns Number value
 */
export const parseKSH = (value: string): number => {
  return parseFloat(value.replace(/[^0-9.-]+/g, ''));
};

/**
 * Get currency symbol
 * @returns KSH symbol
 */
export const getCurrencySymbol = (): string => {
  return CURRENCY.SYMBOL;
};

/**
 * Get currency code
 * @returns KSH code
 */
export const getCurrencyCode = (): string => {
  return CURRENCY.CODE;
};

/**
 * Format table cell value
 * @param value - Number to format
 * @returns Formatted currency string
 */
export const formatTableCurrency = (value: number): string => {
  return formatCurrency(value);
};
