import axios from 'axios';

// バックエンドAPIのベースURL
// 環境変数から読み込む（未設定の場合はローカルをデフォルト）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// モックモード（テスト用）
const USE_MOCK = false;

// Axiosインスタンスの作成
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3分のタイムアウト（量子アニーリング計算は時間がかかる）
});

/**
 * 献立生成APIを呼び出す（新しいバックエンドAPI用）
 * @param {Object} params - リクエストパラメータ
 * @param {number} params.days - 献立を作成する日数（通常は5）
 * @param {number} params.cost - M日間の合計コスト目標値（円）
 * @param {string} [params.school_id] - 小学校ID（オプション、デフォルト: "default_school"）
 * @param {string} [params.target_year_month] - 対象年月（YYYY-MM-DD形式、オプション）
 * @param {boolean} [params.add_milk=false] - 牛乳を追加するか（オプション、デフォルト: false）
 * @param {Object} params.history - 履歴データ（現在は未使用）
 * @returns {Promise} APIレスポンス
 */
export const generateMenu = async (params) => {
  // モックモードの場合
  if (USE_MOCK) {
    console.log('🔧 Using MOCK response for testing. Params:', params);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機

    // モックレスポンス（example_response.jsonの構造に準拠）
    return transformBackendResponse({
      meta: {
        M: params.days || 5,
        N_candidates: 252,
        target: {
          "エネルギー": 650.0,
          "たんぱく質": 20.0,
          "脂質": 18.0,
          "ナトリウム": 1000.0,
          "cost": params.cost || 1500
        }
      },
      plan: {
        days: [],
        daily_totals: [],
        total_cost: 0
      },
      checks: {
        per_day_category_counts: []
      }
    });
  }

  // 実際のバックエンドAPIを呼び出す
  try {
    console.log('🚀 Calling backend API /optimize with params:', params);

    // 新しいバックエンドAPIのリクエスト形式に変換
    const apiParams = {
      M: params.days || 5,  // 献立日数
      cost: params.cost || 1500.0,  // M日間の合計コスト目標値
      save_to_db: true,  // データベースに保存
      school_id: params.school_id || '62059dce-db8f-4fde-b59a-444853efe5d8',  // 小学校ID（横須賀市小学校のUUID）
      target_year_month: params.target_year_month || null,  // 対象年月（YYYY-MM-DD形式）
      target_week: params.target_week || null,  // 対象週（1〜5、NULLも可）
      add_milk: params.add_milk || false  // 牛乳を追加するか
    };

    console.log('📤 Request to /optimize:', apiParams);

    const response = await apiClient.post('/optimize', apiParams);

    console.log('📥 Response from /optimize:', response.data);

    // バックエンドのレスポンスをフロントエンド形式に変換
    return transformBackendResponse(response.data);

  } catch (error) {
    console.error('❌ Menu generation error:', error);

    // エラーメッセージの整形
    if (error.response) {
      // サーバーからのエラーレスポンス
      const errorMessage = error.response.data?.error || 'サーバーエラーが発生しました';
      throw new Error(errorMessage);
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない
      throw new Error('サーバーからの応答がありません。ネットワーク接続を確認してください。');
    } else {
      // リクエスト設定時のエラー
      throw new Error('リクエストの送信に失敗しました: ' + error.message);
    }
  }
};

/**
 * 献立生成SSEストリーミングAPI（1日ごとにリアルタイム受信）
 * @param {Object} params - リクエストパラメータ（generateMenuと同形式）
 * @param {Function} onDay - 1日分が完了するたびに呼ばれる (dayEvent) => void
 * @param {Function} onDone - 全日完了時に呼ばれる (result) => void（transformBackendResponse済み）
 * @param {Function} onError - エラー時に呼ばれる (error) => void
 * @returns {AbortController} - キャンセル用コントローラー
 */
