'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

const loginSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationStep(1), 200),  // 横線表示
      setTimeout(() => setAnimationStep(2), 600),  // 横に伸ばす
      setTimeout(() => setAnimationStep(3), 1000), // 縦に伸ばす（長方形）
      setTimeout(() => setAnimationStep(4), 1400), // コンテンツ表示
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await signIn(data.userId, data.password);
      setSuccess(true);
      // AuthContext handles role-based redirect with delay
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error && 'code' in error
        ? (() => {
            switch ((error as { code: string }).code) {
              case 'auth/user-not-found':
                return 'ユーザーが見つかりません';
              case 'auth/wrong-password':
                return 'パスワードが間違っています';
              case 'auth/invalid-email':
                return '無効なユーザーIDです';
              default:
                return 'ログインに失敗しました';
            }
          })()
        : 'ログインに失敗しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`h-screen overflow-hidden flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 ${success ? 'animate-page-exit' : ''}`}
      style={{
        height: '100dvh',
        touchAction: 'none',
        position: 'fixed',
        width: '100%',
        top: 0,
        left: 0
      }}
    >
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <div className="animate-spin-slow">
              <Image
                src="/images/logo-only-transparent.png"
                alt="Shifty"
                width={180}
                height={180}
                className="h-auto max-w-full transition-all duration-700 ease-in-out"
                priority
                quality={85}
                sizes="(max-width: 768px) 150px, 180px"
              />
            </div>
          </div>
        </div>

        <div 
          className="bg-white shadow-lg border border-gray-200 transition-all duration-400 ease-in-out overflow-hidden flex items-center justify-center"
          style={{
            transformOrigin: 'center',
            opacity: animationStep === 0 ? 0 : 1,
            width: animationStep === 0 ? '0px' : 
                   animationStep === 1 ? '40px' : '100%',
            height: animationStep === 0 ? '0px' :
                    animationStep === 1 ? '3px' :
                    animationStep === 2 ? '3px' :
                    animationStep === 3 ? '200px' : 'auto',
            borderRadius: animationStep === 0 ? '0px' :
                         animationStep === 1 ? '1.5px' :
                         animationStep === 2 ? '0px' :
                         animationStep === 3 ? '8px' : '8px',
            padding: animationStep === 4 ? '24px' : '0px',
            display: animationStep === 4 ? 'block' : 'flex'
          }}
        >
          {animationStep === 4 && (
            <div className="w-full">
              <h2 className="mb-6 text-lg font-semibold text-gray-900 text-center">ログイン</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center space-x-3 text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center space-x-3 text-green-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">リダイレクト中...</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                ユーザーID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('userId')}
                  type="text"
                  autoComplete="username"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-200"
                  placeholder="ユーザーIDを入力"
                />
              </div>
              {errors.userId && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.userId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.password.message}</p>
              )}
            </div>


            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || success}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl 
                         text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-600 
                         hover:from-orange-600 hover:to-amber-700 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-orange-400 disabled:opacity-50 
                         disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {success ? 'リダイレクト中...' : loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </div>
          </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}