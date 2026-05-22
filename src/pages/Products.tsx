import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, Filter, ArrowLeft, Save, CheckCircle2, List, Eye, Upload } from 'lucide-react';

type Spec = { id: number; name: string; value: string };

type Product = {
  id: number;
  name: string;
  category: string;
  status: string;
  images: string[];
  specs: Spec[];
  features: string[];
  description: string;
  _backendId?: string;
};

const defaultSpecs: Spec[] = [
  { id: 0, name: 'Item Name', value: 'SAV120/140' },
  { id: 1, name: 'Release paper', value: '120/140g±5g' },
  { id: 2, name: 'Film', value: '80/100micron±5micron' },
  { id: 3, name: 'Surface', value: 'Glossy/ Matte' },
  { id: 4, name: 'Glue', value: 'Semi removable, 22μm±2μm' },
  { id: 5, name: 'Size', value: '1.07/1.27/1.37/1.52*50m' },
  { id: 6, name: 'Ink type', value: 'Eco solvent/ solvent' },
  { id: 7, name: 'Package', value: 'Export carton' },
];

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<'list' | 'edit' | 'details'>('list');
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);

  // 编辑表单 state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSpecs, setEditSpecs] = useState<Spec[]>([]);
  const [editFeatures, setEditFeatures] = useState<string[]>(['']);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [editCategory, setEditCategory] = useState('Advertising Media');
  const [editCategoryId, setEditCategoryId] = useState('advertising-media');
  const [editStatus, setEditStatus] = useState('上架');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('所有分类');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 防抖搜索
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 搜索或筛选变化时回到第一页
  React.useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filterCategory]);
  const [categoryList, setCategoryList] = useState<{ id: string; name_en: string }[]>([]);

  const [toastMsg, setToastMsg] = useState('');
  const [deleteImageIndex, setDeleteImageIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 产品图片上传处理（使用 MinIO）
  const handleProductImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/about/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      if (result.url) {
        setProductImages(prev => [...prev, result.url]);
        showToast('图片已上传');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('图片上传失败');
    }
  };

  // 加载产品和分类
  React.useEffect(() => {
    async function fetchAll() {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch('/api/categories', { cache: 'no-store' }),
          fetch('/api/products?status=all'),
        ]);
        let cats: { id: string; name_en: string }[] = [];
        if (catRes.ok) {
          const catData = await catRes.json();
          cats = Array.isArray(catData) ? catData : (catData.data || []);
          setCategoryList(cats);
        }
        if (prodRes.ok) {
          const apiResponse = await prodRes.json();
          const apiProducts = apiResponse.data || apiResponse; // 兼容 {success,data} 和直接返回数组两种格式
          const converted: Product[] = apiProducts.map((p: any, index: number) => ({
            id: index + 1,
            name: p.name_en || 'Product',
            category: getCategoryName(p.category_id, cats),
            status: p.status === 'active' ? '上架' : '下架',
            images: p.images || [],
            _backendId: p.id || '',
            description: p.description_en || '',
            specs: (p.specs || []).map((s: any, i: number) => ({
              id: i,
              name: s.k_en || '',
              value: s.v_en || '',
            })),
            features: Array.isArray(p.features_en)
              ? p.features_en
              : (p.features_en ? p.features_en.split('; ').filter((f: string) => f) : ['']),
          }));
          setProducts(converted);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // 拖拽阻止默认行为
  React.useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 防抖搜索 + 分页
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      (debouncedSearch === '' || p.name.toLowerCase().includes(debouncedSearch.toLowerCase())) &&
      (filterCategory === '所有分类' || p.category === filterCategory)
    );
  }, [products, debouncedSearch, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredProducts, currentPage]);

  // 确保 currentPage 不越界
  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages]);

  const getCategoryName = (categoryId: string, cats?: { id: string; name_en: string }[]) => {
    const list = cats || categoryList;
    const found = list.find(c => String(c.id) === String(categoryId));
    return found ? found.name_en : categoryId || 'Other';
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      if (res.ok) {
        const cats = await res.json();
        const list = Array.isArray(cats) ? cats : (cats.data || []);
        setCategoryList(list);
        return list;
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
    return [];
  };

  const openEdit = async (product: Product | null, mode: 'edit' | 'details') => {
    setSelectedItem(product);
    const cats = await fetchCategories();
    if (product) {
      setEditName(product.name || '');
      setEditDesc(product.description || '');
      setEditSpecs(product.specs && product.specs.length > 0
        ? product.specs.map(s => ({ ...s }))
        : defaultSpecs.map(s => ({ ...s })));
      setEditFeatures(product.features && product.features.length > 0
        ? [...product.features]
        : ['']);
      setProductImages([...product.images]);
      setEditCategory(product.category);
      const matchedCat = cats.find((c: any) => c.name_en === product.category || c.id === product.category);
      setEditCategoryId(matchedCat ? matchedCat.id : 'advertising-media');
      setEditStatus(product.status);
    } else {
      setEditName('');
      setEditDesc('');
      setEditSpecs(defaultSpecs.map(s => ({ ...s })));
      setEditFeatures(['']);
      setProductImages([]);
      const firstCat = cats[0] || { id: 'advertising-media', name_en: 'Advertising Media' };
      setEditCategory(firstCat.name_en);
      setEditCategoryId(firstCat.id);
      setEditStatus('上架');
    }
    setView(mode);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const refreshProductList = async () => {
    try {
      const res = await fetch('/api/products?status=all');
      if (res.ok) {
        const apiProducts = await res.json();
        const converted: Product[] = apiProducts.map((p: any, index: number) => ({
          id: index + 1,
          name: p.name_en || 'Product',
          category: getCategoryName(p.category_id),
          status: p.status === 'active' ? '上架' : '下架',
          images: p.images || [],
          _backendId: p.id,
          description: p.description_en || '',
          specs: (p.specs || []).map((s: any, i: number) => ({
            id: i,
            name: s.k_en || '',
            value: s.v_en || '',
          })),
          features: Array.isArray(p.features_en)
            ? p.features_en
            : (p.features_en ? p.features_en.split('; ').filter((f: string) => f) : ['']),
        }));
        setProducts(converted);
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      showToast('请填写产品名称');
      return;
    }
    if (!productImages || productImages.length === 0) {
      showToast('请上传产品图片');
      return;
    }

    setIsSaving(true);
    try {
      const backendProduct = {
        name_en: editName.trim(),
        description_en: editDesc.trim(),
        category_id: editCategoryId || 'advertising-media',
        status: editStatus === '上架' ? 'active' : 'inactive',
        images: productImages,
        specs: editSpecs.map(s => ({
          k_en: s.name || '',
          v_en: s.value || '',
        })),
        features_en: editFeatures.filter(f => f.trim()),
      };

      if (selectedItem && selectedItem._backendId) {
        const res = await fetch(`/api/products/${selectedItem._backendId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendProduct),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Save failed: ${res.status} - ${errText}`);
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendProduct),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Save failed: ${res.status} - ${errText}`);
        }
      }

      showToast('产品保存成功！');
      setView('list');
      setTimeout(() => setIsSaving(false), 1000);
      refreshProductList();
    } catch (err: any) {
      setIsSaving(false);
      showToast('保存失败: ' + (err?.message || '未知错误'));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    if (deleteModal._backendId) {
      try {
        const res = await fetch(`/api/products/${deleteModal._backendId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        await refreshProductList();
      } catch {
        showToast('删除失败');
        return;
      }
    } else {
      setProducts(prev => prev.filter(p => p.id !== deleteModal.id));
    }
    setDeleteModal(null);
    showToast('产品已删除');
  };

  // ─── 编辑 / 详情 视图 ───────────────────────────────────────────────────────
  if (view === 'edit' || view === 'details') {
    const isReadOnly = view === 'details';
    return (
      <div className="space-y-6 animate-in fade-in duration-500 relative max-w-7xl mx-auto">
        {toastMsg && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center z-50 animate-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 顶部标题栏 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <button onClick={() => setView('list')} className="mr-4 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isReadOnly ? '产品详情' : (selectedItem ? '编辑产品' : '发布新产品')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {isReadOnly ? '查看产品信息和规格。' : '填写英文产品信息和规格参数。'}
              </p>
            </div>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm ${isSaving ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存产品
                </>
              )}
            </button>
          )}
        </div>

        {/* 基本信息 */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
            <List className="w-5 h-5 mr-2 text-blue-600" />
            基本信息
          </h2>

          {/* 分类 + 状态 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">分类</label>
              <select
                disabled={isReadOnly}
                value={editCategoryId}
                onChange={(e) => {
                  const cat = categoryList.find(c => c.id === e.target.value);
                  setEditCategoryId(e.target.value);
                  setEditCategory(cat ? cat.name_en : e.target.value);
                }}
                className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500'}`}
              >
                {categoryList.length > 0 ? categoryList.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name_en}</option>
                )) : (
                  <>
                    <option value="advertising-media">Advertising Media</option>
                    <option value="advertising-panel">Advertising Panel</option>
                    <option value="display-stand">Display Stand</option>
                    <option value="accessory-tools">Accessory Tools</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">状态</label>
              <select
                disabled={isReadOnly}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500'}`}
              >
                <option value="上架">上架</option>
                <option value="下架">下架</option>
              </select>
            </div>
          </div>

          {/* 图片上传 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              产品图片 <span className="text-red-500">*</span>
              <span className="text-gray-500 font-normal ml-2">最多6张图片，第一张为主图</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-2">
              {productImages.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden group">
                  <img src={img} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                  {index === 0 && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-sm z-10">主图</div>
                  )}
                  {!isReadOnly && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      {index !== 0 && (
                        <button
                          onClick={() => {
                            const newImgs = [...productImages];
                            const [removed] = newImgs.splice(index, 1);
                            newImgs.unshift(removed);
                            setProductImages(newImgs);
                          }}
                          className="text-xs bg-white text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          设为主图
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteImageIndex(index)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {productImages.length < 6 && !isReadOnly && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      handleProductImageUpload(file);
                    }
                  }}
                  className="aspect-square flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl transition-colors bg-gray-50 hover:border-blue-500 cursor-pointer hover:bg-blue-50/50 group"
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleProductImageUpload(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors mb-2">
                    <Upload className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600">上传</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 产品内容（英文）*/}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-900">产品内容（English）</h2>
            <p className="text-sm text-gray-500 mt-0.5">前台多语言翻译将以此为基础自动生成</p>
          </div>

          <div className="p-6 space-y-6">
            {/* 产品名称 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                产品名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none transition-all ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500'}`}
                placeholder="e.g. Self Adhesive Vinyl"
              />
            </div>

            {/* 产品介绍 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">产品介绍</label>
              <textarea
                disabled={isReadOnly}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={4}
                className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none transition-all resize-y ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500'}`}
                placeholder="e.g. High quality Self Adhesive Vinyl for advertising and display applications."
              />
              <p className="text-xs text-gray-400 mt-1">This description will appear on the product detail page.</p>
            </div>

            {/* 规格 */}
            <div className="space-y-4">
              <h3 className="text-md font-bold text-gray-900">规格</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-1/3 border-r border-gray-200">属性</th>
                      <th className="px-4 py-3 font-semibold w-7/12 border-r border-gray-200">值</th>
                      <th className="px-4 py-3 font-semibold w-1/12 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {editSpecs.map((spec, index) => (
                      <tr key={spec.id} className="bg-white hover:bg-gray-50/50 transition-colors">
                        <td className="px-0 py-0 border-r border-gray-200">
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={spec.name}
                            onChange={(e) => {
                              setEditSpecs(prev => prev.map((s, i) => i === index ? { ...s, name: e.target.value } : s));
                            }}
                            className={`w-full bg-transparent px-4 py-3 outline-none transition-colors ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-blue-50/50'}`}
                            placeholder="e.g. Release paper"
                          />
                        </td>
                        <td className="px-0 py-0 border-r border-gray-200">
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={spec.value}
                            onChange={(e) => {
                              setEditSpecs(prev => prev.map((s, i) => i === index ? { ...s, value: e.target.value } : s));
                            }}
                            className={`w-full bg-transparent px-4 py-3 outline-none transition-colors ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-blue-50/50'}`}
                            placeholder="e.g. 120/140g±5g"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          {!isReadOnly && (
                            <button
                              onClick={() => setEditSpecs(prev => prev.filter((_, i) => i !== index))}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除此行"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setEditSpecs(prev => [...prev, { id: Date.now(), name: '', value: '' }])}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors border border-dashed border-blue-300 w-full justify-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加规格行
                </button>
              )}
            </div>

            {/* 产品特点 */}
            <div className="space-y-4">
              <h3 className="text-md font-bold text-gray-900">产品特点</h3>
              <div className="space-y-3">
                {editFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={feature}
                      onChange={(e) => setEditFeatures(prev => prev.map((f, i) => i === index ? e.target.value : f))}
                      className={`flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all ${isReadOnly ? 'text-gray-500 cursor-not-allowed' : 'focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500'}`}
                      placeholder={`Feature ${index + 1}...`}
                    />
                    {!isReadOnly && editFeatures.length > 1 && (
                      <button
                        onClick={() => setEditFeatures(prev => prev.filter((_, i) => i !== index))}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setEditFeatures(prev => [...prev, ''])}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors border border-dashed border-blue-300 w-full justify-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加特点
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 删除图片确认弹窗 */}
        {deleteImageIndex !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除图片？</h3>
                <p className="text-sm text-gray-500">确定要删除这张图片吗？</p>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-center gap-3">
                <button onClick={() => setDeleteImageIndex(null)} className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">取消</button>
                <button
                  onClick={() => {
                    setProductImages(prev => prev.filter((_, i) => i !== deleteImageIndex));
                    setDeleteImageIndex(null);
                    showToast('图片已删除');
                  }}
                  className="flex-1 px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── 列表视图 ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {toastMsg && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center z-50 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">产品管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理网站展示的所有产品信息及规格参数。</p>
        </div>
        <button onClick={() => openEdit(null, 'edit')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          发布新产品
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索产品名称..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="所有分类">所有分类</option>
                {categoryList.length > 0 ? categoryList.map(cat => (
                  <option key={cat.id} value={cat.name_en}>{cat.name_en}</option>
                )) : (
                  <>
                    <option>Advertising Media</option>
                    <option>Advertising Panel</option>
                    <option>Display Stand</option>
                    <option>Accessory Tools</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-semibold">产品信息</th>
                <th className="px-6 py-4 font-semibold">所属分类</th>
                <th className="px-6 py-4 font-semibold">状态</th>
                <th className="px-6 py-4 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400 text-sm">加载中...</td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {product.images && product.images[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">{product.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${product.status === '上架' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product.status === '上架' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => openEdit(product, 'details')} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="查看详情">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(product, 'edit')} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteModal(product)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="删除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
          {!isLoading && filteredProducts.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                第 {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredProducts.length)} 条，共 {filteredProducts.length} 条
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  上一页
                </button>
                <span className="px-3 py-1.5 text-sm">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
          {!isLoading && filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">未找到匹配的产品</p>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除产品？</h3>
              <p className="text-sm text-gray-500">此操作无法撤销。</p>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-center gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                取消
              </button>
              <button onClick={handleDelete} className="flex-1 px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
