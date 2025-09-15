// Web Crypto API を使用（ブラウザ・Node.js両対応）

// セキュリティキー（本来は環境変数から取得）
const SECRET_KEY = process.env.NEXT_PUBLIC_SECURE_URL_SECRET || 'shifty-secure-key-2025';

export interface SecureUrlOptions {
  expiresInMinutes?: number;
  additionalParams?: Record<string, string>;
  requireAuth?: boolean;
}

export interface ParsedSecureUrl {
  userId: string;
  action: string;
  timestamp: number;
  isValid: boolean;
  isExpired: boolean;
  additionalParams?: Record<string, string>;
}

/**
 * 簡易ハッシュ関数（Web Crypto APIの代替）
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit制限
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * セキュアな動的URLを生成
 * @param userId ユーザーID
 * @param action アクション名
 * @param options オプション設定
 * @returns セキュアURL
 */
export const generateSecureUrl = (
  userId: string, 
  action: string, 
  options: SecureUrlOptions = {}
): string => {
  const timestamp = Date.now();
  const expiresAt = timestamp + (options.expiresInMinutes || 30) * 60 * 1000; // デフォルト30分
  
  // ハッシュ生成用の文字列
  const hashString = `${userId}-${action}-${timestamp}-${expiresAt}-${SECRET_KEY}`;
  
  // ハッシュを生成（16文字）
  const hash = simpleHash(hashString).substr(0, 16);
  
  // 基本パラメータ
  const params = new URLSearchParams({
    t: timestamp.toString(),
    u: userId,
    e: expiresAt.toString(),
  });

  // 追加パラメータがあれば追加
  if (options.additionalParams) {
    Object.entries(options.additionalParams).forEach(([key, value]) => {
      params.append(key, value);
    });
  }

  return `/secure/${hash}/${action}?${params.toString()}`;
};

/**
 * セキュアURLをパースして検証
 * @param url セキュアURL
 * @param expectedAction 期待されるアクション（オプション）
 * @returns パース結果
 */
export const parseSecureUrl = (url: string, expectedAction?: string): ParsedSecureUrl => {
  try {
    const urlObj = new URL(url, 'https://example.com');
    const pathParts = urlObj.pathname.split('/');
    
    if (pathParts.length < 4 || pathParts[1] !== 'secure') {
      return {
        userId: '',
        action: '',
        timestamp: 0,
        isValid: false,
        isExpired: true,
      };
    }

    const hash = pathParts[2];
    const action = pathParts[3];
    const params = urlObj.searchParams;
    
    const timestamp = parseInt(params.get('t') || '0');
    const userId = params.get('u') || '';
    const expiresAt = parseInt(params.get('e') || '0');

    // 期待されるアクションと一致するかチェック
    if (expectedAction && action !== expectedAction) {
      return {
        userId,
        action,
        timestamp,
        isValid: false,
        isExpired: false,
      };
    }

    // ハッシュを再生成して検証
    const expectedHashString = `${userId}-${action}-${timestamp}-${expiresAt}-${SECRET_KEY}`;
    const expectedHash = simpleHash(expectedHashString).substr(0, 16);

    const isValid = hash === expectedHash;
    const isExpired = Date.now() > expiresAt;

    // 追加パラメータを取得
    const additionalParams: Record<string, string> = {};
    params.forEach((value, key) => {
      if (!['t', 'u', 'e'].includes(key)) {
        additionalParams[key] = value;
      }
    });

    return {
      userId,
      action,
      timestamp,
      isValid,
      isExpired,
      additionalParams: Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
    };
  } catch (error) {
    return {
      userId: '',
      action: '',
      timestamp: 0,
      isValid: false,
      isExpired: true,
    };
  }
};

/**
 * ユーザー管理用のセキュアURL生成
 */
export const generateUserManagementUrls = (userId: string, targetUserId: string) => {
  return {
    edit: generateSecureUrl(userId, 'edit-user', {
      expiresInMinutes: 15,
      additionalParams: { target: targetUserId },
    }),
    delete: generateSecureUrl(userId, 'delete-user', {
      expiresInMinutes: 5, // 削除は短時間
      additionalParams: { target: targetUserId },
    }),
    view: generateSecureUrl(userId, 'view-user', {
      expiresInMinutes: 60,
      additionalParams: { target: targetUserId },
    }),
  };
};

/**
 * システム管理用のセキュアURL生成
 */
export const generateSystemUrls = (userId: string) => {
  return {
    logs: generateSecureUrl(userId, 'view-logs', {
      expiresInMinutes: 30,
    }),
    database: generateSecureUrl(userId, 'manage-database', {
      expiresInMinutes: 15,
    }),
    settings: generateSecureUrl(userId, 'system-settings', {
      expiresInMinutes: 30,
    }),
    reports: generateSecureUrl(userId, 'view-reports', {
      expiresInMinutes: 45,
    }),
  };
};

/**
 * セキュアURL用のミドルウェアヘルパー
 */
export const validateSecureUrlMiddleware = (request: Request): ParsedSecureUrl | null => {
  const url = new URL(request.url);
  
  if (!url.pathname.startsWith('/secure/')) {
    return null;
  }

  return parseSecureUrl(url.pathname + url.search);
};

/**
 * ログ記録付きセキュアURL生成
 */
export const generateSecureUrlWithLogging = async (
  userId: string,
  action: string,
  options: SecureUrlOptions = {}
): Promise<string> => {
  const url = generateSecureUrl(userId, action, options);
  
  // ログ記録（必要に応じて実装）
  console.log(`🔗 Secure URL generated: ${action} for user ${userId}`);
  
  return url;
};