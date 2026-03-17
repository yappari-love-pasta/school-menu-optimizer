import React, { useState, useEffect } from 'react';
import { getSavedMenu, getRecipes, getHolidays, deleteMenu } from '../services/api';

// 1日あたりの目標値（バックエンドの TARGET 定数と合わせる）
const TARGETS = {
  costPerDay: 300,  // 1500円/5日
  energy: 650,      // kcal
  protein: 20,      // g
  fat: 18,          // g
  sodium: 1000,     // mg
  salt: 2.5,        // g（食塩相当量 = ナトリウム1000mg × 2.54 / 1000）
};

const MenuCalendar = ({ generatedMenu, selectedMonth, schoolId, calendarView, onCalendarViewChange }) => {
  // calendarView（コース切り替え後の復元用）> selectedMonth（生成直後の遷移用）> 当月 の優先順位で初期値を設定
  const [currentYear, setCurrentYear] = useState(
    calendarView ? calendarView.year : (selectedMonth ? selectedMonth.year : new Date().getFullYear())
  );
  const [currentMonth, setCurrentMonth] = useState(
    calendarView ? calendarView.month : (selectedMonth ? selectedMonth.month : new Date().getMonth())
  );
  const [menuData, setMenuData] = useState({});
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recipeData, setRecipeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);
  const [holidays, setHolidays] = useState(new Set());

  // 当月の統計を計算
  const monthStats = React.useMemo(() => {
    const prefix = `${currentYear}-${currentMonth + 1}-`;
    const days = Object.entries(menuData)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, val]) => val)
      .filter(d => d && d.daily_totals && Object.keys(d.daily_totals).length > 0);

    if (days.length === 0) return null;

    const totalCost = days.reduce((sum, d) => sum + (d.daily_totals.cost || 0), 0);
    const avgEnergy = days.reduce((sum, d) => sum + (d.daily_totals['エネルギー'] || 0), 0) / days.length;
    const avgProtein = days.reduce((sum, d) => sum + (d.daily_totals['たんぱく質'] || 0), 0) / days.length;
    const avgFat = days.reduce((sum, d) => sum + (d.daily_totals['脂質'] || 0), 0) / days.length;
    const avgSodium = days.reduce((sum, d) => sum + (d.daily_totals['ナトリウム'] || 0), 0) / days.length;

    const numDays = days.length;
    const targetTotalCost = numDays * TARGETS.costPerDay;
    const roundedCost = Math.round(totalCost);
    const roundedEnergy = Math.round(avgEnergy);
    const roundedProtein = Math.round(avgProtein * 10) / 10;
    const roundedFat = Math.round(avgFat * 10) / 10;
    const roundedSalt = Math.round(avgSodium * 2.54 / 1000 * 10) / 10;

    return {
      totalCost: roundedCost,
      avgEnergy: roundedEnergy,
      avgProtein: roundedProtein,
      avgFat: roundedFat,
      avgSalt: roundedSalt,
      targetTotalCost,
      diffCost: roundedCost - targetTotalCost,
      diffEnergy: roundedEnergy - TARGETS.energy,
      diffProtein: Math.round((roundedProtein - TARGETS.protein) * 10) / 10,
      diffFat: Math.round((roundedFat - TARGETS.fat) * 10) / 10,
      diffSalt: Math.round((roundedSalt - TARGETS.salt) * 10) / 10,
    };
  }, [menuData, currentYear, currentMonth]);

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
      main:    'bg-[#fde2e2] hover:bg-[#f8a8a8]',   // メイン - ピンク
      side:    'bg-[#e2eeff] hover:bg-[#a8c0f8]',   // サイド - ブルー
      salad:   'bg-[#fff9c4] hover:bg-[#f0e060]',   // サラダ - 淡黄
      soup:    'bg-[#e8f5e9] hover:bg-[#a8d8ab]',   // 汁物 - 淡緑
      dessert: 'bg-[#f3e5f5] hover:bg-[#d8a8e8]',   // デザート - 淡紫
      drink:   'bg-white border border-slate-200 hover:bg-slate-200', // 飲み物 - 白
    };
    return classes[category] || 'bg-slate-100 hover:bg-slate-300';
  };

  useEffect(() => {
    if (selectedMonth) {
      setCurrentYear(selectedMonth.year);
      setCurrentMonth(selectedMonth.month);
      onCalendarViewChange?.({ year: selectedMonth.year, month: selectedMonth.month });
    }
  }, [selectedMonth]);

  // 祝日リストを取得（表示中の年が変わったら再取得）
  useEffect(() => {
    getHolidays(currentYear).then(list => setHolidays(new Set(list)));
  }, [currentYear]);

  // データベースから保存済み献立を読み込む
  useEffect(() => {
    const loadSavedMenu = async () => {
      setIsLoading(true);
      try {
        // 対象年月を計算（YYYY-MM-01形式）
        const targetYearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

        console.log('[MenuCalendar] Loading saved menu for:', targetYearMonth);

        const savedData = await getSavedMenu({
          school_id: schoolId,
          target_year_month: targetYearMonth
        });

        // 新フォーマット: 1レコード = 1日（target_date + menu_data.recipes）
        if (savedData && savedData.menus && Array.isArray(savedData.menus) && savedData.menus.length > 0) {
          console.log('[MenuCalendar] Saved menus found:', savedData.menus);

          const data = {};
          const categoryOrder = { 'main': 1, 'side': 2, 'salad': 3, 'soup': 4, 'dessert': 5, 'drink': 6 };
          const categoryMap = { '主食': 'main', '主菜': 'side', '副菜': 'salad', '汁物': 'soup', 'デザート': 'dessert' };

          savedData.menus.forEach((record) => {
            // target_date は "2026-04-07" 形式
            const dateStr = record.target_date;
            if (!dateStr) return;

            const [year, month, day] = dateStr.split('-').map(Number);
            const key = `${year}-${month}-${day}`;  // 例: "2026-4-7"

            const menuData = record.menu_data || {};
            const recipes = Array.isArray(menuData.recipes) ? menuData.recipes : [];

            // category は整数（0=主菜,1=副菜,2=主食,3=汁物,4=デザート）なので文字列に変換
            const INT_CAT_MAP = { 0: '主菜', 1: '副菜', 2: '主食', 3: '汁物', 4: 'デザート' };

            let mainAssigned = false;
            const categorizedMenus = recipes.map(menuItem => {
              const displayName = menuItem.title || menuItem.name || String(menuItem);
              const menuId = menuItem.id || menuItem.menu_id || null;
              // category_name（文字列）を優先し、整数の category はマップで変換
              const categoryName = menuItem.category_name ||
                (typeof menuItem.category === 'number' ? INT_CAT_MAP[menuItem.category] : null);

              if (displayName.includes('牛乳') || displayName.includes('ミルク')) {
                return { name: displayName, category: 'drink', menu_id: menuId };
              }

              if (categoryName && categoryMap[categoryName]) {
                return { name: displayName, category: categoryMap[categoryName], menu_id: menuId };
              }

              const cat = classifyMenu(displayName);
              if (cat) return { name: displayName, category: cat, menu_id: menuId };

              if (!mainAssigned) {
                mainAssigned = true;
                return { name: displayName, category: 'main', menu_id: menuId };
              }
              return { name: displayName, category: 'side', menu_id: menuId };
            });

            const sortedMenus = categorizedMenus.sort((a, b) =>
              (categoryOrder[a.category] || 999) - (categoryOrder[b.category] || 999)
            );

            // total_nutrition に cost を合算して daily_totals として使用
            const daily_totals = {
              ...(record.total_nutrition || {}),
              cost: record.total_cost || 0,
            };

            data[key] = { menus: sortedMenus, daily_totals };
          });

          console.log('[MenuCalendar] Loaded menu data from DB:', data);
          setMenuData(prev => ({ ...(prev || {}), ...data }));
        } else {
          console.log('[MenuCalendar] No saved menu found for this month');
        }
      } catch (error) {
        console.error('[MenuCalendar] Failed to load saved menu:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedMenu();
  }, [currentYear, currentMonth]);

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

      // 平日（月〜金）をスキップしながら n 日分の日付リストを生成（school_days がない場合のフォールバック）
      const getWeekdays = (startDate, n) => {
        const dates = [];
        const d = new Date(startDate);
        while (dates.length < n) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) dates.push(new Date(d));
          d.setDate(d.getDate() + 1);
        }
        return dates;
      };

      const startDate = new Date(year, month, startDay);
      console.log('[MenuCalendar] Start date:', startDate);

      // school_days があればそれを使用（土日・祝日を正確に除外済み）
      // なければ週末スキップのフォールバック
      const schoolDays = selectedMonth.schoolDays || null;

      // 生成されたメニューを平日に割り当て
      generatedMenu.forEach((dayMenu, index) => {
          let targetDate;
          if (schoolDays && index < schoolDays.length) {
            const [sd_y, sd_m, sd_d] = schoolDays[index].split('-').map(Number);
            targetDate = new Date(sd_y, sd_m - 1, sd_d);
          } else {
            // フォールバック: 週末スキップ
            const weekdays = getWeekdays(startDate, index + 1);
            targetDate = weekdays[index];
          }

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
      let isCurrentMonthCell = false;
      let dayForClick = -1;
      let dayDataForClick = null;

      if (weekday === 0) cellClass += ' bg-red-50';
      if (weekday === 6) cellClass += ' bg-blue-50';

      // 日付番号のフォント色（土曜: #007bbb / 日曜・祝日: #d3381c）
      let dayNumColor = '';
      if (weekday === 6) {
        dayNumColor = '#007bbb';
      } else if (weekday === 0) {
        dayNumColor = '#d3381c';
      }

      if (i < firstDay) {
        // 前月の日付
        const prevDay = prevMonthDays - firstDay + i + 1;
        cellClass += ' bg-gray-300 opacity-50';
        dayNumber = `${prevDay}日`;
      } else if (i - firstDay < daysInMonth) {
        // 当月の日付
        const day = i - firstDay + 1;

        // 祝日チェック（当月の日付のみ）
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (holidays.has(dateStr)) dayNumColor = '#d3381c';

        const isToday =
          currentYear === today.getFullYear() &&
          currentMonth === today.getMonth() &&
          day === today.getDate();

        if (isToday) cellClass += ' outline outline-2 outline-blue-500 outline-offset-[-2px]';

        const key = `${currentYear}-${currentMonth + 1}-${day}`;
        const dayData = menuData[key];
        const menus = dayData ? (dayData.menus || dayData) : [];

        dayNumber = `${day}日`;
        isCurrentMonthCell = true;
        dayForClick = day;
        dayDataForClick = dayData;
        cellContent = (Array.isArray(menus) ? menus : []).map((menu, idx) => {
          const menuName = typeof menu === 'string' ? menu : menu.name;
          const category = typeof menu === 'object' && menu.category ? menu.category : 'main';
          const categoryClass = getCategoryClass(category);

          return (
            <div
              key={idx}
              className={`menu-item px-2 py-0.5 rounded text-xs mb-0.5 ${categoryClass} whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer transition-colors duration-300 hover:duration-0`}
              onClick={(e) => { e.stopPropagation(); handleMenuClick(typeof menu === 'object' ? menu : { name: menu, menu_id: null }); }}
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

      // その日のカロリーと費用を計算（当月の日付のみ）
      let totalCalories = 0;
      let totalCost = 0;
      if (i >= firstDay && i - firstDay < daysInMonth) {
        const key = `${currentYear}-${currentMonth + 1}-${i - firstDay + 1}`;
        const dayData = menuData[key];

        if (dayData) {
          if (dayData.daily_totals) {
            if (dayData.daily_totals['エネルギー']) {
              totalCalories = Math.round(dayData.daily_totals['エネルギー']);
            }
            if (dayData.daily_totals.cost) {
              totalCost = Math.round(dayData.daily_totals.cost);
            }
          } else if (dayData.menus && dayData.menus.length > 0) {
            totalCalories = 650;
          }
        }
      }

      const calClass = totalCalories > 0
        ? (Math.abs(totalCalories - TARGETS.energy) <= TARGETS.energy * 0.1
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-600')
        : '';
      const costClass = totalCost > 0
        ? (totalCost <= TARGETS.costPerDay
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-600')
        : '';

      cells.push(
        <td
          key={i}
          className={`${cellClass}${isCurrentMonthCell ? ' cursor-pointer transition-colors duration-200 hover:duration-100 hover:bg-orange-100' : ''}`}
          onClick={isCurrentMonthCell ? () => handleDayClick(dayForClick, currentYear, currentMonth, dayDataForClick) : undefined}
        >
          <div className="flex items-start justify-between px-1 py-1 mb-1">
            <div className="text-sm font-bold" style={{ color: dayNumColor || '#334155' }}>
              {dayNumber}
            </div>
            <div className="flex flex-row items-center gap-1">
              {totalCalories > 0 && (
                <div className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${calClass}`}>
                  {totalCalories}kcal
                </div>
              )}
              {totalCost > 0 && (
                <div className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${costClass}`}>
                  {totalCost}円
                </div>
              )}
            </div>
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
      onCalendarViewChange?.({ year: currentYear - 1, month: 11 });
    } else {
      setCurrentMonth(currentMonth - 1);
      onCalendarViewChange?.({ year: currentYear, month: currentMonth - 1 });
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
      onCalendarViewChange?.({ year: currentYear + 1, month: 0 });
    } else {
      setCurrentMonth(currentMonth + 1);
      onCalendarViewChange?.({ year: currentYear, month: currentMonth + 1 });
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    onCalendarViewChange?.({ year: now.getFullYear(), month: now.getMonth() });
  };

  // レシピ詳細を読み込む関数
  const loadRecipeDetail = async (menuId) => {
    try {
      // バックエンドAPIからレシピ詳細を取得
      const data = await getRecipes(menuId);

      // バックエンドのデータ構造をフロントエンド用に変換
      const formattedData = {
        menu_id: data.id,
        menu_name: data.menu_name,
        nutrition: data.nutrition,
        ingredients: data.ingredients
          ? data.ingredients.map(ing => `${ing.name} ${ing.amount}g`)
          : [],
        instructions: data.instructions || [],
        notes: data.notes || ''
      };

      setRecipeData(formattedData);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Failed to load recipe:', error);
      // レシピが見つからない場合は基本情報のみ表示
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

  // 日付セル（余白）をクリックしたときの処理
  const handleDayClick = (day, year, month, dayData) => {
    setSelectedDayInfo({
      day,
      year,
      month: month + 1,
      daily_totals: dayData?.daily_totals || null,
      menus: dayData?.menus || [],
    });
    setIsDayModalOpen(true);
  };

  const closeDayModal = () => {
    setIsDayModalOpen(false);
    setSelectedDayInfo(null);
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

        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">費用の合計</p>
            <p className="text-2xl font-bold text-slate-800">
              {monthStats ? monthStats.totalCost.toLocaleString() : 0} <span className="text-sm font-normal text-slate-400">円</span>
            </p>
            {monthStats && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-slate-400">目標 {monthStats.targetTotalCost.toLocaleString()}円</span>
                <span className={monthStats.diffCost <= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                  {monthStats.diffCost > 0 ? '+' : ''}{monthStats.diffCost.toLocaleString()}円
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均エネルギー</p>
            <p className="text-2xl font-bold text-slate-800">
              {monthStats ? monthStats.avgEnergy : 0} <span className="text-sm font-normal text-slate-400">kcal</span>
            </p>
            {monthStats && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-slate-400">目標 {TARGETS.energy}kcal</span>
                <span className={Math.abs(monthStats.diffEnergy) <= TARGETS.energy * 0.1 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                  {monthStats.diffEnergy > 0 ? '+' : ''}{monthStats.diffEnergy}kcal
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均たんぱく質</p>
            <p className="text-2xl font-bold text-slate-800">
              {monthStats ? monthStats.avgProtein : 0} <span className="text-sm font-normal text-slate-400">g</span>
            </p>
            {monthStats && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-slate-400">目標 {TARGETS.protein}g</span>
                <span className={Math.abs(monthStats.diffProtein) <= TARGETS.protein * 0.1 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                  {monthStats.diffProtein > 0 ? '+' : ''}{monthStats.diffProtein}g
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均脂質</p>
            <p className="text-2xl font-bold text-slate-800">
              {monthStats ? monthStats.avgFat : 0} <span className="text-sm font-normal text-slate-400">g</span>
            </p>
            {monthStats && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-slate-400">目標 {TARGETS.fat}g</span>
                <span className={Math.abs(monthStats.diffFat) <= TARGETS.fat * 0.1 ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                  {monthStats.diffFat > 0 ? '+' : ''}{monthStats.diffFat}g
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">平均食塩相当量</p>
            <p className="text-2xl font-bold text-slate-800">
              {monthStats ? monthStats.avgSalt : 0} <span className="text-sm font-normal text-slate-400">g</span>
            </p>
            {monthStats && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="text-slate-400">目標 {TARGETS.salt}g</span>
                <span className={monthStats.diffSalt <= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                  {monthStats.diffSalt > 0 ? '+' : ''}{monthStats.diffSalt}g
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
                <svg className="animate-spin w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="text-sm">献立を読み込んでいます...</span>
              </div>
            </div>
          )}
          {renderCalendar()}
        </div>
      </div>

      {/* 日別サマリーモーダル */}
      {isDayModalOpen && selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeDayModal}>
          <div className="absolute inset-0 bg-black bg-opacity-50" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {selectedDayInfo.year}年{selectedDayInfo.month}月{selectedDayInfo.day}日
              </h2>
              <button
                onClick={closeDayModal}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 献立名リスト */}
            {selectedDayInfo.menus && selectedDayInfo.menus.length > 0 && (
              <div className="px-6 pt-4 pb-2">
                <ul className="space-y-0.5">
                  {selectedDayInfo.menus.map((menu, idx) => (
                    <li key={idx} className="text-sm text-slate-700 pl-2">
                      {typeof menu === 'string' ? menu : menu.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="px-6 py-4">
              {selectedDayInfo.daily_totals ? (() => {
                const t = selectedDayInfo.daily_totals;
                const rows = [
                  { label: '費用', unit: '円', target: TARGETS.costPerDay, actual: Math.round(t.cost || 0), lowerBetter: true, fixed: 0 },
                  { label: 'エネルギー', unit: 'kcal', target: TARGETS.energy, actual: Math.round(t['エネルギー'] || 0), lowerBetter: false, fixed: 0 },
                  { label: 'たんぱく質', unit: 'g', target: TARGETS.protein, actual: +(t['たんぱく質'] || 0).toFixed(1), lowerBetter: false, fixed: 1 },
                  { label: '脂質', unit: 'g', target: TARGETS.fat, actual: +(t['脂質'] || 0).toFixed(1), lowerBetter: false, fixed: 1 },
                  { label: '食塩相当量', unit: 'g', target: TARGETS.salt, actual: +((t['ナトリウム'] || 0) * 2.54 / 1000).toFixed(1), lowerBetter: true, fixed: 1 },
                ];
                const fmt = (v, fixed) => fixed > 0 ? v.toFixed(fixed) : Math.round(v).toLocaleString();
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 text-xs text-slate-400 font-medium">項目</th>
                        <th className="text-right pb-2 text-xs text-slate-400 font-medium">目標</th>
                        <th className="text-right pb-2 text-xs text-slate-400 font-medium">実績</th>
                        <th className="text-right pb-2 text-xs text-slate-400 font-medium">差分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ label, unit, target, actual, lowerBetter, fixed }) => {
                        const diff = +(actual - target).toFixed(fixed);
                        const isGood = lowerBetter ? diff <= 0 : Math.abs(diff) <= target * 0.1;
                        const diffColor = isGood ? 'text-green-600' : 'text-red-500';
                        return (
                          <tr key={label} className="border-b border-slate-50 last:border-0">
                            <td className="py-2.5 text-slate-600 font-medium">{label}</td>
                            <td className="py-2.5 text-right text-slate-400">{fmt(target, fixed)}{unit}</td>
                            <td className="py-2.5 text-right font-semibold text-slate-800">{fmt(actual, fixed)}{unit}</td>
                            <td className={`py-2.5 text-right font-semibold ${diffColor}`}>
                              {diff > 0 ? '+' : ''}{fmt(diff, fixed)}{unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })() : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400 mb-4">この日の献立データがありません</p>
                  <button
                    onClick={() => alert('Demo版のため追加はまだできません。')}
                    className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    手動追加
                  </button>
                </div>
              )}
            </div>

            {/* 削除ボタン */}
            {(selectedDayInfo.menus?.length > 0 || selectedDayInfo.daily_totals) && (
              <div className="px-6 pb-5">
                <button
                  onClick={async () => {
                    if (!window.confirm(`${selectedDayInfo.year}年${selectedDayInfo.month}月${selectedDayInfo.day}日の献立を削除しますか？`)) return;
                    const dateStr = `${selectedDayInfo.year}-${String(selectedDayInfo.month).padStart(2, '0')}-${String(selectedDayInfo.day).padStart(2, '0')}`;
                    try {
                      await deleteMenu(schoolId, dateStr);
                      const key = `${selectedDayInfo.year}-${selectedDayInfo.month}-${selectedDayInfo.day}`;
                      setMenuData(prev => {
                        const next = { ...(prev || {}) };
                        delete next[key];
                        return next;
                      });
                      closeDayModal();
                    } catch (err) {
                      alert('削除に失敗しました: ' + err.message);
                    }
                  }}
                  className="w-full py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  献立を削除
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
