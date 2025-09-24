'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import {
  MessageCircle,
  Send,
  User,
  Circle,
  Search,
  Phone,
  Video,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { chatService } from '@/lib/chatService';
import { userService } from '@/lib/userService';
import { ChatRoom, ChatMessage, User } from '@/types';

export default function ManagerChatPage() {
  const { currentUser } = useAuth();

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [staff, setStaff] = useState<User[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // スクロールを最下部に移動
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // スタッフデータとチャットルームの監視（calendar ページと同じパターン）
  useEffect(() => {
    console.log("🚀 CHAT PAGE: Starting effect, managerUser:", managerUser);
    console.log("🔍 CHAT PAGE: managerUser.uid:", managerUser.uid);
    console.log("🔍 CHAT PAGE: currentUser:", currentUser);

    let unsubscribeStaff: (() => void) | null = null;
    let unsubscribeChatRooms: (() => void) | null = null;

    const initializeData = async () => {
      try {
        console.log("🟡 CHAT PAGE: Setting loading states to true");
        setLoading(true);
        setStaffLoading(true);

        console.log("🟡 CHAT PAGE: Calling userService.subscribeToStaffUpdates with uid:", managerUser.uid);
        // リアルタイムスタッフデータ取得（calendar ページと同じ方法）
        unsubscribeStaff = userService.subscribeToStaffUpdates(
          managerUser.uid,
          (staffData) => {
            console.log("🟢 CHAT PAGE: Callback received! staffData:", staffData);
            console.log(`📊 CHAT PAGE: Received ${staffData.length} staff members from Firestore`);
            console.log("🔥 CHAT PAGE: Staff data details:", staffData.map(s => ({ uid: s.uid, name: s.name })));
            setStaff(staffData);
            console.log("🟢 CHAT PAGE: Setting BOTH loading states to false (calendar pattern)");
            setStaffLoading(false);
            setLoading(false); // calendarページと同じパターン！
            setStaffError(null);
          }
        );
        console.log("🟡 CHAT PAGE: userService.subscribeToStaffUpdates call completed, unsubscribeStaff:", unsubscribeStaff);

        // チャットルーム一覧の監視
        unsubscribeChatRooms = SimpleChatService.subscribeToUserChatRooms(
          managerUser.uid,
          'manager',
          (rooms) => {
            console.log("💬 CHAT PAGE: Chat rooms received:", rooms.length);
            setChatRooms(rooms);
            // loadingはスタッフデータ取得完了時のみfalseにする（calendarパターン）
          }
        );

      } catch (error) {
        console.error("❌ Error initializing chat data:", error);
        setLoading(false); // calendarページと同じパターン
        setStaffLoading(false);
        setStaffError('スタッフデータの読み込みに失敗しました');
      }
    };

    initializeData();

    return () => {
      if (unsubscribeStaff) unsubscribeStaff();
      if (unsubscribeChatRooms) unsubscribeChatRooms();
    };
  }, [managerUser.uid]);

  // 選択されたルームのメッセージ監視（1.5ヶ月制限）
  useEffect(() => {
    if (!selectedRoom?.id) return;

    console.log('🔄 Subscribing to messages with 1.5-month limit');
    const unsubscribe = SimpleChatService.subscribeToMessagesWithLimit(
      selectedRoom.id,
      (roomMessages) => {
        setMessages(roomMessages);
      }
    );

    return unsubscribe;
  }, [selectedRoom?.id]);

  // スタッフデータ再取得関数
  const refreshStaff = async () => {
    console.log("🔄 Refreshing staff data...");
    setStaffLoading(true);
    setStaffError(null);

    try {
      // 既存の購読を解除して再開
      const unsubscribe = userService.subscribeToStaffUpdates(
        managerUser.uid,
        (staffData) => {
          console.log(`📊 Refreshed: ${staffData.length} staff members`);
          setStaff(staffData);
          setStaffLoading(false);
          setStaffError(null);
        }
      );

      // クリーンアップのために保存
      return unsubscribe;
    } catch (error) {
      console.error("❌ Error refreshing staff data:", error);
      setStaffLoading(false);
      setStaffError('スタッフデータの更新に失敗しました');
    }
  };

  // デバッグ情報の表示
  useEffect(() => {
    console.log('🔍 Chat page staff data debug:', {
      staff,
      staffCount: staff?.length || 0,
      staffLoading,
      managerUser: managerUser?.uid
    });

    if (staff.length > 0) {
      console.log('✅ Staff data loaded for chat:', {
        staffCount: staff.length,
        staffNames: staff.map(s => s.name || '未設定')
      });
    }
  }, [staff, staffLoading, managerUser.uid]);

  // 新しいチャットルーム作成
  const startNewChat = async (staff: { id: string; name: string }) => {
    if (!currentUser?.uid || !currentUser?.name) return;

    try {
      const room = await SimpleChatService.getOrCreateChatRoom(
        currentUser.uid,
        staff.id,
        currentUser.name,
        staff.name
      );
      setSelectedRoom(room);
    } catch (error) {
      console.error('Error creating chat room:', error);
    }
  };

  // メッセージ送信
  const sendMessage = async () => {
    if (!selectedRoom?.id || !currentUser?.uid || !currentUser?.name || !newMessage.trim()) return;

    setSending(true);
    try {
      await SimpleChatService.sendMessage(
        selectedRoom.id,
        currentUser.uid,
        currentUser.name,
        'manager',
        newMessage.trim()
      );
      setNewMessage('');

      // テキストエリアの高さをリセット
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Enterキーでの送信
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // テキストエリアの自動リサイズ
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);

    // 高さの自動調整
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  // チャットルーム選択時に既読にする
  const selectRoom = async (room: SimpleChatRoom) => {
    setSelectedRoom(room);

    if (currentUser?.uid) {
      try {
        await SimpleChatService.markMessagesAsRead(room.id!, currentUser.uid);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
  };

  // スタッフのフィルタリング（calendar ページと同じパターン）
  const filteredStaff = (staff || []).map(staffMember => ({
    id: staffMember?.uid || '',
    name: staffMember?.name || 'スタッフ'
  })).filter(staffItem =>
    staffItem.id && staffItem.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // フィルタリング結果のデバッグ
  useEffect(() => {
    console.log('🔍 Filtered staff debug:', {
      originalStaff: staff,
      mappedStaff: (staff || []).map(staffMember => ({ id: staffMember?.uid || '', name: staffMember?.name || 'スタッフ' })),
      filteredStaff,
      searchQuery,
      filteredCount: filteredStaff.length
    });
  }, [staff, filteredStaff, searchQuery]);

  // チャットルームのフィルタリング
  const filteredRooms = chatRooms.filter(room =>
    room.staffName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return '今日';
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
      return '昨日';
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="スタッフチャット" />

        <main className="h-[calc(100vh-4rem)] flex">
          {/* チャットリスト */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* 検索バー */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="スタッフを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* チャットルーム一覧 */}
            <div className="flex-1 overflow-y-auto">
              {(loading || staffLoading) ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin h-6 w-6 border-b-2 border-blue-600 rounded-full mx-auto mb-2"></div>
                  読み込み中...
                </div>
              ) : (
                <>
                  {/* 既存のチャットルーム */}
                  {filteredRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => selectRoom(room)}
                      className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        selectedRoom?.id === room.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                            {room.staffName.charAt(0)}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {room.staffName}
                            </p>
                            {room.lastMessage && (
                              <span className="text-xs text-gray-500">
                                {formatTime(room.lastMessage.timestamp)}
                              </span>
                            )}
                          </div>
                          {room.lastMessage && (
                            <p className="text-sm text-gray-600 truncate mt-1">
                              {room.lastMessage.content}
                            </p>
                          )}
                          {currentUser?.uid && room.unreadCount[currentUser.uid] > 0 && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {room.unreadCount[currentUser.uid]}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 新しいチャット開始 */}
                  {filteredStaff.length > 0 ? (
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">新しいチャットを開始</h3>
                      {filteredStaff
                        .filter(staff => !chatRooms.some(room => room.staffId === staff.id))
                        .map((staff) => (
                          <div
                            key={staff.id}
                            onClick={() => startNewChat(staff)}
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{staff.name}</p>
                              <p className="text-xs text-gray-500">新しいチャット</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-4 border border-yellow-200 bg-yellow-50">
                      <h3 className="text-sm font-medium text-yellow-700 mb-2">デバッグ: スタッフリスト表示条件</h3>
                      <div className="text-xs text-yellow-600 space-y-1">
                        <div>staff.length: {(staff || []).length}</div>
                        <div>filteredStaff.length: {filteredStaff.length}</div>
                        <div>staffLoading: {staffLoading.toString()}</div>
                        <div>staffError: {staffError || 'なし'}</div>
                        <div>searchQuery: "{searchQuery}"</div>
                        <div>currentUser: {currentUser?.uid || 'なし'}</div>
                        {(staff || []).length > 0 && (
                          <div className="mt-2 p-2 bg-yellow-100 rounded">
                            <div className="font-medium">スタッフリスト内容:</div>
                            {(staff || []).slice(0, 3).map((staffMember, index) => (
                              <div key={index} className="ml-2">
                                {index + 1}. uid: {staffMember?.uid || '未設定'}, name: {staffMember?.name || '未設定'}
                              </div>
                            ))}
                            {(staff || []).length > 3 && <div className="ml-2">... (+{(staff || []).length - 3} more)</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* スタッフデータエラー */}
                  {staffError && !staffLoading && (
                    <div className="p-4 text-center text-red-500">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-red-300" />
                      <p className="text-sm">スタッフデータの読み込みに失敗しました</p>
                      <button
                        onClick={refreshStaff}
                        className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        再試行
                      </button>
                    </div>
                  )}

                  {/* 空の状態 */}
                  {filteredRooms.length === 0 && filteredStaff.length === 0 && !loading && !staffLoading && !staffError && (
                    <div className="p-4 text-center text-gray-500">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">チャットできるスタッフがいません</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* チャット画面 */}
          <div className="flex-1 flex flex-col">
            {selectedRoom ? (
              <>
                {/* チャットヘッダー */}
                <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                      {selectedRoom.staffName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedRoom.staffName}</h2>
                      <div className="flex items-center space-x-1">
                        <Circle className="h-2 w-2 text-green-500 fill-current" />
                        <span className="text-sm text-gray-500">オンライン</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* メッセージ一覧 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message, index) => {
                    const isManager = message.senderRole === 'manager';
                    const showDate = index === 0 ||
                      formatDate(messages[index - 1].timestamp) !== formatDate(message.timestamp);

                    return (
                      <div key={message.id || index}>
                        {showDate && (
                          <div className="text-center mb-4">
                            <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                              {formatDate(message.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
                            isManager ? 'bg-blue-500 text-white' : 'bg-white text-gray-900'
                          } rounded-2xl px-4 py-2 shadow-sm`}>
                            <p className="text-sm break-words">{message.content}</p>
                            <p className={`text-xs mt-1 ${
                              isManager ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* メッセージ入力 */}
                <div className="bg-white border-t border-gray-200 p-4">
                  <div className="flex items-end space-x-4">
                    <div className="flex-1">
                      <textarea
                        ref={textareaRef}
                        value={newMessage}
                        onChange={handleTextareaChange}
                        onKeyPress={handleKeyPress}
                        placeholder="メッセージを入力..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                        disabled={sending}
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* 未選択状態 */
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">チャットを選択してください</h3>
                  <p className="text-gray-500">
                    左のリストからスタッフを選択してチャットを開始できます
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}