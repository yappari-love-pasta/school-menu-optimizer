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
  timeout: 300000, // 300秒のタイムアウト（量子アニーリング計算は時間がかかる）
});

/**
 * 献立生成APIを呼び出す（新しいバックエンドAPI用）
 * @param {Object} params - リクエストパラメータ
 * @param {number} params.days - 献立を作成する日数（通常は5）
 * @param {number} params.cost - M日間の合計コスト目標値（円）
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
      cost: params.cost || 1500.0  // M日間の合計コスト目標値
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
    const response = await axios.get(`/recipe/${menuId}.json`);
    return response.data;
  } catch (error) {
    console.error(`Failed to load recipe ${menuId}:`, error);
    throw new Error(`レシピ ${menuId} の読み込みに失敗しました`);
  }
};

/**
 * バックエンドからレシピ一覧を取得
 * @returns {Promise} レシピ一覧
 */
export const getRecipes = async () => {
  try {
    // 新しいバックエンドにレシピ取得エンドポイントがない場合は、
    // ローカルのJSONファイルから読み込む
    const response = await loadJSON('school_lunch_menu_neyagawa.json');

    // JSONからレシピ一覧を抽出
    const recipes = [];
    if (response.months && Array.isArray(response.months)) {
      response.months.forEach(month => {
        if (month.days && Array.isArray(month.days)) {
          month.days.forEach(day => {
            if (day.menus && Array.isArray(day.menus)) {
              day.menus.forEach(menu => {
                // 重複を避けるためmenu_idでチェック
                if (!recipes.find(r => r.menu_id === menu.menu_id)) {
                  recipes.push({
                    menu_id: menu.menu_id,
                    name: menu.menu_name,
                    category: '未分類', // カテゴリ情報がない場合
                    ingredients: menu.ingredients || [],
                    nutrition: menu.nutrition || {}
                  });
                }
              });
            }
          });
        }
      });
    }

    return recipes;
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
    throw new Error('レシピ一覧の取得に失敗しました');
  }
};

export default {
  generateMenu,
  loadJSON,
  loadRecipe,
  getRecipes,
};
