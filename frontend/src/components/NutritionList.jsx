import React, { useState, useEffect } from 'react';
import { loadJSON } from '../services/api';

const NutritionList = () => {
  const [nutritionData, setNutritionData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    foodGroup: '',
    foodNumber: '',
    foodName: '',
  });

  useEffect(() => {
    loadNutritionData();
  }, []);

  const loadNutritionData = async () => {
    try {
      const data = await loadJSON('ja_food_standard_composition_list.json');
      // dataは配列そのもの
      setNutritionData(Array.isArray(data) ? data : []);
      setFilteredData(Array.isArray(data) ? data : []);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load nutrition data:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const filtered = nutritionData.filter((food) => {
      const matchGroup = !filters.foodGroup ||
        (food['食品群名'] || '').toLowerCase().includes(filters.foodGroup.toLowerCase());
      const matchNumber = !filters.foodNumber ||
        (food['食品番号'] || '').toLowerCase().includes(filters.foodNumber.toLowerCase());
      const matchName = !filters.foodName ||
        (food['食品名'] || '').toLowerCase().includes(filters.foodName.toLowerCase());

      return matchGroup && matchNumber && matchName;
    });
    setFilteredData(filtered);
  }, [filters, nutritionData]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="text-center py-8 text-slate-400">データを読み込んでいます...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">栄養価一覧</h2>

      {/* Filter Section */}
      <div className="bg-slate-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-3">検索フィルター</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              食品群名
            </label>
            <input
              type="text"
              value={filters.foodGroup}
              onChange={(e) => handleFilterChange('foodGroup', e.target.value)}
              placeholder="例: 穀類"
              className="w-full border-slate-200 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              食品番号
            </label>
            <input
              type="text"
              value={filters.foodNumber}
              onChange={(e) => handleFilterChange('foodNumber', e.target.value)}
              placeholder="例: 01001"
              className="w-full border-slate-200 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              食品名
            </label>
            <input
              type="text"
              value={filters.foodName}
              onChange={(e) => handleFilterChange('foodName', e.target.value)}
              placeholder="例: こめ"
              className="w-full border-slate-200 rounded text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          表示件数: <span className="font-bold text-slate-800">{filteredData.length}</span> 件
        </p>
        {(filters.foodGroup || filters.foodNumber || filters.foodName) && (
          <button
            onClick={() => setFilters({ foodGroup: '', foodNumber: '', foodName: '' })}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            フィルターをクリア
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="border border-slate-300 px-2 py-2 text-left text-xs font-semibold text-slate-700">
                食品群名
              </th>
              <th className="border border-slate-300 px-2 py-2 text-left text-xs font-semibold text-slate-700">
                食品番号
              </th>
              <th className="border border-slate-300 px-2 py-2 text-left text-xs font-semibold text-slate-700">
                食品名
              </th>
              <th className="border border-slate-300 px-2 py-2 text-right text-xs font-semibold text-slate-700">
                エネルギー<br />(kcal)
              </th>
              <th className="border border-slate-300 px-2 py-2 text-right text-xs font-semibold text-slate-700">
                たんぱく質<br />(g)
              </th>
              <th className="border border-slate-300 px-2 py-2 text-right text-xs font-semibold text-slate-700">
                脂質<br />(g)
              </th>
              <th className="border border-slate-300 px-2 py-2 text-right text-xs font-semibold text-slate-700">
                炭水化物<br />(g)
              </th>
              <th className="border border-slate-300 px-2 py-2 text-right text-xs font-semibold text-slate-700">
                食塩相当量<br />(g)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredData.length > 0 ? (
              filteredData.map((food, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700">
                    {food['食品群名'] || '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700">
                    {food['食品番号'] || '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-800">
                    {food['食品名'] || '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700 text-right">
                    {food['エネルギー(kcal)'] !== undefined && food['エネルギー(kcal)'] !== null ? food['エネルギー(kcal)'] : '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700 text-right">
                    {food['たんぱく質(g)'] !== undefined && food['たんぱく質(g)'] !== null ? food['たんぱく質(g)'] : '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700 text-right">
                    {food['脂質(g)'] !== undefined && food['脂質(g)'] !== null ? food['脂質(g)'] : '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700 text-right">
                    {food['炭水化物(g)'] !== undefined && food['炭水化物(g)'] !== null ? food['炭水化物(g)'] : '-'}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-xs text-slate-700 text-right">
                    {food['食塩相当量(g)'] !== undefined && food['食塩相当量(g)'] !== null ? food['食塩相当量(g)'] : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="border border-slate-200 px-4 py-8 text-center text-slate-400 text-sm">
                  検索条件に一致する食品が見つかりませんでした
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NutritionList;
