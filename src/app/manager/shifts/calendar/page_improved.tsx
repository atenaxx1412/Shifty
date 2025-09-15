// 改善されたシフト作成フロー - 直感的でシンプル

// 主要な改善点：

// 1. ボタンテキストの改善
// 「作成」→「{スタッフ名}のシフトを設定」
// 手続き感ではなく「設定」の感覚

// 2. ワンクリック作成オプション
// 簡単な設定の場合は、確認なしで即座に反映

// 3. 視覚的フィードバックの改善
// 設定完了時に該当セルが即座に更新され、視覚的に確認できる

// 修正箇所1: ボタンテキストの改善
const getCreateButtonText = () => {
  if (createLoading) return '設定中...';
  if (createModalStaff) return `${createModalStaff.name}のシフト設定`;
  return 'シフト設定';
};

// 修正箇所2: モーダルタイトルの改善
const getModalTitle = () => {
  if (createModalStaff) {
    return `${createModalStaff.name}さんのシフト設定`;
  }
  return 'シフト設定';
};

// 修正箇所3: 成功メッセージの改善
const getSuccessMessage = () => {
  const dateStr = format(createModalDate, 'M月d日', { locale: ja });
  if (createModalStaff) {
    return `${dateStr} ${createModalStaff.name}さんのシフトを設定しました`;
  }
  return `${dateStr}のシフトを設定しました`;
};

// 修正箇所4: executeCreateShift関数の改善
const executeCreateShift = async () => {
  if (!createModalDate) {
    console.error('❌ Date not selected for shift creation');
    return;
  }

  // 時間の妥当性チェック
  const start = new Date(`2000-01-01T${formData.startTime}`);
  const end = new Date(`2000-01-01T${formData.endTime}`);
  if (start >= end) {
    alert('終了時間は開始時間より後に設定してください');
    return;
  }

  setCreateLoading(true);
  
  try {
    // ポジションを配列に変換
    const positions = formData.positions
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // 労働時間を計算（分単位）
    const duration = (end.getTime() - start.getTime()) / (1000 * 60);

    // 指定されたスタッフがいる場合は自動割り当て
    const assignedStaff = createModalStaff ? [createModalStaff.uid] : [];
    
    // シフトデータを構築
    const shiftData = {
      managerId: currentUser.uid,
      date: createModalDate,
      slots: [
        {
          slotId: `slot_${Date.now()}`,
          startTime: formData.startTime,
          endTime: formData.endTime,
          requiredStaff: 1,
          assignedStaff: assignedStaff,
          positions: positions.length > 0 ? positions : ['一般'],
          requiredSkills: positions.length > 0 ? positions : [],
          priority: 'medium' as const,
          estimatedDuration: duration,
          notes: formData.notes
        }
      ]
    };

    if (createModalStaff) {
      console.log(`✅ Auto-assigning shift to staff: ${createModalStaff.name}`);
    }

    // ShiftServiceを使用してシフトを作成（自動的にpublished状態）
    const createdShift = await shiftService.createShift(shiftData, currentUser);
    
    // 改善されたフィードバック
    const successMsg = getSuccessMessage();
    alert(successMsg);

    // モーダルを閉じる
    closeCreateModal();

    // シフト一覧が自動更新される（subscribeToShiftUpdatesにより）
    
  } catch (error) {
    console.error('❌ Failed to create shift:', error);
    alert('シフトの設定に失敗しました。再度お試しください。');
  } finally {
    setCreateLoading(false);
  }
};

// JSXでの改善点（モーダル内）:
/*
<div className="flex items-center justify-between mb-6">
  <div>
    <h3 className="text-xl font-semibold text-gray-900">
      {getModalTitle()}
    </h3>
    {createModalStaff && (
      <p className="text-sm text-green-600 mt-1">
        このスタッフに直接反映されます
      </p>
    )}
  </div>
  <!-- 省略 -->
</div>

<!-- ボタン部分 -->
<button
  type="button"
  onClick={executeCreateShift}
  disabled={createLoading}
  className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
  {getCreateButtonText()}
</button>
*/

// 追加改善案：
// 1. 「よく使う設定」のクイック設定ボタン
// 2. スタッフの希望シフト時間を事前表示
// 3. 競合するシフトがある場合の警告表示
// 4. ドラッグ&ドロップでのシフト移動機能

// 結論：
// 現在のシステムは技術的には正しく「直接反映」を実現している
// 問題はUX（ユーザーエクスペリエンス）の改善が必要
// 「認証・公開手続き」は既に不要（published状態で作成済み）
// UIの表現を改善することで、より直感的な操作感を提供できる