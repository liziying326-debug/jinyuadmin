import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Phone, Mail, MapPin, Building, CheckCircle2,
  Plus, Trash2, ImageIcon, Upload, Eye, EyeOff, Users, Award,
  Target, Eye as EyeIcon, ArrowUp, ArrowDown, ImageIcon as ImageIcon2,
} from 'lucide-react';

// ========== 类型定义（仅英文） ==========

interface MilestoneItem {
  year: string;
  title: string;
  desc: string;
}

interface FactoryImage {
  url: string;
  alt: string;
}

interface CapacityCard {
  title: string;
  desc: string;
  is_active?: boolean;
}

interface Certification {
  name: string; image: string; icon: string;
  desc: string;
  status: string;
}

interface TeamMember {
  visible: boolean;
  name: string;
  role: string;
  desc: string;
  photo: string; color: string; initial: string; email: string;
}

interface AboutData {
  // 公司介绍
  intro_title: string;
  intro_desc: string;
  business_desc: string;
  export_desc: string;
  company_image: string;

  // 使命愿景价值观
  mission: string;
  vision: string;
  values: string;

  // Company at a Glance
  founded: string;
  location: string;
  certification: string;
  product_lines: string;
  export_markets: string;
  contact_email: string;
  timeline_image: string;

  // 数组数据
  milestones: MilestoneItem[];
  factory_images: FactoryImage[];
  capacity_cards: CapacityCard[];
  certifications: Certification[];
  team_members: TeamMember[];
}

// ========== 默认数据（从前端 about.html 提取） ==========
const defaultAboutData = (): AboutData => ({
  intro_title: 'Who We Are',
  intro_desc: 'Foshan Jin Yu Advertising Material Co., Ltd is a professional manufacturer of advertising materials established in 2009. We are located in the U+Zhigu Industrial Park, LiShui Town, Nanhai District, Foshan City, Guangdong Province – one of China\'s most concentrated hubs for advertising material production.',
  business_desc: 'Our business integrates design, research and development, production and sales of advertising materials including self adhesive vinyl, PVC flex banner, PVC foam board, acrylic sheet, aluminum composite panel, PP hollow sheet, reflective sheeting, display stands and sign-making accessories.',
  export_desc: 'We export to Southeast Asia, Europe, the Americas, the Middle East and other global markets. Our products are known for durability, customizability, and competitive factory-direct pricing.',
  company_image: '',

  mission: 'To provide advertising professionals and sign-making businesses worldwide with reliable, high-quality materials that enable outstanding creative work at competitive factory-direct prices.',
  vision: 'To become a globally recognized name in advertising material manufacturing – known for product innovation, quality consistency, and strong long-term customer partnerships.',
  values: 'Quality first. Honest dealing. Continuous improvement. Customer-centric development. Every product batch must meet the standard we set for ourselves – not just what\'s acceptable.',

  founded: '2009',
  location: 'Foshan, Guangdong, China',
  certification: 'ISO 9001:2015',
  product_lines: '12',
  export_markets: '50',
  contact_email: 'vivian@materials-ad.com',
  timeline_image: '',

  milestones: [
    { year: '2009 · Year 1', title: 'Company Established', desc: 'Foshan Jin Yu Advertising Material Co., Ltd officially founded in Nanhai District, Foshan. Initial product range focused on PVC foam board and self adhesive vinyl for domestic market supply.' },
    { year: 'October 2022', title: 'First International Clients – Canton Fair', desc: 'Participated in the Canton Fair for the first time. Successfully established partnerships with overseas buyers from Southeast Asia, the Middle East, and Europe.' },
    { year: 'March 2023', title: 'R&D Team Established', desc: 'Dedicated research and development team formed to drive product innovation, custom formulation development, and technical support capabilities for international clients.' },
    { year: 'July 2023', title: 'Production Capacity Expanded', desc: 'Significant investment in new production lines and advanced equipment. Manufacturing capacity increased substantially to meet growing international order volumes.' },
    { year: '2024', title: 'ISO 9001 Certification Achieved', desc: 'Successfully completed ISO 9001:2015 quality management system certification. Full quality documentation and continuous improvement systems formalized.' },
  ],
  factory_images: [
    { url: '', alt: 'Factory Exterior' },
    { url: '', alt: 'Production Line' },
    { url: '', alt: 'Equipment' },
    { url: '', alt: 'Quality Control' },
  ],
  capacity_cards: [
    { title: 'Production Equipment', desc: 'Advanced extrusion lines, calendering equipment, coating machines, and slitting systems expanded in 2023' },
    { title: 'R&D Laboratory', desc: 'In-house testing lab and R&D team for custom formulation, product development, and quality verification' },
    { title: 'Export Warehouse', desc: 'Dedicated export packaging zone with moisture-proof and shock-resistant packing for international shipping' },
    { title: 'Quality Control Process', desc: 'Raw material inspection → in-process checks → final testing → packaging verification → pre-shipment inspection' },
    { title: 'Export Logistics', desc: 'FOB Guangzhou / Foshan. LCL and FCL available. Major freight forwarder partnerships.' },
    { title: 'OEM / Custom Orders', desc: 'Private label packaging, custom specifications, color matching, and dedicated production runs.' },
  ],
  certifications: [],
  team_members: [
    { visible: true,
      name: 'Vivian',
      role: 'Export Sales Manager',
      desc: 'International B2B sales, client relations and export documentation. Direct contact for all international enquiries.',
      photo: '', color: '#2563eb', initial: 'V', email: 'vivian@materials-ad.com' },
    { visible: true,
      name: 'R&D Department',
      role: 'Technical Development Team',
      desc: 'Product innovation, custom formulation, quality control, and technical documentation for international compliance.',
      photo: '', color: '#E8751A', initial: 'R', email: '' },
    { visible: true,
      name: 'Production Team',
      role: 'Manufacturing & QC',
      desc: 'Experienced production workforce operating our expanded manufacturing facility with ISO 9001 quality procedures.',
      photo: '', color: '#3a7ab8', initial: 'P', email: '' },
  ],
});

