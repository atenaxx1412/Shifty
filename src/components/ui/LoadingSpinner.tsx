import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  color?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  text = '読み込み中...',
  className = '',
  color = 'text-blue-600',
  fullScreen = false
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50'
    : 'flex items-center justify-center';

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="text-center">
        <Loader className={`${sizeClasses[size]} animate-spin ${color} mx-auto mb-4`} />
        <p className={`text-gray-600 ${textSizes[size]}`}>{text}</p>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ isLoading, text, children }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
          <LoadingSpinner text={text} />
        </div>
      )}
    </div>
  );
}