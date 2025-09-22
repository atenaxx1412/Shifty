'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerData } from '@/hooks/useManagerData';
import { ShiftExtended, ShiftTimeSlot } from '@/types/shift';
import { User } from '@/types/auth';

export function useShiftData() {
  const { currentUser } = useAuth();
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Manager data from existing hook
  const { staff: managerStaff, shifts: managerShifts, loading: managerLoading } = useManagerData(currentUser?.uid);

  useEffect(() => {
    if (!managerLoading) {
      setStaff(managerStaff || []);
      setShifts(managerShifts || []);
      setLoading(false);
    }
  }, [managerStaff, managerShifts, managerLoading]);

  const handleSaveShiftSlot = async (
    shiftId: string,
    slotId: string,
    newSlot: ShiftTimeSlot,
    selectedStaffIds: string[]
  ) => {
    try {
      const shiftIndex = shifts.findIndex(s => s.id === shiftId);
      if (shiftIndex === -1) return;

      const updatedShifts = [...shifts];
      const shift = updatedShifts[shiftIndex];

      const slotIndex = shift.timeSlots.findIndex(slot => slot.id === slotId);
      if (slotIndex === -1) return;

      // Update the time slot
      shift.timeSlots[slotIndex] = {
        ...newSlot,
        assignedStaffIds: selectedStaffIds
      };

      // Save to Firebase
      if (currentUser?.managerId) {
        await setDoc(doc(db, "users", currentUser.managerId, "shifts", shiftId), shift);
      }

      setShifts(updatedShifts);
    } catch (error) {
      console.error("Error saving shift slot:", error);
      throw error;
    }
  };

  const handleDeleteShiftSlot = async (slotId: string) => {
    try {
      const updatedShifts = shifts.map(shift => ({
        ...shift,
        timeSlots: shift.timeSlots.filter(slot => slot.id !== slotId)
      }));

      // Save updated shifts to Firebase
      for (const shift of updatedShifts) {
        if (shift.timeSlots.length === 0) {
          // If no time slots remain, you might want to delete the entire shift
          continue;
        }
        if (currentUser?.managerId) {
          await setDoc(doc(db, "users", currentUser.managerId, "shifts", shift.id), shift);
        }
      }

      setShifts(updatedShifts);
    } catch (error) {
      console.error("Error deleting shift slot:", error);
      throw error;
    }
  };

  const createSampleStaffData = async () => {
    if (!currentUser?.uid) return;

    const sampleStaffData = {
      uid: `staff_${Date.now()}`,
      email: `staff${Date.now()}@example.com`,
      name: `サンプルスタッフ${staff.length + 1}`,
      role: "staff" as const,
      managerId: currentUser.uid,
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true,
    };

    try {
      await setDoc(doc(db, "users", sampleStaffData.uid), sampleStaffData);
      setStaff(prev => [...prev, sampleStaffData]);
    } catch (error) {
      console.error("Error creating sample staff:", error);
      throw error;
    }
  };

  return {
    shifts,
    staff,
    loading,
    setShifts,
    setStaff,
    handleSaveShiftSlot,
    handleDeleteShiftSlot,
    createSampleStaffData
  };
}