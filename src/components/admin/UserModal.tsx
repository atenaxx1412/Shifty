'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { logUserAction, logDataChange } from '@/lib/auditLogger';
import { 
  X, 
  Save, 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Building,
  Clock,
  Banknote,
  Star,
  AlertCircle
} from 'lucide-react';

const userSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  role: z.enum(['manager', 'staff'] as const, {
    errorMap: () => ({ message: '役割を選択してください' })
  }),
  shopId: z.string().optional(),
  employmentType: z.string().optional(),
  skills: z.array(z.string()).optional(),
  hourlyRate: z.number().optional(),
  maxHoursPerWeek: z.number().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserWithId {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  shopId?: string;
  employmentType?: string;
  skills?: string[];
  hourlyRate?: number;
  maxHoursPerWeek?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  user?: UserWithId | null;
  mode: 'add' | 'edit';
}

export default function UserModal({ isOpen, onClose, onSave, user, mode }: UserModalProps) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [availableSkills] = useState([
    'レジ操作', 'キッチン', '接客', '清掃', '在庫管理', 
    'シフト管理', '新人研修', '売上分析', 'POS操作', '電話対応'
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'staff',
      shopId: '',
      employmentType: 'part-time',
      skills: [],
      hourlyRate: 1000,
      maxHoursPerWeek: 20
    }
  });

  const watchedRole = watch('role');
  const watchedSkills = watch('skills') || [];

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && user) {
        reset({
          name: user.name,
          email: user.email,
          password: '', // Don't pre-fill password for security
          role: user.role as 'manager' | 'staff',
          shopId: user.shopId || '',
          employmentType: user.employmentType || 'part-time',
          skills: user.skills || [],
          hourlyRate: user.hourlyRate || 1000,
          maxHoursPerWeek: user.maxHoursPerWeek || 20
        });
      } else {
        reset({
          name: '',
          email: '',
          password: '',
          role: 'staff',
          shopId: '',
          employmentType: 'part-time',
          skills: [],
          hourlyRate: 1000,
          maxHoursPerWeek: 20
        });
      }
      setError('');
    }
  }, [isOpen, mode, user, reset]);

  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const onSubmit = async (data: UserFormData) => {
    setLoading(true);
    setError('');

    try {
      if (mode === 'add') {
        // Check if email already exists
        const existingUserQuery = query(
          collection(db, 'login'),
          where('email', '==', data.email)
        );
        const existingUserSnapshot = await getDocs(existingUserQuery);
        
        if (!existingUserSnapshot.empty) {
          setError('このメールアドレスは既に使用されています');
          setLoading(false);
          return;
        }

        const userId = generateUserId();
        const now = new Date();

        // Create user document
        await addDoc(collection(db, 'users'), {
          uid: userId,
          name: data.name,
          email: data.email,
          role: data.role,
          shopId: data.shopId || null,
          employmentType: data.employmentType || 'part-time',
          skills: data.skills || [],
          hourlyRate: data.hourlyRate || null,
          maxHoursPerWeek: data.maxHoursPerWeek || null,
          availability: {},
          createdAt: now,
          updatedAt: now,
        });

        // Create login document
        await addDoc(collection(db, 'login'), {
          uid: userId,
          email: data.email,
          password: data.password,
        });

        // Log user creation
        if (currentUser) {
          await logUserAction(
            'User Created',
            currentUser.uid,
            currentUser.name,
            currentUser.role,
            userId,
            data.name,
            {
              email: data.email,
              role: data.role,
              shopId: data.shopId,
              employmentType: data.employmentType,
            }
          );
          
          await logDataChange(
            'User Added to Database',
            currentUser.uid,
            currentUser.name,
            currentUser.role,
            `user:${userId}`,
            { action: 'create', targetUser: data.name }
          );
        }

      } else if (mode === 'edit' && user) {
        const now = new Date();
        
        // Update user document
        await updateDoc(doc(db, 'users', user.id), {
          name: data.name,
          email: data.email,
          role: data.role,
          shopId: data.shopId || null,
          employmentType: data.employmentType,
          skills: data.skills,
          hourlyRate: data.hourlyRate,
          maxHoursPerWeek: data.maxHoursPerWeek,
          updatedAt: now,
        });

        // Update login document if password is provided
        if (data.password) {
          const loginQuery = query(
            collection(db, 'login'),
            where('uid', '==', user.uid)
          );
          const loginSnapshot = await getDocs(loginQuery);
          
          if (!loginSnapshot.empty) {
            const loginDoc = loginSnapshot.docs[0];
            await updateDoc(doc(db, 'login', loginDoc.id), {
              email: data.email,
              password: data.password,
            });
          }
        } else {
          // Update only email in login document
          const loginQuery = query(
            collection(db, 'login'),
            where('uid', '==', user.uid)
          );
          const loginSnapshot = await getDocs(loginQuery);
          
          if (!loginSnapshot.empty) {
            const loginDoc = loginSnapshot.docs[0];
            await updateDoc(doc(db, 'login', loginDoc.id), {
              email: data.email,
            });
          }
        }

        // Log user update
        if (currentUser) {
          await logUserAction(
            'User Updated',
            currentUser.uid,
            currentUser.name,
            currentUser.role,
            user.uid,
            data.name,
            {
              email: data.email,
              role: data.role,
              shopId: data.shopId,
              employmentType: data.employmentType,
              passwordChanged: !!data.password,
            }
          );
          
          await logDataChange(
            'User Modified in Database',
            currentUser.uid,
            currentUser.name,
            currentUser.role,
            `user:${user.uid}`,
            { action: 'update', targetUser: data.name }
          );
        }
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
      setError('ユーザーの保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSkillToggle = (skill: string) => {
    const currentSkills = watchedSkills;
    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter(s => s !== skill)
      : [...currentSkills, skill];
    setValue('skills', newSkills);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-white/30 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {mode === 'add' ? '新規ユーザー追加' : 'ユーザー編集'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1 mb-0.5" />
                名前
              </label>
              <input
                {...register('name')}
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="田中太郎"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Mail className="inline h-4 w-4 mr-1 mb-0.5" />
                メールアドレス
              </label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tanaka@shifty.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Lock className="inline h-4 w-4 mr-1 mb-0.5" />
                パスワード {mode === 'edit' && <span className="text-gray-500 text-xs">(変更する場合のみ入力)</span>}
              </label>
              <input
                {...register('password')}
                type="password"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Shield className="inline h-4 w-4 mr-1 mb-0.5" />
                役割
              </label>
              <select
                {...register('role')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="staff">スタッフ</option>
                <option value="manager">店長</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Building className="inline h-4 w-4 mr-1 mb-0.5" />
                店舗ID
              </label>
              <input
                {...register('shopId')}
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="shop001"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1 mb-0.5" />
                雇用形態
              </label>
              <select
                {...register('employmentType')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="part-time">アルバイト</option>
                <option value="full-time">正社員</option>
                <option value="contract">契約社員</option>
              </select>
            </div>
          </div>

          {/* Staff-specific fields */}
          {watchedRole === 'staff' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Banknote className="inline h-4 w-4 mr-1 mb-0.5" />
                    時給（円）
                  </label>
                  <input
                    {...register('hourlyRate', { valueAsNumber: true })}
                    type="number"
                    min="800"
                    max="3000"
                    step="50"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="inline h-4 w-4 mr-1 mb-0.5" />
                    週最大勤務時間
                  </label>
                  <input
                    {...register('maxHoursPerWeek', { valueAsNumber: true })}
                    type="number"
                    min="1"
                    max="40"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <Star className="inline h-4 w-4 mr-1 mb-0.5" />
                  スキル・資格
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleSkillToggle(skill)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        watchedSkills.includes(skill)
                          ? 'bg-blue-100/80 backdrop-blur-sm text-blue-800 border-2 border-blue-300/50 shadow-sm'
                          : 'bg-white/50 backdrop-blur-sm text-gray-700 border-2 border-transparent hover:bg-white/70 hover:shadow-sm'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {mode === 'add' ? '追加' : '更新'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}