import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateMenuStream } from '../services/api';
import flatpickr from 'flatpickr';
import { Japanese } from 'flatpickr/dist/l10n/ja.js';
import 'flatpickr/dist/themes/airbnb.css';

// 次の月曜日の日付を YYYY-MM-DD 形式で返す
const getNextMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
};

// 指定日付から n 日後を YYYY-MM-DD 形式で返す
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return formatDate(d);
};

// Date オブジェクトを YYYY-MM-DD 形式に変換（タイムゾーン安全）
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const RecipeCreation = ({ onMenuGenerated, schoolId, schoolIdB }) => {
  const navigate = useNavigate();
  const defaultStart = getNextMonday();
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(addDays(defaultStart, 4));
  const [totalDays, setTotalDays] = useState(0);
  const [targetCost, setTargetCost] = useState(300);
  const [addMilk, setAddMilk] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState(null);
  const [partialResults, setPartialResults] = useState([]);

  const startRef = useRef(null);
  const endRef = useRef(null);
  const fpStartRef = useRef(null);
  const fpEndRef = useRef(null);
  // onChange で最新値を参照するためのref
  const startDateRef = useRef(defaultStart);
  // start イベントで受け取った school_days を保持するref
  const schoolDaysRef = useRef(null);

  const isInvalid = !startDate || !endDate || endDate < startDate;

  // flatpickr 初期化
  useEffect(() => {
    fpStartRef.current = flatpickr(startRef.current, {
      locale: Japanese,
      dateFormat: 'Y-m-d',
      defaultDate: startDate,
      onChange: ([date]) => {
        if (!date) return;
        const val = formatDate(date);
        startDateRef.current = val;
        setStartDate(val);
        fpEndRef.current?.set('minDate', date);
        // 終了日が開始日より前になったらリセット
        if (fpEndRef.current?.selectedDates[0] < date) {
          fpEndRef.current.setDate(date);
          setEndDate(val);
        }
      },
    });

    fpEndRef.current = flatpickr(endRef.current, {
      locale: Japanese,
      dateFormat: 'Y-m-d',
      defaultDate: endDate,
      minDate: startDate,
      onChange: ([date]) => {
        if (!date) return;
        setEndDate(formatDate(date));
      },
    });

    return () => {
      fpStartRef.current?.destroy();
      fpEndRef.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 生成中はカレンダーを無効化
  useEffect(() => {
    const startInput = fpStartRef.current?._input;
    const endInput = fpEndRef.current?._input;
    if (startInput) startInput.disabled = isGenerating;
    if (endInput) endInput.disabled = isGenerating;
  }, [isGenerating]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setError(null);
    setPartialResults([]);
    setTotalDays(0);
    setProgressMessage('アニーリング計算を開始しました...');

    const [year, month, day] = startDate.split('-').map(Number);

    generateMenuStream(
      {
        cost: targetCost,
        start_date: startDate,
        end_date: endDate,
        school_id: schoolId,
        school_id_b: schoolIdB,
        add_milk: addMilk,
      },
      (dayEvent) => {
        setPartialResults(prev => {
          const updated = [...prev];
          updated[dayEvent.day - 1] = dayEvent;
          return updated;
        });
        setProgressMessage(`${dayEvent.day}日目の献立が確定しました...`);
      },
      (result) => {
        onMenuGenerated(result.menu, { year, month: month - 1, startDay: day, schoolDays: schoolDaysRef.current });
        setIsGenerating(false);
        navigate('/menu-calendar');
      },
      (err) => {
        console.error('Menu generation failed:', err);
        setError(err.message || '献立の生成に失敗しました');
        setIsGenerating(false);
        setProgressMessage('');
      },
      (startInfo) => {
        setTotalDays(startInfo.total_days);
        schoolDaysRef.current = startInfo.school_days || null;
      }
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">
          基本パラメータ
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
          {/* 開始日 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              開始日
            </label>
            <input
              ref={startRef}
              type="text"
              placeholder="開始日を選択"
              className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
              readOnly
            />
          </div>

          {/* 終了日 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              終了日
            </label>
            <input
              ref={endRef}
              type="text"
              placeholder="終了日を選択"
              className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
              readOnly
            />
          </div>

          {/* 目標費用 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              目標費用　※1日あたり（1人）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={targetCost}
                onChange={(e) => setTargetCost(Number(e.target.value))}
                className="flex-1 border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={isGenerating}
                min="0"
                step="10"
              />
              <span className="text-sm text-slate-500">円</span>
            </div>
          </div>
        </div>

        {/* 牛乳オプション */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={addMilk}
              onChange={(e) => setAddMilk(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              disabled={isGenerating}
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                牛乳を追加する（200ml）
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                各日の献立に牛乳（エネルギー122kcal、たんぱく質6.6g、脂質7.6g、20円）を追加します
              </p>
            </div>
          </label>
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
          disabled={isGenerating || isInvalid}
          className={`font-bold py-4 px-12 rounded-full shadow-lg transition-all flex items-center gap-3 mx-auto ${
            isGenerating || isInvalid
              ? 'bg-slate-400 cursor-not-allowed text-white'
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
      </div>

      {/* リアルタイム生成プレビュー */}
      {isGenerating && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            アニーリング計算中
          </h3>

          {/* プログレスバー */}
          {(() => {
            const doneDays = partialResults.filter(Boolean).length;
            const pct = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0;
            return (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{doneDays} / {totalDays || '...'} 日完了</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* 日ごとの結果 */}
          <div className="space-y-2">
            {Array.from({ length: totalDays || partialResults.length }, (_, i) => {
              const dayResult = partialResults[i];
              const recipes = dayResult?.plan_a?.recipes || [];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm ${
                    dayResult ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    dayResult ? 'bg-green-500 text-white' : 'bg-slate-300 text-slate-600'
                  }`}>
                    {dayResult ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700 mr-2">{i + 1}日目</span>
                    {dayResult ? (
                      <span className="text-slate-600 text-xs">
                        {recipes.map(r => r.title).join(' ／ ')}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">最適化中...</span>
                    )}
                  </div>
                  {dayResult && (
                    <span className="text-xs text-green-600 font-medium flex-shrink-0">
                      ¥{Math.round(dayResult.plan_a.totals?.cost ?? 0)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-blue-900">最適化について</h4>

        {/* Solver構成 */}
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">使用 Solver</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-white border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-blue-800">Fixstars Amplify AE</p>
              <p className="text-xs text-slate-600 mt-0.5">前半日程（Day 1→）を担当。シミュレーテッドアニーリング型クラウドSolver。</p>
            </div>
            <div className="bg-white border border-purple-200 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-purple-800">TOSHIBA SQBM+</p>
              <p className="text-xs text-slate-600 mt-0.5">後半日程（Day N←）を担当。東芝製量子インスパイアード Solver。トークン未設定時は Amplify AE にフォールバック。</p>
            </div>
          </div>
        </div>

        {/* 並列実行方式 */}
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wider">並列実行方式（投機的並列）</p>
          <p className="text-sm text-blue-800">
            2つの Solver が前方（Day 1→）と後方（Day N←）から同時に計算を開始し、中央で合流します。
            各日の計算が完了し次第、順次結果が画面に表示されます。
          </p>
        </div>

        {/* 最適化の制約 */}
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wider">最適化の制約条件</p>
          <ul className="text-xs text-blue-800 space-y-0.5 list-disc list-inside">
            <li>栄養バランス（エネルギー・たんぱく質・脂質・ナトリウム）</li>
            <li>目標費用（指定した合計予算に近づける）</li>
            <li>カテゴリ構成（主食・主菜・副菜・汁物の組み合わせ）</li>
            <li>ジャンル多様性（同一ジャンルの連続を回避）</li>
            <li>レシピ重複なし（期間内で同一レシピを繰り返さない）</li>
          </ul>
        </div>

        <p className="text-xs text-blue-600">
          計算時間は日数・レシピ数により異なります（通常 数十秒〜数分）。土日・祝日は自動的に除外されます。
        </p>
      </div>
    </div>
  );
};

export default RecipeCreation;
