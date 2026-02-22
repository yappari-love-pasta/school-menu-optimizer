import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateMenu } from '../services/api';

const RecipeCreation = ({ onMenuGenerated }) => {
  const navigate = useNavigate();
  const [targetWeek, setTargetWeek] = useState('');
  const [weekOptions, setWeekOptions] = useState([]);
  const [targetCost, setTargetCost] = useState(1500); // 目標費用を状態管理
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    // 今週から16週分の選択肢を生成 + 月単位の選択肢（3月・4月）を追加
    const generateWeekOptions = () => {
      const options = [];
      const now = new Date();

      // 週単位の選択肢
      for (let i = 0; i < 16; i++) {
        // 今週の月曜日を基準に計算
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() + 1 + (i * 7));

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const year = monday.getFullYear();
        const month = monday.getMonth() + 1;
        const day = monday.getDate();

        options.push({
          value: `${year}-${month}-${day}`,
          label: `${year}年${month}月${day}日週 (${month}/${day} - ${friday.getMonth() + 1}/${friday.getDate()})`,
          startDate: monday,
          days: 5,
          type: 'week'
        });
      }

      // 月単位の選択肢を追加（3月・4月固定）
      const currentYear = now.getFullYear();

      // 3月 (31日)
      options.push({
        value: `${currentYear}-3-1-month`,
        label: `${currentYear}年3月 (1ヶ月分・31日間)`,
        startDate: new Date(currentYear, 2, 1),
        days: 31,
        type: 'month'
      });

      // 4月 (30日)
      options.push({
        value: `${currentYear}-4-1-month`,
        label: `${currentYear}年4月 (1ヶ月分・30日間)`,
        startDate: new Date(currentYear, 3, 1),
        days: 30,
        type: 'month'
      });

      setWeekOptions(options);
      if (options.length > 0) {
        setTargetWeek(options[0].value);
      }
    };

    generateWeekOptions();
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setProgressMessage('サーバーに送信中...');

    try {
      // 進捗メッセージを段階的に更新
      const messages = [
        { delay: 1200, text: 'アニーリング計算を開始しました...' },
        { delay: 2400, text: '最適化処理中...' },
        { delay: 3600, text: '栄養バランスを検証中...' },
        { delay: 4800, text: '献立を確定しています...' },
      ];

      messages.forEach(({ delay, text }) => {
        setTimeout(() => {
          if (isGenerating) {
            setProgressMessage(text);
          }
        }, delay);
      });

      // 1. 履歴データを構築（ここでは空の行列を送信しない）
      const history = {};

      // 2. 選択された期間の情報を取得
      const selectedOption = weekOptions.find(opt => opt.value === targetWeek);

      let year, month, day, days;

      if (selectedOption && selectedOption.type === 'month') {
        // 月単位の場合
        const parts = targetWeek.split('-');
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = 1;
        days = selectedOption.days;
      } else {
        // 週単位の場合
        const parts = targetWeek.split('-').map(Number);
        year = parts[0];
        month = parts[1];
        day = parts[2];
        days = 5; // 平日5日分固定
      }

      // 3. バックエンドAPIを呼び出し（レシピデータはバックエンド側で構築）
      // target_year_monthを YYYY-MM-DD 形式で作成
      const targetYearMonth = `${year}-${String(month).padStart(2, '0')}-01`;

      // 週番号を計算（日曜日始まり、1〜5）
      let targetWeekNumber = null;
      if (selectedOption && selectedOption.type === 'week') {
        // その月の1日が何曜日か取得
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const firstWeekday = firstDayOfMonth.getDay(); // 0=日曜日, 6=土曜日

        // 週番号を計算（日曜日始まり）
        // 日数 + 月初の曜日オフセット - 1 を7で割って切り上げ
        targetWeekNumber = Math.floor((day + firstWeekday - 1) / 7) + 1;

        // 週番号は1〜5の範囲に収める
        if (targetWeekNumber < 1) {
          targetWeekNumber = 1;
        } else if (targetWeekNumber > 5) {
          targetWeekNumber = 5;
        }
      }

      console.log('Calling backend API with:', {
        days,
        cost: targetCost,
        target_year_month: targetYearMonth,
        target_week: targetWeekNumber,
        type: selectedOption?.type
      });

      const result = await generateMenu({
        days: days,
        cost: targetCost,
        target_year_month: targetYearMonth,
        target_week: targetWeekNumber,
        school_id: 'default_school',  // TODO: ログイン機能実装時に実際の school_id を使用
        history: history,
      });

      console.log('API Response:', result);

      // 7. 結果を保存してカレンダーページに遷移
      onMenuGenerated(result.menu, { year, month: month - 1, startDay: day });

      setIsGenerating(false);
      navigate('/menu-calendar');

    } catch (err) {
      console.error('Menu generation failed:', err);
      setError(err.message || '献立の生成に失敗しました');
      setIsGenerating(false);
      setProgressMessage('');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">
          基本パラメータ
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              対象期間（週または月）
            </label>
            <select
              value={targetWeek}
              onChange={(e) => setTargetWeek(e.target.value)}
              className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={isGenerating}
            >
              {weekOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              目標費用 (C)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={targetCost}
                onChange={(e) => setTargetCost(Number(e.target.value))}
                className="flex-1 border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={isGenerating}
                min="0"
                step="100"
              />
              <span className="text-sm text-slate-500">円</span>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`font-bold py-4 px-12 rounded-full shadow-lg transition-all flex items-center gap-3 mx-auto ${
            isGenerating
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isGenerating && (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          )}
          {isGenerating ? progressMessage : '献立を生成する'}
        </button>

        {isGenerating && (
          <p className="mt-4 text-sm text-slate-500">
            アニーリング計算中です。しばらくお待ちください...
          </p>
        )}
      </div>

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-blue-900 mb-2">📘 最適化について</h4>
        <p className="text-sm text-blue-800">
          Fixstars Amplify AE（アニーリングマシン）を使用して、
          栄養価・費用・ジャンルの統一・多様性などの制約を満たす最適な献立を生成します。
          計算には数秒〜数十秒かかる場合があります。
        </p>
      </div>
    </div>
  );
};

export default RecipeCreation;