// ========== 组件 ==========

// 多行文本输入
function TextField({ label, value, onChange, disabled }: { label?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>}
      <textarea
        rows={2}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

// 单行文本输入
function TextInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

// 图片上传组件
function ImageUpload({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/about/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) onChange(data.url);
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="w-24 h-16 object-cover rounded-lg border border-gray-200" />
        ) : (
          <div className="w-24 h-16 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-gray-400" />
          </div>
        )}
        <div className="flex-1">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? '上传中...' : '上传图片'}
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          {value && (
            <button onClick={() => onChange('')} className="ml-2 text-red-400 hover:text-red-600 text-xs">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Company() {
  const [data, setData] = useState<AboutData>(defaultAboutData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeTab, setActiveTab] = useState('intro');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // 加载数据
  useEffect(() => {
    fetch('/api/about')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data && Object.keys(json.data).length > 0) {
          const def = defaultAboutData();
          const loadedData = json.data;
          const parseArray = (val: any, maxItems?: number) => {
            let arr;
            if (Array.isArray(val)) arr = val;
            else if (typeof val === 'string') {
              try { arr = JSON.parse(val); } catch { arr = []; }
            } else {
              arr = [];
            }
            if (maxItems && arr.length > maxItems) {
              arr = arr.slice(0, maxItems);
            }
            return arr;
          };
          const cleanLangFields = (item: any) => {
            if (typeof item !== 'object' || item === null) return item;
            const cleaned: any = {};
            Object.keys(item).forEach(key => {
              if (!/_zh$|_vi$|_tl$/.test(key)) {
                cleaned[key] = item[key];
              }
            });
            return cleaned;
          };
          loadedData.milestones = parseArray(loadedData.milestones, 10).map(cleanLangFields);
          loadedData.factory_images = parseArray(loadedData.factory_images, 4);
          loadedData.capacity_cards = parseArray(loadedData.capacity_cards).map(cleanLangFields);
          loadedData.certifications = parseArray(loadedData.certifications);
          loadedData.team_members = parseArray(loadedData.team_members);
          setData({ ...def, ...loadedData });
        }
      })
      .catch(err => console.warn('Load about data failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // 保存数据
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) showToast('公司介绍保存成功！');
      else showToast('保存失败：' + (json.message || '未知错误'));
    } catch { showToast('网络错误，保存失败'); }
    setSaving(false);
  };

  // 更新字段辅助
  const setField = useCallback((field: keyof AboutData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Tab 配置
  const tabs = [
    { id: 'intro', label: '公司介绍', icon: Building },
    { id: 'mission', label: '使命愿景', icon: Target },
    { id: 'milestones', label: '发展里程碑', icon: Award },
    { id: 'factory', label: '工厂展示', icon: ImageIcon2 },
    { id: 'capacity', label: '产能卡片', icon: Target },
    { id: 'team', label: '团队成员', icon: Users },
    { id: 'glance', label: '概览/侧边栏', icon: EyeIcon },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" /></div>;

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-500 relative">
      {toastMsg && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center z-50 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 页头 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">公司介绍管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理前台 About Us 页面的所有内容模块</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors shadow-sm">
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存所有修改'}
        </button>
      </div>

      {/* 模块 Tab */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* 公司介绍 Tab */}
          {activeTab === 'intro' && (
            <div className="space-y-5">
              <TextInput label="标题 (Intro Title)" value={data.intro_title} onChange={v => setField('intro_title', v)} />
              <TextField label="公司介绍 (Intro Description)" value={data.intro_desc} onChange={v => setField('intro_desc', v)} />
              <TextField label="业务描述 (Business Description)" value={data.business_desc} onChange={v => setField('business_desc', v)} />
              <TextField label="出口描述 (Export Description)" value={data.export_desc} onChange={v => setField('export_desc', v)} />
              <ImageUpload label="公司主图 (Company Image)" value={data.company_image} onChange={v => setField('company_image', v)} />
            </div>
          )}

          {/* 使命愿景 Tab */}
          {activeTab === 'mission' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">🎯 使命 (Mission)</h3>
                  <TextField label="" value={data.mission} onChange={v => setField('mission', v)} />
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">🔭 愿景 (Vision)</h3>
                  <TextField label="" value={data.vision} onChange={v => setField('vision', v)} />
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">💎 价值观 (Values)</h3>
                  <TextField label="" value={data.values} onChange={v => setField('values', v)} />
                </div>
              </div>
            </div>
          )}

          {/* 发展里程碑 Tab */}
          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">按时间倒序排列显示在前台时间线中</p>
                <button
                  onClick={() => {
                    const newItem: MilestoneItem = { year: '', title: '', desc: '' };
                    setField('milestones', [...data.milestones, newItem]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> 添加里程碑
                </button>
              </div>
              {data.milestones.map((m, idx) => (
                <div key={idx} className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">里程碑 #{idx + 1}</span>
                    <div className="flex gap-1">
                      {idx > 0 && <button onClick={() => {
                        const arr = [...data.milestones];
                        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
                        setField('milestones', arr);
                      }} className="p-1.5 text-gray-400 hover:text-blue-600"><ArrowUp className="w-4 h-4" /></button>}
                      {idx < data.milestones.length - 1 && <button onClick={() => {
                        const arr = [...data.milestones];
                        [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
                        setField('milestones', arr);
                      }} className="p-1.5 text-gray-400 hover:text-blue-600"><ArrowDown className="w-4 h-4" /></button>}
                      <button onClick={() => {
                        const arr = data.milestones.filter((_, i) => i !== idx);
                        setField('milestones', arr);
                      }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <TextInput label="年份/日期" value={m.year}
                    onChange={v => { const arr = [...data.milestones]; arr[idx] = { ...arr[idx], year: v }; setField('milestones', arr); }} />
                  <TextInput label="标题" value={m.title}
                    onChange={v => { const arr = [...data.milestones]; arr[idx] = { ...arr[idx], title: v }; setField('milestones', arr); }} />
                  <TextField label="描述" value={m.desc}
                    onChange={v => { const arr = [...data.milestones]; arr[idx] = { ...arr[idx], desc: v }; setField('milestones', arr); }} />
                </div>
              ))}
              {data.milestones.length === 0 && <p className="text-center text-gray-400 py-8">暂无里程碑，点击上方按钮添加</p>}
            </div>
          )}

          {/* 工厂展示 Tab */}
          {activeTab === 'factory' && (
            <div className="space-y-4">
              <ImageUpload label="发展历程配图 (Timeline Image)" value={data.timeline_image} onChange={v => setField('timeline_image', v)} />
              <hr className="my-4" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">工厂图片（前台展示 2x2 网格，最多 4 张）</p>
                {data.factory_images.length < 4 && (
                  <button
                    onClick={() => {
                      const newItem: FactoryImage = { url: '', alt: '' };
                      setField('factory_images', [...data.factory_images, newItem]);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> 添加图片
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.factory_images.map((img, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">图片 #{idx + 1}</span>
                      <button onClick={() => {
                        const arr = data.factory_images.filter((_, i) => i !== idx);
                        setField('factory_images', arr);
                      }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <ImageUpload label="" value={img.url}
                      onChange={v => { const arr = [...data.factory_images]; arr[idx] = { ...arr[idx], url: v }; setField('factory_images', arr); }} />
                    <TextInput label="Alt 文字" value={img.alt}
                      onChange={v => { const arr = [...data.factory_images]; arr[idx] = { ...arr[idx], alt: v }; setField('factory_images', arr); }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 产能卡片 Tab */}
          {activeTab === 'capacity' && (() => {
            const activeCards = data.capacity_cards.filter(c => c.is_active !== false);
            const canAddMore = activeCards.length < 6;
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">前台展示 2 行 3 列网格，最多 6 张卡片</p>
                  <button
                    onClick={() => {
                      const newItem: CapacityCard = { title: '', desc: '', is_active: true };
                      setField('capacity_cards', [...data.capacity_cards, newItem]);
                    }}
                    disabled={!canAddMore}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${canAddMore ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    <Plus className="w-3.5 h-3.5" /> 添加卡片 ({activeCards.length}/6)
                  </button>
                </div>
                {!canAddMore && <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">已达到最大数量 6 张，请先关闭部分卡片后再添加。</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.capacity_cards.map((card, idx) => {
                    const isActive = card.is_active !== false;
                    return (
                      <div key={idx} className={`bg-gray-50 rounded-xl p-4 border space-y-3 ${isActive ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={isActive} onChange={(e) => {
                                if (e.target.checked && activeCards.length >= 6) {
                                  showToast('最多只能启用 6 张卡片，请先关闭部分卡片');
                                  return;
                                }
                                const arr = [...data.capacity_cards];
                                arr[idx] = { ...arr[idx], is_active: e.target.checked };
                                setField('capacity_cards', arr);
                              }} className="sr-only peer" />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                            <span className={`text-sm font-bold ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>卡片 #{idx + 1} {isActive ? '(启用)' : '(禁用)'}</span>
                          </div>
                          <div className="flex gap-1">
                            {idx > 0 && <button onClick={() => {
                              const arr = [...data.capacity_cards];
                              [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
                              setField('capacity_cards', arr);
                            }} className="p-1.5 text-gray-400 hover:text-blue-600"><ArrowUp className="w-4 h-4" /></button>}
                            {idx < data.capacity_cards.length - 1 && <button onClick={() => {
                              const arr = [...data.capacity_cards];
                              [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
                              setField('capacity_cards', arr);
                            }} className="p-1.5 text-gray-400 hover:text-blue-600"><ArrowDown className="w-4 h-4" /></button>}
                              <button onClick={() => {
                                const arr = data.capacity_cards.filter((_, i) => i !== idx);
                                setField('capacity_cards', arr);
                              }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <TextInput label="标题 (EN)" value={card.title} disabled={!isActive}
                          onChange={v => { const arr = [...data.capacity_cards]; arr[idx] = { ...arr[idx], title: v }; setField('capacity_cards', arr); }} />
                        <TextField label="描述 (EN)" value={card.desc} disabled={!isActive}
                          onChange={v => { const arr = [...data.capacity_cards]; arr[idx] = { ...arr[idx], desc: v }; setField('capacity_cards', arr); }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 团队成员 Tab */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">前台展示团队成员卡片，可拖拽排序</p>
                <button
                  onClick={() => {
                    const newItem: TeamMember = {
                      visible: true,
                      name: '', role: '', desc: '',
                      photo: '', color: '#2563eb', initial: '?', email: '',
                    };
                    setField('team_members', [...data.team_members, newItem]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> 添加成员
                </button>
              </div>
              {data.team_members.map((m, idx) => (
                <div key={idx} className={`bg-gray-50 rounded-xl p-5 border space-y-3 ${m.visible ? 'border-gray-100' : 'border-red-200 bg-red-50/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-700">成员 #{idx + 1}</span>
                      <button
                        onClick={() => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], visible: !arr[idx].visible }; setField('team_members', arr); }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.visible ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {m.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {m.visible ? '显示' : '隐藏'}
                      </button>
                    </div>
                    <div className="flex gap-1">
                      {idx > 0 && <button onClick={() => {
                        const arr = [...data.team_members];
                        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
                        setField('team_members', arr);
                      }} className="p-1.5 text-gray-400 hover:text-blue-600"><ArrowUp className="w-4 h-4" /></button>}
                      {idx < data.team_members.length - 1 && <button onClick={() => {
                        const arr = [...data.team_members];
                        [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
                        setField('team_members', arr);
                      }} className="p-1.5 text-gray-400 hover:text-blue-600"><ArrowDown className="w-4 h-4" /></button>}
                      <button onClick={() => {
                        const arr = data.team_members.filter((_, i) => i !== idx);
                        setField('team_members', arr);
                      }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TextInput label="姓名" value={m.name}
                      onChange={v => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], name: v }; setField('team_members', arr); }} />
                    <TextInput label="职位" value={m.role}
                      onChange={v => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], role: v }; setField('team_members', arr); }} />
                  </div>
                  <TextField label="描述" value={m.desc}
                    onChange={v => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], desc: v }; setField('team_members', arr); }} />
                  <ImageUpload label="头像照片" value={m.photo}
                    onChange={v => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], photo: v }; setField('team_members', arr); }} />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">邮箱</label>
                      <input type="email" value={m.email} onChange={e => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], email: e.target.value }; setField('team_members', arr); }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">背景色</label>
                      <input type="color" value={m.color} onChange={e => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], color: e.target.value }; setField('team_members', arr); }}
                        className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">首字母 (无头像时)</label>
                      <input type="text" maxLength={2} value={m.initial} onChange={e => { const arr = [...data.team_members]; arr[idx] = { ...arr[idx], initial: e.target.value }; setField('team_members', arr); }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              ))}
              {data.team_members.length === 0 && <p className="text-center text-gray-400 py-8">暂无团队成员，点击上方按钮添加</p>}
            </div>
          )}

          {/* 概览/侧边栏 Tab */}
          {activeTab === 'glance' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500 mb-4">这些数据显示在前台 "Company at a Glance" 侧边栏（无需多语言）</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">成立年份</label>
                  <input type="text" value={data.founded} onChange={e => setField('founded', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">认证名称</label>
                  <input type="text" value={data.certification} onChange={e => setField('certification', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">产品线数量</label>
                  <input type="text" value={data.product_lines} onChange={e => setField('product_lines', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">出口市场数量（国家数）</label>
                  <input type="text" value={data.export_markets} onChange={e => setField('export_markets', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">联系邮箱</label>
                  <input type="email" value={data.contact_email} onChange={e => setField('contact_email', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" />
                </div>
              </div>
              <TextInput label="地区 (Location)" value={data.location} onChange={v => setField('location', v)} />
              <ImageUpload label="发展历程配图 (Timeline Image)" value={data.timeline_image} onChange={v => setField('timeline_image', v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
