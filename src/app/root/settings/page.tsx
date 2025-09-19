'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { SettingsService, SystemSettings, defaultSettings } from '@/lib/settingsService';
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Palette,
  Clock,
  Database,
  Mail,
  Smartphone,
  Lock,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader,
  ChevronDown
} from 'lucide-react';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const [activeTab, setActiveTab] = useState('system');
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const tabs = [
    { id: 'system', label: 'システム設定', icon: Settings },
    { id: 'security', label: 'セキュリティ', icon: Shield },
    { id: 'notifications', label: '通知設定', icon: Bell },
    { id: 'appearance', label: '表示設定', icon: Palette }
  ];

  // ローカルストレージキーの定義
  const SETTINGS_CACHE_KEY = 'system_settings_cache';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間

  // 設定を読み込み（ローカルストレージ優先）
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // ローカルストレージから設定を確認
        const cachedData = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            const cacheAge = Date.now() - parsedData.timestamp;

            // キャッシュが有効期限内の場合は使用
            if (cacheAge < CACHE_DURATION) {
              console.log('📋 Using cached settings from localStorage');
              setSettings(parsedData.settings);
              setOriginalSettings(JSON.parse(JSON.stringify(parsedData.settings)));
              setLoading(false);
              return;
            } else {
              console.log('🗑️ Cached settings expired, fetching fresh data');
              localStorage.removeItem(SETTINGS_CACHE_KEY);
            }
          } catch (parseError) {
            console.warn('Failed to parse cached settings:', parseError);
            localStorage.removeItem(SETTINGS_CACHE_KEY);
          }
        }

        // キャッシュがない場合はFirebaseから取得
        console.log('🔄 Fetching settings from Firebase');
        const loadedSettings = await SettingsService.getSystemSettings();
        setSettings(loadedSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));

        // ローカルストレージに保存
        const cacheData = {
          settings: loadedSettings,
          timestamp: Date.now()
        };
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cacheData));
        console.log('💾 Settings cached to localStorage');

      } catch (error) {
        console.error('Error loading settings:', error);
        showError('設定読み込みエラー', '設定の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [showError]);

  // 変更検知
  useEffect(() => {
    const hasSettingsChanged = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(hasSettingsChanged);
  }, [settings, originalSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setValidationErrors([]);

      // バリデーション
      const validation = SettingsService.validateSettings(settings);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        showError('設定エラー', '入力内容に問題があります');
        return;
      }

      // Firebaseに設定を保存（イベント書き込み）
      console.log('🔥 Saving settings to Firebase');
      await SettingsService.saveSystemSettings(settings);

      // ローカルストレージキャッシュを更新
      const cacheData = {
        settings: settings,
        timestamp: Date.now()
      };
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cacheData));
      console.log('💾 Settings cache updated in localStorage');

      // ローカルバックアップ（既存の機能）
      SettingsService.backupToLocalStorage(settings);

      // 元の設定を更新
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      setHasChanges(false);

      showSuccess('設定保存完了', '設定が正常に保存されました');
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('保存エラー', '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    setValidationErrors([]);
    showInfo('設定リセット', '変更を破棄しました');
  };

  const renderSystemSettings = () => (
    <div className="space-y-4 lg:space-y-6">
      {/* Maintenance Mode - Critical Section */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 lg:space-x-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm lg:text-base">メンテナンスモード</h3>
              <p className="text-xs lg:text-sm text-gray-600">システム全体を一時的に停止します</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.system.maintenanceMode}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                system: { ...prev.system, maintenanceMode: e.target.checked }
              }))}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Auto Backup Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">自動バックアップ</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">自動バックアップを有効にする</span>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={settings.system.autoBackup}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  system: { ...prev.system, autoBackup: e.target.checked }
                }))}
              />
            </label>
            <div>
              <label className="block text-sm text-gray-700 mb-2">バックアップ頻度</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={settings.system.backupFrequency}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  system: { ...prev.system, backupFrequency: e.target.value as 'hourly' | 'daily' | 'weekly' }
                }))}
              >
                <option value="hourly">毎時間</option>
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Timezone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">システムタイムゾーン</h3>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">タイムゾーン</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              value={settings.system.systemTimezone}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                system: { ...prev.system, systemTimezone: e.target.value }
              }))}
            >
              <option value="Asia/Tokyo">アジア/東京</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">アメリカ/ニューヨーク</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Shield className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">認証設定</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">2段階認証を有効にする</span>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={settings.security.twoFactorAuth}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, twoFactorAuth: e.target.checked }
                }))}
              />
            </label>
            <div>
              <label className="block text-sm text-gray-700 mb-2">セッションタイムアウト（分）</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.security.sessionTimeout}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
                }))}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Lock className="h-4 w-4 lg:h-5 lg:w-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">パスワードポリシー</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">パスワード有効期限（日）</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.security.passwordExpiry}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, passwordExpiry: parseInt(e.target.value) }
                }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">最大ログイン試行回数</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.security.loginAttempts}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, loginAttempts: parseInt(e.target.value) }
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Mail className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">メール通知</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">メール通知を有効にする</span>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={settings.notifications.emailNotifications}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, emailNotifications: e.target.checked }
                }))}
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">システムアラート</span>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={settings.notifications.systemAlerts}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, systemAlerts: e.target.checked }
                }))}
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <Smartphone className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">プッシュ通知</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">プッシュ通知を有効にする</span>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={settings.notifications.pushNotifications}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, pushNotifications: e.target.checked }
                }))}
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700">ユーザー活動通知</span>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={settings.notifications.userActivity}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, userActivity: e.target.checked }
                }))}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Palette className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">テーマ設定</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">テーマ</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.appearance.theme}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  appearance: { ...prev.appearance, theme: e.target.value }
                }))}
              >
                <option value="light">ライト</option>
                <option value="dark">ダーク</option>
                <option value="auto">自動</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">言語</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.appearance.language}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  appearance: { ...prev.appearance, language: e.target.value }
                }))}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center space-x-3 mb-3 lg:mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Globe className="h-4 w-4 lg:h-5 lg:w-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm lg:text-base">地域設定</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">日付形式</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.appearance.dateFormat}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  appearance: { ...prev.appearance, dateFormat: e.target.value }
                }))}
              >
                <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">通貨</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={settings.appearance.currency}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  appearance: { ...prev.appearance, currency: e.target.value }
                }))}
              >
                <option value="JPY">JPY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root']}>
        <div className="min-h-screen bg-gray-50">
          <AppHeader title="システム設定" />
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center space-y-4">
                  <Loader className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-gray-600">設定を読み込み中...</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="システム設定" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto space-y-4">
            
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Settings className="h-6 w-6 text-gray-700" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">システム設定</h1>
                    <p className="text-sm text-gray-500 hidden sm:block">
                      システム全体の設定管理・セキュリティ・通知設定
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {hasChanges && (
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium sm:px-4"
                    >
                      <RefreshCw className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">リセット</span>
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`inline-flex items-center px-3 py-2 sm:px-6 sm:py-3 rounded-lg transition-all duration-200 shadow-sm font-semibold ${
                      hasChanges && !saving
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader className="h-4 w-4 sm:mr-2 animate-spin" />
                        <span className="hidden sm:inline">保存中...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">設定を保存</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">設定に問題があります</h3>
                      <ul className="mt-2 text-sm text-red-700">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="mt-1">• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Navigation Dropdown */}
            <div className="lg:hidden">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
                <div className="relative">
                  <select
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
                  >
                    {tabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Desktop Navigation Tabs */}
              <div className="hidden lg:block lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <nav className="space-y-2">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {/* Settings Content */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 lg:p-6">
                  {activeTab === 'system' && renderSystemSettings()}
                  {activeTab === 'security' && renderSecuritySettings()}
                  {activeTab === 'notifications' && renderNotificationSettings()}
                  {activeTab === 'appearance' && renderAppearanceSettings()}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}