import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MenuCalendar from './components/MenuCalendar';
import RecipeCreation from './components/RecipeCreation';
import RecipeList from './components/RecipeList';
import NutritionList from './components/NutritionList';

function App() {
  const [generatedMenu, setGeneratedMenu] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* ヘッダー */}
          <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
            <div className="text-lg font-semibold text-slate-800">
              給食献立サポート
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">Solver: Fixstars Amplify AE</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                Connected
              </span>
            </div>
          </header>

          {/* コンテンツエリア */}
          <div className="flex-1 overflow-y-auto p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/menu-calendar"
                element={
                  <MenuCalendar
                    generatedMenu={generatedMenu}
                    selectedMonth={selectedMonth}
                  />
                }
              />
              <Route
                path="/recipe-creation"
                element={
                  <RecipeCreation
                    onMenuGenerated={(menu, month) => {
                      // 既存のメニューデータを保持しながら、新しい週のデータをマージ
                      setGeneratedMenu(prevMenu => {
                        if (!prevMenu || !Array.isArray(prevMenu)) {
                          // 初回またはprevMenuが配列でない場合は新しいメニューをそのまま設定
                          return menu;
                        }
                        // 配列同士を連結
                        return [...prevMenu, ...menu];
                      });
                      setSelectedMonth(month);
                    }}
                  />
                }
              />
              <Route path="/recipe-list" element={<RecipeList />} />
              <Route path="/nutrition-list" element={<NutritionList />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
