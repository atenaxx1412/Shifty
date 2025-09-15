'use client';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}