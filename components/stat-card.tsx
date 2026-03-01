import { Type as type, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { THEME } from '@/lib/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variantStyles = {
  default: 'text-primary',
  success: 'text-green-600',
  warning: 'text-amber-600',
  destructive: 'text-red-600',
};

const variantBackgrounds = {
  default: 'bg-primary/5 border-primary/10',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-amber-50 border-amber-200',
  destructive: 'bg-red-50 border-red-200',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className = '',
}: StatCardProps) {
  return (
    <Card className={`${variantBackgrounds[variant]} hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {Icon && <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <div className={`text-xs font-semibold mt-3 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
