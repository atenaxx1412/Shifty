'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, X, Info } from 'lucide-react';

interface CustomAlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  type,
  title,
  message,
  onClose,
  autoClose = true,
  duration = 4000
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setIsVisible(true);

    if (autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoClose, duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Animation duration
  };

  const getAlertConfig = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          icon: CheckCircle,
        };
      case 'error':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          icon: AlertCircle,
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          icon: AlertTriangle,
        };
      case 'info':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          icon: Info,
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          icon: Info,
        };
    }
  };

  const config = getAlertConfig();
  const IconComponent = config.icon;

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transform transition-all duration-300 ease-in-out ${
        isVisible 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
      }`}
    >
      <div
        className={`
          ${config.bgColor} ${config.borderColor} ${config.textColor}
          max-w-sm w-full border border-opacity-50 rounded-xl shadow-lg backdrop-blur-sm
          p-4 flex items-start space-x-3
        `}
      >
        <div className="flex-shrink-0">
          <IconComponent className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {message && (
            <p className="text-xs mt-1 opacity-80">{message}</p>
          )}
        </div>

        <button
          onClick={handleClose}
          className={`
            flex-shrink-0 ml-2 rounded-lg p-1 hover:bg-black hover:bg-opacity-10 
            transition-colors duration-200 ${config.iconColor}
          `}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CustomAlert;