"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/layout/AppHeader";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  Plus,
  UserPlus,
  MessageCircle,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ShiftDetailModal from "@/components/shifts/ShiftDetailModal";

// Import split components and hooks
import { PreviewModal, ExportModal } from "./components";
import { useShiftData, useCalendarState } from "./hooks";
import {
  getMonthDates,
  getStaffShiftsForDate,
  prepareExportData,
  generateCSVData,
  downloadCSV,
  ExportFormat
} from "./utils";

type CalendarViewType = "month" | "week" | "day" | "grid";
type LayoutMode = "standard" | "compact";

export default function CalendarPage() {
  const { currentUser } = useAuth();

  // Use custom hooks for state management
  const {
    shifts,
    staff,
    loading,
    handleSaveShiftSlot,
    handleDeleteShiftSlot,
    createSampleStaffData
  } = useShiftData();

  const {
    selectedDate,
    setSelectedDate,
    calendarView,
    setCalendarView,
    layoutMode,
    showCreateModal,
    createModalDate,
    createModalStaff,
    showExportModal,
    showPreviewModal,
    setShowPreviewModal,
    selectedStaffForCalendar,
    formData,
    createLoading,
    shiftDetailModalOpen,
    selectedShiftSlot,
    chatOpen,
    chatTargetUser,
    chatRelatedShift,
    handleCreateShift,
    closeCreateModal,
    handleExportShift,
    closeExportModal,
    handleShowPreview,
    handleFormChange,
    handleStaffTimeChange,
    handleOpenStaffChat,
    handleCloseChat,
    handleOpenShiftDetail,
    handleCloseShiftDetail,
  } = useCalendarState();

  // Utility functions
  const monthDates = getMonthDates(selectedDate);

  const executeExport = async (format: ExportFormat) => {
    try {
      const exportData = prepareExportData(format, selectedDate, shifts, staff);

      if (format === 'pdf') {
        // PDF export logic would go here
        console.log('PDF export not implemented yet');
      } else {
        const csvData = generateCSVData(exportData);
        const filename = `shift-${format}-${format(selectedDate, "yyyy-MM")}.csv`;
        downloadCSV(csvData, filename);
      }

      closeExportModal();
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={["root", "manager"]}>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">カレンダーを読み込み中...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={["root", "manager"]}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="シフト管理カレンダー" />

        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-4">

            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() - 1)))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold">
                  {format(selectedDate, "yyyy年M月", { locale: ja })}
                </h2>
                <button
                  onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                <button
                  onClick={handleShowPreview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  プレビュー
                </button>
                <button
                  onClick={handleExportShift}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  エクスポート
                </button>
                <button
                  onClick={() => handleCreateShift()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4 mr-2 inline" />
                  シフト作成
                </button>
              </div>
            </div>

            {/* Staff List */}
            {staff.length === 0 && (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  スタッフが登録されていません
                </h3>
                <p className="text-gray-600 mb-4">
                  シフト管理を開始するにはスタッフを追加してください
                </p>
                <button
                  onClick={createSampleStaffData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4 mr-2 inline" />
                  サンプルスタッフを追加
                </button>
              </div>
            )}

            {/* Calendar Grid - Simplified for demo */}
            {staff.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-7 gap-2">
                  {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
                    <div key={day} className="p-2 text-center font-medium text-gray-700 bg-gray-50 rounded">
                      {day}
                    </div>
                  ))}
                  {monthDates.map((date, index) => {
                    const staffShifts = getStaffShiftsForDate(shifts, date);
                    const hasShifts = staffShifts.size > 0;

                    return (
                      <div
                        key={index}
                        className={`
                          p-2 min-h-[100px] border rounded cursor-pointer transition-colors
                          ${hasShifts ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}
                          hover:bg-blue-100
                        `}
                        onClick={() => handleCreateShift(date)}
                      >
                        <div className="text-sm font-medium">
                          {format(date, "d")}
                        </div>
                        <div className="mt-1 space-y-1">
                          {Array.from(staffShifts.entries()).slice(0, 3).map(([staffId, staffMemberShifts]) => {
                            const staffMember = staff.find(s => s.uid === staffId);
                            return (
                              <div key={staffId} className="text-xs bg-blue-200 rounded px-1 py-0.5 truncate">
                                {staffMember?.name}
                              </div>
                            );
                          })}
                          {staffShifts.size > 3 && (
                            <div className="text-xs text-gray-500">
                              +{staffShifts.size - 3}名
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </main>

        {/* Modals */}
        <PreviewModal
          showModal={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          selectedDate={selectedDate}
          staff={staff}
          shifts={shifts}
          monthDates={monthDates}
          getStaffShiftsForDate={(date) => getStaffShiftsForDate(shifts, date)}
        />

        <ExportModal
          showModal={showExportModal}
          onClose={closeExportModal}
          onExport={executeExport}
        />

        {/* Chat Sidebar */}
        <ChatSidebar
          isOpen={chatOpen}
          onClose={handleCloseChat}
          targetUser={chatTargetUser}
          relatedShiftId={chatRelatedShift}
        />

        {/* Shift Detail Modal */}
        {shiftDetailModalOpen && selectedShiftSlot && (
          <ShiftDetailModal
            isOpen={shiftDetailModalOpen}
            onClose={handleCloseShiftDetail}
            shift={selectedShiftSlot.shift}
            slot={selectedShiftSlot.slot}
            date={selectedShiftSlot.date}
            onSave={handleSaveShiftSlot}
            onDelete={handleDeleteShiftSlot}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}