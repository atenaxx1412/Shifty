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
  size?: 'sm' | 'md' | 'lg';
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
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const textSizes = {
    sm: {
      value: 'text-2xl',
      label: 'text-xs',
      change: 'text-xs'
    },
    md: {
      value: 'text-3xl',
      label: 'text-sm',
      change: 'text-xs'
    },
    lg: {
      value: 'text-4xl',
      label: 'text-base',
      change: 'text-sm'
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
    <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 ${sizeClasses[size]} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`font-medium text-slate-600 mb-1 ${textSizes[size].label}`}>
            {label}
          </p>
          <p className={`font-bold text-slate-900 ${textSizes[size].value}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
          </p>
          {change && (
            <div className={`flex items-center space-x-1 mt-2 ${textSizes[size].change} font-medium ${getTrendColor(trend)}`}>
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
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}