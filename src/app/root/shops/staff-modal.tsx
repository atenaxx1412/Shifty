{/* Create Staff Modal */}
{showCreateStaffModal && (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">新規スタッフ作成</h2>
        </div>
        <button
          onClick={() => setShowCreateStaffModal(false)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      <form onSubmit={handleCreateStaff} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">スタッフ名 *</label>
            <input
              type="text"
              value={staffFormData.name}
              onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              placeholder="佐藤花子"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">ログインID *</label>
            <input
              type="text"
              value={staffFormData.loginId}
              onChange={(e) => setStaffFormData({ ...staffFormData, loginId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              placeholder="sato_staff01"
              required
            />
            <p className="text-xs text-slate-500 mt-1">スタッフがログイン時に使用するIDです</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">パスワード *</label>
            <input
              type="password"
              value={staffFormData.password}
              onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              placeholder="6文字以上のパスワード"
              required
              minLength={6}
            />
          </div>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/50">
          <div className="flex items-start space-x-2">
            <div className="p-1 bg-emerald-100 rounded-full mt-1">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">スタッフ詳細について</p>
              <p className="text-xs text-slate-600">時給、勤務時間、スキルなどの詳細情報は、店長が後で管理画面から設定できます。まずは基本的なアカウント情報のみで作成を進めてください。</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => setShowCreateStaffModal(false)}
            className="px-6 py-2.5 text-slate-600 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200/80 transition-all duration-200 border border-slate-300/50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg"
          >
            スタッフを作成
          </button>
        </div>
      </form>
    </div>
  </div>
)}