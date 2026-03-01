// POS System Theme Configuration
// Consistent design tokens and styling across all components

export const THEME = {
  colors: {
    // Primary Colors - Business/Professional Blue
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    // Success - Green
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    // Warning - Amber
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    // Danger - Red
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
    // Neutral - Slate
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  typography: {
    // Headings
    h1: 'text-4xl font-bold tracking-tight',
    h2: 'text-3xl font-bold tracking-tight',
    h3: 'text-2xl font-bold tracking-tight',
    h4: 'text-xl font-semibold',
    // Body
    body: 'text-base font-normal',
    bodySmall: 'text-sm font-normal',
    bodyXSmall: 'text-xs font-normal',
    // Labels
    label: 'text-sm font-semibold',
    caption: 'text-xs font-medium',
  },
  components: {
    card: {
      base: 'bg-card text-card-foreground border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow',
      header: 'px-6 py-4 border-b border-border',
      content: 'px-6 py-4',
      footer: 'px-6 py-4 border-t border-border bg-muted',
    },
    button: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-colors',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg font-medium transition-colors',
      outline: 'border border-border bg-transparent hover:bg-muted px-4 py-2 rounded-lg font-medium transition-colors',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-lg font-medium transition-colors',
    },
    input: {
      base: 'w-full px-3 py-2 border border-input bg-background rounded-md placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50',
    },
    badge: {
      primary: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary',
      success: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success-700',
      warning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning-700',
      danger: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger-700',
    },
  },
  layout: {
    // Container widths
    containerSm: 'max-w-sm',
    containerMd: 'max-w-md',
    containerLg: 'max-w-lg',
    containerXl: 'max-w-xl',
    container2xl: 'max-w-2xl',
    // Grid gaps
    gapXs: 'gap-1',
    gapSm: 'gap-2',
    gapMd: 'gap-4',
    gapLg: 'gap-6',
    gapXl: 'gap-8',
  },
} as const;

// Utility functions for theme usage
export const getThemeClass = (category: keyof typeof THEME.components, variant: string) => {
  const component = THEME.components[category];
  return (component as any)[variant] || '';
};

export const getColorClass = (color: string, shade: number) => {
  const colors = THEME.colors as any;
  return colors[color]?.[shade] || colors[color]?.[500] || '#000000';
};
