import React, { useState, useEffect } from 'react';
import { getRecipes, loadRecipe } from '../services/api';

const RecipeList = () => {
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      // バックエンドAPIからレシピ一覧を取得
      const recipeList = await getRecipes();

      // レシピ名でソート
      const sortedRecipes = recipeList
        .map((recipe) => ({
          menu_id: recipe.menu_id,
          menu_name: recipe.name,
        }))
        .sort((a, b) => a.menu_name.localeCompare(b.menu_name, 'ja'));

      setRecipes(sortedRecipes);
      setFilteredRecipes(sortedRecipes);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load recipes:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const filtered = recipes.filter((recipe) =>
      recipe.menu_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredRecipes(filtered);
  }, [searchQuery, recipes]);

  const handleRecipeClick = async (menuId) => {
    try {
      const recipeData = await loadRecipe(menuId);
      setSelectedRecipe(recipeData);
    } catch (error) {
      console.error('Failed to load recipe details:', error);
      alert('レシピの詳細情報の読み込みに失敗しました');
    }
  };

  if (selectedRecipe) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <button
          onClick={() => setSelectedRecipe(null)}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          一覧に戻る
        </button>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">{selectedRecipe.menu_name}</h2>
            <span className="text-sm font-mono text-slate-400">{selectedRecipe.menu_id}</span>
          </div>

          <div className="bg-slate-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-slate-700 mb-4">栄養成分（1人分）</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">エネルギー</p>
                <p className="text-2xl font-bold text-slate-800">{selectedRecipe.nutrition.energy_kcal || '-'}</p>
                <p className="text-xs text-slate-400">kcal</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">たんぱく質</p>
                <p className="text-2xl font-bold text-slate-800">{selectedRecipe.nutrition.protein_g || '-'}</p>
                <p className="text-xs text-slate-400">g</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">脂質</p>
                <p className="text-2xl font-bold text-slate-800">{selectedRecipe.nutrition.fat_g || '-'}</p>
                <p className="text-xs text-slate-400">g</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">炭水化物</p>
                <p className="text-2xl font-bold text-slate-800">{selectedRecipe.nutrition.carbohydrate_g || '-'}</p>
                <p className="text-xs text-slate-400">g</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">食塩相当量</p>
                <p className="text-2xl font-bold text-slate-800">{selectedRecipe.nutrition.salt_g || '-'}</p>
                <p className="text-xs text-slate-400">g</p>
              </div>
            </div>
          </div>

          {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-slate-700 mb-4">材料</h3>
              <ul className="list-disc list-inside space-y-2">
                {selectedRecipe.ingredients.map((ing, idx) => (
                  <li key={idx} className="text-slate-700">{ing}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedRecipe.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>備考:</strong> {selectedRecipe.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">レシピ一覧</h2>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="メニュー名で検索..."
          className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">データを読み込んでいます...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.menu_id}
                onClick={() => handleRecipeClick(recipe.menu_id)}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-400">{recipe.menu_id}</span>
                </div>
                <h3 className="font-bold text-slate-800">{recipe.menu_name}</h3>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500 text-right mt-4">
            表示件数: {filteredRecipes.length}
          </div>
        </>
      )}
    </div>
  );
};

export default RecipeList;
