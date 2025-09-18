import React from 'react';
import { LucideIcon } from 'lucide-react';

interface GradientHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  gradient?: string;
  iconBackground?: string;
  textColor?: string;
  actions?: React.ReactNode;
  status?: {
    label: string;
    color: string;
    icon?: LucideIcon;
  };
  className?: string;
}

export default function GradientHeader({
  title,
  subtitle,
  icon: Icon,
  gradient = 'from-slate-800 to-slate-900',
  iconBackground = 'from-teal-500 to-cyan-600',
  textColor = 'text-white',
  actions,
  status,
  className = ''
}: GradientHeaderProps) {
  return (
    <div className={`bg-gradient-to-r ${gradient} rounded-2xl shadow-xl p-8 ${textColor} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 bg-gradient-to-br ${iconBackground} rounded-2xl shadow-lg`}>
            <Icon className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className={`mt-2 text-lg ${textColor === 'text-white' ? 'text-slate-300' : 'text-gray-600'}`}>
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {status && (
            <div className={`px-4 py-2 rounded-xl border shadow-sm ${status.color}`}>
              <div className="flex items-center space-x-2">
                {status.icon && <status.icon className="h-5 w-5" />}
                <span className="font-bold">{status.label}</span>
              </div>
            </div>
          )}
          {actions && (
            <div className="flex items-center space-x-3">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SimpleHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function SimpleHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = ''
}: SimpleHeaderProps) {
  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg">
            <Icon className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{title}</h1>
            {subtitle && (
              <p className="text-slate-600 mt-2 text-lg">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}