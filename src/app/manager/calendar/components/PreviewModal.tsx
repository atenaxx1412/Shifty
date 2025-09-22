'use client';

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ShiftExtended, User, ShiftSlot } from "@/types";

interface PreviewModalProps {
  showModal: boolean;
  onClose: () => void;
  selectedDate: Date;
  staff: User[];
  shifts: ShiftExtended[];
  monthDates: Date[];
  getStaffShiftsForDate: (date: Date) => Map<string, Array<{shift: ShiftExtended; slot: ShiftSlot;}>>;
}

export default function PreviewModal({
  showModal,
  onClose,
  selectedDate,
  staff,
  shifts,
  monthDates,
  getStaffShiftsForDate
}: PreviewModalProps) {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-lg border border-white/20 shadow-2xl rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">シフト表プレビュー</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600">
            {format(selectedDate, "yyyy年M月", { locale: ja })}
            のシフト表
          </p>
          <p className="text-sm text-gray-500">
            スタッフ{staff.length}名 • シフト{shifts.length}件
          </p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="min-w-full border border-gray-200 print:w-full print:text-sm">
            <thead>
              <tr className="bg-gray-50 print:bg-gray-100">
                <th className="border border-gray-200 px-2 py-2 text-center w-20 print:px-1 print:py-1">
                  日付
                </th>
                {staff.map((staffMember) => (
                  <th
                    key={staffMember.uid}
                    className="border border-gray-200 px-4 py-2 text-center print:px-2 print:py-1 print:text-xs"
                  >
                    {staffMember.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthDates.map((date, index) => {
                const staffShifts = getStaffShiftsForDate(date);
                const dayOfWeek = format(date, "E", { locale: ja });

                return (
                  <tr
                    key={index}
                    className={
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }
                  >
                    <td className="border border-gray-200 px-2 py-2 text-center w-20 print:px-1 print:py-1">
                      <div className="print:text-xs">{format(date, "M/d")}</div>
                      <div className="text-xs text-gray-500 print:text-[10px]">
                        ({dayOfWeek})
                      </div>
                    </td>
                    {staff.map((staffMember) => {
                      const myShifts =
                        staffShifts.get(staffMember.uid) || [];
                      return (
                        <td
                          key={staffMember.uid}
                          className="border border-gray-200 px-4 py-2 text-center print:px-2 print:py-1"
                        >
                          <div className="text-sm print:text-xs">
                            {myShifts.length > 0
                              ? myShifts
                                  .map(
                                    ({ slot }) =>
                                      `${slot.startTime}-${slot.endTime}`
                                  )
                                  .join(", ")
                              : "-"}
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
      </div>
    </div>
  );
}