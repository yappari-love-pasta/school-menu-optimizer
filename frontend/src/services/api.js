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
 * バックエンドからレシピ一覧を取得
 * @returns {Promise} レシピ一覧
 */
export const getRecipes = async () => {
  try {
    // backend/reciept.json からレシピを読み込む
    const response = await loadJSON('reciept.json');

    // JSONからレシピ一覧を抽出
    const recipes = [];
    if (Array.isArray(response)) {
      response.forEach(recipe => {
        // カテゴリマッピング
        const categoryMap = {
          1: '主食',
          2: '主菜',
          3: '副菜',
          4: '汁物',
          5: 'デザート'
        };

        recipes.push({
          menu_id: `M${String(recipe.id).padStart(9, '0')}`, // id を M000000001 形式に変換
          name: recipe.title,
          category: categoryMap[recipe.category] || '未分類',
          ingredients: recipe.ingredients || [],
          nutrition: recipe.nutritions || {}
        });
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
