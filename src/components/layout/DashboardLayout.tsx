'use client';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {

  return (
    <div className="fixed inset-0 top-16 bg-gray-100 overflow-hidden">
      <main className="h-full p-4 lg:p-6 overflow-hidden">
        {children}
      </main>
    </div>
  );
}