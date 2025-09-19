import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  gradient: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  gradient,
  change,
  trend = 'neutral',
  size = 'md',
  className = ''
}: StatCardProps) {
  const sizeClasses = {
    xs: 'p-2 py-3 lg:p-3 lg:py-4',
    sm: 'p-3 lg:p-4 lg:py-5',
    md: 'p-3 lg:p-4 lg:py-6',
    lg: 'p-4 lg:p-5 lg:py-7'
  };

  const textSizes = {
    xs: {
      value: 'text-xs lg:text-sm',
      label: 'text-xs lg:text-xs whitespace-nowrap',
      change: 'text-xs'
    },
    sm: {
      value: 'text-lg lg:text-xl',
      label: 'text-xs lg:text-sm',
      change: 'text-xs'
    },
    md: {
      value: 'text-xl lg:text-2xl',
      label: 'text-xs lg:text-sm',
      change: 'text-xs'
    },
    lg: {
      value: 'text-2xl lg:text-3xl',
      label: 'text-sm lg:text-base',
      change: 'text-xs lg:text-sm'
    }
  };

  const iconSizes = {
    xs: {
      container: 'p-1.5 lg:p-3',
      icon: 'h-3 w-3 lg:h-5 lg:w-5'
    },
    sm: {
      container: 'p-2 lg:p-3',
      icon: 'h-4 w-4 lg:h-5 lg:w-5'
    },
    md: {
      container: 'p-2 lg:p-3',
      icon: 'h-4 w-4 lg:h-5 lg:w-5'
    },
    lg: {
      container: 'p-3 lg:p-4',
      icon: 'h-5 w-5 lg:h-6 lg:w-6'
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 ${sizeClasses[size]} ${size === 'xs' ? 'min-h-[4rem] flex flex-col justify-center' : ''} ${className}`}>
      <div className="flex items-center justify-between h-full">
        <div className={`flex-1 ${size === 'xs' ? 'flex flex-col justify-center' : ''}`}>
          <p className={`font-medium text-slate-600 mb-0 ${textSizes[size].label}`}>
            {label}
          </p>
          <p className={`font-bold text-slate-900 ${textSizes[size].value}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {change && (
            <div className={`flex items-center space-x-1 ${textSizes[size].change} font-medium ${getTrendColor(trend)}`}>
              {trend === 'up' && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
              {trend === 'down' && (
                <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
              <span>{change}</span>
            </div>
          )}
          <div className={`${iconSizes[size].container} rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className={`${iconSizes[size].icon} text-white`} />
          </div>
        </div>
      </div>
    </div>
  );
}