export const generateMenuStream = (params, onDay, onDone, onError, onStart) => {
  const apiParams = {
    cost: params.cost || 1500.0,
    save_to_db: true,
    school_id: params.school_id || '62059dce-db8f-4fde-b59a-444853efe5d8',
    school_id_b: params.school_id_b || 'b4e2f891-c7d3-4a56-9f18-2b3c4d5e6f7a',
    start_date: params.start_date || null,
    end_date: params.end_date || null,
    add_milk: params.add_milk || false,
  };

  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/optimize-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiParams),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`サーバーエラー: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // 未完了部分を保持

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.event === 'start') {
              onStart?.(data);
            } else if (data.event === 'day') {
              onDay(data);
            } else if (data.event === 'done') {
              onDone(transformBackendResponse(data.result));
            } else if (data.event === 'error') {
              onError(new Error(data.message || '最適化エラーが発生しました'));
              return;
            }
          } catch (e) {
            console.warn('SSE parse error:', e, part);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    }
  })();

  return controller;
};

/**
 * バックエンドAPIのレスポンスをフロントエンド形式に変換
 * @param {Object} backendResponse - バックエンドAPIのレスポンス
 * @returns {Object} フロントエンド用のレスポンス
 */
function transformBackendResponse(backendResponse) {
  const { meta, plan, checks } = backendResponse;

  // フロントエンドが期待する形式に変換
  // plan.days の各日のレシピを menu 配列に変換
  const menu = plan.days.map(day => ({
    day: day.day,
    menu: day.recipes.map(recipe => ({
      name: recipe.title,
      menu_id: recipe.id,
      category: recipe.category_name,
      recipe: {
        id: recipe.id,
        title: recipe.title,
        category: recipe.category,
        category_name: recipe.category_name,
        genre: recipe.genre,
        nutritions: recipe.nutritions,
        ingredients: recipe.ingredients,
        recipe_cost: recipe.recipe_cost
      }
    })),
    daily_totals: plan.daily_totals.find(dt => dt.day === day.day)?.totals || {}
  }));

  return {
    menu: menu,
    energy: meta.target?.["エネルギー"] || 650.0,
    num_solutions: 1,
    meta: meta,
    total_cost: plan.total_cost,
    checks: checks
  };
}

/**
 * JSONファイルを読み込む
 * @param {string} filename - ファイル名
 * @returns {Promise} JSONデータ
 */
export const loadJSON = async (filename) => {
  try {
    const response = await axios.get(`/${filename}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to load ${filename}:`, error);
    throw new Error(`${filename}の読み込みに失敗しました`);
  }
};

/**
 * レシピファイルを読み込む
 * @param {string} menuId - メニューID (例: M000000001)
 * @returns {Promise} レシピデータ
 */
export const loadRecipe = async (menuId) => {
  try {
    // menuId から数値IDを抽出 (M000000001 -> 1)
    const recipeId = parseInt(menuId.replace('M', ''), 10);

    // reciept.json から全レシピを取得
    const recipes = await loadJSON('reciept.json');

    // 該当するレシピを検索
    const recipe = recipes.find(r => r.id === recipeId);

    if (!recipe) {
      throw new Error(`Recipe with ID ${menuId} not found`);
    }

    // カテゴリマッピング
    const categoryMap = {
      1: '主食',
      2: '主菜',
      3: '副菜',
      4: '汁物',
      5: 'デザート'
    };

    // フロントエンドが期待する形式に変換
    return {
      menu_id: menuId,
      menu_name: recipe.title,
      category: categoryMap[recipe.category] || '未分類',
      nutrition: {
        energy_kcal: recipe.nutritions?.['エネルギー'] || 0,
        protein_g: recipe.nutritions?.['たんぱく質'] || 0,
        fat_g: recipe.nutritions?.['脂質'] || 0,
        carbohydrate_g: 0, // reciept.jsonには炭水化物情報がない
        salt_g: recipe.nutritions?.['ナトリウム'] ? (recipe.nutritions['ナトリウム'] / 400).toFixed(1) : 0 // ナトリウム(mg)を食塩相当量(g)に変換
      },
      ingredients: recipe.ingredients ? recipe.ingredients.map(ing => `${ing.name} ${ing.amount}g`) : [],
      notes: recipe.note || ''
    };
  } catch (error) {
    console.error(`Failed to load recipe ${menuId}:`, error);
    throw new Error(`レシピ ${menuId} の読み込みに失敗しました`);
  }
};

/**
 * バックエンドから指定されたIDのレシピを取得
 * @param {number|string} recipeId - レシピID
 * @returns {Promise} レシピデータ
 */
export const getRecipes = async (recipeId) => {
  try {
    if (!recipeId) {
      throw new Error('レシピIDが指定されていません');
    }

    // バックエンドの /get-recipes エンドポイントにリクエスト
    const response = await apiClient.get('/get-recipes', {
      params: { id: recipeId }
    });

    console.log(`✅ Recipe ${recipeId} retrieved successfully:`, response.data);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Recipe ${recipeId} not found`);
      throw new Error(`レシピ ${recipeId} が見つかりません`);
    }
    console.error(`Failed to fetch recipe ${recipeId}:`, error);
    throw new Error(`レシピ ${recipeId} の取得に失敗しました`);
  }
};

/**
 * 全レシピ一覧を取得する
 * @returns {Promise} 全レシピデータ（カテゴリー、ジャンル、栄養価含む）
 */
