'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  User,
  Crown,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { SimpleChatService, SimpleChatRoom, SimpleChatMessage } from '@/lib/simpleChatService';
import { useAuth } from '@/contexts/AuthContext';

interface SimpleChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  targetUserId?: string;
  targetUserName?: string;
  relatedShiftId?: string;
  position?: 'right' | 'left';
}

export default function SimpleChatSidebar({
  isOpen,
  onToggle,
  targetUserId,
  targetUserName,
  relatedShiftId,
  position = 'right'
}: SimpleChatSidebarProps) {
  const { currentUser } = useAuth();
  const [chatRoom, setChatRoom] = useState<SimpleChatRoom | null>(null);
  const [messages, setMessages] = useState<SimpleChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // チャット初期化
  useEffect(() => {
    if (isOpen && currentUser && targetUserId && targetUserName) {
      initializeChat();
    }

    return () => {
      // クリーンアップ
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isOpen, currentUser, targetUserId, targetUserName]);

  // 自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // フォーカス管理
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isMinimized]);

  // チャットが開かれたときに既読マーク
  useEffect(() => {
    if (isOpen && !isMinimized && chatRoom && currentUser) {
      SimpleChatService.markMessagesAsRead(chatRoom.id!, currentUser.uid);
    }
  }, [isOpen, isMinimized, chatRoom, currentUser]);

  const initializeChat = async () => {
    if (!currentUser || !targetUserId || !targetUserName) return;

    setLoading(true);
    try {
      console.log('💬 Initializing simple chat:', {
        currentUser: currentUser.uid,
        targetUser: targetUserId,
        targetUserName
      });

      // チャットルームを取得または作成
      const room = await SimpleChatService.getOrCreateChatRoom(
        currentUser.uid,
        targetUserId,
        currentUser.name || 'マネージャー',
        targetUserName
      );

      setChatRoom(room);
      console.log('✅ Chat room created/retrieved:', room.id);

      // メッセージをリアルタイムで監視開始
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      unsubscribeRef.current = SimpleChatService.subscribeToMessages(
        room.id!,
        (updatedMessages) => {
          console.log(`📨 Received ${updatedMessages.length} messages`);
          setMessages(updatedMessages);

          // チャットが開いていて最小化されていない場合は既読マーク
          if (isOpen && !isMinimized) {
            SimpleChatService.markMessagesAsRead(room.id!, currentUser.uid);
          }
        }
      );

    } catch (error) {
      console.error('❌ Error initializing simple chat:', error);
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
      await SimpleChatService.sendMessage(
        chatRoom.id!,
        currentUser.uid,
        currentUser.name || 'マネージャー',
        'manager', // 店長からの送信
        messageText
      );

      console.log('✅ Message sent successfully');

      // 入力フィールドにフォーカス
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

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

  const getRoleIcon = (role: 'manager' | 'staff') => {
    switch (role) {
      case 'manager':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'staff':
        return <User className="h-3 w-3 text-blue-500" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
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

  const formatTimestamp = (timestamp: any) => {
    try {
      // Firestore Timestampの場合
      if (timestamp?.seconds) {
        return format(new Date(timestamp.seconds * 1000), 'HH:mm', { locale: ja });
      }
      // 通常のDateオブジェクトの場合
      if (timestamp instanceof Date) {
        return format(timestamp, 'HH:mm', { locale: ja });
      }
      // 文字列の場合
      if (typeof timestamp === 'string') {
        return format(new Date(timestamp), 'HH:mm', { locale: ja });
      }
      return '';
    } catch (error) {
      console.warn('⚠️ Error formatting timestamp:', error);
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed top-0 h-full bg-white shadow-2xl border-l border-gray-200 z-50 transition-all duration-300 ${
      position === 'right' ? 'right-0' : 'left-0'
    } ${isMinimized ? 'w-14' : 'w-96'}`}>

      {/* Header - 最小化時と通常時で完全に分離 */}
      {isMinimized ? (
        /* 最小化時のヘッダー */
        <div className="h-full bg-gradient-to-b from-teal-500 to-teal-600 text-white flex flex-col items-center">
          {/* メインアイコン */}
          <div className="p-3 border-b border-teal-400 w-full flex justify-center">
            <MessageCircle className="h-5 w-5" />
          </div>

          {/* 未読数表示エリア（将来の拡張用） */}
          <div className="flex-1 flex items-center justify-center">
            {/* 未読メッセージがある場合のドット表示 */}
            {messages.some(msg => !msg.read && msg.senderId !== currentUser?.uid) && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </div>

          {/* 最小化時のボタン群 */}
          <div className="space-y-2 p-2 border-t border-teal-400 w-full">
            <button
              onClick={() => setIsMinimized(false)}
              className="w-full p-2 hover:bg-teal-600 rounded transition-colors flex justify-center"
              title="最大化"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={onToggle}
              className="w-full p-2 hover:bg-teal-600 rounded transition-colors flex justify-center"
              title="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* 通常時のヘッダー */
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-teal-500 to-teal-600 text-white">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <div>
              <h3 className="font-semibold text-sm">
                {targetUserName || 'チャット'}
              </h3>
              {relatedShiftId && (
                <p className="text-xs opacity-90 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  シフト相談
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-teal-600 rounded transition-colors"
              title="最小化"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-teal-600 rounded transition-colors"
              title="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div className="flex-1 h-[calc(100vh-128px)] overflow-y-auto p-4 space-y-3">
            {loading && messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300 animate-pulse" />
                <p className="text-sm">チャットを読み込み中...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">メッセージがありません</p>
                <p className="text-xs mt-1 text-gray-400">最初のメッセージを送信してみましょう</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const showSenderInfo = index === 0 ||
                  messages[index - 1].senderId !== message.senderId;

                return (
                  <div key={message.id || index} className="space-y-1">
                    {/* 送信者情報 */}
                    {showSenderInfo && message.senderId !== currentUser?.uid && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 mb-1">
                        {getRoleIcon(message.senderRole)}
                        <span className="font-medium">{message.senderName}</span>
                        <span>•</span>
                        <span>{formatTimestamp(message.timestamp)}</span>
                      </div>
                    )}

                    {/* メッセージバブル */}
                    <div className={`flex ${message.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                      <div className={getMessageBubbleClass(message.senderId)}>
                        <div className="whitespace-pre-wrap">{message.content}</div>

                        {/* 時刻（自分のメッセージの場合） */}
                        {message.senderId === currentUser?.uid && (
                          <div className="text-xs opacity-75 mt-1 text-right">
                            {formatTimestamp(message.timestamp)}
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                disabled={loading || !chatRoom}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || loading || !chatRoom}
                className="p-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="送信"
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

            {/* ローカルストレージ表示 */}
            <div className="mt-1 text-xs text-gray-400 text-center">
              💾 メッセージは1.5ヶ月間ローカルに保存されます
            </div>
          </div>
        </>
      )}
    </div>
  );
}