import React from 'react';
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

const Dashboard = () => {
  // グラフ用のデータ
  const months = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月'];

  // コスト推移グラフデータ
  const costChartData = {
    labels: months,
    datasets: [{
      label: 'コスト',
      data: [420, 310, 460, 340, 520, 380, 440, 490, 410, 505],
      backgroundColor: '#10b981',
      borderRadius: 6
    }]
  };

  const costChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { borderDash: [5, 5] }
      }
    }
  };

  // たんぱく質推移グラフデータ
  const proteinChartData = {
    labels: months,
    datasets: [{
      label: '摂取量',
      data: [32, 33, 34, 22, 26, 31, 29, 32, 28, 30],
      backgroundColor: '#f59e0b',
      borderRadius: 6
    }]
  };

  const proteinChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { borderDash: [5, 5] }
      }
    }
  };

  // エネルギー推移グラフデータ
  const energyChartData = {
    labels: months,
    datasets: [{
      label: 'エネルギー',
      data: [640, 655, 638, 660, 645, 650, 642, 658, 649, 651],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
      fill: true
    }]
  };

  const energyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        min: 600,
        max: 700
      }
    }
  };

  // 脂質・炭水化物バランスグラフデータ
  const macroChartData = {
    labels: months,
    datasets: [
      {
        label: '脂質',
        data: [22, 24, 21, 25, 23, 22, 24, 21, 22, 23],
        backgroundColor: '#ec4899'
      },
      {
        label: '炭水化物',
        data: [55, 52, 58, 50, 54, 55, 53, 58, 56, 54],
        backgroundColor: '#8b5cf6'
      }
    ]
  };

  const macroChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true },
      y: { stacked: true }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 情報カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">システムについて</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            このシステムは、Fixstars Amplify AE（アニーリングマシン）を使用して、
            学校給食の献立を自動生成します。栄養価、費用、ジャンルの統一、
            多様性などの制約を考慮した最適な献立を提案します。
          </p>
          <div className="mt-4 flex gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              アニーリング最適化
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              栄養バランス
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">使い方</h3>
          <ol className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>「献立作成（最適化）」で対象月を選択</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>「献立を生成する」ボタンをクリック</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>アニーリング計算が完了するまで待機</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>「献立スケジュール」で結果を確認</span>
            </li>
          </ol>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 計算結果サマリー */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center gap-2 mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <h3 className="text-lg font-bold">計算結果サマリー</h3>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-white/20 pb-4">
              <span className="text-sm text-white/80">総コスト</span>
              <span className="text-2xl font-bold font-mono">¥1,961.284</span>
            </div>
            <div className="flex justify-between items-end border-b border-white/20 pb-4">
              <span className="text-sm text-white/80">目標合計コスト</span>
              <span className="text-2xl font-bold font-mono">¥2,000</span>
            </div>
            <div className="flex justify-between items-end pb-2">
              <span className="text-sm text-white/80">最適化精度</span>
              <span className="text-2xl font-bold font-mono">99.8%</span>
            </div>
          </div>

          <div className="mt-8 text-[10px] text-white/50 text-right italic">
            Last Updated: 2026/02/07
          </div>
        </div>

        {/* サブメトリクス */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-sm text-slate-500 font-medium">平均エネルギー</p>
            <p className="text-3xl font-bold mt-2">645 <span className="text-sm font-normal text-slate-400">kcal</span></p>
            <div className="mt-4 flex items-center gap-1 text-green-600 text-xs font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
              基準値内
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-sm text-slate-500 font-medium">レシピ再利用率</p>
            <p className="text-3xl font-bold mt-2">12.5 <span className="text-sm font-normal text-slate-400">%</span></p>
            <div className="mt-4 flex items-center gap-1 text-blue-600 text-xs font-bold">
              多様性維持
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-sm text-slate-500 font-medium">平均たんぱく質</p>
            <p className="text-3xl font-bold mt-2">23.8 <span className="text-sm font-normal text-slate-400">g</span></p>
            <div className="mt-4 flex items-center gap-1 text-green-600 text-xs font-bold">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
              基準値内
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-sm text-slate-500 font-medium">ジャンル多様性</p>
            <p className="text-3xl font-bold mt-2">85 <span className="text-sm font-normal text-slate-400">%</span></p>
            <div className="mt-4 flex items-center gap-1 text-purple-600 text-xs font-bold">
              良好
            </div>
          </div>
        </div>
      </div>

      {/* 推移グラフ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* コスト推移 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
            コスト推移 (円)
            <span className="text-[10px] text-slate-400 font-normal">2025年度実績</span>
          </h3>
          <div className="h-64">
            <Bar data={costChartData} options={costChartOptions} />
          </div>
        </div>

        {/* たんぱく質推移 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
            たんぱく質摂取量推移 (g)
            <span className="text-[10px] text-slate-400 font-normal">基準値: 18-20g</span>
          </h3>
          <div className="h-64">
            <Bar data={proteinChartData} options={proteinChartOptions} />
          </div>
        </div>

        {/* エネルギー推移 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
            エネルギー推移 (kcal)
            <span className="text-[10px] text-slate-400 font-normal">基準値: 650kcal</span>
          </h3>
          <div className="h-64">
            <Line data={energyChartData} options={energyChartOptions} />
          </div>
        </div>

        {/* 脂質・炭水化物バランス */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center justify-between">
            脂質・炭水化物バランス
            <span className="text-[10px] text-slate-400 font-normal">月別構成比</span>
          </h3>
          <div className="h-64">
            <Bar data={macroChartData} options={macroChartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
