import React, { useState, useEffect, useRef } from 'react';
import { getRecipes, getAllRecipes, getRecipeDetail, updateRecipe, addRecipe, importRecipes, deleteRecipe } from '../services/api';

const RecipeList = () => {
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 編集モーダル用のstate
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [editRecipeData, setEditRecipeData] = useState({});
  const [editIngredients, setEditIngredients] = useState([]);
  const [editWorkloadSteps, setEditWorkloadSteps] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 追加モーダル用のstate
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRecipeData, setNewRecipeData] = useState({});
  const [newIngredients, setNewIngredients] = useState([]);
  const [newWorkloadSteps, setNewWorkloadSteps] = useState([]);
  const [isAddSaving, setIsAddSaving] = useState(false);

  // 削除確認モーダル用のstate
  const [deleteTarget, setDeleteTarget] = useState(null); // { menu_id, menu_name }
  const [isDeleting, setIsDeleting] = useState(false);

  // CSVインポート用のstate
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importFileRef = useRef(null);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      // バックエンドAPIから全レシピ一覧を取得
      const response = await getAllRecipes();
      const recipeList = response.recipes || [];

      // レシピ名でソート
      const sortedRecipes = recipeList
        .map((recipe) => ({
          menu_id: recipe.recipe_id,
          menu_name: recipe.recipe_name,
          category: recipe.category,
          genre: recipe.genre,
          nutrition: recipe.nutrition,
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
    const filtered = recipes.filter((recipe) => {
      // レシピ名フィルター（部分一致）
      const matchesName = recipe.menu_name.toLowerCase().includes(searchQuery.toLowerCase());

      // カテゴリーフィルター
      const matchesCategory = selectedCategory === '' || recipe.category === selectedCategory;

      // ジャンルフィルター
      const matchesGenre = selectedGenre === '' || recipe.genre === selectedGenre;

      return matchesName && matchesCategory && matchesGenre;
    });
    setFilteredRecipes(filtered);
  }, [searchQuery, selectedCategory, selectedGenre, recipes]);

  const handleRecipeClick = async (recipeId) => {
    try {
      // バックエンドAPIからレシピ詳細を取得
      const recipeData = await getRecipes(recipeId);

      // データ形式を統一
      const formattedData = {
        menu_id: recipeData.id,
        menu_name: recipeData.menu_name,
        nutrition: recipeData.nutrition,
        ingredients: recipeData.ingredients
          ? recipeData.ingredients.map(ing => `${ing.name} ${ing.amount}g`)
          : [],
        instructions: recipeData.instructions || [],
        notes: recipeData.notes || ''
      };

      setSelectedRecipe(formattedData);
    } catch (error) {
      console.error('Failed to load recipe details:', error);
      alert('レシピの詳細情報の読み込みに失敗しました');
    }
  };

  const handleEditClick = async (e, recipeId) => {
    e.stopPropagation(); // 行クリックイベントを防ぐ
    try {
      setIsLoadingDetail(true);
      setIsEditModalOpen(true); // モーダルを先に開いてローディング表示
      setEditingRecipe(recipeId);

      // 詳細データをバックエンドから取得
      const detailData = await getRecipeDetail(recipeId);

      setEditRecipeData(detailData.recipe || {});
      setEditIngredients(detailData.ingredients || []);
      setEditWorkloadSteps(detailData.workload_steps || []);
    } catch (error) {
      console.error('Failed to load recipe detail for editing:', error);
      alert('レシピ詳細の読み込みに失敗しました');
      setIsEditModalOpen(false); // エラー時はモーダルを閉じる
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openDeleteModal = (e, recipe) => {
    e.stopPropagation();
    setDeleteTarget({ menu_id: recipe.menu_id, menu_name: recipe.menu_name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteRecipe(deleteTarget.menu_id);
      setRecipes(prev => prev.filter(r => r.menu_id !== deleteTarget.menu_id));
      setFilteredRecipes(prev => prev.filter(r => r.menu_id !== deleteTarget.menu_id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      alert('レシピの削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);

      // バックエンドAPIを呼び出して更新
      await updateRecipe(
        editingRecipe,
        editRecipeData,
        editIngredients,
        editWorkloadSteps
      );

      alert('レシピを更新しました');
      setIsEditModalOpen(false);
      setEditingRecipe(null);

      // レシピ一覧を再読み込み
      await loadRecipes();
    } catch (error) {
      console.error('Failed to update recipe:', error);
      alert('レシピの更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingRecipe(null);
    setEditRecipeData({});
    setEditIngredients([]);
    setEditWorkloadSteps([]);
    setIsLoadingDetail(false);
  };

  const openAddModal = () => {
    setNewRecipeData({});
    setNewIngredients([]);
    setNewWorkloadSteps([]);
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!newRecipeData.recipe_name?.trim()) {
      alert('レシピ名を入力してください');
      return;
    }
    setIsAddSaving(true);
    try {
      await addRecipe(newRecipeData, newIngredients, newWorkloadSteps);
      alert('レシピを追加しました');
      setIsAddModalOpen(false);
      await loadRecipes();
    } catch (error) {
      console.error('Failed to add recipe:', error);
      alert('レシピの追加に失敗しました');
    } finally {
      setIsAddSaving(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAddModalOpen(false);
    setNewRecipeData({});
    setNewIngredients([]);
    setNewWorkloadSteps([]);
  };

  const handleExportCSV = () => {
    const headers = [
      'recipe_id',
      'recipe_name',
      'category',
      'genre',
      'energy_kcal',
      'protein_g',
      'fat_g',
      'salt_g',
    ];

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = filteredRecipes.map((r) => [
      r.menu_id,
      r.menu_name,
      r.category ?? '',
      r.genre ?? '',
      r.nutrition?.energy_kcal ?? '',
      r.nutrition?.protein_g ?? '',
      r.nutrition?.fat_g ?? '',
      r.nutrition?.salt_g ?? '',
    ].map(escape).join(','));

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recipes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    importFileRef.current.value = '';
    importFileRef.current.click();
  };

  const parseCSV = (text) => {
    const content = text.replace(/^\uFEFF/, ''); // BOM除去
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
      const values = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (line[i] === ',' && !inQ) {
          values.push(cur); cur = '';
        } else {
          cur += line[i];
        }
      }
      values.push(cur);
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? ''; });
      return row;
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      setImportPreviewRows(rows);
      setImportResult(null);
      setIsImportModalOpen(true);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportConfirm = async () => {
    setIsImporting(true);
    try {
      const result = await importRecipes(importPreviewRows);
      setImportResult({
        successCount: result.success_count,
        errorCount: result.error_count,
        errors: result.errors || [],
      });
      if (result.success_count > 0) await loadRecipes();
    } catch (err) {
      setImportResult({ successCount: 0, errorCount: importPreviewRows.length, errors: [err.message] });
    } finally {
      setIsImporting(false);
    }
  };

  // 食材の追加
  const handleAddIngredient = () => {
    setEditIngredients([...editIngredients, { food_id: null, food_name: '', amount_g: 0 }]);
  };

  // 食材の削除
  const handleRemoveIngredient = (index) => {
    setEditIngredients(editIngredients.filter((_, i) => i !== index));
  };

  // 食材の更新
  const handleUpdateIngredient = (index, field, value) => {
    const updated = [...editIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setEditIngredients(updated);
  };

  // 調理工程の追加
  const handleAddWorkloadStep = () => {
    setEditWorkloadSteps([...editWorkloadSteps, {
      step_name: '',
      cooking_time_min: 0,
      use_heat: false,
      use_oven: false,
      requires_prep_day_before: false
    }]);
  };

  // 調理工程の削除
  const handleRemoveWorkloadStep = (index) => {
    setEditWorkloadSteps(editWorkloadSteps.filter((_, i) => i !== index));
  };

  // 調理工程の更新
  const handleUpdateWorkloadStep = (index, field, value) => {
    const updated = [...editWorkloadSteps];
    updated[index] = { ...updated[index], [field]: value };
    setEditWorkloadSteps(updated);
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

  // ユニークなカテゴリーとジャンルのリストを取得
  const categories = ['', ...new Set(recipes.map(r => r.category).filter(Boolean))];
  const genres = ['', ...new Set(recipes.map(r => r.genre).filter(Boolean))];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">レシピ一覧</h2>
        <div className="flex items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            CSVインポート
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV出力
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span className="text-base leading-none">＋</span>
            レシピを追加
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* レシピ名検索 */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">レシピ名</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="部分一致で検索..."
            className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* カテゴリーフィルター */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">カテゴリー</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">すべて</option>
            {categories.filter(c => c !== '').map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* ジャンルフィルター */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">ジャンル</label>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">すべて</option>
            {genres.filter(g => g !== '').map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">データを読み込んでいます...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">ID</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">レシピ名</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">カテゴリー</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">ジャンル</th>
                  <th className="text-right p-3 text-xs font-semibold text-slate-600">エネルギー<br/>(kcal)</th>
                  <th className="text-right p-3 text-xs font-semibold text-slate-600">たんぱく質<br/>(g)</th>
                  <th className="text-right p-3 text-xs font-semibold text-slate-600">脂質<br/>(g)</th>
                  <th className="text-right p-3 text-xs font-semibold text-slate-600">食塩<br/>(g)</th>
                  <th className="text-center p-3 text-xs font-semibold text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((recipe) => (
                  <tr
                    key={recipe.menu_id}
                    onClick={() => handleRecipeClick(recipe.menu_id)}
                    className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 text-xs font-mono text-slate-400">{recipe.menu_id}</td>
                    <td className="p-3 text-sm font-medium text-slate-800">{recipe.menu_name}</td>
                    <td className="p-3 text-sm text-slate-600">{recipe.category || '-'}</td>
                    <td className="p-3 text-sm text-slate-600">{recipe.genre || '-'}</td>
                    <td className="p-3 text-sm text-right text-slate-700">
                      {recipe.nutrition?.energy_kcal?.toFixed(1) || '-'}
                    </td>
                    <td className="p-3 text-sm text-right text-slate-700">
                      {recipe.nutrition?.protein_g?.toFixed(1) || '-'}
                    </td>
                    <td className="p-3 text-sm text-right text-slate-700">
                      {recipe.nutrition?.fat_g?.toFixed(1) || '-'}
                    </td>
                    <td className="p-3 text-sm text-right text-slate-700">
                      {recipe.nutrition?.salt_g?.toFixed(1) || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={(e) => handleEditClick(e, recipe.menu_id)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors whitespace-nowrap"
                        >
                          編集
                        </button>
                        <button
                          onClick={(e) => openDeleteModal(e, recipe)}
                          className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors whitespace-nowrap"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-slate-500 text-right mt-4">
            表示件数: {filteredRecipes.length}
          </div>
        </>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-3">レシピの削除</h3>
            <p className="text-sm text-slate-600 mb-6">
              「<span className="font-semibold text-slate-800">{deleteTarget.menu_name}</span>」を削除しますか？
              <br />
              <span className="text-xs text-red-500 mt-1 block">この操作は取り消せません。</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSVインポートプレビューモーダル */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">CSVインポート プレビュー</h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {importResult ? (
                <div className="space-y-4">
                  <div className={`rounded-lg p-4 ${importResult.errorCount === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className="font-semibold text-slate-800">
                      インポート完了: 成功 {importResult.successCount} 件 / 失敗 {importResult.errorCount} 件
                    </p>
                    {importResult.errors.length > 0 && (
                      <ul className="mt-2 text-sm text-red-700 space-y-1">
                        {importResult.errors.map((e, i) => <li key={i}>・{e}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    以下の {importPreviewRows.length} 件をインポートします。
                    <span className="ml-2 text-xs text-slate-400">recipe_id あり → UPDATE / なし → INSERT</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-center p-2 font-semibold text-slate-600">操作</th>
                          <th className="text-left p-2 font-semibold text-slate-600">recipe_id</th>
                          <th className="text-left p-2 font-semibold text-slate-600">recipe_name</th>
                          <th className="text-left p-2 font-semibold text-slate-600">category</th>
                          <th className="text-left p-2 font-semibold text-slate-600">genre</th>
                          <th className="text-right p-2 font-semibold text-slate-600">energy_kcal</th>
                          <th className="text-right p-2 font-semibold text-slate-600">protein_g</th>
                          <th className="text-right p-2 font-semibold text-slate-600">fat_g</th>
                          <th className="text-right p-2 font-semibold text-slate-600">salt_g</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${row.recipe_id ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {row.recipe_id ? 'UPDATE' : 'INSERT'}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-slate-400">{row.recipe_id || '-'}</td>
                            <td className="p-2 font-medium text-slate-800">{row.recipe_name}</td>
                            <td className="p-2 text-slate-600">{row.category || '-'}</td>
                            <td className="p-2 text-slate-600">{row.genre || '-'}</td>
                            <td className="p-2 text-right text-slate-700">{row.energy_kcal || '-'}</td>
                            <td className="p-2 text-right text-slate-700">{row.protein_g || '-'}</td>
                            <td className="p-2 text-right text-slate-700">{row.fat_g || '-'}</td>
                            <td className="p-2 text-right text-slate-700">{row.salt_g || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded hover:bg-slate-300 transition-colors"
              >
                {importResult ? '閉じる' : 'キャンセル'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImportConfirm}
                  disabled={isImporting || importPreviewRows.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'インポート中...' : `${importPreviewRows.length} 件をインポート`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">レシピを追加</h3>
              <button onClick={handleCancelAdd} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 基本情報 */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                <h4 className="font-semibold text-slate-700">基本情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">レシピ名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={newRecipeData.recipe_name || ''}
                      onChange={(e) => setNewRecipeData({ ...newRecipeData, recipe_name: e.target.value })}
                      placeholder="例: ポテトサラダ"
                      className="w-full border-slate-300 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">カテゴリー</label>
                    <select
                      value={newRecipeData.category || ''}
                      onChange={(e) => setNewRecipeData({ ...newRecipeData, category: e.target.value })}
                      className="w-full border-slate-300 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">選択してください</option>
                      <option value="主菜">主菜</option>
                      <option value="副菜">副菜</option>
                      <option value="主食">主食</option>
                      <option value="汁物">汁物</option>
                      <option value="デザート">デザート</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">ジャンル</label>
                    <select
                      value={newRecipeData.genre || ''}
                      onChange={(e) => setNewRecipeData({ ...newRecipeData, genre: e.target.value })}
                      className="w-full border-slate-300 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">選択してください</option>
                      <option value="和風">和風</option>
                      <option value="洋風">洋風</option>
                      <option value="中華風">中華風</option>
                      <option value="韓国風">韓国風</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                </div>
                {/* 栄養価 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {[
                    { label: 'エネルギー (kcal)', key: 'energy_kcal' },
                    { label: 'たんぱく質 (g)', key: 'protein_g' },
                    { label: '脂質 (g)', key: 'fat_g' },
                    { label: '食塩 (g)', key: 'salt_g' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={newRecipeData[key] ?? ''}
                        onChange={(e) => setNewRecipeData({ ...newRecipeData, [key]: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        className="w-full border-slate-300 rounded text-sm px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 食材 */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">食材</h4>
                  <button
                    onClick={() => setNewIngredients([...newIngredients, { food_name: '', amount_g: 0 }])}
                    className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                  >
                    + 追加
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {newIngredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded">
                      <input
                        type="text"
                        placeholder="食材名"
                        value={ing.food_name}
                        onChange={(e) => { const a = [...newIngredients]; a[idx] = { ...a[idx], food_name: e.target.value }; setNewIngredients(a); }}
                        className="flex-1 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="量(g)"
                        step="0.1"
                        value={ing.amount_g}
                        onChange={(e) => { const a = [...newIngredients]; a[idx] = { ...a[idx], amount_g: parseFloat(e.target.value) || 0 }; setNewIngredients(a); }}
                        className="w-24 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setNewIngredients(newIngredients.filter((_, i) => i !== idx))}
                        className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 調理工程 */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">調理工程</h4>
                  <button
                    onClick={() => setNewWorkloadSteps([...newWorkloadSteps, { step_name: '', cooking_time_min: 0, use_heat: false, use_oven: false, requires_prep_day_before: false }])}
                    className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                  >
                    + 追加
                  </button>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {newWorkloadSteps.map((step, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded space-y-2">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="工程名"
                          value={step.step_name}
                          onChange={(e) => { const a = [...newWorkloadSteps]; a[idx] = { ...a[idx], step_name: e.target.value }; setNewWorkloadSteps(a); }}
                          className="flex-1 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="時間(分)"
                          value={step.cooking_time_min}
                          onChange={(e) => { const a = [...newWorkloadSteps]; a[idx] = { ...a[idx], cooking_time_min: parseInt(e.target.value) || 0 }; setNewWorkloadSteps(a); }}
                          className="w-24 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                          onClick={() => setNewWorkloadSteps(newWorkloadSteps.filter((_, i) => i !== idx))}
                          className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                      <div className="flex gap-3 text-xs">
                        {[
                          { label: '火を使う', key: 'use_heat' },
                          { label: 'オーブン使用', key: 'use_oven' },
                          { label: '前日準備が必要', key: 'requires_prep_day_before' },
                        ].map(({ label, key }) => (
                          <label key={key} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={step[key] || false}
                              onChange={(e) => { const a = [...newWorkloadSteps]; a[idx] = { ...a[idx], [key]: e.target.checked }; setNewWorkloadSteps(a); }}
                              className="rounded"
                            />
                            <span className="text-slate-600">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleCancelAdd}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded hover:bg-slate-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveAdd}
                disabled={isAddSaving || !newRecipeData.recipe_name?.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddSaving ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">レシピ編集</h3>
              <button
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-slate-600">レシピ詳細を読み込んでいます...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* レシピ基本情報 */}
                  <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                <h4 className="font-semibold text-slate-700 mb-3">基本情報</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">レシピ名</label>
                    <input
                      type="text"
                      value={editRecipeData.recipe_name || ''}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, recipe_name: e.target.value })}
                      className="w-full border-slate-300 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">カテゴリー</label>
                    <select
                      value={editRecipeData.category || ''}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, category: e.target.value })}
                      className="w-full border-slate-300 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">選択してください</option>
                      <option value="主菜">主菜</option>
                      <option value="副菜">副菜</option>
                      <option value="主食">主食</option>
                      <option value="汁物">汁物</option>
                      <option value="デザート">デザート</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">ジャンル</label>
                    <select
                      value={editRecipeData.genre || ''}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, genre: e.target.value })}
                      className="w-full border-slate-300 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">選択してください</option>
                      <option value="和風">和風</option>
                      <option value="洋風">洋風</option>
                      <option value="中華風">中華風</option>
                      <option value="韓国風">韓国風</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                </div>

                {/* 栄養価 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">エネルギー (kcal)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editRecipeData.energy_kcal || 0}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, energy_kcal: parseFloat(e.target.value) })}
                      className="w-full border-slate-300 rounded text-sm px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">たんぱく質 (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editRecipeData.protein_g || 0}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, protein_g: parseFloat(e.target.value) })}
                      className="w-full border-slate-300 rounded text-sm px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">脂質 (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editRecipeData.fat_g || 0}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, fat_g: parseFloat(e.target.value) })}
                      className="w-full border-slate-300 rounded text-sm px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">炭水化物 (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editRecipeData.carbohydrate_g || 0}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, carbohydrate_g: parseFloat(e.target.value) })}
                      className="w-full border-slate-300 rounded text-sm px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">食塩 (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editRecipeData.salt_g || 0}
                      onChange={(e) => setEditRecipeData({ ...editRecipeData, salt_g: parseFloat(e.target.value) })}
                      className="w-full border-slate-300 rounded text-sm px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 食材リスト */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">食材</h4>
                  <button
                    onClick={handleAddIngredient}
                    className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                  >
                    + 追加
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editIngredients.map((ingredient, index) => (
                    <div key={index} className="flex gap-2 items-center bg-slate-50 p-2 rounded">
                      {ingredient.food_id && (
                        <div className="w-16 text-xs font-mono text-slate-400 px-2">
                          {ingredient.food_id}
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="食材名"
                        value={ingredient.food_name || ''}
                        onChange={(e) => handleUpdateIngredient(index, 'food_name', e.target.value)}
                        className="flex-1 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="量(g)"
                        step="0.1"
                        value={ingredient.amount_g || 0}
                        onChange={(e) => handleUpdateIngredient(index, 'amount_g', parseFloat(e.target.value) || 0)}
                        className="w-24 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleRemoveIngredient(index)}
                        className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 調理工程リスト */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">調理工程</h4>
                  <button
                    onClick={handleAddWorkloadStep}
                    className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition-colors"
                  >
                    + 追加
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {editWorkloadSteps.map((step, index) => (
                    <div key={index} className="bg-slate-50 p-3 rounded space-y-2">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="工程名"
                          value={step.step_name || ''}
                          onChange={(e) => handleUpdateWorkloadStep(index, 'step_name', e.target.value)}
                          className="flex-1 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="時間(分)"
                          value={step.cooking_time_min || 0}
                          onChange={(e) => handleUpdateWorkloadStep(index, 'cooking_time_min', parseInt(e.target.value) || 0)}
                          className="w-24 border-slate-300 rounded text-xs px-2 py-1 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleRemoveWorkloadStep(index)}
                          className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={step.use_heat || false}
                            onChange={(e) => handleUpdateWorkloadStep(index, 'use_heat', e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-slate-600">火を使う</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={step.use_oven || false}
                            onChange={(e) => handleUpdateWorkloadStep(index, 'use_oven', e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-slate-600">オーブン使用</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={step.requires_prep_day_before || false}
                            onChange={(e) => handleUpdateWorkloadStep(index, 'requires_prep_day_before', e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-slate-600">前日準備が必要</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                </>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded hover:bg-slate-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeList;
