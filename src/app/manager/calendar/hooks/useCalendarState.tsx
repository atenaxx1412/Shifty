'use client';

import { useState } from 'react';
import { CalendarViewType, LayoutMode } from '@/types/calendar';
import { User } from '@/types/auth';

export function useCalendarState() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarViewType>("month");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("standard");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);
  const [createModalStaff, setCreateModalStaff] = useState<User | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Staff selection state
  const [selectedStaffForCalendar, setSelectedStaffForCalendar] = useState<string[]>([]);

  // Staff time settings
  const [staffTimeSettings, setStaffTimeSettings] = useState<{
    [staffId: string]: {
      defaultStartTime: string;
      defaultEndTime: string;
      preferredShifts: string[];
    };
  }>({});

  // Form data
  const [formData, setFormData] = useState({
    startTime: "09:00",
    endTime: "17:00",
    breakTime: 60,
    position: "一般",
    notes: "",
  });

  const [createLoading, setCreateLoading] = useState(false);

  // Shift detail modal
  const [shiftDetailModalOpen, setShiftDetailModalOpen] = useState(false);
  const [selectedShiftSlot, setSelectedShiftSlot] = useState<any>(null);

  // Chat states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState<{
    uid: string;
    name: string;
  } | null>(null);
  const [chatRelatedShift, setChatRelatedShift] = useState<string | null>(null);

  // Modal controls
  const handleCreateShift = (date?: Date, staffMember?: User) => {
    setCreateModalDate(date || selectedDate);
    setCreateModalStaff(staffMember || null);
    setShowCreateModal(true);
    setFormData({
      startTime: staffMember && staffTimeSettings[staffMember.uid]
        ? staffTimeSettings[staffMember.uid].defaultStartTime
        : "09:00",
      endTime: staffMember && staffTimeSettings[staffMember.uid]
        ? staffTimeSettings[staffMember.uid].defaultEndTime
        : "17:00",
      breakTime: 60,
      position: "一般",
      notes: "",
    });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateModalDate(null);
    setCreateModalStaff(null);
    setSelectedStaffForCalendar([]);
    setFormData({
      startTime: "09:00",
      endTime: "17:00",
      breakTime: 60,
      position: "一般",
      notes: "",
    });
  };

  const handleExportShift = () => {
    setShowExportModal(true);
  };

  const closeExportModal = () => {
    setShowExportModal(false);
  };

  const handleShowPreview = () => {
    setShowPreviewModal(true);
  };

  const handleFormChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStaffTimeChange = (
    staffId: string,
    field: "defaultStartTime" | "defaultEndTime",
    value: string
  ) => {
    setStaffTimeSettings(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: value,
        preferredShifts: prev[staffId]?.preferredShifts || []
      }
    }));
  };

  // Chat controls
  const handleOpenStaffChat = (
    staffMember: User,
    relatedShiftId?: string
  ) => {
    setChatTargetUser({
      uid: staffMember.uid,
      name: staffMember.name,
    });
    setChatRelatedShift(relatedShiftId || null);
    setChatOpen(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setChatTargetUser(null);
    setChatRelatedShift(null);
  };

  // Shift detail controls
  const handleOpenShiftDetail = (
    shift: any,
    slot: any,
    date: Date
  ) => {
    setSelectedShiftSlot({
      shift,
      slot,
      date,
    });
    setShiftDetailModalOpen(true);
  };

  const handleCloseShiftDetail = () => {
    setShiftDetailModalOpen(false);
    setSelectedShiftSlot(null);
  };

  return {
    // Date and view states
    selectedDate,
    setSelectedDate,
    calendarView,
    setCalendarView,
    layoutMode,
    setLayoutMode,

    // Modal states
    showCreateModal,
    createModalDate,
    createModalStaff,
    showExportModal,
    showPreviewModal,
    setShowPreviewModal,

    // Staff selection
    selectedStaffForCalendar,
    setSelectedStaffForCalendar,
    staffTimeSettings,

    // Form data
    formData,
    createLoading,
    setCreateLoading,

    // Shift detail
    shiftDetailModalOpen,
    selectedShiftSlot,

    // Chat states
    chatOpen,
    chatTargetUser,
    chatRelatedShift,

    // Action handlers
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
  };
}