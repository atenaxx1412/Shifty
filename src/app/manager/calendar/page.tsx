'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/layout/AppHeader";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { format, startOfMonth, endOfMonth, getDaysInMonth, addDays, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { shiftService } from "@/lib/shiftService";
import { ShiftExtended, User, ShiftSlot } from "@/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import SimpleChatSidebar from "@/components/chat/SimpleChatSidebar";
import ShiftDetailModal from "@/components/shifts/ShiftDetailModal";
import { excelService } from "@/lib/excelService";
import { userService } from "@/lib/userService";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  StaffingTemplateService,
  StaffingTemplate,
} from "@/lib/staffingTemplateService";
import { ManagerDataService } from "@/lib/managerDataService";

// 新しく作成したコンポーネントをインポート
import {
  ShiftCreateModal,
  CalendarGrid,
  MonthStats,
  CalendarNavigation,
  ExportModal,
  PreviewModal,
} from "./components";

// カレンダー表示形式の型定義
type CalendarViewType = "day" | "week" | "halfMonth" | "month";
type LayoutMode = "grid" | "traditional";

export default function ManagerCalendarPage() {
  const { currentUser } = useAuth();

  // フォールバック用のマネージャー情報（ログインしていない場合）
  const fallbackManager = {
    uid: "test-manager-001",
    email: "manager@shifty.com",
    name: "マネージャー",
    role: "manager" as const,
  };

  const managerUser = currentUser || fallbackManager;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState<CalendarViewType>("month");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [chatRelatedShift, setChatRelatedShift] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);
  const [createModalStaff, setCreateModalStaff] = useState<User | null>(null);
  const [selectedStaffForCalendar, setSelectedStaffForCalendar] = useState<string[]>([]);
  const [staffTimeSettings, setStaffTimeSettings] = useState<{
    [staffId: string]: {
      startTime: string;
      endTime: string;
      positions: string;
      notes: string;
    };
  }>({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [formData, setFormData] = useState({
    startTime: "09:00",
    endTime: "17:00",
    positions: "",
    notes: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftExtended | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [templates, setTemplates] = useState<StaffingTemplate[]>([]);

  // データ取得とリアルタイム購読
  useEffect(() => {
    console.log("👥 Setting up staff data subscription for manager:", managerUser.uid);

    let unsubscribeStaff: (() => void) | null = null;

    const initializeData = async () => {
      try {
        setLoading(true);

        // リアルタイムスタッフデータ取得（店長のスタッフ）
        unsubscribeStaff = userService.subscribeToStaffUpdates(
          managerUser.uid, // managerIdを使用
          (staffData) => {
            console.log(`📊 Received ${staffData.length} staff members from Firestore`);
            setStaff(staffData);
            setLoading(false);
          }
        );

        // その他のデータを並行取得
        const [shiftsData, templatesData] = await Promise.all([
          shiftService.getShiftsByShop(managerUser.uid),
          StaffingTemplateService.getManagerTemplates(managerUser.uid),
        ]);

        setShifts(shiftsData);
        setTemplates(templatesData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    initializeData();

    // クリーンアップ関数
    return () => {
      if (unsubscribeStaff) {
        console.log("🧹 Cleaning up staff subscription");
        unsubscribeStaff();
      }
    };
  }, [managerUser.uid]);

  // 自動リフレッシュ (シフトデータのみ - スタッフデータはリアルタイム購読)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const shiftsData = await shiftService.getShiftsByShop(managerUser.uid);
        setShifts(shiftsData);
      } catch (error) {
        console.error("Error during auto-refresh:", error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [managerUser.uid]);

  // 日付変更ハンドラー
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  // 表示形式変更ハンドラー
  const handleViewChange = (view: CalendarViewType, layout: LayoutMode) => {
    setCalendarView(view);
    setLayoutMode(layout);
  };

  // 月間日付の計算
  const getMonthDates = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const daysInMonth = getDaysInMonth(selectedDate);
    return Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));
  };

  // 指定日のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter((shift) => shift.date && isSameDay(new Date(shift.date), date));
  };

  // 指定日のスタッフ別シフト情報を取得
  const getStaffShiftsForDate = (date: Date) => {
    const dayShifts = getShiftsForDate(date);
    const staffShifts = new Map<
      string,
      Array<{
        shift: ShiftExtended;
        slot: ShiftSlot;
      }>
    >();

    // スタッフごとのシフトをグループ化
    staff.forEach((s) => {
      staffShifts.set(s.uid, []);
    });

    dayShifts.forEach((shift) => {
      if (shift.slots && shift.slots.length > 0) {
        shift.slots.forEach((slot) => {
          if (slot.assignedStaff && slot.assignedStaff.length > 0) {
            slot.assignedStaff.forEach((staffId: string) => {
              const existing = staffShifts.get(staffId) || [];
              existing.push({ shift, slot });
              staffShifts.set(staffId, existing);
            });
          }
        });
      }
    });

    return staffShifts;
  };

  // 日付統計の計算
  const getDayStats = (date: Date) => {
    const dayShifts = shifts.filter(shift =>
      shift.date && new Date(shift.date).toDateString() === date.toDateString()
    );

    const totalSlots = dayShifts.length;
    const totalAssignedStaff = dayShifts.filter(shift => shift.assignedUserId).length;
    const totalRequiredStaff = dayShifts.length;

    // テンプレートベースの統計計算
    const dayOfWeek = date.getDay();
    const template = templates.find(t => t.dayOfWeek === dayOfWeek);

    const templateRequiredStaff = template ?
      template.morningStaff + template.afternoonStaff + template.eveningStaff : 0;

    const templateShortage = templateRequiredStaff > 0 ?
      Math.max(0, templateRequiredStaff - totalAssignedStaff) : 0;

    const shortage = Math.max(0, totalRequiredStaff - totalAssignedStaff);

    return {
      totalRequiredStaff,
      totalAssignedStaff,
      totalSlots,
      templateRequiredStaff,
      templateShortage,
      shortage,
      hasTemplateData: templateRequiredStaff > 0,
      isCriticalShortage: templateShortage >= 3 || shortage >= 3,
      isWarningShortage: templateShortage >= 1 || shortage >= 1,
      templateShortageByTimeSlot: {
        morning: template ? Math.max(0, template.morningStaff -
          dayShifts.filter(s => s.startTime && s.startTime < "12:00").length) : 0,
        afternoon: template ? Math.max(0, template.afternoonStaff -
          dayShifts.filter(s => s.startTime && s.startTime >= "12:00" && s.startTime < "18:00").length) : 0,
        evening: template ? Math.max(0, template.eveningStaff -
          dayShifts.filter(s => s.startTime && s.startTime >= "18:00").length) : 0,
      },
    };
  };

  // シフト作成関連ハンドラー
  const handleCreateShift = (date: Date, staffMember?: User) => {
    setCreateModalDate(date);
    setCreateModalStaff(staffMember || null);
    setShowCreateModal(true);
    if (staffMember) {
      setSelectedStaffForCalendar([staffMember.uid]);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateModalDate(null);
    setCreateModalStaff(null);
    setSelectedStaffForCalendar([]);
    setStaffTimeSettings({});
    setFormData({
      startTime: "09:00",
      endTime: "17:00",
      positions: "",
      notes: "",
    });
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStaffTimeChange = (staffId: string, field: string, value: string) => {
    setStaffTimeSettings(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: value,
      },
    }));
  };

  const handleSubmitShift = async () => {
    if (!createModalDate) return;

    try {
      setCreateLoading(true);

      if (createModalStaff) {
        // 単一スタッフのシフト作成
        const shiftData = {
          date: createModalDate.toISOString().split("T")[0],
          startTime: formData.startTime,
          endTime: formData.endTime,
          positions: formData.positions.split(",").map(p => p.trim()).filter(p => p),
          notes: formData.notes,
          assignedUserId: createModalStaff.uid,
          managerUid: managerUser.uid,
          status: "confirmed" as const,
        };

        await shiftService.createShift(shiftData);
      } else {
        // 複数スタッフのシフト作成
        const promises = selectedStaffForCalendar.map(async (staffId) => {
          const staffSetting = staffTimeSettings[staffId] || formData;
          const shiftData = {
            date: createModalDate.toISOString().split("T")[0],
            startTime: staffSetting.startTime,
            endTime: staffSetting.endTime,
            positions: staffSetting.positions.split(",").map(p => p.trim()).filter(p => p),
            notes: staffSetting.notes,
            assignedUserId: staffId,
            managerUid: managerUser.uid,
            status: "confirmed" as const,
          };

          return shiftService.createShift(shiftData);
        });

        await Promise.all(promises);
      }

      // データを再取得
      const newShifts = await shiftService.getShiftsByShop(managerUser.uid);
      setShifts(newShifts);

      handleCloseCreateModal();
    } catch (error) {
      console.error("Error creating shift:", error);
    } finally {
      setCreateLoading(false);
    }
  };

  // シフト詳細モーダル
  const handleShiftClick = (shift: ShiftExtended) => {
    setSelectedShift(shift);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setSelectedShift(null);
    setShowDetailModal(false);
  };

  // チャット関連ハンドラー
  const handleChatWithStaff = (staffMember: User, shiftId?: string) => {
    setChatTargetUser({
      id: staffMember.uid,
      name: staffMember.name,
    });
    setChatRelatedShift(shiftId || null);
    setChatOpen(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setChatTargetUser(null);
    setChatRelatedShift(null);
  };

  // 出力・プレビュー機能
  const handleExportShift = () => {
    setShowExportModal(true);
  };

  const handleShowExport = handleExportShift; // 互換性のためのエイリアス

  const handleCloseExport = () => {
    setShowExportModal(false);
  };

  const handleShowPreview = () => {
    setShowPreviewModal(true);
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
  };

  const handleExport = async (layout: 'daily' | 'weekly' | 'monthly', format: 'excel' | 'pdf') => {
    try {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      const monthShifts = shifts.filter(shift => {
        if (!shift.date) return false;
        const shiftDate = new Date(shift.date);
        return shiftDate >= monthStart && shiftDate <= monthEnd;
      });

      if (format === 'pdf') {
        // PDF出力 - 期間に応じて向きを自動設定
        if (layout === 'daily' || layout === 'weekly') {
          // 日ごと・週ごと → 横向き
          await excelService.exportWeeklySchedulePDF(monthShifts, staff, selectedDate);
        } else {
          // 月ごと → 縦向き
          await excelService.exportMonthlySchedulePDF(monthShifts, staff, selectedDate);
        }
      } else {
        // Excel出力 - ExcelJSメソッドを使用
        if (layout === 'daily' || layout === 'weekly') {
          await excelService.exportWeeklyScheduleExcelJS(monthShifts, staff, selectedDate);
        } else {
          await excelService.exportMonthlyScheduleExcelJS(monthShifts, staff, selectedDate);
        }
      }

      handleCloseExport();
    } catch (error) {
      console.error("Error exporting:", error);
    }
  };

  // エクスポート機能
  const handleExportExcel = async () => {
    try {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      const monthShifts = shifts.filter(shift => {
        if (!shift.date) return false;
        const shiftDate = new Date(shift.date);
        return shiftDate >= monthStart && shiftDate <= monthEnd;
      });

      await excelService.exportMonthlyScheduleExcelJS(monthShifts, staff, selectedDate);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const monthDates = getMonthDates();

      const monthShifts = shifts.filter(shift => {
        if (!shift.date) return false;
        const shiftDate = new Date(shift.date);
        return shiftDate >= monthStart && shiftDate <= monthEnd;
      });

      // PDFを作成（A4横向き）
      const doc = new jsPDF('l', 'mm', 'a4');

      // ファイル名
      const fileName = `シフト表_${format(selectedDate, "yyyy年M月", { locale: ja })}.pdf`;

      // タイトル（横向きA4の中央: 297mm / 2 = 148.5mm）
      doc.setFontSize(16);
      doc.text(`${format(selectedDate, "yyyy年M月", { locale: ja })}のシフト表`, 148.5, 20, { align: 'center' });

      // サブタイトル
      doc.setFontSize(10);
      doc.text(`スタッフ${staff.length}名 • シフト${monthShifts.length}件`, 148.5, 28, { align: 'center' });

      // テーブルのヘッダー行を準備（日本語対応）
      const headers = ['日付', ...staff.map(staffMember => staffMember.name)];

      // テーブルのデータ行を準備
      const tableData = monthDates.map(date => {
        const staffShifts = getStaffShiftsForDate(date);
        const dayOfWeek = format(date, "E", { locale: ja });

        const row = [
          `${format(date, "M/d")}\n(${dayOfWeek})`
        ];

        staff.forEach(staffMember => {
          const myShifts = staffShifts.get(staffMember.uid) || [];
          const shiftText = myShifts.length > 0
            ? myShifts.map(({ slot }) => `${slot.startTime}-${slot.endTime}`).join(',')
            : '-';
          row.push(shiftText);
        });

        return row;
      });

      // autoTableでテーブル生成（日本語対応設定）
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 35,
        margin: { top: 35, right: 10, bottom: 10, left: 10 },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle',
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          font: 'helvetica', // 基本フォント
          fontStyle: 'normal',
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: {
            cellWidth: 25,
            halign: 'center',
            fontSize: 6,
          },
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.1,
        pageBreak: 'avoid',
        theme: 'grid',
        // 日本語テキストの回避策：Unicode文字を使用しない
        didParseCell: function(data) {
          // 日本語文字を英数字に変換（必要に応じて）
          if (data.cell.text && Array.isArray(data.cell.text)) {
            data.cell.text = data.cell.text.map(text => {
              if (typeof text === 'string') {
                // 日付の曜日を英語に変換
                return text
                  .replace(/日/g, 'Su')
                  .replace(/月/g, 'Mo')
                  .replace(/火/g, 'Tu')
                  .replace(/水/g, 'We')
                  .replace(/木/g, 'Th')
                  .replace(/金/g, 'Fr')
                  .replace(/土/g, 'Sa');
              }
              return text;
            });
          }
        }
      });

      // PDFを自動ダウンロード
      doc.save(fileName);

    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("PDFの出力に失敗しました。エラー詳細: " + error.message);
    }
  };


  return (
    <ProtectedRoute requiredRole="manager">
      <div className="min-h-screen bg-gray-50">
        <AppHeader
          title="シフト管理"
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6">
            {/* 上部エリア：出力・プレビューボタン + 月間統計 */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
              {/* 出力・プレビューボタン */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShowPreview();
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>プレビュー</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShowExport();
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>出力</span>
                </button>
              </div>

              {/* 月間統計 */}
              <div className="flex-1 lg:max-w-2xl">
                <MonthStats
                  monthDates={getMonthDates()}
                  getDayStats={getDayStats}
                  loading={loading}
                />
              </div>
            </div>

            {/* カレンダーナビゲーション */}
            <CalendarNavigation
              selectedDate={selectedDate}
              calendarView={calendarView}
              layoutMode={layoutMode}
              onDateChange={handleDateChange}
              onViewChange={handleViewChange}
            />

            {/* カレンダーグリッド */}
            <CalendarGrid
              selectedDate={selectedDate}
              calendarView={calendarView}
              layoutMode={layoutMode}
              shifts={shifts}
              staff={staff}
              getDayStats={getDayStats}
              getStaffShiftsForDate={getStaffShiftsForDate}
              getShiftsForDate={getShiftsForDate}
              onCreateShift={handleCreateShift}
              onOpenShiftDetail={(shift, slot, staff) => handleShiftClick(shift)}
              onOpenStaffChat={(staffId, staffName, shiftId) => {
                const staffMember = staff.find(s => s.uid === staffId);
                if (staffMember) {
                  handleChatWithStaff(staffMember, shiftId);
                }
              }}
              loading={loading}
            />
          </div>
        </div>

        {/* シフト作成モーダル */}
        <ShiftCreateModal
          showModal={showCreateModal}
          createModalDate={createModalDate}
          createModalStaff={createModalStaff}
          calendarView={calendarView}
          staff={staff}
          selectedStaffForCalendar={selectedStaffForCalendar}
          setSelectedStaffForCalendar={setSelectedStaffForCalendar}
          staffTimeSettings={staffTimeSettings}
          handleStaffTimeChange={handleStaffTimeChange}
          formData={formData}
          handleFormChange={handleFormChange}
          createLoading={createLoading}
          managerId={currentUser?.uid || ''}
          onClose={handleCloseCreateModal}
          onSubmit={handleSubmitShift}
        />

        {/* シフト詳細モーダル */}
        {selectedShift && (
          <ShiftDetailModal
            shift={selectedShift}
            staff={staff}
            onClose={handleCloseDetailModal}
            onUpdate={async () => {
              const newShifts = await shiftService.getShiftsByShop(managerUser.uid);
              setShifts(newShifts);
            }}
          />
        )}

        {/* エクスポートモーダル */}
        <ExportModal
          showModal={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />

        {/* プレビューモーダル */}
        <PreviewModal
          showModal={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          shifts={shifts}
          staff={staff}
          selectedDate={selectedDate}
          monthDates={getMonthDates()}
          getStaffShiftsForDate={getStaffShiftsForDate}
        />

        {/* チャットサイドバー */}
        <SimpleChatSidebar
          isOpen={chatOpen}
          onToggle={handleCloseChat}
          targetUserId={chatTargetUser?.id}
          targetUserName={chatTargetUser?.name}
          relatedShiftId={chatRelatedShift}
        />
      </div>
    </ProtectedRoute>
  );
}