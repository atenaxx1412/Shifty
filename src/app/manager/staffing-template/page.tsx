'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import CalendarGrid from '@/components/staffing/CalendarGrid';
import StaffRequirementModal from '@/components/staffing/StaffRequirementModal';
import { LocalStaffingTemplateService } from '@/lib/localStaffingTemplate';
import { MonthlyStaffingTemplate } from '@/types/staffingTemplate';
import {
  Save,
  Calendar,
  Users,
  Info,
  Download,
  Upload,
  Trash2,
  BarChart3
} from 'lucide-react';

export default function StaffingTemplatePage() {
  const { currentUser } = useAuth();

  // State management
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const [template, setTemplate] = useState<MonthlyStaffingTemplate | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentRequirement, setCurrentRequirement] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load template when month or user changes
  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadTemplate = () => {
      const existingTemplate = LocalStaffingTemplateService.getTemplate(
        currentUser.uid,
        selectedMonth
      );

      if (existingTemplate) {
        setTemplate(existingTemplate);
        setNotes(existingTemplate.notes || '');
      } else {
        // Create empty template
        setTemplate({
          managerId: currentUser.uid,
          month: selectedMonth,
          dailyRequirements: [],
          notes: ''
        });
        setNotes('');
      }
    };

    loadTemplate();
  }, [currentUser?.uid, selectedMonth]);

  // Handle date click to open modal
  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    const requirement = LocalStaffingTemplateService.getDailyRequirement(
      currentUser?.uid || '',
      selectedMonth,
      date
    );
    setCurrentRequirement(requirement);
    setShowModal(true);
  };

  // Handle staff requirement save (without persisting to localStorage)
  const handleStaffRequirementSave = (date: string, requiredStaff: number) => {
    if (!currentUser?.uid || !template) return;

    // Update template state without saving to localStorage
    const existingReqIndex = template.dailyRequirements.findIndex(req => req.date === date);
    const updatedRequirements = [...template.dailyRequirements];

    if (requiredStaff === 0) {
      // Remove requirement if set to 0
      if (existingReqIndex !== -1) {
        updatedRequirements.splice(existingReqIndex, 1);
      }
    } else {
      // Add or update requirement
      if (existingReqIndex !== -1) {
        updatedRequirements[existingReqIndex] = { date, requiredStaff };
      } else {
        updatedRequirements.push({ date, requiredStaff });
        updatedRequirements.sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    const updatedTemplate = {
      ...template,
      dailyRequirements: updatedRequirements
    };

    setTemplate(updatedTemplate);
    setHasUnsavedChanges(true);
  };

  // Handle template save (save all changes to localStorage)
  const handleTemplateSave = () => {
    if (!currentUser?.uid || !template) return;

    try {
      setSaving(true);
      const templateToSave = {
        ...template,
        notes
      };
      const updatedTemplate = LocalStaffingTemplateService.saveTemplate(templateToSave);

      setTemplate(updatedTemplate);
      setHasUnsavedChanges(false);
      alert('テンプレートを保存しました');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // Export template
  const handleExport = () => {
    try {
      const exportData = LocalStaffingTemplateService.exportTemplates();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `staffing-templates-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました');
    }
  };

  // Import template
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const success = LocalStaffingTemplateService.importTemplates(result);

        if (success) {
          alert('テンプレートをインポートしました');
          // Reload current template
          const reloadedTemplate = LocalStaffingTemplateService.getTemplate(
            currentUser?.uid || '',
            selectedMonth
          );
          setTemplate(reloadedTemplate);
          setHasUnsavedChanges(false);
        } else {
          alert('インポートに失敗しました');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Clear current month template
  const handleClearMonth = () => {
    if (!currentUser?.uid) return;

    if (confirm('この月のテンプレートをすべて削除しますか？')) {
      LocalStaffingTemplateService.deleteTemplate(currentUser.uid, selectedMonth);
      setTemplate({
        managerId: currentUser.uid,
        month: selectedMonth,
        dailyRequirements: [],
        notes: ''
      });
      setNotes('');
      setHasUnsavedChanges(false);
      alert('テンプレートを削除しました');
    }
  };

  // Get statistics
  const stats = currentUser?.uid
    ? LocalStaffingTemplateService.getStats(currentUser.uid)
    : { totalTemplates: 0, totalDaysWithRequirements: 0, averageRequiredStaff: 0 };

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="人員テンプレート管理" />

        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Header Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">人員テンプレート設定</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    日付をクリックして必要人数を設定してください
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Month selector */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Action buttons */}
                  <button
                    onClick={handleTemplateSave}
                    disabled={saving || !hasUnsavedChanges}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      hasUnsavedChanges
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? '保存中...' : hasUnsavedChanges ? '保存' : '保存済み'}
                  </button>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900">新しい人員テンプレートについて</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    シンプルなカレンダー形式で、特定の日に必要な人数を設定できます。
                    設定した人数は、シフト作成時に人数不足の警告として活用されます。
                  </p>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">テンプレート数</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalTemplates}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <Calendar className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">設定済み日数</p>
                    <p className="text-xl font-bold text-gray-900">{stats.totalDaysWithRequirements}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">平均必要人数</p>
                    <p className="text-xl font-bold text-gray-900">{stats.averageRequiredStaff}人</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            {template && (
              <CalendarGrid
                month={selectedMonth}
                dailyRequirements={template.dailyRequirements}
                onDateClick={handleDateClick}
              />
            )}

            {/* Notes Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ・備考</h2>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="特別な配慮事項や注意点があればここに記入してください..."
                className="w-full h-24 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Management Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">データ管理</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  エクスポート
                </button>

                <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                  <Upload className="h-4 w-4" />
                  インポート
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleClearMonth}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  この月をクリア
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Staff Requirement Modal */}
        <StaffRequirementModal
          isOpen={showModal}
          selectedDate={selectedDate}
          currentRequirement={currentRequirement}
          onClose={() => setShowModal(false)}
          onSave={handleStaffRequirementSave}
        />
      </div>
    </ProtectedRoute>
  );
}