export const getAllRecipes = async () => {
  try {
    // バックエンドの /get-all-recipes エンドポイントにリクエスト
    const response = await apiClient.get('/get-all-recipes');

    console.log('✅ All recipes retrieved successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch all recipes:', error);
    throw new Error('全レシピの取得に失敗しました');
  }
};

/**
 * 保存された献立を取得する
 * @param {Object} params - リクエストパラメータ
 * @param {string} [params.school_id='62059dce-db8f-4fde-b59a-444853efe5d8'] - 小学校ID（UUID）
 * @param {string} [params.target_year_month] - 対象年月（YYYY-MM-DD形式）
 * @param {number} [params.target_week] - 対象週（1〜5、省略時は月全体のすべての週を取得）
 * @returns {Promise} APIレスポンス（target_week指定時は単一オブジェクト、未指定時は{menus: []}）
 */
export const getSavedMenu = async (params = {}) => {
  try {
    const { school_id = '62059dce-db8f-4fde-b59a-444853efe5d8', target_year_month } = params;

    const response = await apiClient.post('/get_menu', {
      school_id,
      target_year_month,
    });

    console.log('✅ Saved menu retrieved successfully:', response.data);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('ℹ️ No saved menu found for the specified parameters');
      return null;
    }
    console.error('Failed to get saved menu:', error);
    throw error;
  }
};

/**
 * 食材価格一覧を取得する
 * @returns {Promise} 食材価格データ（food_id, food_name, price_per_gram含む）
 */
export const getFoodCosts = async () => {
  try {
    const response = await apiClient.get('/get-food-costs');
    console.log('✅ Food costs retrieved successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch food costs:', error);
    throw new Error('食材価格の取得に失敗しました');
  }
};

/**
 * 食材価格を更新する
 * @param {number} foodId - 食材ID
 * @param {string} schoolId - 小学校ID（UUID）
 * @param {number} pricePerGram - グラム単価（円/g）
 * @returns {Promise} 更新結果
 */
export const updateFoodCost = async (foodId, schoolId, pricePerGram) => {
  try {
    const response = await apiClient.post('/update-food-cost', {
      food_id: foodId,
      school_id: schoolId,
      price_per_gram: pricePerGram,
    });
    console.log(`✅ Food cost updated successfully for food_id ${foodId}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Failed to update food cost for food_id ${foodId}:`, error);
    throw new Error('食材価格の更新に失敗しました');
  }
};

/**
 * レシピ詳細を取得する（食材・調理工程含む）
 * @param {number} recipeId - レシピID
 * @returns {Promise} レシピ詳細データ（recipe, ingredients, workload_steps）
 */
export const getRecipeDetail = async (recipeId) => {
  try {
    const response = await apiClient.get(`/get-recipe-detail/${recipeId}`);
    console.log(`✅ Recipe detail ${recipeId} retrieved successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch recipe detail ${recipeId}:`, error);
    throw new Error(`レシピ詳細の取得に失敗しました (ID: ${recipeId})`);
  }
};

/**
 * レシピを更新する（食材・調理工程含む）
 * @param {number} recipeId - レシピID
 * @param {Object} recipe - レシピ基本情報
 * @param {Array} ingredients - 食材リスト [{food_id, food_name, amount_g}]
 * @param {Array} workloadSteps - 調理工程リスト [{step_name, cooking_time_min, use_heat, use_oven, requires_prep_day_before}]
 * @returns {Promise} 更新結果
 */
export const updateRecipe = async (recipeId, recipe, ingredients, workloadSteps) => {
  try {
    const response = await apiClient.post('/update-recipe', {
      recipe_id: recipeId,
      recipe: recipe,
      ingredients: ingredients,
      workload_steps: workloadSteps,
    });
    console.log(`✅ Recipe ${recipeId} updated successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Failed to update recipe ${recipeId}:`, error);
    throw new Error(`レシピの更新に失敗しました (ID: ${recipeId})`);
  }
};

/**
 * 新規食材を追加する
 * @param {string} foodName - 食材名
 * @param {string} schoolId - 小学校ID（UUID）
 * @param {number} pricePerGram - グラム単価（円/g）
 * @param {number|null} foodColorClass - 食品色分類（1=赤, 2=黄, 3=緑, null=未分類）
 * @returns {Promise} 追加結果（food_id含む）
 */
export const addFood = async (foodName, schoolId, pricePerGram, foodColorClass = null) => {
  try {
    const response = await apiClient.post('/add-food', {
      food_name: foodName,
      school_id: schoolId,
      price_per_gram: pricePerGram,
      food_color_class: foodColorClass,
    });
    console.log('✅ Food added successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to add food:', error);
    throw new Error('食材の追加に失敗しました');
  }
};

