import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { getDashboardStats } from '../services/api';

// Chart.jsのコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = ({ schoolId = '62059dce-db8f-4fde-b59a-444853efe5d8' }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getDashboardStats(schoolId);
        setStats(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [schoolId]);

  // 月別推移ラベルとデータ配列を生成
  const trends = stats?.monthly_trends || [];
  const labels = trends.map(t => t.label);
  const summary = stats?.summary || null;

  // コスト推移グラフデータ
  const costChartData = {
    labels,
    datasets: [{
      label: 'コスト (円)',
      data: trends.map(t => t.avg_cost),
      backgroundColor: '#10b981',
      borderRadius: 6
    }]
  };

  const costChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [5, 5] } }
    }
  };

  // たんぱく質推移グラフデータ
  const proteinChartData = {
    labels,
    datasets: [{
      label: '摂取量 (g)',
      data: trends.map(t => t.avg_protein),
      backgroundColor: '#f59e0b',
      borderRadius: 6
    }]
  };

  const proteinChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [5, 5] } }
    }
  };

  // エネルギー推移グラフデータ
  const energyChartData = {
    labels,
    datasets: [{
      label: 'エネルギー (kcal)',
      data: trends.map(t => t.avg_energy),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      fill: true
    }]
  };

  const energyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        min: trends.length > 0 ? Math.max(0, Math.min(...trends.map(t => t.avg_energy)) - 50) : 600,
        max: trends.length > 0 ? Math.max(...trends.map(t => t.avg_energy)) + 50 : 700,
      }
    }
  };

  // 脂質推移グラフデータ
  const fatChartData = {
    labels,
    datasets: [{
      label: '脂質 (g)',
      data: trends.map(t => t.avg_fat),
      backgroundColor: '#ec4899',
      borderRadius: 6
    }]
  };

  const fatChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [5, 5] } }
    }
  };

  // 食塩相当量推移グラフデータ
  const saltChartData = {
    labels,
    datasets: [{
      label: '食塩相当量 (g)',
      data: trends.map(t => Math.round(t.avg_sodium * 2.54 / 1000 * 10) / 10),
      backgroundColor: '#6366f1',
      borderRadius: 6
    }]
  };

  const saltChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [5, 5] } }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 情報カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">システムについて</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            このシステムは、<span className="font-semibold text-blue-700">Fixstars Amplify AE</span> と <span className="font-semibold text-purple-700">TOSHIBA SQBM+</span> の2種類のアニーリングソルバーを用いて、学校給食の献立を自動生成します。
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mt-2">
            献立生成では、前方（Day 1→）と後方（Day M→）を2つのソルバーで<span className="font-semibold">投機的並列実行</span>し、中央の日を逐次解くことで処理時間を短縮しています。栄養価・費用・ジャンル多様性・調理工程数などの制約を同時に最適化します。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              Fixstars Amplify AE
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
              TOSHIBA SQBM+
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              投機的並列実行
            </span>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
              栄養バランス最適化
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">使い方</h3>
          <ol className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>左メニュー「献立作成（最適化）」で、対象月・週を選択</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>「献立を生成する」ボタンをクリック</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>Amplify AE と SQBM+ が前後から並列計算。完了後に中央日を逐次処理（計算中はそのままお待ちください）</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>「献立スケジュール」カレンダーで結果を確認・保存</span>
            </li>
          </ol>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-3 text-slate-500">
            <svg className="animate-spin w-6 h-6 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>統計データを読み込んでいます...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          データの取得に失敗しました: {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 計算結果サマリー */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-6 shadow-xl text-white">
              <div className="flex items-center gap-2 mb-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                <h3 className="text-lg font-bold">給食コストサマリー（最大12か月間）</h3>
              </div>

              {summary ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-end border-b border-white/20 pb-4">
                    <span className="text-sm text-white/80">対象日数</span>
                    <span className="text-sm font-semibold">{summary.serving_days}日分</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/20 pb-4">
                    <span className="text-sm text-white/80">総コスト</span>
                    <span className="text-2xl font-bold font-mono">¥{summary.total_cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/20 pb-4">
                    <span className="text-sm text-white/80">目標合計コスト</span>
                    <span className="text-2xl font-bold font-mono">¥{summary.target_cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-end pb-2">
                    <span className="text-sm text-white/80">最適化精度</span>
                    <span className="text-2xl font-bold font-mono">{summary.optimization_accuracy}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-white/60 text-sm text-center mt-8">献立データがありません</p>
              )}
            </div>

            {/* サブメトリクス */}
            <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm text-slate-500 font-medium">平均エネルギー</p>
                <p className="text-3xl font-bold mt-2">
                  {summary ? summary.avg_energy : '—'} <span className="text-sm font-normal text-slate-400">kcal</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold">
                  {summary ? (
                    Math.abs(summary.avg_energy - 650) <= 65 ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                          <polyline points="16 7 22 7 22 13"/>
                        </svg>
                        基準値内
                      </span>
                    ) : (
                      <span className="text-orange-500">基準値外（目標: 650kcal）</span>
                    )
                  ) : <span className="text-slate-400">データなし</span>}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm text-slate-500 font-medium">平均たんぱく質</p>
                <p className="text-3xl font-bold mt-2">
                  {summary ? summary.avg_protein : '—'} <span className="text-sm font-normal text-slate-400">g</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold">
                  {summary ? (
                    Math.abs(summary.avg_protein - 20) <= 4 ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                          <polyline points="16 7 22 7 22 13"/>
                        </svg>
                        基準値内
                      </span>
                    ) : (
                      <span className="text-orange-500">基準値外（目標: 20g）</span>
                    )
                  ) : <span className="text-slate-400">データなし</span>}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm text-slate-500 font-medium">平均脂質</p>
                <p className="text-3xl font-bold mt-2">
                  {summary ? summary.avg_fat : '—'} <span className="text-sm font-normal text-slate-400">g</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold">
                  {summary ? (
                    Math.abs(summary.avg_fat - 18) <= 1.8 ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                          <polyline points="16 7 22 7 22 13"/>
                        </svg>
                        基準値内
                      </span>
                    ) : (
                      <span className="text-orange-500">基準値外（目標: 18g）</span>
                    )
                  ) : <span className="text-slate-400">データなし</span>}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm text-slate-500 font-medium">平均食塩相当量</p>
                <p className="text-3xl font-bold mt-2">
                  {summary ? summary.avg_salt : '—'} <span className="text-sm font-normal text-slate-400">g</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold">
                  {summary ? (
                    summary.avg_salt <= 2.5 ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                          <polyline points="16 7 22 7 22 13"/>
                        </svg>
                        基準値内
                      </span>
                    ) : (
                      <span className="text-red-500">基準値超（目標: 2.5g以下）</span>
                    )
                  ) : <span className="text-slate-400">データなし</span>}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm text-slate-500 font-medium">レシピ再利用率</p>
                <p className="text-3xl font-bold mt-2">
                  {summary ? summary.recipe_reuse_rate : '—'} <span className="text-sm font-normal text-slate-400">%</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-blue-600 text-xs font-bold">
                  {summary ? (summary.recipe_reuse_rate <= 20 ? '多様性維持' : '再利用多め') : <span className="text-slate-400">データなし</span>}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm text-slate-500 font-medium">ジャンル多様性</p>
                <p className="text-3xl font-bold mt-2">
                  {summary ? summary.genre_diversity : '—'} <span className="text-sm font-normal text-slate-400">%</span>
                </p>
                <div className="mt-4 flex items-center gap-1 text-purple-600 text-xs font-bold">
                  {summary ? (summary.genre_diversity >= 60 ? '良好' : '偏りあり') : <span className="text-slate-400">データなし</span>}
                </div>
              </div>
            </div>
          </div>

          {/* 推移グラフ */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* コスト推移 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
                1日あたりコスト推移 (円)
                <span className="text-[10px] text-slate-400 font-normal">過去12ヶ月実績</span>
              </h3>
              <div className="h-64">
                {trends.length > 0
                  ? <Bar data={costChartData} options={costChartOptions} />
                  : <p className="text-center text-slate-400 text-sm pt-20">データがありません</p>}
              </div>
            </div>

            {/* たんぱく質推移 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
                たんぱく質摂取量推移 (g)
                <span className="text-[10px] text-slate-400 font-normal">基準値: 20g</span>
              </h3>
              <div className="h-64">
                {trends.length > 0
                  ? <Bar data={proteinChartData} options={proteinChartOptions} />
                  : <p className="text-center text-slate-400 text-sm pt-20">データがありません</p>}
              </div>
            </div>

            {/* エネルギー推移 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
                エネルギー推移 (kcal)
                <span className="text-[10px] text-slate-400 font-normal">基準値: 650kcal</span>
              </h3>
              <div className="h-64">
                {trends.length > 0
                  ? <Line data={energyChartData} options={energyChartOptions} />
                  : <p className="text-center text-slate-400 text-sm pt-20">データがありません</p>}
              </div>
            </div>

            {/* 脂質推移 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
                脂質推移 (g)
                <span className="text-[10px] text-slate-400 font-normal">基準値: 18g</span>
              </h3>
              <div className="h-64">
                {trends.length > 0
                  ? <Bar data={fatChartData} options={fatChartOptions} />
                  : <p className="text-center text-slate-400 text-sm pt-20">データがありません</p>}
              </div>
            </div>

            {/* 食塩相当量推移 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
                食塩相当量推移 (g)
                <span className="text-[10px] text-slate-400 font-normal">基準値: 2.5g以下</span>
              </h3>
              <div className="h-64">
                {trends.length > 0
                  ? <Bar data={saltChartData} options={saltChartOptions} />
                  : <p className="text-center text-slate-400 text-sm pt-20">データがありません</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
