'use client';

import { format } from "date-fns";
import { User } from "@/types/auth";
import { CalendarViewType } from "@/types/calendar";
import { StaffingTemplateIntegration } from "@/lib/staffingTemplateIntegration";
import { Info, AlertTriangle, Users } from "lucide-react";

interface StaffTimeSettings {
  [staffId: string]: {
    startTime: string;
    endTime: string;
    positions: string;
    notes: string;
  };
}

interface FormData {
  startTime: string;
  endTime: string;
  positions: string;
  notes: string;
}

interface ShiftCreateModalProps {
  showModal: boolean;
  createModalDate: Date | null;
  createModalStaff: User | null;
  calendarView: CalendarViewType;
  staff: User[];
  selectedStaffForCalendar: string[];
  setSelectedStaffForCalendar: (fn: (prev: string[]) => string[]) => void;
  staffTimeSettings: StaffTimeSettings;
  handleStaffTimeChange: (staffId: string, field: string, value: string) => void;
  formData: FormData;
  handleFormChange: (field: string, value: string) => void;
  createLoading: boolean;
  managerId: string; // Added for template integration
  onClose: () => void;
  onSubmit: () => void;
}

export default function ShiftCreateModal({
  showModal,
  createModalDate,
  createModalStaff,
  calendarView,
  staff,
  selectedStaffForCalendar,
  setSelectedStaffForCalendar,
  staffTimeSettings,
  handleStaffTimeChange,
  formData,
  handleFormChange,
  createLoading,
  managerId,
  onClose,
  onSubmit
}: ShiftCreateModalProps) {
  if (!showModal || !createModalDate) return null;

  // Get template shortage information
  const dateString = format(createModalDate, "yyyy-MM-dd");
  const currentStaffCount = createModalStaff ? 1 : selectedStaffForCalendar.length;
  const shortageInfo = StaffingTemplateIntegration.getDateShortageInfo(
    managerId,
    dateString,
    currentStaffCount
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      ></div>

      <div className="relative z-10 bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl max-w-lg w-full max-h-screen overflow-y-auto transform transition-all duration-300 scale-100">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {createModalStaff
                  ? `${createModalStaff.name}さんのシフト設定`
                  : "新規シフト作成"}
              </h3>
              {createModalStaff && (
                <p className="text-sm text-green-600 mt-1 flex items-center">
                  <svg
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  このスタッフに直接反映されます
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 transition-all duration-200"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Form Content */}
          <div className="space-y-6">
            {/* Date Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                日付
              </label>
              <input
                type="date"
                value={format(createModalDate, "yyyy-MM-dd")}
                className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                readOnly
              />
            </div>

            {/* Staff Selection - Available when no specific staff is selected */}
            {!createModalStaff && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  スタッフ選択
                </label>
                <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto bg-white/50">
                  {staff.length > 0 ? (
                    <div className="space-y-2">
                      {staff.map((staffMember) => (
                        <div
                          key={staffMember.uid}
                          className="flex items-center p-2 hover:bg-gray-50 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            id={`staff-${staffMember.uid}`}
                            value={staffMember.uid}
                            checked={selectedStaffForCalendar.includes(staffMember.uid)}
                            onChange={(e) => {
                              e.stopPropagation();
                              const isChecked = e.target.checked;
                              setSelectedStaffForCalendar((prev) => {
                                if (isChecked) {
                                  return [...prev, staffMember.uid];
                                } else {
                                  return prev.filter((id) => id !== staffMember.uid);
                                }
                              });
                            }}
                            className="h-4 w-4 accent-red-500 text-red-600 border-gray-300 rounded checked:bg-red-500 checked:border-red-500 focus:ring-red-500 focus:border-red-500 cursor-pointer"
                          />
                          <label
                            htmlFor={`staff-${staffMember.uid}`}
                            className="ml-3 flex-1 cursor-pointer"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {staffMember.name}
                            </div>
                            {staffMember.skills && staffMember.skills.length > 0 && (
                              <div className="text-xs text-gray-500">
                                {staffMember.skills.slice(0, 2).join(", ")}
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      スタッフが登録されていません
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Template Information */}
            {shortageInfo ? (
              <div className={`p-5 rounded-xl border-2 ${
                shortageInfo.isCritical
                  ? 'bg-red-50 border-red-300'
                  : shortageInfo.isWarning
                  ? 'bg-yellow-50 border-yellow-300'
                  : shortageInfo.shortage === 0
                  ? 'bg-green-50 border-green-300'
                  : 'bg-blue-50 border-blue-300'
              }`}>
                <div className="flex items-start space-x-4">
                  {shortageInfo.isCritical ? (
                    <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  ) : shortageInfo.isWarning ? (
                    <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
                  ) : shortageInfo.shortage === 0 ? (
                    <Users className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  ) : (
                    <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <h4 className={`text-base font-semibold mb-2 ${
                      shortageInfo.isCritical
                        ? 'text-red-900'
                        : shortageInfo.isWarning
                        ? 'text-yellow-900'
                        : shortageInfo.shortage === 0
                        ? 'text-green-900'
                        : 'text-blue-900'
                    }`}>
                      {shortageInfo.isCritical
                        ? '🚨 重要: 深刻な人数不足'
                        : shortageInfo.isWarning
                        ? '⚠️ 注意: 人数不足の可能性'
                        : shortageInfo.shortage === 0
                        ? '✅ 人数設定OK'
                        : '📋 人員テンプレート情報'}
                    </h4>
                    <div className={`space-y-2 text-sm ${
                      shortageInfo.isCritical
                        ? 'text-red-800'
                        : shortageInfo.isWarning
                        ? 'text-yellow-800'
                        : shortageInfo.shortage === 0
                        ? 'text-green-800'
                        : 'text-blue-800'
                    }`}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/50 p-3 rounded-lg">
                          <p className="text-xs font-medium opacity-70 mb-1">必要人数</p>
                          <p className="text-lg font-bold">{shortageInfo.requiredStaff}人</p>
                        </div>
                        <div className="bg-white/50 p-3 rounded-lg">
                          <p className="text-xs font-medium opacity-70 mb-1">選択中</p>
                          <p className="text-lg font-bold">{shortageInfo.assignedStaff}人</p>
                        </div>
                      </div>
                      {shortageInfo.shortage > 0 ? (
                        <div className={`mt-3 p-3 rounded-lg font-medium text-center ${
                          shortageInfo.isCritical
                            ? 'bg-red-100 text-red-900'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}>
                          あと<strong className="text-lg">{shortageInfo.shortage}人</strong>必要です
                        </div>
                      ) : shortageInfo.assignedStaff > shortageInfo.requiredStaff ? (
                        <div className="mt-3 p-3 rounded-lg font-medium text-center bg-blue-100 text-blue-900">
                          予定より<strong className="text-lg">{shortageInfo.assignedStaff - shortageInfo.requiredStaff}人</strong>多く配置されています
                        </div>
                      ) : (
                        <div className="mt-3 p-3 rounded-lg font-medium text-center bg-green-100 text-green-900">
                          ✅ 必要人数に達しています
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">
                      人員テンプレート情報
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      この日にはテンプレートが設定されていません
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      人員テンプレート管理ページで事前に必要人数を設定できます
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Staff Time Settings */}
            {!createModalStaff && selectedStaffForCalendar.length > 0 ? (
              <div className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-blue-700">
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm font-medium">
                      各スタッフごとに個別の時間設定が可能です
                    </p>
                  </div>
                </div>

                {selectedStaffForCalendar.map((staffId) => {
                  const staffMember = staff.find((s) => s.uid === staffId);
                  const staffSetting = staffTimeSettings[staffId] || {
                    startTime: "09:00",
                    endTime: "17:00",
                    positions: "",
                    notes: "",
                  };

                  return (
                    <div
                      key={staffId}
                      className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                    >
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                        {staffMember?.name || "スタッフ"}さんの設定
                      </h4>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            開始時間
                          </label>
                          <input
                            type="time"
                            value={staffSetting.startTime}
                            onChange={(e) =>
                              handleStaffTimeChange(staffId, "startTime", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            終了時間
                          </label>
                          <input
                            type="time"
                            value={staffSetting.endTime}
                            onChange={(e) =>
                              handleStaffTimeChange(staffId, "endTime", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ポジション
                        </label>
                        <input
                          type="text"
                          value={staffSetting.positions}
                          onChange={(e) =>
                            handleStaffTimeChange(staffId, "positions", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                          placeholder="レジ、フロア、キッチンなど（カンマ区切り）"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          備考
                        </label>
                        <textarea
                          rows={2}
                          value={staffSetting.notes}
                          onChange={(e) =>
                            handleStaffTimeChange(staffId, "notes", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                          placeholder="特別な指示があれば入力"
                        ></textarea>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single Time Settings UI */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始時間
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleFormChange("startTime", e.target.value)}
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
                      onChange={(e) => handleFormChange("endTime", e.target.value)}
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
                    onChange={(e) => handleFormChange("positions", e.target.value)}
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
                    onChange={(e) => handleFormChange("notes", e.target.value)}
                    className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                    placeholder="特別な指示があれば入力"
                  ></textarea>
                </div>
              </div>
            )}

            {/* Footer Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={onSubmit}
                disabled={createLoading}
                className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createLoading
                  ? (() => {
                      if (createModalStaff) {
                        return `${createModalStaff.name}さんに設定中...`;
                      } else if (
                        !createModalStaff &&
                        selectedStaffForCalendar.length > 0
                      ) {
                        return `${selectedStaffForCalendar.length}名に設定中...`;
                      }
                      return "作成中...";
                    })()
                  : (() => {
                      if (createModalStaff) {
                        return `${createModalStaff.name}さんのシフト設定`;
                      } else if (
                        !createModalStaff &&
                        selectedStaffForCalendar.length > 0
                      ) {
                        return `${selectedStaffForCalendar.length}名のシフト設定`;
                      }
                      return "作成";
                    })()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}