'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  MessageCircle,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { chatService } from '@/lib/chatService';
import { userService } from '@/lib/userService';
import { ChatRoom, ChatMessage, User } from '@/types';

export default function StaffChatPage() {
  const { currentUser } = useAuth();
  const [managerChatRoom, setManagerChatRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [manager, setManager] = useState<User | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initializeManagerChat = useCallback(async () => {
    if (!currentUser?.managerId) {
      console.log('⚠️ Staff Chat: No managerId found');
      setLoading(false);
      return;
    }

    try {
      console.log('🚀 Staff Chat: Initializing staff-manager chat room');

      // Generate consistent room ID for this staff-manager pair
      const roomId = `staff-${currentUser.uid}-manager-${currentUser.managerId}`;
      console.log('🔑 Staff Chat: Generated new room ID:', roomId);

      // Create default manager object first (offline-friendly)
      const defaultManager = {
        uid: currentUser.managerId,
        name: '管理者',
        role: 'manager' as const,
        userId: '',
        password: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Try to load manager information (optional, can fail offline)
      let managerData = defaultManager;
      try {
        console.log('🔄 Staff Chat: Attempting to load manager data');
        const loadedManager = await userService.getUserById(currentUser.managerId);
        if (loadedManager) {
          managerData = loadedManager;
          console.log('✅ Staff Chat: Manager data loaded:', loadedManager.name);
        }
      } catch (managerError) {
        console.log('⚠️ Staff Chat: Using default manager due to error:', managerError);
        // Continue with default manager
      }

      setManager(managerData);

      // Try to get or create chat room
      console.log('🔄 Staff Chat: Getting/creating chat room');
      const chatRoom = await chatService.getOrCreateStaffManagerRoom(
        roomId,
        currentUser,
        managerData
      );

      setManagerChatRoom(chatRoom);
      setLoading(false);
      console.log('✅ Staff Chat: Room initialized successfully:', roomId);
    } catch (error) {
      console.error('❌ Staff Chat: Error initializing manager chat:', error);

      // Handle offline error gracefully
      if (error.code === 'unavailable' || error.message.includes('offline')) {
        console.log('📱 Staff Chat: Offline mode - showing offline message');
        setIsOffline(true);
        setLoading(false);

        // Still try to show a basic chat UI with default manager
        setManager({
          uid: currentUser.managerId,
          name: '管理者',
          role: 'manager' as const,
          userId: '',
          password: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        setLoading(false);
      }
    }
  }, [currentUser]);

  // Initialize manager chat automatically
  useEffect(() => {
    if (!currentUser?.managerId) {
      console.log('⚠️ Staff Chat: No managerId found');
      setLoading(false);
      return;
    }

    initializeManagerChat();
  }, [currentUser, initializeManagerChat]);

  // Monitor network status and retry when online
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Back online - retrying chat initialization');
      if (isOffline && currentUser?.managerId) {
        setIsOffline(false);
        setLoading(true);
        initializeManagerChat();
      }
    };

    const handleOffline = () => {
      console.log('📱 Network: Gone offline');
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOffline, currentUser, initializeManagerChat]);

  // Subscribe to messages in manager chat room
  useEffect(() => {
    if (!managerChatRoom) {
      console.log('⚠️ Staff Chat: No managerChatRoom for message subscription');
      return;
    }

    console.log('🔄 Staff Chat: Setting up message subscription for room:', managerChatRoom.chatRoomId);
    console.log('🔄 Staff Chat: Current messages state:', messages.length);
    console.log('🔍 Staff Chat: Current user:', currentUser?.uid);
    console.log('🔍 Staff Chat: Manager data:', manager?.uid);

    const unsubscribe = chatService.subscribeToMessages(
      managerChatRoom.chatRoomId,
      (messages) => {
        console.log('📨 Staff Chat: Message subscription callback fired!');
        console.log('📨 Staff Chat: Received messages count:', messages.length);
        console.log('📨 Staff Chat: Messages data:', messages);
        console.log('📨 Staff Chat: Setting messages state...');
        setMessages(messages);
        console.log('📨 Staff Chat: Messages state set successfully');
        // Mark room as read when messages are loaded
        if (messages.length > 0) {
          chatService.markChatRoomAsRead(managerChatRoom.chatRoomId, currentUser!.uid);
        }
      }
    );

    console.log('🔄 Staff Chat: Message subscription setup complete');
    console.log('🔄 Staff Chat: Unsubscribe function:', typeof unsubscribe);

    // Test the subscription after a small delay
    setTimeout(() => {
      console.log('🧪 Staff Chat: Testing subscription after 2 seconds...');
      console.log('🧪 Staff Chat: Room ID used for subscription:', managerChatRoom.chatRoomId);
      console.log('🧪 Staff Chat: Messages state length:', messages.length);
    }, 2000);

    return unsubscribe;
  }, [managerChatRoom, currentUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const manualRefreshMessages = async () => {
    if (!managerChatRoom) return;

    try {
      console.log('🔄 Staff Chat: Manual refresh - fetching messages for room:', managerChatRoom.chatRoomId);
      const fetchedMessages = await chatService.getChatMessages(managerChatRoom.chatRoomId);
      console.log('📥 Staff Chat: Manual refresh - fetched messages:', fetchedMessages.length);
      console.log('📥 Staff Chat: Manual refresh - messages data:', fetchedMessages);
      setMessages(fetchedMessages);
    } catch (error) {
      console.error('❌ Staff Chat: Manual refresh failed:', error);
    }
  };

  const sendMessage = async () => {
    console.log('📤 Staff Chat: Attempting to send message');
    console.log('📤 Staff Chat: managerChatRoom:', managerChatRoom?.chatRoomId);
    console.log('📤 Staff Chat: currentUser:', currentUser?.uid);
    console.log('📤 Staff Chat: message:', newMessage.trim());
    console.log('📤 Staff Chat: sending state:', sending);

    if (!managerChatRoom || !currentUser || !newMessage.trim() || sending) {
      console.log('❌ Staff Chat: Message send blocked - missing requirements');
      return;
    }

    try {
      setSending(true);
      console.log('🚀 Staff Chat: Calling chatService.sendMessage');
      console.log('🚀 Staff Chat: Room ID for sending:', managerChatRoom.chatRoomId);

      const sentMessage = await chatService.sendMessage(
        managerChatRoom.chatRoomId,
        currentUser,
        newMessage.trim()
      );

      console.log('✅ Staff Chat: Message sent successfully:', sentMessage);
      console.log('✅ Staff Chat: Sent message room ID:', sentMessage.chatRoomId);
      console.log('✅ Staff Chat: Current subscription room ID:', managerChatRoom.chatRoomId);
      console.log('✅ Staff Chat: Room IDs match:', sentMessage.chatRoomId === managerChatRoom.chatRoomId);

      setNewMessage('');

      // Force manual refresh after sending
      setTimeout(async () => {
        console.log('⏰ Staff Chat: Triggering manual refresh after send...');
        await manualRefreshMessages();
      }, 1000);

    } catch (error) {
      console.error('❌ Staff Chat: Error sending message:', error);
      console.error('❌ Staff Chat: Error details:', JSON.stringify(error, null, 2));
      alert(`メッセージの送信に失敗しました: ${error}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);

    // Same day - show time only
    if (messageDate.toDateString() === now.toDateString()) {
      return format(messageDate, 'HH:mm');
    }

    // Different day - show date and time
    return format(messageDate, 'MM/dd HH:mm', { locale: ja });
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['staff']}>
        <AppHeader />
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="text-gray-600">チャットを読み込み中...</span>

            {/* Debug information */}
            <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600 max-w-md">
              <h3 className="font-medium mb-2">デバッグ情報:</h3>
              <div className="space-y-1">
                <div>ユーザーID: {currentUser?.uid || '未設定'}</div>
                <div>ユーザー名: {currentUser?.name || '未設定'}</div>
                <div>マネージャーID: {currentUser?.managerId || '未設定'}</div>
                <div>ロール: {currentUser?.role || '未設定'}</div>
              </div>

              {!currentUser && (
                <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800">
                  ユーザー情報が読み込まれていません
                </div>
              )}

              {currentUser && !currentUser.managerId && (
                <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-800">
                  マネージャーIDが設定されていません
                </div>
              )}

              <button
                onClick={() => setLoading(false)}
                className="mt-3 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
              >
                強制的に続行
              </button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['staff']}>
      <AppHeader />
      <DashboardLayout>
        <div className="h-[calc(100vh-12rem)] max-h-[600px] flex flex-col bg-white rounded-lg shadow overflow-hidden">
          {managerChatRoom ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-medium">
                        {manager?.name?.charAt(0) || '管'}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 flex items-center">
                          <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                          {manager?.name || '管理者'}との会話
                        </h3>
                        <p className="text-sm text-gray-500">店長</p>
                      </div>
                    </div>
                    {/* Debug: Manual refresh button */}
                    <button
                      onClick={manualRefreshMessages}
                      className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                    >
                      手動更新
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((message) => (
                    <div
                      key={message.messageId}
                      className={`flex ${
                        message.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.senderId === currentUser?.uid
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border text-gray-900'
                        }`}
                      >
                        {message.messageType === 'system' && (
                          <div className="text-center text-sm text-gray-500 italic">
                            {message.message}
                          </div>
                        )}
                        {message.messageType === 'text' && (
                          <>
                            <p className="whitespace-pre-wrap">{message.message}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.senderId === currentUser?.uid
                                  ? 'text-blue-100'
                                  : 'text-gray-500'
                              }`}
                            >
                              {formatMessageTime(message.createdAt)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-end space-x-3">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="メッセージを入力..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={1}
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isOffline ? 'オフラインモード' : 'チャット準備中'}
                </h3>

                {isOffline ? (
                  <div className="text-yellow-600 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm font-medium">現在オフラインです</p>
                    <p className="text-xs mt-1">インターネット接続を確認してください</p>
                    <p className="text-xs mt-1">接続が回復すると自動的にチャットが利用できます</p>
                    {manager && (
                      <p className="text-xs mt-2 text-gray-600">
                        {manager.name}との会話準備中...
                      </p>
                    )}
                  </div>
                ) : !currentUser?.managerId ? (
                  <div className="text-red-500">
                    <p className="text-sm">マネージャー情報が設定されていません</p>
                    <p className="text-xs mt-1">管理者にお問い合わせください</p>
                  </div>
                ) : (
                  <p className="text-gray-500">
                    店長との会話を初期化しています...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}