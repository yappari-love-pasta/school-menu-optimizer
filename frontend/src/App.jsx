import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MenuCalendar from './components/MenuCalendar';
import RecipeCreation from './components/RecipeCreation';
import RecipeList from './components/RecipeList';
import FoodCostSettings from './components/FoodCostSettings';
import NutritionList from './components/NutritionList';

const SCHOOLS = [
  { id: '62059dce-db8f-4fde-b59a-444853efe5d8', name: 'Aコース' },
  { id: 'b4e2f891-c7d3-4a56-9f18-2b3c4d5e6f7a', name: 'Bコース' },
];

// 献立作成・ダッシュボードではコース切り替えを非表示
const HIDE_SWITCHER_PATHS = ['/dashboard', '/recipe-creation'];

const SchoolSwitcher = ({ schoolIndex, switchSchool }) => {
  const location = useLocation();
  if (HIDE_SWITCHER_PATHS.includes(location.pathname)) return null;
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-1 shadow-inner gap-0.5">
      {SCHOOLS.map((s, idx) => (
        <button
          key={s.id}
          onClick={() => switchSchool(idx)}
          className={`px-4 py-1.5 rounded-md text-sm transition-all duration-200 ${
            schoolIndex === idx
              ? 'bg-white text-slate-800 font-semibold shadow-sm'
              : 'text-slate-500 hover:text-slate-700 font-medium'
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
};

function App() {
  const [generatedMenu, setGeneratedMenu] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [schoolIndex, setSchoolIndex] = useState(0);
  const [animClass, setAnimClass] = useState('');
  const [calendarView, setCalendarView] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  const switchSchool = (idx) => {
    if (idx === schoolIndex) return;
    const dir = idx > schoolIndex ? 'right' : 'left';
    setSchoolIndex(idx);
    setAnimClass(dir === 'right' ? 'school-slide-in-right' : 'school-slide-in-left');
    setGeneratedMenu(null);
    setSelectedMonth(null);
  };

  const school = SCHOOLS[schoolIndex];

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />

        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* ヘッダー */}
          <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
            <SchoolSwitcher schoolIndex={schoolIndex} switchSchool={switchSchool} />

            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm text-slate-500">
                Solver: <span className="text-blue-600 font-medium">Fixstars Amplify AE</span>
                <span className="mx-1.5 text-slate-300">|</span>
                <span className="text-purple-600 font-medium">TOSHIBA SQBM+</span>
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                献立 太郎
              </span>
            </div>
          </header>

          {/* コンテンツエリア - overflow:hidden でアニメーション中のクリップ */}
          <div className="flex-1 relative overflow-hidden">
            <div
              key={schoolIndex}
              className={`absolute inset-0 overflow-y-auto p-8 ${animClass}`}
              onAnimationEnd={() => setAnimClass('')}
            >
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard schoolId={SCHOOLS[0].id} />} />
                <Route
                  path="/menu-calendar"
                  element={
                    <MenuCalendar
                      generatedMenu={generatedMenu}
                      selectedMonth={selectedMonth}
                      schoolId={school.id}
                      calendarView={calendarView}
                      onCalendarViewChange={setCalendarView}
                    />
                  }
                />
                <Route
                  path="/recipe-creation"
                  element={
                    <RecipeCreation
                      schoolId={SCHOOLS[0].id}
                      schoolIdB={SCHOOLS[1].id}
                      onMenuGenerated={(menu, month) => {
                        setGeneratedMenu(prevMenu => {
                          if (!prevMenu || !Array.isArray(prevMenu)) {
                            return menu;
                          }
                          return [...prevMenu, ...menu];
                        });
                        setSelectedMonth(month);
                      }}
                    />
                  }
                />
                <Route path="/recipe-list" element={<RecipeList schoolId={school.id} />} />
                <Route path="/food-cost-settings" element={<FoodCostSettings schoolId={school.id} />} />
                <Route path="/nutrition-list" element={<NutritionList schoolId={school.id} />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
