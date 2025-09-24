'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import {
  MessageCircle,
  Send,
  Search,
  Phone,
  Video,
  Info,
  Plus
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

  // Load staff members
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = userService.subscribeToStaffUpdates(
      currentUser.uid,
      (staffData) => {
        console.log(`🔄 Manager Chat: Loaded ${staffData.length} staff members`);
        setStaff(staffData);
        setStaffLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  // Subscribe to chat rooms
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = chatService.subscribeToChatRooms(
      currentUser.uid,
      currentUser.uid, // Using managerId as shopId
      (rooms) => {
        console.log('🔄 Manager Chat: Received rooms:', rooms.length);

        // Filter for staff-manager rooms only to avoid duplicates
        const staffManagerRooms = rooms.filter(room => {
          const isStaffManagerRoom = room.chatRoomId.includes(`manager-${currentUser.uid}`);
          console.log(`📋 Manager Chat: Room ${room.chatRoomId} - isStaffManager: ${isStaffManagerRoom}`);
          return isStaffManagerRoom;
        });

        console.log('✅ Manager Chat: Filtered staff-manager rooms:', staffManagerRooms.length);
        setChatRooms(staffManagerRooms);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  // Subscribe to messages in selected room
  useEffect(() => {
    if (!selectedRoom) {
      console.log('⚠️ Manager Chat: No selectedRoom for message subscription');
      return;
    }

    console.log('🔄 Manager Chat: Setting up message subscription for room:', selectedRoom.chatRoomId);
    console.log('🔄 Manager Chat: Current messages state:', messages.length);

    const unsubscribe = chatService.subscribeToMessages(
      selectedRoom.chatRoomId,
      (messages) => {
        console.log('📨 Manager Chat: Message subscription callback fired!');
        console.log('📨 Manager Chat: Received messages count:', messages.length);
        console.log('📨 Manager Chat: Messages data:', messages);
        setMessages(messages);
        // Mark room as read when messages are loaded
        if (messages.length > 0) {
          chatService.markChatRoomAsRead(selectedRoom.chatRoomId, currentUser!.uid);
        }
      }
    );

    console.log('🔄 Manager Chat: Message subscription setup complete');
    return unsubscribe;
  }, [selectedRoom, currentUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startNewChat = async (staffMember: User) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      console.log('🚀 Manager Chat: Starting new chat with staff:', staffMember.name);

      // Generate consistent room ID for staff-manager pair (same as staff side)
      const roomId = `staff-${staffMember.uid}-manager-${currentUser.uid}`;
      console.log('🔑 Manager Chat: Generated room ID:', roomId);

      const room = await chatService.getOrCreateStaffManagerRoom(
        roomId,
        staffMember, // staff
        currentUser   // manager
      );

      console.log('✅ Manager Chat: Room created/retrieved:', room.chatRoomId);
      setSelectedRoom(room);
    } catch (error) {
      console.error('❌ Manager Chat: Error creating chat with staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const manualRefreshMessages = async () => {
    if (!selectedRoom) return;

    try {
      console.log('🔄 Manager Chat: Manual refresh - fetching messages for room:', selectedRoom.chatRoomId);
      const fetchedMessages = await chatService.getChatMessages(selectedRoom.chatRoomId);
      console.log('📥 Manager Chat: Manual refresh - fetched messages:', fetchedMessages.length);
      console.log('📥 Manager Chat: Manual refresh - messages data:', fetchedMessages);
      setMessages(fetchedMessages);
    } catch (error) {
      console.error('❌ Manager Chat: Manual refresh failed:', error);
    }
  };

  const sendMessage = async () => {
    if (!selectedRoom || !currentUser || !newMessage.trim() || sending) return;

    try {
      setSending(true);
      console.log('🚀 Manager Chat: Sending message to room:', selectedRoom.chatRoomId);

      const sentMessage = await chatService.sendMessage(
        selectedRoom.chatRoomId,
        currentUser,
        newMessage.trim()
      );

      console.log('✅ Manager Chat: Message sent successfully:', sentMessage);
      setNewMessage('');

      // Force manual refresh after sending
      setTimeout(async () => {
        console.log('⏰ Manager Chat: Triggering manual refresh after send...');
        await manualRefreshMessages();
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      alert('メッセージの送信に失敗しました');
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

  const getOtherParticipant = (room: ChatRoom) => {
    // For staff-manager rooms, extract staff info from room ID
    if (room.chatRoomId.startsWith('staff-') && room.chatRoomId.includes(`manager-${currentUser?.uid}`)) {
      const staffId = room.chatRoomId.split('-')[1]; // Extract staff ID from room ID
      const staffMember = staff.find(s => s.uid === staffId);
      if (staffMember) {
        console.log(`👤 Manager Chat: Found staff for room ${room.chatRoomId}: ${staffMember.name}`);
        return staffMember.name;
      }
    }

    // Fallback to original logic for other room types
    const otherParticipantId = room.participants.find(p => p !== currentUser?.uid);
    const participantName = otherParticipantId ? room.participantNames[otherParticipantId] : '不明なユーザー';
    console.log(`👤 Manager Chat: Fallback participant for room ${room.chatRoomId}: ${participantName}`);
    return participantName;
  };

  if (loading && staffLoading) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <div className="h-screen overflow-hidden bg-gray-50">
          <AppHeader title="スタッフチャット" />
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">チャットを読み込み中...</span>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="スタッフチャット" />

        <main className="h-[calc(100vh-4rem)] flex">
          {/* Chat List Sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Search Bar */}
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

            {/* Staff List */}
            <div className="flex-1 overflow-y-auto">
              {/* All Staff Members */}
              <div className="p-3 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700">スタッフ</h3>
              </div>

              {staff
                .filter(staffMember =>
                  staffMember.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((staffMember) => {
                  // Check if there's an existing room for this staff member
                  const roomId = `staff-${staffMember.uid}-manager-${currentUser?.uid}`;
                  const existingRoom = chatRooms.find(room => room.chatRoomId === roomId);
                  const hasUnread = existingRoom && (existingRoom.unreadCount[currentUser?.uid || ''] || 0) > 0;
                  const isSelected = selectedRoom?.chatRoomId === roomId;

                  return (
                    <div
                      key={staffMember.uid}
                      onClick={() => startNewChat(staffMember)}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 ${
                        isSelected ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-medium">
                          {staffMember.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 truncate">
                              {staffMember.name}
                            </p>
                            {existingRoom?.lastMessageTime && (
                              <span className="text-xs text-gray-500">
                                {formatMessageTime(existingRoom.lastMessageTime)}
                              </span>
                            )}
                          </div>
                          {existingRoom?.lastMessage ? (
                            <p className="text-sm text-gray-500 truncate mt-1">
                              {existingRoom.lastMessage}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 mt-1">スタッフ</p>
                          )}
                          {hasUnread && (
                            <div className="mt-1">
                              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                                {existingRoom.unreadCount[currentUser?.uid || '']}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Empty State */}
              {staff.length === 0 && !staffLoading && (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>スタッフが登録されていません</p>
                </div>
              )}

              {staff.length > 0 && staff.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && searchQuery && (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>「{searchQuery}」に一致するスタッフが見つかりません</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedRoom ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-medium">
                        {getOtherParticipant(selectedRoom).charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {getOtherParticipant(selectedRoom)}
                        </h3>
                        <p className="text-sm text-gray-500">オンライン</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Debug: Manual refresh button */}
                      <button
                        onClick={manualRefreshMessages}
                        className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                      >
                        手動更新
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                        <Phone className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                        <Video className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                        <Info className="h-5 w-5" />
                      </button>
                    </div>
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
                        ref={textareaRef}
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">チャットを選択</h3>
                  <p className="text-gray-500">
                    左側のリストからスタッフを選択してチャットを開始
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