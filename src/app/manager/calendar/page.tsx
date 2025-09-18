'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/layout/AppHeader';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
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
  ChevronRight
} from 'lucide-react';
import { format, addDays, isSameDay, startOfDay, startOfMonth, endOfMonth, getDaysInMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftService } from '@/lib/shiftService';
import { ShiftExtended, User, ShiftSlot } from '@/types';
import jsPDF from 'jspdf';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ShiftDetailModal from '@/components/shifts/ShiftDetailModal';
import { excelService } from '@/lib/excelService';
import { drawJapaneseText, addJapaneseFonts, formatJapaneseDate, formatJapaneseMonthYear } from '@/lib/japanesePdfFonts';
import { userService } from '@/lib/userService';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// カレンダー表示形式の型定義
type CalendarViewType = 'day' | 'week' | 'halfMonth' | 'month' | 'calendarFormat';

export default function ManagerCalendarPage() {
  const { currentUser } = useAuth();

  // フォールバック用のマネージャー情報（ログインしていない場合）
  const fallbackManager = {
    uid: 'test-manager-001', // テストデータと一致させる
    email: 'manager@shifty.com',
    name: 'マネージャー',
    role: 'manager' as const
  };

  const managerUser = currentUser || fallbackManager;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState<CalendarViewType>('month');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'traditional' | 'week' | 'list'>('grid');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState<{id: string, name: string} | null>(null);
  const [chatRelatedShift, setChatRelatedShift] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);
  const [createModalStaff, setCreateModalStaff] = useState<User | null>(null);
  const [selectedStaffForCalendar, setSelectedStaffForCalendar] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [formData, setFormData] = useState({
    startTime: '09:00',
    endTime: '17:00',
    positions: '',
    notes: ''
  });
  const [createLoading, setCreateLoading] = useState(false);

  // シフト詳細モーダルの状態管理
  const [shiftDetailModalOpen, setShiftDetailModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftExtended | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ShiftSlot | null>(null);
  const [selectedShiftStaff, setSelectedShiftStaff] = useState<User | null>(null);

  // 開発用：サンプルスタッフデータを作成
  const createSampleStaffData = async () => {
    if (!confirm(`サンプルスタッフデータを作成しますか？
（既存データがある場合は上書きされます）`)) {
      return;
    }

    try {
      console.log('📦 Creating sample staff data...');

      const sampleStaff = [
        {
          uid: 'staff_001',
          email: 'staff1@shifty.com',
          name: '田中太郎',
          role: 'staff',
          managerId: 'test-manager-001',
          employmentType: 'part-time',
          skills: ['レジ', 'フロア'],
          hourlyRate: 1200,
          maxHoursPerWeek: 25,
          availability: {
            monday: { available: true, preferredHours: ['09:00-17:00'] },
            tuesday: { available: true, preferredHours: ['09:00-17:00'] },
            wednesday: { available: false, preferredHours: [] },
            thursday: { available: true, preferredHours: ['13:00-21:00'] },
            friday: { available: true, preferredHours: ['13:00-21:00'] },
            saturday: { available: true, preferredHours: ['09:00-21:00'] },
            sunday: { available: true, preferredHours: ['09:00-21:00'] }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          uid: 'staff_002',
          email: 'staff2@shifty.com',
          name: '佐藤花子',
          role: 'staff',
          managerId: 'test-manager-001',
          employmentType: 'part-time',
          skills: ['レジ', 'キッチン'],
          hourlyRate: 1300,
          maxHoursPerWeek: 30,
          availability: {
            monday: { available: true, preferredHours: ['09:00-17:00'] },
            tuesday: { available: false, preferredHours: [] },
            wednesday: { available: true, preferredHours: ['09:00-17:00'] },
            thursday: { available: true, preferredHours: ['13:00-21:00'] },
            friday: { available: true, preferredHours: ['13:00-21:00'] },
            saturday: { available: true, preferredHours: ['09:00-21:00'] },
            sunday: { available: false, preferredHours: [] }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          uid: 'staff_003',
          email: 'staff3@shifty.com',
          name: '鈴木一郎',
          role: 'staff',
          managerId: 'test-manager-001',
          employmentType: 'full-time',
          skills: ['レジ', 'フロア', 'キッチン', 'リーダー'],
          hourlyRate: 1500,
          maxHoursPerWeek: 40,
          availability: {
            monday: { available: true, preferredHours: ['09:00-18:00'] },
            tuesday: { available: true, preferredHours: ['09:00-18:00'] },
            wednesday: { available: true, preferredHours: ['09:00-18:00'] },
            thursday: { available: true, preferredHours: ['09:00-18:00'] },
            friday: { available: true, preferredHours: ['09:00-18:00'] },
            saturday: { available: false, preferredHours: [] },
            sunday: { available: false, preferredHours: [] }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // 各スタッフデータをFirestoreに保存
      for (const staffData of sampleStaff) {
        await setDoc(doc(db, 'users', staffData.uid), staffData);
        console.log(`✅ Created staff: ${staffData.name}`);
      }

      alert(`サンプルスタッフデータを作成しました！
${sampleStaff.length}名のスタッフが追加されました。`);
      console.log('🎉 Sample staff data creation completed!');

    } catch (error) {
      console.error('❌ Error creating sample staff data:', error);
      alert('サンプルデータの作成に失敗しました。コンソールを確認してください。');
    }
  };

  // リアルタイムでシフトデータを取得
  useEffect(() => {
    setLoading(true);
    console.log('📅 Setting up real-time shift subscription for manager:', managerUser.uid);

    // リアルタイムシフト取得（店長のシフト）
    const unsubscribe = shiftService.subscribeToShiftUpdates(
      managerUser.uid, // managerIdを使用
      (updatedShifts) => {
        setShifts(updatedShifts);
        setLoading(false);
      }
    );

    return () => {
      console.log('🔌 Cleaning up manager shift subscription');
      unsubscribe();
    };
  }, [managerUser.uid]); // managerUser.uidに依存

  // 実際のスタッフデータをFirestoreから取得
  useEffect(() => {
    console.log('👥 Setting up staff data subscription for manager:', managerUser.uid);

    // リアルタイムスタッフデータ取得（店長のスタッフ）
    const unsubscribeStaff = userService.subscribeToStaffUpdates(
      managerUser.uid, // managerIdを使用
      (staffData) => {
        console.log(`📊 Received ${staffData.length} staff members from Firestore`);
        setStaff(staffData);

        // スタッフがいない場合の処理
        if (staffData.length === 0) {
          console.log('⚠️ No staff found for this manager. Please add staff members.');
        }
      }
    );

    return () => {
      console.log('🔌 Cleaning up staff subscription');
      unsubscribeStaff();
    };
  }, [managerUser.uid]); // managerUser.uidに依存

  // カレンダー表示形式に応じた日付範囲を計算
  const getDateRange = () => {
    switch (calendarView) {
      case 'day':
        return {
          start: startOfDay(selectedDate),
          end: startOfDay(selectedDate),
          dates: [selectedDate]
        };
      case 'week':
        const weekStart = startOfWeek(selectedDate, { locale: ja, weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { locale: ja, weekStartsOn: 1 });
        const weekDates = [];
        let currentDate = weekStart;
        while (currentDate <= weekEnd) {
          weekDates.push(currentDate);
          currentDate = addDays(currentDate, 1);
        }
        return {
          start: weekStart,
          end: weekEnd,
          dates: weekDates
        };
      case 'halfMonth':
        const isFirstHalf = selectedDate.getDate() <= 15;
        const halfMonthStart = isFirstHalf
          ? startOfMonth(selectedDate)
          : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 16);
        const halfMonthEnd = isFirstHalf
          ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 15)
          : endOfMonth(selectedDate);
        const halfMonthDates = [];
        let halfDate = halfMonthStart;
        while (halfDate <= halfMonthEnd) {
          halfMonthDates.push(halfDate);
          halfDate = addDays(halfDate, 1);
        }
        return {
          start: halfMonthStart,
          end: halfMonthEnd,
          dates: halfMonthDates
        };
      case 'month':
      default:
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const daysInMonth = getDaysInMonth(selectedDate);
        const monthDates = Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));
        return {
          start: monthStart,
          end: monthEnd,
          dates: monthDates
        };
    }
  };

  const dateRange = getDateRange();
  const monthStart = dateRange.start;
  const monthEnd = dateRange.end;
  const monthDates = dateRange.dates;

  // 指定日のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => isSameDay(new Date(shift.date), date));
  };


  // 指定日のスタッフ別シフト情報を取得
  const getStaffShiftsForDate = (date: Date) => {
    const dayShifts = getShiftsForDate(date);
    const staffShifts = new Map<string, Array<{
      shift: ShiftExtended;
      slot: ShiftSlot;
    }>>();

    // スタッフごとのシフトをグループ化
    staff.forEach(s => {
      staffShifts.set(s.uid, []);
    });

    dayShifts.forEach(shift => {
      shift.slots.forEach(slot => {
        slot.assignedStaff?.forEach((staffId: string) => {
          const existing = staffShifts.get(staffId) || [];
          existing.push({ shift, slot });
          staffShifts.set(staffId, existing);
        });
      });
    });

    return staffShifts;
  };

  // 日別統計の計算
  const getDayStats = (date: Date) => {
    const dayShifts = getShiftsForDate(date);

    let totalRequiredStaff = 0;
    let totalAssignedStaff = 0;
    let totalSlots = 0;

    dayShifts.forEach(shift => {
      shift.slots.forEach(slot => {
        totalSlots++;
        totalRequiredStaff += slot.requiredStaff || 0;
        totalAssignedStaff += slot.assignedStaff?.length || 0;
      });
    });

    const shortage = totalRequiredStaff - totalAssignedStaff;
    const fulfillmentRate = totalRequiredStaff > 0 ? (totalAssignedStaff / totalRequiredStaff) * 100 : 0;

    return {
      totalSlots,
      totalRequiredStaff,
      totalAssignedStaff,
      shortage: Math.max(0, shortage),
      fulfillmentRate
    };
  };



  // 日付範囲の表示フォーマット
  const getDateRangeLabel = () => {
    switch (calendarView) {
      case 'day':
        return format(selectedDate, 'yyyy年 M月d日(E)', { locale: ja });
      case 'week':
        return `${format(dateRange.start, 'yyyy年 M月d日', { locale: ja })}〜${format(dateRange.end, 'M月d日', { locale: ja })}`;
      case 'halfMonth':
        return `${format(dateRange.start, 'yyyy年 M月d日', { locale: ja })}〜${format(dateRange.end, 'M月d日', { locale: ja })}`;
      case 'month':
      default:
        return `${format(monthStart, 'yyyy年 M月d日(E)', { locale: ja })}〜${format(monthEnd, 'M月d日(E)', { locale: ja })}`;
    }
  };

  // 従来のカレンダー形式用の週を取得
  const getCalendarWeeks = () => {
    const weeks: Date[][] = [];
    const { start, end } = dateRange;
    const startDate = startOfWeek(start, { locale: ja, weekStartsOn: 1 }); // 月曜日始まり
    const endDate = endOfWeek(end, { locale: ja, weekStartsOn: 1 });

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  };

  // スタッフチャットを開く
  const handleOpenStaffChat = (staffId: string, staffName: string, relatedShiftId?: string) => {
    setChatTargetUser({ id: staffId, name: staffName });
    setChatRelatedShift(relatedShiftId || null);
    setChatOpen(true);
    console.log('💬 Opening chat with:', staffName, relatedShiftId ? `(Shift: ${relatedShiftId})` : '');
  };

  // シフト詳細モーダルを開く
  const handleOpenShiftDetail = (shift: ShiftExtended, slot: ShiftSlot, staff: User) => {
    setSelectedShift(shift);
    setSelectedSlot(slot);
    setSelectedShiftStaff(staff);
    setShiftDetailModalOpen(true);
    console.log('📝 Opening shift detail for:', staff.name, 'on', shift.date);
  };

  // シフト詳細モーダルを閉じる
  const handleCloseShiftDetail = () => {
    setShiftDetailModalOpen(false);
    setSelectedShift(null);
    setSelectedSlot(null);
    setSelectedShiftStaff(null);
  };

  // シフトスロットを保存
  const handleSaveShiftSlot = async (slotId: string, updatedSlot: Partial<ShiftSlot>) => {
    if (!selectedShift || !managerUser) return;

    try {
      // 現在の slots から該当スロットを更新
      const updatedSlots = selectedShift.slots.map(slot =>
        slot.slotId === slotId ? { ...slot, ...updatedSlot } : slot
      );

      // シフト全体を更新
      await shiftService.updateShift(
        selectedShift.shiftId,
        { slots: updatedSlots },
        managerUser as User,
        'Slot details updated'
      );

      console.log('✅ Shift slot updated successfully');
      // リアルタイム更新により自動で反映される
    } catch (error) {
      console.error('❌ Error updating shift slot:', error);
      throw error;
    }
  };

  // シフトスロットを削除
  const handleDeleteShiftSlot = async (slotId: string) => {
    if (!selectedShift || !managerUser) return;

    try {
      // 現在の slots から該当スロットを削除
      const updatedSlots = selectedShift.slots.filter(slot => slot.slotId !== slotId);

      // スロットがすべて削除される場合はシフト全体を削除
      if (updatedSlots.length === 0) {
        await shiftService.deleteShift(selectedShift.shiftId, managerUser as User);
      } else {
        // シフト全体を更新
        await shiftService.updateShift(
          selectedShift.shiftId,
          { slots: updatedSlots },
          managerUser as User,
          'Slot deleted'
        );
      }

      console.log('✅ Shift slot deleted successfully');
      // リアルタイム更新により自動で反映される
    } catch (error) {
      console.error('❌ Error deleting shift slot:', error);
      throw error;
    }
  };

  // チャットを閉じる
  const handleCloseChat = () => {
    setChatOpen(false);
    setChatTargetUser(null);
    setChatRelatedShift(null);
  };

  // シフト作成
  const handleCreateShift = (date?: Date, staffMember?: User) => {
    const targetDate = date || new Date();
    console.log('Create shift for date:', format(targetDate, 'yyyy-MM-dd'));
    if (staffMember) {
      console.log('Pre-assigned staff:', staffMember.name);
      setCreateModalStaff(staffMember);
    } else {
      setCreateModalStaff(null);
      // カレンダー形式の場合は複数選択をリセット
      setSelectedStaffForCalendar([]);
    }
    setCreateModalDate(targetDate);
    setShowCreateModal(true);
  };

  // シフト作成モーダルを閉じる
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateModalDate(null);
    setCreateModalStaff(null);
    setSelectedStaffForCalendar([]);
    // フォームデータをリセット
    setFormData({
      startTime: '09:00',
      endTime: '17:00',
      positions: '',
      notes: ''
    });
    setCreateLoading(false);
  };

  // フォームデータを更新
  const handleFormChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // シフト作成の実行
  const executeCreateShift = async () => {

    if (!createModalDate) {
      console.error('❌ Date not selected for shift creation');
      return;
    }

    // 時間の妥当性チェック
    const start = new Date(`2000-01-01T${formData.startTime}`);
    const end = new Date(`2000-01-01T${formData.endTime}`);
    if (start >= end) {
      alert('終了時間は開始時間より後に設定してください');
      return;
    }

    setCreateLoading(true);

    try {
      // ポジションを配列に変換
      const positions = formData.positions
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      // 労働時間を計算（分単位）
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);

      // レイアウトに応じてスタッフ割り当てを決定
      let assignedStaff: string[] = [];
      if (layoutMode === 'traditional' && selectedStaffForCalendar.length > 0) {
        // カレンダー形式: 複数スタッフ選択
        assignedStaff = selectedStaffForCalendar;
      } else if (createModalStaff) {
        // グリッド形式: 単一スタッフ
        assignedStaff = [createModalStaff.uid];
      }

      // シフトデータを構築
      const shiftData = {
        managerId: managerUser.uid,
        date: createModalDate,
        slots: [
          {
            slotId: `slot_${Date.now()}`,
            startTime: formData.startTime,
            endTime: formData.endTime,
            requiredStaff: Math.max(1, assignedStaff.length),
            assignedStaff: assignedStaff,
            positions: positions.length > 0 ? positions : ['一般'],
            requiredSkills: positions.length > 0 ? positions : [],
            priority: 'medium' as const,
            estimatedDuration: duration,
            notes: formData.notes
          }
        ]
      };

      if (assignedStaff.length > 0) {
        const staffNames = assignedStaff.map(uid => {
          const staffMember = staff.find(s => s.uid === uid);
          return staffMember ? staffMember.name : uid;
        }).join(', ');
        console.log(`✅ Auto-assigning shift to staff: ${staffNames}`);
      }

      // ShiftServiceを使用してシフトを作成
      if (!managerUser) {
        throw new Error('Manager user not found');
      }
      await shiftService.createShift(shiftData, managerUser as User);

      if (assignedStaff.length > 0) {
        const staffNames = assignedStaff.map(uid => {
          const staffMember = staff.find(s => s.uid === uid);
          return staffMember ? staffMember.name : uid;
        }).join('、');
        alert(`✅ ${staffNames}さんの${format(createModalDate, 'M月d日', { locale: ja })}シフトを設定しました！

カレンダーに直ちに反映されています。`);
      } else {
        alert(`${format(createModalDate, 'M月d日', { locale: ja })}のシフトを作成しました`);
      }

      // モーダルを閉じる
      closeCreateModal();

      // シフト一覧が自動更新される（subscribeToShiftUpdatesにより）

    } catch (error) {
      console.error('❌ Failed to create shift:', error);
      alert('シフトの作成に失敗しました。再度お試しください。');
    } finally {
      setCreateLoading(false);
    }
  };

  // シフト出力モーダルを開く
  const handleExportShift = () => {
    setShowExportModal(true);
  };

  // シフト出力モーダルを閉じる
  const closeExportModal = () => {
    setShowExportModal(false);
  };

  // シフト出力の実行
  const executeExport = (exportFormat: 'daily' | 'weekly' | 'monthly') => {
    const startDate = monthStart;
    const endDate = monthEnd;

    // ファイル名を生成（スタッフ名は代表として最初のスタッフを使用、または月名を使用）
    const staffName = staff.length > 0 ? staff[0].name : '全スタッフ';
    const fileName = `シフト表_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}_${staffName}.xlsx`;

    excelService.exportShiftTable(
      shifts,
      staff,
      startDate,
      endDate,
      exportFormat,
      fileName
    );

    closeExportModal();
    console.log(`Exported ${exportFormat} shift table:`, fileName);
  };

  // プレビュー表示
  const handleShowPreview = () => {
    setShowPreviewModal(true);
  };

  // 月間統計の計算
  const monthStats = monthDates.reduce((acc, date) => {
    const dayStats = getDayStats(date);
    return {
      totalSlots: acc.totalSlots + dayStats.totalSlots,
      totalRequired: acc.totalRequired + dayStats.totalRequiredStaff,
      totalAssigned: acc.totalAssigned + dayStats.totalAssignedStaff,
      totalShortage: acc.totalShortage + dayStats.shortage
    };
  }, { totalSlots: 0, totalRequired: 0, totalAssigned: 0, totalShortage: 0 });

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <div className="h-screen overflow-hidden bg-gray-50">
          <AppHeader title="シフトカレンダー" />
          <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">シフトカレンダーを読み込み中...</p>
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="シフトカレンダー" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {/* 開発用：サンプルデータ作成ボタン */}
              {staff.length === 0 && (
                <button
                  onClick={createSampleStaffData}
                  className="flex items-center space-x-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors whitespace-nowrap"
                  title="開発用：サンプルスタッフデータを作成"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>サンプル作成</span>
                </button>
              )}
              <button
                onClick={handleExportShift}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>出力</span>
              </button>
              <button
                onClick={handleShowPreview}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>プレビュー</span>
              </button>
            </div>

            {/* Month Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">今月のシフト数</p>
                  <p className="text-2xl font-bold text-blue-900">{monthStats.totalSlots}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">配置済み</p>
                  <p className="text-2xl font-bold text-green-900">{monthStats.totalAssigned}</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <UserPlus className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-600 font-medium">必要人数</p>
                  <p className="text-2xl font-bold text-yellow-900">{monthStats.totalRequired}</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="text-sm text-red-600 font-medium">人数不足</p>
                  <p className="text-2xl font-bold text-red-900">{monthStats.totalShortage}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Navigation */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {getDateRangeLabel()}
                </h2>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="前月"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="次月"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                  title="今月に戻る"
                >
                  戻る
                </button>
              </div>
            </div>

            <div className="flex items-center">
              {/* 表示形式切り替えドロップダウン */}
              <div className="relative">
                <select
                  value={calendarView === 'month' && layoutMode === 'traditional' ? 'calendar' : calendarView}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'calendar') {
                      setCalendarView('month');
                      setLayoutMode('traditional');
                    } else {
                      setCalendarView(value as CalendarViewType);
                      setLayoutMode('grid');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer appearance-none pr-8"
                >
                  <option value="day">日</option>
                  <option value="week">週</option>
                  <option value="halfMonth">半月</option>
                  <option value="month">月</option>
                  <option value="calendar">カレンダー</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          <div>
          {calendarView === 'day' ? (
            // 日表示ビュー（9時から23時まで時間軸）
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex">
                {/* Fixed Staff Names Column */}
                <div className={`flex-shrink-0 w-48 border-r border-gray-300 ${
                  selectedDate.getDay() === 0 ? 'bg-red-50' :
                  selectedDate.getDay() === 6 ? 'bg-blue-50' : 'bg-gray-50'
                }`}>
                  <div className="h-12 px-3 py-2 font-medium text-gray-900 border-b border-gray-300 flex items-center">
                    <span>スタッフ</span>
                  </div>
                  {staff.map((staffMember, staffIndex) => (
                    <div key={staffMember.uid} className={`h-20 px-3 py-2 flex items-center ${
                      staffIndex < staff.length - 1 ? 'border-b border-gray-300' : ''
                    }`}>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <div className="font-medium text-gray-900">{staffMember.name}</div>
                          <div className="text-sm text-gray-600">
                            {staffMember.skills?.slice(0, 2).join(', ')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenStaffChat(staffMember.uid, staffMember.name)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title={`${staffMember.name}さんとチャット`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time Grid */}
                <div className="flex-1 overflow-x-auto">
                  <div className="min-w-max">
                    {/* Time Headers (9:00-23:00) */}
                    <div className="flex border-b border-gray-300">
                      {Array.from({ length: 15 }, (_, i) => i + 9).map((hour) => (
                        <div key={hour} className={`w-20 h-12 px-2 py-1 text-center font-medium border-r border-gray-300 ${
                          selectedDate.getDay() === 0 ? 'bg-red-50' :
                          selectedDate.getDay() === 6 ? 'bg-blue-50' : 'bg-gray-50'
                        }`}>
                          <div className="text-sm">{hour}:00</div>
                        </div>
                      ))}
                    </div>

                    {/* Staff Time Grid */}
                    {staff.map((staffMember, staffIndex) => {
                      const dayShifts = getStaffShiftsForDate(selectedDate);
                      const myShifts = dayShifts.get(staffMember.uid) || [];

                      return (
                        <div key={staffMember.uid} className="flex">
                          {Array.from({ length: 15 }, (_, i) => i + 9).map((hour) => {
                            const shiftInHour = myShifts.find(({ slot }) => {
                              const start = parseInt(slot.startTime.split(':')[0]);
                              const end = parseInt(slot.endTime.split(':')[0]);
                              return start <= hour && hour < end;
                            });

                            return (
                              <div
                                key={hour}
                                className={`w-20 h-20 border-r border-gray-300 ${
                                  staffIndex < staff.length - 1 ? 'border-b' : ''
                                } ${shiftInHour ? '' :
                                  selectedDate.getDay() === 0 ? 'bg-red-50' :
                                  selectedDate.getDay() === 6 ? 'bg-blue-50' : 'bg-gray-50'
                                }`}
                              >
                                {shiftInHour && (
                                  <div
                                    className={`h-full p-1 cursor-pointer transition-colors ${
                                      shiftInHour.shift.status === 'published'
                                        ? 'bg-green-100 hover:bg-green-200'
                                        : 'bg-yellow-100 hover:bg-yellow-200'
                                    }`}
                                    onClick={() => handleOpenShiftDetail(shiftInHour.shift, shiftInHour.slot, staffMember)}
                                  >
                                    <div className="text-xs font-medium">
                                      {shiftInHour.slot.positions?.join(', ')}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : layoutMode === 'grid' ? (
            // グリッド表示（スタッフ×日付）
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex">
              {/* Fixed Staff Names Column */}
              <div className="flex-shrink-0 w-48 bg-gray-50 border-r border-gray-300">
                {/* Header */}
                <div className="h-20 px-3 py-2 font-medium text-gray-900 border-b border-gray-300 flex items-center box-border">
                  <span>スタッフ</span>
                </div>

                {/* Staff Rows */}
                {staff.map((staffMember, staffIndex) => (
                  <div key={staffMember.uid} className={`h-16 px-3 py-2 flex items-center box-border ${
                    staffIndex < staff.length - 1 ? 'border-b border-gray-300' : ''
                  }`}>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="font-medium text-gray-900">{staffMember.name}</div>
                        <div className="text-sm text-gray-600">
                          {staffMember.skills?.slice(0, 2).join(', ')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenStaffChat(staffMember.uid, staffMember.name)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title={`${staffMember.name}さんとチャット`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scrollable Dates Section */}
              <div className="flex-1 overflow-x-auto" id="calendar-scroll-container">
                <div style={{ minWidth: `${monthDates.length * 160}px` }}>
                  {/* Date Headers */}
                  <div className="flex border-b border-gray-300">
                    {monthDates.map((date) => {
                      const dayStats = getDayStats(date);
                      const isToday = isSameDay(date, new Date());
                      const dayOfWeek = format(date, 'E', { locale: ja });
                      const dayOfWeekNum = date.getDay();

                      // スタイルクラスを決定
                      let bgClass = 'bg-gray-50';
                      let textClass = 'text-gray-900';
                      let borderClass = 'border-r-gray-300';

                      if (isToday) {
                        bgClass = 'bg-blue-100';
                        textClass = 'text-blue-900';
                        borderClass = 'border-r-blue-300';
                      } else if (dayOfWeekNum === 0) { // 日曜日
                        bgClass = 'bg-red-50';
                        textClass = 'text-red-600';
                        borderClass = 'border-r-red-300';
                      } else if (dayOfWeekNum === 6) { // 土曜日
                        bgClass = 'bg-blue-50';
                        textClass = 'text-blue-600';
                        borderClass = 'border-r-blue-300';
                      }

                      return (
                        <div
                          key={date.toISOString()}
                          className={`w-40 h-20 px-3 py-2 text-center font-medium border-r border-gray-300 flex flex-col justify-center box-border ${bgClass} ${textClass} ${borderClass}`}
                        >
                          <div className={`text-sm ${dayOfWeekNum === 0 ? 'text-red-600 font-semibold' : dayOfWeekNum === 6 ? 'text-blue-600 font-semibold' : ''}`}>
                            {dayOfWeek}
                          </div>
                          <div className="text-lg">{format(date, 'd')}</div>
                          <div className="flex items-center justify-center space-x-1 mt-2">
                            {dayStats.shortage > 0 ? (
                              <div className="flex items-center space-x-1 text-xs text-red-600">
                                <AlertTriangle className="h-3 w-3" />
                                <span>-{dayStats.shortage}</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                <span>OK</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Staff Schedule Grid */}
                  <div>
                    {staff.map((staffMember, staffIndex) => (
                      <div key={staffMember.uid} className="flex">
                        {monthDates.map((date) => {
                          const staffShifts = getStaffShiftsForDate(date);
                          const myShifts = staffShifts.get(staffMember.uid) || [];
                          const isPast = date < startOfDay(new Date());
                          const isToday = isSameDay(date, new Date());
                          const dayOfWeekNum = date.getDay();

                          // セルの背景色と枠線色を決定
                          let cellBgClass = '';
                          let cellBorderClass = 'border-r-gray-300';

                          if (isToday) {
                            cellBgClass = 'bg-blue-100';
                            cellBorderClass = 'border-r-blue-300';
                          } else if (dayOfWeekNum === 0) { // 日曜日
                            cellBgClass = 'bg-red-50';
                            cellBorderClass = 'border-r-red-300';
                          } else if (dayOfWeekNum === 6) { // 土曜日
                            cellBgClass = 'bg-blue-50';
                            cellBorderClass = 'border-r-blue-300';
                          } else if (isPast) {
                            cellBgClass = 'bg-gray-50';
                          }

                          return (
                            <div
                              key={date.toISOString()}
                              className={`w-40 h-16 px-3 py-2 border-r border-gray-300 flex items-center box-border ${
                                staffIndex < staff.length - 1 ? 'border-b border-gray-300' : ''
                              } ${cellBgClass} ${cellBorderClass}`}
                            >
                              <div className="w-full flex flex-col items-center justify-center space-y-1">
                                {myShifts.map(({ shift, slot }, index) => (
                                  <div
                                    key={`${shift.shiftId}-${slot.slotId}-${index}`}
                                    className={`p-1 rounded text-xs border group relative cursor-pointer transition-colors ${
                                      shift.status === 'published'
                                        ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                                        : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
                                    }`}
                                    onClick={() => handleOpenShiftDetail(shift, slot, staffMember)}
                                    title={`${staffMember.name}さんのシフト詳細を編集`}
                                  >
                                    <div className="font-medium flex items-center justify-between">
                                      <span>{slot.startTime}-{slot.endTime}</span>
                                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {slot.positions && (
                                      <div className="text-gray-600 truncate">
                                        {slot.positions.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {myShifts.length === 0 && !isPast && (
                                  <button
                                    onClick={() => handleCreateShift(date, staffMember)}
                                    className="w-full h-10 border-2 border-dashed border-blue-300 rounded text-blue-400 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center hover:bg-blue-50"
                                    title={`${staffMember.name}さんのシフトを設定（直接反映）`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : (
            // 従来のカレンダー形式（週ごと表示）
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Calendar Grid */}
              {getCalendarWeeks().map((week, weekIndex) => (
                <div key={weekIndex} className="border-b border-gray-200 last:border-b-0">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 border-b border-gray-300">
                    {week.map((date, dayIndex) => {
                      const dayOfWeekNum = date.getDay();
                      const isToday = isSameDay(date, new Date());
                      const dayShifts = getShiftsForDate(date);

                      return (
                        <div
                          key={dayIndex}
                          className={`min-h-[120px] p-2 border-r border-gray-200 last:border-r-0 ${
                            isToday ? 'bg-blue-100' :
                            dayOfWeekNum === 0 ? 'bg-red-50' :
                            dayOfWeekNum === 6 ? 'bg-blue-50' : 'bg-white'
                          }`}
                        >
                          {/* Date Header */}
                          <div className={`text-sm font-medium mb-2 ${
                            isToday ? 'text-blue-900' :
                            dayOfWeekNum === 0 ? 'text-red-600' :
                            dayOfWeekNum === 6 ? 'text-blue-600' : 'text-gray-900'
                          }`}>
                            {format(date, 'd')}
                            <span className="ml-1 text-xs">
                              {format(date, 'E', { locale: ja })}
                            </span>
                          </div>

                          {/* Shifts for this day */}
                          <div className="space-y-1">
                            {dayShifts.slice(0, 3).map((shift, shiftIndex) => (
                              <div key={`${shift.shiftId}-${shiftIndex}`} className="space-y-1">
                                {shift.slots.map((slot) => {
                                  // 同じスロットに複数スタッフがいる場合は横並びに表示
                                  const assignedStaffCount = slot.assignedStaff?.length || 0;
                                  if (assignedStaffCount === 0) return null;

                                  if (assignedStaffCount === 1) {
                                    // 単一スタッフの場合は従来通り
                                    const staffId = slot.assignedStaff![0];
                                    const staffMember = staff.find(s => s.uid === staffId);
                                    if (!staffMember) return null;

                                    return (
                                      <div
                                        key={`${shift.shiftId}-${slot.slotId}-${staffId}`}
                                        className={`p-1 rounded text-xs cursor-pointer transition-colors ${
                                          shift.status === 'published'
                                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                        }`}
                                        onClick={() => handleOpenShiftDetail(shift, slot, staffMember)}
                                        title={`${staffMember.name}: ${slot.startTime}-${slot.endTime}`}
                                      >
                                        <div className="font-medium truncate">
                                          {staffMember.name}
                                        </div>
                                        <div className="text-gray-600 truncate">
                                          {slot.startTime}-{slot.endTime}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // 複数スタッフの場合は横並び
                                    return (
                                      <div
                                        key={`${shift.shiftId}-${slot.slotId}`}
                                        className={`flex space-x-1 p-1 rounded text-xs ${
                                          shift.status === 'published'
                                            ? 'bg-green-100'
                                            : 'bg-yellow-100'
                                        }`}
                                      >
                                        {slot.assignedStaff?.map((staffId: string) => {
                                          const staffMember = staff.find(s => s.uid === staffId);
                                          if (!staffMember) return null;

                                          return (
                                            <div
                                              key={staffId}
                                              className={`flex-1 p-1 rounded cursor-pointer transition-colors ${
                                                shift.status === 'published'
                                                  ? 'bg-green-200 text-green-800 hover:bg-green-300'
                                                  : 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                                              }`}
                                              onClick={() => handleOpenShiftDetail(shift, slot, staffMember)}
                                              title={`${staffMember.name}: ${slot.startTime}-${slot.endTime}`}
                                            >
                                              <div className="font-medium truncate text-xs">
                                                {staffMember.name}
                                              </div>
                                              <div className="text-gray-600 truncate" style={{ fontSize: '10px' }}>
                                                {slot.startTime}-{slot.endTime}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            ))}

                            {dayShifts.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayShifts.length - 3} more
                              </div>
                            )}

                            {/* Add shift button */}
                            {dayShifts.length === 0 && date >= startOfDay(new Date()) && (
                              <div className="flex justify-center items-center h-full">
                                <button
                                  onClick={() => handleCreateShift(date)}
                                  className="w-10 h-10 border-2 border-dashed border-gray-300 rounded-full text-gray-400 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center"
                                  title="シフトを追加"
                                >
                                  <Plus className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && staff.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">スタッフが登録されていません</p>
              <p className="text-gray-400 mt-2">スタッフを追加してからシフトを管理してください</p>
            </div>
          )}
          </div>

          {/* プレビューモーダル */}
          {showPreviewModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">シフト表プレビュー</h2>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-gray-600">
                    {format(selectedDate, 'yyyy年M月', { locale: ja })}のシフト表
                  </p>
                  <p className="text-sm text-gray-500">
                    スタッフ{staff.length}名 • シフト{shifts.length}件
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left">日付</th>
                        {staff.map(staffMember => (
                          <th key={staffMember.uid} className="border border-gray-200 px-4 py-2 text-center">
                            {staffMember.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthDates.map((date, index) => {
                        const staffShifts = getStaffShiftsForDate(date);
                        const dayOfWeek = format(date, 'E', { locale: ja });

                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-200 px-4 py-2">
                              <div>{format(date, 'M/d')}</div>
                              <div className="text-xs text-gray-500">({dayOfWeek})</div>
                            </td>
                            {staff.map(staffMember => {
                              const myShifts = staffShifts.get(staffMember.uid) || [];
                              return (
                                <td key={staffMember.uid} className="border border-gray-200 px-4 py-2 text-center">
                                  <div className="text-sm">
                                    {myShifts.length > 0
                                      ? myShifts.map(({slot}) => `${slot.startTime}-${slot.endTime}`).join(', ')
                                      : '-'
                                    }
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </main>

        {/* Chat Sidebar */}
        <ChatSidebar
          isOpen={chatOpen}
          onToggle={handleCloseChat}
          targetUserId={chatTargetUser?.id}
          targetUserName={chatTargetUser?.name}
          relatedShiftId={chatRelatedShift || undefined}
          position="right"
        />

        {/* Shift Detail Modal */}
        <ShiftDetailModal
          isOpen={shiftDetailModalOpen}
          onClose={handleCloseShiftDetail}
          shift={selectedShift}
          slot={selectedSlot}
          staff={selectedShiftStaff}
          onSave={handleSaveShiftSlot}
          onDelete={handleDeleteShiftSlot}
        />

        {/* Shift Creation Modal */}
        {showCreateModal && createModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-all duration-300"
            onClick={closeCreateModal}
          ></div>

          <div className="relative z-10 bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl max-w-lg w-full max-h-screen overflow-y-auto transform transition-all duration-300 scale-100">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {createModalStaff ? `${createModalStaff.name}さんのシフト設定` : '新規シフト作成'}
                  </h3>
                  {createModalStaff && (
                    <p className="text-sm text-green-600 mt-1 flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      このスタッフに直接反映されます
                    </p>
                  )}
                </div>
                <button
                  onClick={closeCreateModal}
                  className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 transition-all duration-200"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    日付
                  </label>
                  <input
                    type="date"
                    value={format(createModalDate, 'yyyy-MM-dd')}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                    readOnly
                  />
                </div>

                {/* カレンダー形式の場合: スタッフ選択チェックボックス */}
                {layoutMode === 'traditional' && !createModalStaff && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      スタッフ選択
                    </label>
                    <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto bg-white/50">
                      {staff.length > 0 ? (
                        <div className="space-y-2">
                          {console.log('Staff data:', staff.map(s => ({name: s.name, uid: s.uid})))}
                          {console.log('Current selected staff:', selectedStaffForCalendar)}
                          {console.log('Layout mode:', layoutMode)}
                          {staff.map((staffMember) => (
                            <div key={staffMember.uid} className="flex items-center p-2 hover:bg-gray-50 rounded-lg">
                              <input
                                type="checkbox"
                                id={`staff-${staffMember.uid}`}
                                value={staffMember.uid}
                                checked={selectedStaffForCalendar.includes(staffMember.uid)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Checkbox clicked:', staffMember.name, 'UID:', staffMember.uid);
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  console.log('Checkbox changed:', staffMember.name, 'UID:', staffMember.uid, 'Checked:', e.target.checked);
                                  const isChecked = e.target.checked;

                                  setSelectedStaffForCalendar(prev => {
                                    if (isChecked) {
                                      const newSelection = [...prev, staffMember.uid];
                                      console.log('Adding staff:', newSelection);
                                      return newSelection;
                                    } else {
                                      const newSelection = prev.filter(id => id !== staffMember.uid);
                                      console.log('Removing staff:', newSelection);
                                      return newSelection;
                                    }
                                  });
                                }}
                                className="h-4 w-4 accent-red-500 text-red-600 border-gray-300 rounded checked:bg-red-500 checked:border-red-500 focus:ring-red-500 focus:border-red-500 cursor-pointer"
                              />
                              <label
                                htmlFor={`staff-${staffMember.uid}`}
                                className="ml-3 flex-1 cursor-pointer"
                              >
                                <div className="text-sm font-medium text-gray-900">{staffMember.name}</div>
                                {staffMember.skills && staffMember.skills.length > 0 && (
                                  <div className="text-xs text-gray-500">{staffMember.skills.slice(0, 2).join(', ')}</div>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">スタッフが登録されていません</p>
                      )}
                    </div>
                  </div>
                )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            開始時間
                          </label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => handleFormChange('startTime', e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            終了時間
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => handleFormChange('endTime', e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ポジション
                        </label>
                        <input
                          type="text"
                          value={formData.positions}
                          onChange={(e) => handleFormChange('positions', e.target.value)}
                          className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                          placeholder="レジ、フロア、キッチンなど（カンマ区切り）"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          備考
                        </label>
                        <textarea
                          rows={3}
                          value={formData.notes}
                          onChange={(e) => handleFormChange('notes', e.target.value)}
                          className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                          placeholder="特別な指示があれば入力"
                        ></textarea>
                </div>
              </div>

              {/* 直接反映の説明 */}
              {createModalStaff && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-green-700">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium">
                      このシフトは{createModalStaff.name}さんに直接設定され、すぐにカレンダーに反映されます
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeCreateModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeCreateShift}
                disabled={createLoading}
                className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createLoading
                  ? (() => {
                      if (createModalStaff) {
                        return `${createModalStaff.name}さんに設定中...`;
                      } else if (layoutMode === 'traditional' && selectedStaffForCalendar.length > 0) {
                        return `${selectedStaffForCalendar.length}名に設定中...`;
                      }
                      return '作成中...';
                    })()
                  : (() => {
                      if (createModalStaff) {
                        return `${createModalStaff.name}さんのシフト設定`;
                      } else if (layoutMode === 'traditional' && selectedStaffForCalendar.length > 0) {
                        return `${selectedStaffForCalendar.length}名のシフト設定`;
                      }
                      return '作成';
                    })()
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Format Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={closeExportModal}
          ></div>

          <div className="relative z-10 bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  📋 フォーマットの選択
                </h3>
                <button
                  onClick={closeExportModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                下のレイアウトパターンから選択してください。
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* 日パターン */}
                <button
                  onClick={() => executeExport('daily')}
                  className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-center group"
                >
                  <div className="w-12 h-8 bg-blue-100 rounded border-2 border-blue-300 flex items-center justify-center mx-auto mb-2">
                    <div className="grid grid-cols-4 gap-0.5">
                      {Array.from({length: 8}).map((_, i) => (
                        <div key={i} className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div>
                      ))}
                    </div>
                  </div>
                  <div className="font-medium text-gray-900">日ごと</div>
                </button>

                {/* 週パターン */}
                <button
                  onClick={() => executeExport('weekly')}
                  className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-center group"
                >
                  <div className="w-12 h-8 bg-green-100 rounded border-2 border-green-300 flex items-center justify-center mx-auto mb-2">
                    <div className="grid grid-cols-7 gap-0.5">
                      {Array.from({length: 14}).map((_, i) => (
                        <div key={i} className="w-0.5 h-0.5 bg-green-400 rounded-full"></div>
                      ))}
                    </div>
                  </div>
                  <div className="font-medium text-gray-900">週まとめ</div>
                </button>

                {/* 月パターン */}
                <button
                  onClick={() => executeExport('monthly')}
                  className="p-3 border-2 border-blue-400 bg-blue-50 rounded-lg hover:border-blue-500 hover:bg-blue-100 transition-colors text-center group"
                >
                  <div className="w-12 h-8 bg-blue-200 rounded border-2 border-blue-400 flex items-center justify-center mx-auto mb-2">
                    <div className="grid grid-cols-6 gap-0.5">
                      {Array.from({length: 30}).map((_, i) => (
                        <div key={i} className="w-0.5 h-0.5 bg-blue-500 rounded-full"></div>
                      ))}
                    </div>
                  </div>
                  <div className="font-medium text-blue-900">月まとめ</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}