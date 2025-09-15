'use client';

import { useState, useEffect, useRef } from 'react';
// 認証不要版
import { 
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  User,
  Crown,
  Settings,
  Clock,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { chatService } from '@/lib/chatService';
import { ChatMessage, ChatRoom } from '@/types';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  targetUserId?: string;
  targetUserName?: string;
  relatedShiftId?: string;
  position?: 'right' | 'left';
}

export default function ChatSidebar({
  isOpen,
  onToggle,
  targetUserId,
  targetUserName,
  relatedShiftId,
  position = 'right'
}: ChatSidebarProps) {
  // ハードコーディングされたマネージャー情報（認証不要）
  const currentUser = {
    uid: 'manager_001',
    email: 'manager@shifty.com',
    name: 'マネージャー',
    role: 'manager' as const
  };
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // チャット初期化
  useEffect(() => {
    if (isOpen && currentUser && targetUserId) {
      initializeChat();
    }
  }, [isOpen, currentUser, targetUserId, relatedShiftId]);

  // メッセージリアルタイム監視
  useEffect(() => {
    if (!chatRoom) return;

    const unsubscribe = chatService.subscribeToMessages(
      chatRoom.chatRoomId,
      (updatedMessages) => {
        setMessages(updatedMessages);
        scrollToBottom();
        
        // 既読マーク
        if (isOpen && !isMinimized) {
          chatService.markChatRoomAsRead(chatRoom.chatRoomId, currentUser!.uid);
        }
      }
    );

    return () => unsubscribe();
  }, [chatRoom, isOpen, isMinimized]);

  // 自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // フォーカス管理
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const initializeChat = async () => {
    if (!currentUser || !targetUserId) return;

    setLoading(true);
    try {
      // ターゲットユーザー情報を構築（簡略化）
      const targetUser = {
        uid: targetUserId,
        name: targetUserName || 'ユーザー',
        email: '',
        role: 'staff' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 直接チャットを取得または作成
      const room = await chatService.getOrCreateDirectChat(
        currentUser.shopId!,
        currentUser,
        targetUser,
        relatedShiftId
      );

      setChatRoom(room);

      // 既存メッセージを取得
      const existingMessages = await chatService.getChatMessages(room.chatRoomId);
      setMessages(existingMessages);

      // 既読マーク
      if (isOpen && !isMinimized) {
        await chatService.markChatRoomAsRead(room.chatRoomId, currentUser.uid);
      }

      console.log('💬 Chat initialized:', {
        chatRoomId: room.chatRoomId,
        participants: room.participants,
        messageCount: existingMessages.length,
      });

    } catch (error) {
      console.error('❌ Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatRoom || !currentUser || loading) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setLoading(true);

    try {
      if (relatedShiftId) {
        await chatService.sendShiftRelatedMessage(
          chatRoom.chatRoomId,
          currentUser,
          messageText,
          relatedShiftId
        );
      } else {
        await chatService.sendMessage(
          chatRoom.chatRoomId,
          currentUser,
          messageText
        );
      }

      // 入力フィールドにフォーカス
      if (inputRef.current) {
        inputRef.current.focus();
      }

    } catch (error) {
      console.error('❌ Error sending message:', error);
      // エラー時はメッセージを復元
      setNewMessage(messageText);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'root':
      case 'manager':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'staff':
        return <User className="h-3 w-3 text-blue-500" />;
      default:
        return <Settings className="h-3 w-3 text-gray-500" />;
    }
  };

  const getMessageBubbleClass = (senderId: string) => {
    const isMyMessage = senderId === currentUser?.uid;
    const baseClass = 'max-w-[80%] p-3 rounded-lg break-words';
    
    if (isMyMessage) {
      return `${baseClass} bg-blue-500 text-white ml-auto`;
    } else {
      return `${baseClass} bg-gray-100 text-gray-900`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed top-0 h-full bg-white shadow-2xl border-l border-gray-200 z-50 transition-all duration-300 ${
      position === 'right' ? 'right-0' : 'left-0'
    } ${isMinimized ? 'w-16' : 'w-96'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        {!isMinimized && (
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <div>
              <h3 className="font-semibold text-sm">
                {targetUserName || 'チャット'}
              </h3>
              {relatedShiftId && (
                <p className="text-xs opacity-90 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  シフト相談
                </p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-1">
          {!isMinimized && (
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-blue-600 rounded transition-colors"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
          {isMinimized && (
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 hover:bg-blue-600 rounded transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 hover:bg-blue-600 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div className="flex-1 h-[calc(100vh-128px)] overflow-y-auto p-4 space-y-3">
            {loading && messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">チャットを読み込み中...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">メッセージがありません</p>
                <p className="text-xs mt-1">最初のメッセージを送信してみましょう</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const showSenderInfo = index === 0 || 
                  messages[index - 1].senderId !== message.senderId ||
                  (message.createdAt.getTime() - messages[index - 1].createdAt.getTime()) > 5 * 60 * 1000; // 5分以上間隔

                return (
                  <div key={message.messageId} className="space-y-1">
                    {/* 送信者情報 */}
                    {showSenderInfo && message.senderId !== currentUser?.uid && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                        {getRoleIcon(message.senderRole)}
                        <span>{message.senderName}</span>
                        <span>•</span>
                        <span>{format(message.createdAt, 'HH:mm', { locale: ja })}</span>
                      </div>
                    )}

                    {/* メッセージバブル */}
                    <div className={`flex ${message.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                      <div className={getMessageBubbleClass(message.senderId)}>
                        {/* システムメッセージ */}
                        {message.messageType === 'system' && (
                          <div className="text-center text-gray-500 text-xs">
                            <Settings className="h-3 w-3 inline mr-1" />
                            {message.message}
                          </div>
                        )}

                        {/* シフト関連メッセージ */}
                        {message.messageType === 'shift_related' && (
                          <div className="space-y-1">
                            <div className="flex items-center text-xs opacity-75">
                              <Calendar className="h-3 w-3 mr-1" />
                              シフト関連
                            </div>
                            <div>{message.message}</div>
                          </div>
                        )}

                        {/* 通常メッセージ */}
                        {message.messageType === 'text' && (
                          <div>{message.message}</div>
                        )}

                        {/* 時刻（自分のメッセージの場合） */}
                        {message.senderId === currentUser?.uid && (
                          <div className="text-xs opacity-75 mt-1 text-right">
                            {format(message.createdAt, 'HH:mm', { locale: ja })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="メッセージを入力..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={loading || !chatRoom}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || loading || !chatRoom}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            
            {relatedShiftId && (
              <div className="mt-2 text-xs text-gray-500 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                このチャットはシフト（{relatedShiftId.slice(-8)}）に関連しています
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}