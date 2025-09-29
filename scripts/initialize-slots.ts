import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { slotManagementService } from '../src/lib/slotManagementService';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config({ path: '.env.local' });

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 色付きログ出力用
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

async function initializeSlots() {
  console.log(`${colors.bright}${colors.blue}==================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue} 枠数管理システム初期化スクリプト${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}==================================${colors.reset}\n`);

  try {
    console.log(`${colors.cyan}📋 ステップ 1: 既存の店長を確認中...${colors.reset}`);

    // すべての店長の枠数を初期化
    await slotManagementService.initializeAllManagerSlots();

    console.log(`\n${colors.green}✅ 初期化が完了しました！${colors.reset}`);
    console.log(`${colors.yellow}🎯 すべての店長に初期枠数（5枠）が割り当てられました${colors.reset}`);

    // 初期化結果を確認
    console.log(`\n${colors.cyan}📊 初期化結果:${colors.reset}`);
    const allSlots = await slotManagementService.getAllManagerSlots();

    console.log(`${colors.bright}総店長数: ${allSlots.length}名${colors.reset}`);
    allSlots.forEach(slot => {
      console.log(`  - ${slot.managerName || slot.managerId}: ${slot.totalSlots}枠 (使用: ${slot.usedSlots}枠)`);
    });

  } catch (error) {
    console.error(`${colors.red}❌ エラーが発生しました:${colors.reset}`, error);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.green}🎉 枠数管理システムの初期化が完了しました${colors.reset}\n`);
  process.exit(0);
}

// スクリプト実行
initializeSlots();