/**
 * 新規レシピを追加する
 * @param {Object} recipe - レシピ基本情報 {recipe_name, category, genre, energy_kcal, protein_g, fat_g, salt_g}
 * @param {Array} ingredients - 食材リスト [{food_name, amount_g}]
 * @param {Array} workloadSteps - 調理工程リスト [{step_name, cooking_time_min, use_heat, use_oven, requires_prep_day_before}]
 * @returns {Promise} 追加結果（recipe_id含む）
 */
export const addRecipe = async (recipe, ingredients, workloadSteps) => {
  try {
    const response = await apiClient.post('/add-recipe', {
      recipe,
      ingredients,
      workload_steps: workloadSteps,
    });
    console.log('✅ Recipe added successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to add recipe:', error);
    throw new Error('レシピの追加に失敗しました');
  }
};

/**
 * 食材を削除する
 * @param {number} foodId - 食材ID
 * @param {string} schoolId - 小学校ID（UUID）
 * @returns {Promise} 削除結果
 */
export const deleteFood = async (foodId, schoolId) => {
  try {
    const response = await apiClient.post('/delete-food', {
      food_id: foodId,
      school_id: schoolId,
    });
    console.log(`✅ Food ${foodId} deleted successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Failed to delete food ${foodId}:`, error);
    throw new Error('食材の削除に失敗しました');
  }
};

/**
 * レシピを削除する
 * @param {number} recipeId - レシピID
 * @returns {Promise} 削除結果
 */
export const deleteRecipe = async (recipeId) => {
  try {
    const response = await apiClient.post('/delete-recipe', {
      recipe_id: recipeId,
    });
    console.log(`✅ Recipe ${recipeId} deleted successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Failed to delete recipe ${recipeId}:`, error);
    throw new Error('レシピの削除に失敗しました');
  }
};

/**
 * 食材価格CSVを一括インポートする（バックエンド側でループ処理）
 * @param {Array} rows - CSVから変換した行オブジェクトの配列
 * @param {string} schoolId - 学校ID
 * @returns {Promise} { success_count, error_count, errors, items }
 */
export const importFoodCosts = async (rows, schoolId) => {
  try {
    const response = await apiClient.post('/import-food-costs', { rows, school_id: schoolId });
    return response.data;
  } catch (error) {
    console.error('Failed to import food costs:', error);
    throw new Error('食材価格の一括インポートに失敗しました');
  }
};

/**
 * レシピCSVを一括インポートする（バックエンド側でループ処理）
 * @param {Array} rows - CSVから変換した行オブジェクトの配列
 * @returns {Promise} { success_count, error_count, errors }
 */
export const importRecipes = async (rows) => {
  try {
    const response = await apiClient.post('/import-recipes', { rows });
    return response.data;
  } catch (error) {
    console.error('Failed to import recipes:', error);
    throw new Error('レシピの一括インポートに失敗しました');
  }
};

/**
 * 祝日リストを取得する
 * @param {number} [year] - 取得する年（省略時は全件）
 * @returns {Promise<string[]>} "YYYY-MM-DD" 形式の祝日配列
 */
export const getHolidays = async (year) => {
  try {
    const params = year ? { year } : {};
    const response = await apiClient.get('/get-holidays', { params });
    return response.data.holidays || [];
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return [];
  }
};

/**
 * 指定日付の献立を削除する
 * @param {string} schoolId - 小学校ID（UUID）
 * @param {string} targetDate - 対象日付（"YYYY-MM-DD"形式）
 * @returns {Promise} { deleted_count, target_date }
 */
export const deleteMenu = async (schoolId, targetDate) => {
  try {
    const response = await apiClient.post('/delete-menu', {
      school_id: schoolId,
      target_date: targetDate,
    });
    console.log(`✅ Menu deleted for ${targetDate}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to delete menu:', error);
    throw new Error('献立の削除に失敗しました');
  }
};

/**
 * ダッシュボード用の統計データを取得する
 * @param {string} schoolId - 小学校ID（UUID）
 * @returns {Promise} { summary, monthly_trends }
 */
export const getDashboardStats = async (schoolId = '62059dce-db8f-4fde-b59a-444853efe5d8') => {
  try {
    const response = await apiClient.get('/dashboard-stats', {
      params: { school_id: schoolId },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    throw new Error('ダッシュボード統計の取得に失敗しました');
  }
};

export default {
  generateMenu,
  generateMenuStream,
  loadJSON,
  loadRecipe,
  getRecipes,
  getAllRecipes,
  getSavedMenu,
  addRecipe,
  importRecipes,
  importFoodCosts,
  getFoodCosts,
  updateFoodCost,
  getRecipeDetail,
  updateRecipe,
  addFood,
  deleteFood,
  deleteRecipe,
  getDashboardStats,
  getHolidays,
  deleteMenu,
};
