import React, { useState, useEffect } from 'react';

const MenuCalendar = ({ generatedMenu, selectedMonth }) => {
  // selectedMonthが渡されている場合はそれを初期値として使用
  const [currentYear, setCurrentYear] = useState(
    selectedMonth ? selectedMonth.year : new Date().getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState(
    selectedMonth ? selectedMonth.month : new Date().getMonth()
  );
  const [menuData, setMenuData] = useState({});
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recipeData, setRecipeData] = useState(null);

  // カテゴリ判定用のキーワード
  const SOUP_WORDS = ['スープ', '汁', '煮', 'ポタージュ', 'みそ汁', 'すまし汁'];
  const DESSERT_WORDS = ['ゼリー', 'クレープ', 'ヨーグルト', 'ぽんかん', 'りんご', 'ひしもち', 'ムース', 'だんご', 'まんじゅう', '豆'];
  const SALAD_WORDS = ['サラダ', 'おひたし', '和え物', 'ふりかけ', 'ソテー', 'たくあん'];
  const DRINK_WORDS = ['牛乳', 'ミルク', 'ジュース', '飲料'];

  // メニュー名からカテゴリを判定する関数
  const classifyMenu = (name) => {
    const n = name.replace(/^◎/, ''); // 記号を除去
    if (DRINK_WORDS.some(w => n.includes(w))) return 'drink';
    if (DESSERT_WORDS.some(w => n.includes(w))) return 'dessert';
    if (SOUP_WORDS.some(w => n.includes(w))) return 'soup';
    if (SALAD_WORDS.some(w => n.includes(w))) return 'salad';
    return null; // main か side は順番で判定
  };

  // カテゴリに応じた背景色を返す関数
  const getCategoryClass = (category) => {
    const classes = {
      main: 'bg-[#fde2e2]',      // メイン - ピンク
      side: 'bg-[#e2eeff]',      // サイド - ブルー
      salad: 'bg-[#fff9c4]',     // サラダ - 淡黄
      soup: 'bg-[#e8f5e9]',      // 汁物 - 淡緑
      dessert: 'bg-[#f3e5f5]',   // デザート - 淡紫
      drink: 'bg-white border border-slate-200' // 飲み物 - 白
    };
    return classes[category] || 'bg-slate-100';
  };

  useEffect(() => {
    if (selectedMonth) {
      setCurrentYear(selectedMonth.year);
      setCurrentMonth(selectedMonth.month);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (generatedMenu && selectedMonth) {
      console.log('[MenuCalendar] Processing menu data:', {
        generatedMenu,
        selectedMonth,
        currentYear,
        currentMonth
      });

      // 生成されたメニューをカレンダー用のデータ構造に変換
      const data = {};
      const year = selectedMonth.year;
      const month = selectedMonth.month;
      const startDay = selectedMonth.startDay;

      console.log('[MenuCalendar] Start date info:', { year, month, startDay });

      // 対象週の月曜日から金曜日（5日間）にメニューを割り当て
      const startDate = new Date(year, month, startDay);
      console.log('[MenuCalendar] Start date:', startDate);

      // 生成されたメニューを指定の週の平日（月曜〜金曜）に割り当て
      generatedMenu.forEach((dayMenu, index) => {
        if (index < 5) {
          // startDateから index 日後の日付を計算
          const targetDate = new Date(startDate);
          targetDate.setDate(startDate.getDate() + index);

          const day = targetDate.getDate();
          const targetMonth = targetDate.getMonth();
          const targetYear = targetDate.getFullYear();

          const key = `${targetYear}-${targetMonth + 1}-${day}`;
          console.log(`[MenuCalendar] Day ${index + 1}: key=${key}, date=${targetDate}`);

          // メニューをカテゴリ付きオブジェクトに変換
          const menus = Array.isArray(dayMenu.menu) ? dayMenu.menu : [];
          let mainAssigned = false;

          const categorizedMenus = menus.map(menuName => {
            // menuNameがオブジェクトの場合とstring の場合を処理
            let displayName, menuId, category;
            if (typeof menuName === 'object' && menuName !== null) {
              displayName = menuName.name || menuName;
              menuId = menuName.menu_id || null;
              category = menuName.category || null;
            } else {
              displayName = typeof menuName === 'string' ? menuName.replace(/^◎/, '') : menuName;
              menuId = null;
              category = null;
            }

            // バックエンドからカテゴリが提供されている場合はそれを使用
            if (category) {
              // バックエンドのカテゴリをフロントエンドのカテゴリにマッピング
              const categoryMap = {
                '主食': 'main',
                '主菜': 'side',
                '副菜': 'salad',
                '汁物': 'soup',
                'デザート': 'dessert'
              };
              const mappedCategory = categoryMap[category] || 'side';

              // 牛乳は特別扱い
              if (displayName.includes('牛乳') || displayName.includes('ミルク')) {
                return { name: displayName, category: 'drink', menu_id: menuId, backendCategory: category };
              }

              return { name: displayName, category: mappedCategory, menu_id: menuId, backendCategory: category };
            }

            // バックエンドからカテゴリが提供されていない場合は従来の判定方法
            const cat = classifyMenu(displayName);

            if (cat) {
              return { name: displayName, category: cat, menu_id: menuId };
            }

            // main/side の判定: 最初のものをmain、残りをsideに
            if (!mainAssigned) {
              mainAssigned = true;
              return { name: displayName, category: 'main', menu_id: menuId };
            }
            return { name: displayName, category: 'side', menu_id: menuId };
          });

          // カテゴリの優先順位を定義（主食 > 主菜 > 副菜 > 汁物 > デザート > 牛乳）
          const categoryOrder = {
            'main': 1,      // 主食
            'side': 2,      // 主菜
            'salad': 3,     // 副菜
            'soup': 4,      // 汁物
            'dessert': 5,   // デザート
            'drink': 6      // 牛乳
          };

          // カテゴリ順にソート
          const sortedMenus = categorizedMenus.sort((a, b) => {
            const orderA = categoryOrder[a.category] || 999;
            const orderB = categoryOrder[b.category] || 999;
            return orderA - orderB;
          });

          // メニューデータと一緒にdaily_totalsも保存
          data[key] = {
            menus: sortedMenus,
            daily_totals: dayMenu.daily_totals || {}
          };
        }
      });

      console.log('[MenuCalendar] Final menu data:', data);

      // 既存のメニューデータを保持しながら、新しいデータをマージ
      setMenuData(prevMenuData => {
        const merged = {
          ...(prevMenuData || {}),
          ...data
        };
        console.log('[MenuCalendar] Merged menu data:', merged);
        return merged;
      });
    }
  }, [generatedMenu, selectedMonth, currentYear, currentMonth]);

  const renderCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    const today = new Date();

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    const cells = [];

    for (let i = 0; i < totalCells; i++) {
      const weekday = i % 7;
      let cellClass = 'border border-slate-300 align-top h-24 p-1 text-xs';
      let cellContent = null;
      let dayNumber = null;

      if (weekday === 0) cellClass += ' bg-red-50';
      if (weekday === 6) cellClass += ' bg-blue-50';

      if (i < firstDay) {
        // 前月の日付
        const prevDay = prevMonthDays - firstDay + i + 1;
        cellClass += ' bg-gray-300 opacity-50';
        dayNumber = `${prevDay}日`;
      } else if (i - firstDay < daysInMonth) {
        // 当月の日付
        const day = i - firstDay + 1;
        const isToday =
          currentYear === today.getFullYear() &&
          currentMonth === today.getMonth() &&
          day === today.getDate();

        if (isToday) cellClass += ' outline outline-2 outline-blue-500 outline-offset-[-2px]';

        const key = `${currentYear}-${currentMonth + 1}-${day}`;
        const dayData = menuData[key];
        const menus = dayData ? (dayData.menus || dayData) : [];

        dayNumber = `${day}日`;
        cellContent = (Array.isArray(menus) ? menus : []).map((menu, idx) => {
          const menuName = typeof menu === 'string' ? menu : menu.name;
          const category = typeof menu === 'object' && menu.category ? menu.category : 'main';
          const categoryClass = getCategoryClass(category);

          return (
            <div
              key={idx}
              className={`menu-item px-2 py-0.5 rounded text-xs mb-0.5 ${categoryClass} whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:opacity-80`}
              onClick={() => handleMenuClick(typeof menu === 'object' ? menu : { name: menu, menu_id: null })}
            >
              {menuName}
            </div>
          );
        });
      } else {
        // 次月の日付
        const nextDay = i - firstDay - daysInMonth + 1;
        cellClass += ' bg-gray-300 opacity-50';
        dayNumber = `${nextDay}日`;
      }

      // その日のカロリーを計算（当月の日付のみ）
      let totalCalories = 0;
      if (i >= firstDay && i - firstDay < daysInMonth) {
        const key = `${currentYear}-${currentMonth + 1}-${i - firstDay + 1}`;
        const dayData = menuData[key];

        if (dayData) {
          // 新しい形式（オブジェクト）の場合
          if (dayData.daily_totals && dayData.daily_totals['エネルギー']) {
            totalCalories = Math.round(dayData.daily_totals['エネルギー']);
          } else if (dayData.menus && dayData.menus.length > 0) {
            // daily_totalsがない場合は650kcalを仮表示
            totalCalories = 650;
          }
        }
      }

      cells.push(
        <td key={i} className={cellClass}>
          <div className="flex items-center justify-between px-1 py-1 mb-1">
            <div className="text-sm text-slate-700 font-bold">
              {dayNumber}
            </div>
            {totalCalories > 0 && (
              <div className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold">
                {totalCalories}kcal
              </div>
            )}
          </div>
          {cellContent}
        </td>
      );
    }

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(<tr key={i}>{cells.slice(i, i + 7)}</tr>);
    }

    return (
      <table className="menu-calendar border-collapse w-full">
        <thead>
          <tr>
            {dayNames.map((day, idx) => (
              <th key={idx} className="bg-slate-200 border border-slate-300 px-2 py-2 text-center font-semibold text-sm text-slate-600">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    );
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // レシピ詳細を読み込む関数
  const loadRecipeDetail = async (menuId) => {
    try {
      const response = await fetch(`/recipe/${menuId}.json`);
      if (response.ok) {
        const data = await response.json();
        setRecipeData(data);
        setIsModalOpen(true);
      } else {
        console.error('Recipe not found:', menuId);
        // レシピが見つからない場合は基本情報のみ表示
        setRecipeData({
          menu_id: menuId,
          menu_name: selectedRecipe,
          error: 'レシピ詳細が見つかりません'
        });
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to load recipe:', error);
      setRecipeData({
        menu_id: menuId,
        menu_name: selectedRecipe,
        error: 'レシピ詳細の読み込みに失敗しました'
      });
      setIsModalOpen(true);
    }
  };

  // モーダルを閉じる関数
  const closeModal = () => {
    setIsModalOpen(false);
    setRecipeData(null);
    setSelectedRecipe(null);
  };

  // メニューをクリックしたときの処理
  const handleMenuClick = (menu) => {
    if (menu.menu_id) {
      setSelectedRecipe(menu.name);
      loadRecipeDetail(menu.menu_id);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            {currentYear}年{currentMonth + 1}月
          </h2>
          <div className="flex gap-2 items-center">
            <button
              onClick={goToToday}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50"
            >
              今日
            </button>
            <button
              onClick={goToPreviousMonth}
              className="w-8 h-8 bg-slate-700 text-white rounded flex items-center justify-center hover:bg-slate-800"
            >
              &lt;
            </button>
            <button
              onClick={goToNextMonth}
              className="w-8 h-8 bg-slate-700 text-white rounded flex items-center justify-center hover:bg-slate-800"
            >
              &gt;
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">費用の合計</p>
            <p className="text-2xl font-bold text-slate-800">
              0 <span className="text-sm font-normal text-slate-400">円</span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均エネルギー</p>
            <p className="text-2xl font-bold text-slate-800">
              0 <span className="text-sm font-normal text-slate-400">kcal</span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均たんぱく質</p>
            <p className="text-2xl font-bold text-slate-800">
              0 <span className="text-sm font-normal text-slate-400">g</span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均脂質・炭水化物</p>
            <p className="text-2xl font-bold text-slate-800">
              0 / 0 <span className="text-sm font-normal text-slate-400">g</span>
            </p>
          </div>
        </div>

        {renderCalendar()}
      </div>

      {/* レシピ詳細モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" onClick={closeModal}>
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div
            className="relative bg-white h-full w-full max-w-2xl shadow-2xl overflow-y-auto animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-slate-800">レシピ詳細</h2>
              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-6">
              {recipeData && !recipeData.error ? (
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{recipeData.menu_name}</h3>
                    <p className="text-sm text-slate-500">メニューID: {recipeData.menu_id}</p>
                  </div>

                  {recipeData.nutrition && (
                    <div className="mb-6 bg-slate-50 rounded-lg p-4">
                      <h4 className="text-lg font-bold text-slate-700 mb-3">栄養価</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">エネルギー</span>
                          <span className="font-semibold">{recipeData.nutrition.energy_kcal} kcal</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">たんぱく質</span>
                          <span className="font-semibold">{recipeData.nutrition.protein_g} g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">脂質</span>
                          <span className="font-semibold">{recipeData.nutrition.fat_g} g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">炭水化物</span>
                          <span className="font-semibold">{recipeData.nutrition.carbohydrate_g} g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-600">塩分</span>
                          <span className="font-semibold">{recipeData.nutrition.salt_g} g</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {recipeData.ingredients && recipeData.ingredients.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-bold text-slate-700 mb-3">材料</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {recipeData.ingredients.map((ingredient, idx) => (
                          <li key={idx} className="text-sm text-slate-600">{ingredient}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recipeData.instructions && recipeData.instructions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-bold text-slate-700 mb-3">調理手順</h4>
                      <ol className="list-decimal list-inside space-y-2">
                        {recipeData.instructions.map((instruction, idx) => (
                          <li key={idx} className="text-sm text-slate-600">{instruction}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {recipeData.notes && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">{recipeData.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-600 mb-2">{recipeData?.error || 'レシピ情報を読み込んでいます...'}</p>
                  {recipeData?.menu_name && (
                    <p className="text-sm text-slate-500">メニュー名: {recipeData.menu_name}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default MenuCalendar;
