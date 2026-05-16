import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, ArrowLeft, Save, CheckCircle2, Package, Search, X } from 'lucide-react';
import ImageUploader from '@/src/components/ImageUploader';

type Scenario = {
  id: number;
  name: string;
  desc: string;
  slug?: string;
  image?: string;
  images?: string[];
  materials?: Material[];
};

type Material = {
  id: string;
  name: string;
  desc: string;
};

async function loadScenariosFromAPI(): Promise<Scenario[]> {
  try {
    const resp = await fetch('/api/scenarios');
    const json = await resp.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data.map((s: any) => ({
        id: s.id,
        name: s.name_en || s.name || '',
        desc: s.description_en || s.desc || '',
        slug: s.slug || '',
        image: s.image || (Array.isArray(s.images) ? s.images[0] : ''),
        images: s.images || [],
        materials: Array.isArray(s.materials) ? s.materials.map((m: any) => ({
          id: m.id || String(Math.random()),
          name: m.name_en || m.name || '',
          desc: m.description_en || m.desc || '',
        })) : []
      }));
    }
  } catch { /* ignore */ }
  return [];
}

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'edit' | 'details'>('list');
  const [selectedItem, setSelectedItem] = useState<Scenario | null>(null);
  const [deleteModal, setDeleteModal] = useState<Scenario | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // 编辑表单状态
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editMaterials, setEditMaterials] = useState<Material[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // 从 API 加载
  React.useEffect(() => {
    loadScenariosFromAPI().then(apiData => {
      if (apiData && apiData.length > 0) setScenarios(apiData);
      setApiLoaded(true);
    }).catch(() => setApiLoaded(true));
  }, []);

  // 当选中项变化时，填充表单
  React.useEffect(() => {
    if (selectedItem) {
      setEditName(selectedItem.name || '');
      setEditDesc(selectedItem.desc || '');
      setEditImages(selectedItem.images || []);
      setEditMaterials(selectedItem.materials || []);
    } else {
      setEditName('');
      setEditDesc('');
      setEditImages([]);
      setEditMaterials([]);
    }
  }, [selectedItem]);

  // 加载产品列表（用于推荐产品选择器）
  React.useEffect(() => {
    if (showProductPicker && allProducts.length === 0) {
      fetch('/api/products', { headers: { 'x-from-frontend': '1' } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data.data)) setAllProducts(data.data); else if (Array.isArray(data)) setAllProducts(data); })
        .catch(() => {});
    }
  }, [showProductPicker]);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const openProductPicker = () => { setShowProductPicker(true); setProductSearch(''); };

  const addRecommendedMaterial = (product: any) => {
    const exists = editMaterials.some(m => m.id === product.id || m.id === product._backendId);
    if (exists) return;
    const newMat: Material = {
      id: product._backendId || product.id || String(Date.now()),
      name: product.name_en || product.name || '',
      desc: product.description_en || product.description || '',
    };
    setEditMaterials(prev => [...prev, newMat]);
  };

  const removeMaterial = (mid: string) => { setEditMaterials(prev => prev.filter(m => m.id !== mid)); };

  const filteredProducts = allProducts.filter(p => {
    const search = productSearch.toLowerCase();
    const name = (p.name_en || p.name || '').toLowerCase();
    const cat = (p.category_name_en || p.category_name || '').toLowerCase();
    return name.includes(search) || cat.includes(search);
  });

  const handleSave = async () => {
    const imgs = editImages.length > 0 ? editImages : (selectedItem?.images || []);

    const payload = {
      name_en: editName,
      description_en: editDesc,
      images: imgs,
      materials: editMaterials,
    };

    try {
      if (selectedItem && selectedItem.id !== 0) {
        const resp = await fetch(`/api/scenarios/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await resp.json();
        if (json.success) {
          const updated = { ...selectedItem, name: editName, desc: editDesc, images: imgs, materials: editMaterials };
          setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
          setSelectedItem(updated);
          showToast('场景保存成功 ✓');
        } else { showToast('保存失败：' + (json.error || '未知错误')); }
      } else {
        const resp = await fetch('/api/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await resp.json();
        if (json.success) {
          const newItem: Scenario = {
            id: json.data?.id || Date.now(),
            name: editName, desc: editDesc, images: imgs, materials: editMaterials,
          };
          setScenarios(prev => [newItem, ...prev]);
          setSelectedItem(newItem);
          showToast('场景发布成功 ✓');
        } else { showToast('发布失败：' + (json.error || '未知错误')); }
      }
    } catch (err) { showToast('网络错误，保存失败'); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await fetch(`/api/scenarios/${deleteModal.id}`, { method: 'DELETE' });
      setScenarios(prev => prev.filter(s => s.id !== deleteModal.id));
      setDeleteModal(null);
      showToast('场景删除成功');
    } catch (error) {
      showToast('删除失败');
    }
  };

  // ── 编辑/详情视图 ──
  if (view === 'edit' || view === 'details') {
    const isReadOnly = view === 'details';

    return (
      <div className="space-y-6 animate-in fade-in duration-500 relative">
        {toastMsg && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center z-[60] animate-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <button onClick={() => { setView('list'); setSelectedItem(null); }} className="mr-4 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{isReadOnly ? '场景详情' : '编辑场景'}</h1>
              <p className="text-sm text-gray-500 mt-1">{isReadOnly ? '查看应用场景内容。' : '编辑应用场景的详细信息。'}</p>
            </div>
          </div>
          {!isReadOnly && (
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm">
              <Save className="w-4 h-4 mr-2" />
              保存场景
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-w-7xl mx-auto">
          {/* 无语言 tab，纯英文编辑 */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">English Content</h2>
          </div>

          <div className="p-6 space-y-6">
            {isReadOnly && selectedItem?.images && selectedItem.images.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">场景图片</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {selectedItem.images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <img src={img} alt={`${selectedItem.name} ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && (<div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow-sm">主图</div>)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isReadOnly && (
              <ImageUploader images={editImages} onChange={setEditImages} max={6} label="场景图片" />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">场景名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500'}`}
                  placeholder="输入场景名称..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">描述 <span className="text-red-500">*</span></label>
              <div className={`border border-gray-200 rounded-lg overflow-hidden transition-all ${isReadOnly ? 'opacity-70' : 'focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500'}`}>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  disabled={isReadOnly}
                  rows={10}
                  className={`w-full bg-white px-4 py-3 text-sm outline-none resize-y ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : ''}`}
                  placeholder="输入详细描述..."
                ></textarea>
              </div>
            </div>

            {/* 推荐产品编辑区域 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-900">推荐产品</label>
                {!isReadOnly && (
                  <button onClick={openProductPicker} className="flex items-center text-sm font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus className="w-4 h-4 mr-1.5" />
                    添加产品
                  </button>
                )}
              </div>

              {editMaterials.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {editMaterials.map(mat => (
                    <div key={mat.id} className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm truncate">{mat.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mat.desc}</div>
                        </div>
                        {!isReadOnly && (
                          <button onClick={() => removeMaterial(mat.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">暂未添加推荐产品</p>
                  <p className="text-xs text-gray-400 mt-1">点击上方"添加产品"从产品列表中选择</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 产品选择器弹框 */}
        {showProductPicker && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">选择推荐产品</h3>
                  <p className="text-sm text-gray-500 mt-0.5">从已上架产品列表中选择关联到此场景的产品</p>
                </div>
                <button onClick={() => setShowProductPicker(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="搜索产品名称或分类..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" autoFocus />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredProducts.map(product => {
                    const isSelected = editMaterials.some(m => m.id === (product._backendId || product.id));
                    return (
                      <div key={product._backendId || product.id} onClick={() => { addRecommendedMaterial(product); setShowProductPicker(false); }}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-blue-300 bg-blue-50 opacity-60' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm'}`}>
                        <img src={product.image || product.images?.[0] || 'https://picsum.photos/seed/prod/60/60'} alt={product.name_en || product.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{product.name_en || product.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{product.category_name_en || product.category_name || '未分类'}</div>
                        </div>
                        {isSelected && (<div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4 text-white" /></div>)}
                      </div>
                    );
                  })}
                </div>
                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" /><p>未找到匹配的产品</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 列表视图 ──
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {toastMsg && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center z-[60] animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">应用场景管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理产品适用的各类应用场景分类。</p>
        </div>
        <button onClick={() => { setSelectedItem(null); setView('edit'); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm">
          <Plus className="w-4 h-4 mr-2" />添加场景
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup><col style={{width: '80px'}} /><col style={{width: '180px'}} /><col style={{width: '180px'}} /><col style={{width: '100px'}} /></colgroup>
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-4 font-semibold">图片</th>
                <th className="px-4 py-4 font-semibold">场景名称</th>
                <th className="px-4 py-4 font-semibold">推荐产品</th>
                <th className="px-4 py-4 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scenarios.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4"><img src={item.images?.[0] || ''} alt={item.name} className="w-14 h-10 object-cover rounded-lg border border-gray-200" /></td>
                  <td className="px-4 py-4"><div className="text-sm font-bold text-gray-900 truncate">{item.name}</div></td>
                  <td className="px-4 py-4">
                    {item.materials && item.materials.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.materials.slice(0, 2).map(m => (
                          <span key={m.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">{m.name || '—'}</span>
                        ))}
                        {item.materials.length > 2 && (<span className="text-xs text-gray-400">+{item.materials.length - 2}</span>)}
                      </div>
                    ) : (<span className="text-xs text-gray-400">—</span>)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-1">
                      <button onClick={() => { setSelectedItem(item); setView('details'); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="查看"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setSelectedItem(item); setView('edit'); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteModal(item)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {scenarios.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">暂无应用场景</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除场景？</h3>
              <p className="text-sm text-gray-500">确定要删除 <span className="font-semibold text-gray-900">"{deleteModal.name}"</span> 吗？此操作不可撤销。</p>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-center gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">取消</button>
              <button onClick={handleDelete} className="flex-1 px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
