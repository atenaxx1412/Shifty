'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomAlert from '@/components/ui/CustomAlert';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  autoClose?: boolean;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const showNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      id,
      autoClose: true,
      duration: 4000,
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);
  };

  const showSuccess = (title: string, message?: string) => {
    showNotification({ type: 'success', title, message });
  };

  const showError = (title: string, message?: string) => {
    showNotification({ type: 'error', title, message });
  };

  const showWarning = (title: string, message?: string) => {
    showNotification({ type: 'warning', title, message });
  };

  const showInfo = (title: string, message?: string) => {
    showNotification({ type: 'info', title, message });
  };

  const contextValue: NotificationContextType = {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Render notifications */}
      <div className="fixed top-0 right-0 z-[9999] pointer-events-none">
        <div className="flex flex-col space-y-2 p-4 pointer-events-auto">
          {notifications.map((notification, index) => (
            <div
              key={notification.id}
              style={{
                transform: `translateY(${index * 10}px)`,
                zIndex: 9999 - index,
              }}
            >
              <CustomAlert
                type={notification.type}
                title={notification.title}
                message={notification.message}
                onClose={() => removeNotification(notification.id)}
                autoClose={notification.autoClose}
                duration={notification.duration}
              />
            </div>
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};