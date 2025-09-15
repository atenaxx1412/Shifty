'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-indigo-600">
            <span className="text-white text-3xl font-bold">S</span>
          </div>
          <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900">
            Shifty
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            シフト管理システムへようこそ
          </p>
        </div>

        <div className="bg-white shadow-xl rounded-lg p-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">ログイン</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center space-x-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span>ログイン成功！リダイレクトしています...</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                ユーザーID
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('userId')}
                  type="text"
                  autoComplete="username"
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ユーザーIDを入力"
                />
              </div>
              {errors.userId && (
                <p className="mt-1 text-sm text-red-600">{errors.userId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  ログイン状態を保持
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || success}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {success ? 'リダイレクト中...' : loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  テスト用アカウント
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>管理者: root / demo123</p>
              <p>店長: manager / demo123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}