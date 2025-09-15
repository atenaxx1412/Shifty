'use client';

import { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Minus,
  Wand2,
  Save,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftService } from '@/lib/shiftService';
import { User, ShiftGenerationRequirements } from '@/types';

interface ShiftCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (shiftId: string) => void;
  currentUser: User;
  initialDate?: Date;
}

interface ShiftSlotInput {
  startTime: string;
  endTime: string;
  requiredStaff: number;
  assignedStaff: string[];
  requiredSkills: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export default function ShiftCreateModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentUser,
  initialDate 
}: ShiftCreateModalProps) {
  const [step, setStep] = useState<'basic' | 'slots' | 'assign' | 'confirm'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useAI, setUseAI] = useState(false);

  // 基本情報
  const [shiftDate, setShiftDate] = useState(
    initialDate ? format(initialDate, 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );

  // スロット情報
  const [slots, setSlots] = useState<ShiftSlotInput[]>([
    {
      startTime: '09:00',
      endTime: '15:00', 
      requiredStaff: 2,
      assignedStaff: [],
      requiredSkills: [],
      priority: 'medium'
    }
  ]);

  // AI生成設定
  const [aiSettings, setAiSettings] = useState<ShiftGenerationRequirements>({
    businessHours: { start: '09:00', end: '21:00' },
    slotDuration: 360, // 6時間
    minimumStaffPerSlot: 2,
    maximumStaffPerSlot: 5,
    requiredSkills: [],
    optimizationStrategy: 'balanced'
  });

  // サンプルスタッフデータ
  const availableStaff: User[] = [
    {
      uid: 'staff1',
      email: 'yamada@example.com', 
      name: '山田太郎',
      role: 'staff',
      shopId: currentUser?.shopId || 'demo-shop-001',
      skills: ['レジ', '接客'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      uid: 'staff2',
      email: 'sato@example.com',
      name: '佐藤花子', 
      role: 'staff',
      shopId: currentUser?.shopId || 'demo-shop-001',
      skills: ['フロア', '清掃'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      uid: 'staff3',
      email: 'tanaka@example.com',
      name: '田中次郎',
      role: 'staff', 
      shopId: currentUser?.shopId || 'demo-shop-001',
      skills: ['キッチン', '調理'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const availableSkills = ['レジ', '接客', 'フロア', '清掃', 'キッチン', '調理', '品出し', '商品知識'];

  if (!isOpen) return null;

  // スロット追加
  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    const newStartTime = lastSlot ? lastSlot.endTime : '09:00';
    const newEndTime = addHours(newStartTime, 6);

    setSlots([...slots, {
      startTime: newStartTime,
      endTime: newEndTime,
      requiredStaff: 2,
      assignedStaff: [],
      requiredSkills: [],
      priority: 'medium'
    }]);
  };

  // スロット削除  
  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  // スロット更新
  const updateSlot = (index: number, field: keyof ShiftSlotInput, value: any) => {
    const updatedSlots = slots.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    );
    setSlots(updatedSlots);
  };

  // スタッフをスロットに追加
  const toggleStaffInSlot = (slotIndex: number, staffId: string) => {
    const slot = slots[slotIndex];
    const isAssigned = slot.assignedStaff.includes(staffId);
    
    const updatedStaff = isAssigned 
      ? slot.assignedStaff.filter(id => id !== staffId)
      : [...slot.assignedStaff, staffId];
    
    updateSlot(slotIndex, 'assignedStaff', updatedStaff);
  };

  // 時間を追加するヘルパー関数
  const addHours = (time: string, hours: number): string => {
    const [h, m] = time.split(':').map(Number);
    const newHour = (h + hours) % 24;
    return `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // AI生成を実行
  const handleAIGeneration = async () => {
    setIsSubmitting(true);
    try {
      console.log('🤖 Generating shift with AI...');
      
      const generatedShift = await shiftService.generateOptimalShift(
        currentUser?.shopId || 'demo-shop-001',
        new Date(shiftDate),
        aiSettings,
        currentUser
      );
      
      console.log('✅ AI generation successful:', generatedShift.shiftId);
      onSuccess(generatedShift.shiftId);
      handleClose();
      
    } catch (error) {
      console.error('❌ AI generation failed:', error);
      alert('AI生成に失敗しました。手動で作成してください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 手動シフト作成
  const handleManualCreate = async () => {
    setIsSubmitting(true);
    try {
      console.log('📝 Creating manual shift...');
      
      // ShiftSlotに変換
      const shiftSlots = slots.map((slot, index) => ({
        slotId: `slot_${Date.now()}_${index}`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        requiredStaff: slot.requiredStaff,
        assignedStaff: slot.assignedStaff,
        requiredSkills: slot.requiredSkills,
        priority: slot.priority,
        estimatedDuration: calculateDuration(slot.startTime, slot.endTime)
      }));

      const shiftData = {
        shopId: currentUser?.shopId || 'demo-shop-001',
        date: new Date(shiftDate),
        slots: shiftSlots,
      };

      const createdShift = await shiftService.createShift(shiftData, currentUser);
      
      console.log('✅ Manual creation successful:', createdShift.shiftId);
      onSuccess(createdShift.shiftId);
      handleClose();
      
    } catch (error) {
      console.error('❌ Manual creation failed:', error);  
      alert('シフトの作成に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 時間差を計算
  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH - startH) * 60 + (endM - startM);
  };

  // モーダルを閉じる
  const handleClose = () => {
    setStep('basic');
    setIsSubmitting(false);
    onClose();
  };

  // スタッフ名を取得
  const getStaffName = (staffId: string) => {
    return availableStaff.find(s => s.uid === staffId)?.name || staffId;
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/80 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">新規シフト作成</h2>
            <p className="text-sm text-gray-600 mt-1">
              {format(new Date(shiftDate), 'yyyy年M月d日 (E)', { locale: ja })} のシフト
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            {[
              { key: 'basic', label: '基本設定' },
              { key: 'slots', label: 'スロット設定' },
              { key: 'assign', label: 'スタッフ配置' },
              { key: 'confirm', label: '確認' }
            ].map((s, index) => (
              <div key={s.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s.key 
                    ? 'bg-blue-600 text-white'
                    : index < ['basic', 'slots', 'assign', 'confirm'].indexOf(step)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index < ['basic', 'slots', 'assign', 'confirm'].indexOf(step) ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  step === s.key ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {s.label}
                </span>
                {index < 3 && <div className="w-8 h-0.5 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {step === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  シフト日付
                </label>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">作成方法を選択</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setUseAI(false)}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      !useAI 
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="h-6 w-6" />
                      <div className="text-left">
                        <div className="font-medium">手動作成</div>
                        <div className="text-sm text-gray-600">
                          スロットとスタッフを手動で設定
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setUseAI(true)}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      useAI 
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Wand2 className="h-6 w-6" />
                      <div className="text-left">
                        <div className="font-medium">AI自動生成</div>
                        <div className="text-sm text-gray-600">
                          AIが最適なシフトを自動作成
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {useAI && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-3">AI生成設定</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        営業時間
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={aiSettings.businessHours?.start}
                          onChange={(e) => setAiSettings({
                            ...aiSettings,
                            businessHours: { ...aiSettings.businessHours!, start: e.target.value }
                          })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <span>〜</span>
                        <input
                          type="time"
                          value={aiSettings.businessHours?.end}
                          onChange={(e) => setAiSettings({
                            ...aiSettings,
                            businessHours: { ...aiSettings.businessHours!, end: e.target.value }
                          })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        最適化戦略
                      </label>
                      <select
                        value={aiSettings.optimizationStrategy}
                        onChange={(e) => setAiSettings({
                          ...aiSettings,
                          optimizationStrategy: e.target.value as any
                        })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="balanced">バランス重視</option>
                        <option value="cost">コスト重視</option>
                        <option value="quality">品質重視</option>
                        <option value="fairness">公平性重視</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'slots' && !useAI && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">シフトスロット設定</h3>
                <button
                  onClick={addSlot}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>スロット追加</span>
                </button>
              </div>

              <div className="space-y-3">
                {slots.map((slot, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">スロット {index + 1}</h4>
                      {slots.length > 1 && (
                        <button
                          onClick={() => removeSlot(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          開始時間
                        </label>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          終了時間  
                        </label>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          必要人数
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={slot.requiredStaff}
                          onChange={(e) => updateSlot(index, 'requiredStaff', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          優先度
                        </label>
                        <select
                          value={slot.priority}
                          onChange={(e) => updateSlot(index, 'priority', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="low">低</option>
                          <option value="medium">中</option>
                          <option value="high">高</option>
                          <option value="critical">緊急</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        必要スキル
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableSkills.map((skill) => (
                          <button
                            key={skill}
                            onClick={() => {
                              const skills = slot.requiredSkills.includes(skill)
                                ? slot.requiredSkills.filter(s => s !== skill)
                                : [...slot.requiredSkills, skill];
                              updateSlot(index, 'requiredSkills', skills);
                            }}
                            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                              slot.requiredSkills.includes(skill)
                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'assign' && !useAI && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">スタッフ配置</h3>
              
              <div className="space-y-4">
                {slots.map((slot, slotIndex) => (
                  <div key={slotIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        スロット {slotIndex + 1}: {slot.startTime}-{slot.endTime}
                      </h4>
                      <span className="text-sm text-gray-600">
                        {slot.assignedStaff.length}/{slot.requiredStaff}名
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {availableStaff.map((staff) => (
                        <button
                          key={staff.uid}
                          onClick={() => toggleStaffInSlot(slotIndex, staff.uid)}
                          className={`p-3 border-2 rounded-lg text-left transition-colors ${
                            slot.assignedStaff.includes(staff.uid)
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-medium">{staff.name}</div>
                          <div className="text-sm text-gray-600">
                            {staff.skills?.slice(0, 2).join(', ')}
                          </div>
                        </button>
                      ))}
                    </div>

                    {slot.assignedStaff.length < slot.requiredStaff && (
                      <div className="mt-3 flex items-center space-x-2 text-sm text-yellow-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>あと{slot.requiredStaff - slot.assignedStaff.length}名必要です</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">シフト内容確認</h3>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">日付:</span>
                    <span className="ml-2">{format(new Date(shiftDate), 'yyyy年M月d日 (E)', { locale: ja })}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">スロット数:</span>
                    <span className="ml-2">{useAI ? 'AI生成' : `${slots.length}個`}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">総必要人数:</span>
                    <span className="ml-2">
                      {useAI ? 'AI算出' : `${slots.reduce((sum, slot) => sum + slot.requiredStaff, 0)}名`}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">作成方法:</span>
                    <span className="ml-2">{useAI ? 'AI自動生成' : '手動作成'}</span>
                  </div>
                </div>
              </div>

              {!useAI && (
                <div className="space-y-3">
                  {slots.map((slot, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">スロット {index + 1}</span>
                          <span className="ml-2 text-gray-600">{slot.startTime}-{slot.endTime}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {slot.assignedStaff.length}/{slot.requiredStaff}名
                        </div>
                      </div>
                      {slot.assignedStaff.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                          担当: {slot.assignedStaff.map(getStaffName).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={() => {
              const steps = ['basic', 'slots', 'assign', 'confirm'];
              const currentIndex = steps.indexOf(step);
              if (currentIndex > 0) {
                setStep(steps[currentIndex - 1] as any);
              }
            }}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={step === 'basic'}
          >
            戻る
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>

            {step === 'confirm' ? (
              <button
                onClick={useAI ? handleAIGeneration : handleManualCreate}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>作成中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{useAI ? 'AI生成で作成' : 'シフトを作成'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (useAI && step === 'basic') {
                    setStep('confirm');
                  } else {
                    const steps = ['basic', 'slots', 'assign', 'confirm'];
                    const currentIndex = steps.indexOf(step);
                    if (currentIndex < steps.length - 1) {
                      setStep(steps[currentIndex + 1] as any);
                    }
                  }
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                次へ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}