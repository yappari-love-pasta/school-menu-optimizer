import React, { useState, useEffect, useRef } from 'react';
import { getFoodCosts, updateFoodCost, addFood, deleteFood, importFoodCosts } from '../services/api';

const FoodCostSettings = ({ schoolId }) => {
  const [foodCosts, setFoodCosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodPrice, setNewFoodPrice] = useState('');
  const [newFoodColorClass, setNewFoodColorClass] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { food_id, food_name }
  const [isDeleting, setIsDeleting] = useState(false);

  // CSVインポート用
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importFileRef = useRef(null);

  useEffect(() => {
    loadFoodCosts();
  }, []);

  const loadFoodCosts = async () => {
    try {
      const response = await getFoodCosts();
      const foodList = response.food_costs || [];
      setFoodCosts(foodList);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load food costs:', error);
      alert('食材価格の読み込みに失敗しました');
      setIsLoading(false);
    }
  };

  const handleEdit = (foodId, currentPrice) => {
    setEditingId(foodId);
    setEditPrice(currentPrice.toString());
  };

  const handleSave = async (foodId, itemSchoolId) => {
    try {
      const price = parseFloat(editPrice);
      if (isNaN(price) || price < 0) {
        alert('有効な価格を入力してください');
        return;
      }

      await updateFoodCost(foodId, itemSchoolId || schoolId, price);

      // ローカルデータを更新
      setFoodCosts(prevCosts =>
        prevCosts.map(item =>
          item.food_id === foodId
            ? { ...item, price_per_gram: price }
            : item
        )
      );

      setEditingId(null);
      setEditPrice('');
    } catch (error) {
      console.error('Failed to save food cost:', error);
      alert('食材価格の更新に失敗しました');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditPrice('');
  };

  const handleExportCSV = () => {
    const headers = ['food_id', 'food_name', 'price_per_gram'];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = filteredFoodCosts.map((item) =>
      [item.food_id, item.food_name, item.price_per_gram].map(escape).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `food_costs_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    importFileRef.current.value = '';
    importFileRef.current.click();
  };

  const parseCSV = (text) => {
    const content = text.replace(/^\uFEFF/, '');
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
      const result = await importFoodCosts(importPreviewRows, schoolId);
      setImportResult({
        successCount: result.success_count,
        errorCount: result.error_count,
        errors: result.errors || [],
      });
      // 成功した行でローカルstateを更新
      if (result.success_count > 0) {
        setFoodCosts((prev) => {
          let updated = [...prev];
          for (const item of (result.items || [])) {
            const idx = updated.findIndex((f) => f.food_id === item.food_id);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], price_per_gram: item.price_per_gram };
            } else {
              updated.push({ food_id: item.food_id, food_name: item.food_name, price_per_gram: item.price_per_gram, school_id: schoolId });
            }
          }
          return updated;
        });
      }
    } catch (err) {
      setImportResult({ successCount: 0, errorCount: importPreviewRows.length, errors: [err.message] });
    } finally {
      setIsImporting(false);
    }
  };

  const openDeleteModal = (item) => {
    setDeleteTarget({ food_id: item.food_id, food_name: item.food_name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteFood(deleteTarget.food_id, schoolId);
      setFoodCosts(prev => prev.filter(item => item.food_id !== deleteTarget.food_id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete food:', error);
      alert('食材の削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddModal = () => {
    setNewFoodName('');
    setNewFoodPrice('');
    setNewFoodColorClass('');
    setIsAddModalOpen(true);
  };

  const handleAddFood = async () => {
    const price = parseFloat(newFoodPrice);
    if (!newFoodName.trim()) {
      alert('食材名を入力してください');
      return;
    }
    if (isNaN(price) || price < 0) {
      alert('有効なグラム単価を入力してください');
      return;
    }
    setIsAdding(true);
    try {
      const colorClass = newFoodColorClass ? parseInt(newFoodColorClass) : null;
      const result = await addFood(newFoodName.trim(), schoolId, price, colorClass);
      // ローカルリストに追記
      setFoodCosts(prev => [...prev, {
        food_id: result.food_id,
        food_name: result.food_name,
        price_per_gram: result.price_per_gram,
        school_id: result.school_id,
      }]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to add food:', error);
      alert('食材の追加に失敗しました');
    } finally {
      setIsAdding(false);
    }
  };

  // 検索フィルター
  const filteredFoodCosts = foodCosts.filter(item =>
    item.food_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">食材価格一覧</h2>
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
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
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
            食材を追加
          </button>
        </div>
      </div>

      {/* 検索ボックス */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">食材名</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="食材名で検索..."
          className="w-full md:w-1/3 border-slate-200 rounded-lg text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">データを読み込んでいます...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col className="w-16" />
                <col className="w-2/5" />
                <col className="w-1/5" />
                <col className="w-1/3" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">食材ID</th>
                  <th className="text-left p-3 text-xs font-semibold text-slate-600">食材名</th>
                  <th className="text-right p-3 text-xs font-semibold text-slate-600">価格（円/g）</th>
                  <th className="text-center p-3 text-xs font-semibold text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredFoodCosts.map((item) => (
                  <tr
                    key={item.food_id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-3 text-xs font-mono text-slate-400">{item.food_id}</td>
                    <td className="p-3 text-sm font-medium text-slate-800 truncate" title={item.food_name}>{item.food_name}</td>
                    <td className="p-3 text-sm text-right text-slate-700">
                      {editingId === item.food_id ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          step="0.0001"
                          min="0"
                          className="w-24 border-slate-300 rounded text-right px-2 py-1 text-sm border focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      ) : (
                        item.price_per_gram.toFixed(4)
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {editingId === item.food_id ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleSave(item.food_id, item.school_id)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors whitespace-nowrap"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(item.food_id, item.price_per_gram)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition-colors whitespace-nowrap"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors whitespace-nowrap"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-slate-500 text-right mt-4">
            表示件数: {filteredFoodCosts.length} / 総件数: {foodCosts.length}
          </div>
        </>
      )}

      {/* CSVインポートプレビューモーダル */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col mx-4">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">CSVインポート プレビュー</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {importResult ? (
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
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    以下の {importPreviewRows.length} 件をインポートします。
                    <span className="ml-2 text-xs text-slate-400">food_id あり → UPDATE / なし → INSERT</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-center p-2 font-semibold text-slate-600">操作</th>
                          <th className="text-left p-2 font-semibold text-slate-600">food_id</th>
                          <th className="text-left p-2 font-semibold text-slate-600">food_name</th>
                          <th className="text-right p-2 font-semibold text-slate-600">price_per_gram</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${row.food_id ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {row.food_id ? 'UPDATE' : 'INSERT'}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-slate-400">{row.food_id || '-'}</td>
                            <td className="p-2 font-medium text-slate-800">{row.food_name}</td>
                            <td className="p-2 text-right text-slate-700">{row.price_per_gram}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {importResult ? '閉じる' : 'キャンセル'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImportConfirm}
                  disabled={isImporting || importPreviewRows.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'インポート中...' : `${importPreviewRows.length} 件をインポート`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-3">食材の削除</h3>
            <p className="text-sm text-slate-600 mb-6">
              「<span className="font-semibold text-slate-800">{deleteTarget.food_name}</span>」を削除しますか？
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

      {/* 食材追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-5">新規食材を追加</h3>

            {/* 食材名 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                食材名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newFoodName}
                onChange={(e) => setNewFoodName(e.target.value)}
                placeholder="例: じゃがいも"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddFood()}
              />
            </div>

            {/* グラム単価 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                グラム単価（円/g） <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newFoodPrice}
                onChange={(e) => setNewFoodPrice(e.target.value)}
                placeholder="例: 0.0120"
                step="0.0001"
                min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* 食品色分類（三色食品群） */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-600 mb-1">食品の色（三色食品群）</label>
              <select
                value={newFoodColorClass}
                onChange={(e) => setNewFoodColorClass(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">未分類</option>
                <option value="1">赤（たんぱく質・体を作る）</option>
                <option value="2">黄（エネルギー・力になる）</option>
                <option value="3">緑（ビタミン・体の調子を整える）</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddFood}
                disabled={isAdding || !newFoodName.trim() || newFoodPrice === ''}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodCostSettings;
