/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import GlobalLangConfig from './pages/GlobalLangConfig';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Cases from './pages/Cases';
import Scenarios from './pages/Scenarios';
import Company from './pages/Company';
import News from './pages/News';
import FAQ from './pages/FAQ';
import Account from './pages/Account';
import SocialLinks from './pages/SocialLinks';
import Login from './pages/Login';
import { authApi, setToken, clearToken } from './api';

const AUTH_KEY = 'jinyu_material_current_user';

interface SearchResult {
  tab: string;
  label: string;
  module: string;
  icon: string;
}

// 从 localStorage 读取数据辅助函数
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return !!localStorage.getItem(AUTH_KEY);
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem(AUTH_KEY) || '';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 全局搜索逻辑
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.toLowerCase().trim();
    const results: SearchResult[] = [];
    const MAX_RESULTS = 20;

    // 1. 搜索产品（从 API + localStorage）
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const products = data.value || data.data || data || [];
      for (const p of products) {
        if (results.length >= MAX_RESULTS) break;
        const haystack = [
          p.name_en, p.name_zh, p.name_vi, p.name_tl,
          p.description_en, p.description_zh, p.category_id, p.id
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'products',
            label: p.name_en || p.name_zh || p.id,
            module: '产品管理',
            icon: '📦',
          });
        }
      }
    } catch { /* API 不可用时从 localStorage 读 */ }

    // 2. 搜索分类
    try {
      const cats = loadFromStorage<any[]>('jinyu_material_categories', []);
      for (const c of cats) {
        if (results.length >= MAX_RESULTS) break;
        const haystack = [
          c.name, c.description,
          c.langData?.en?.name, c.langData?.zh?.name
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'categories',
            label: c.langData?.en?.name || c.langData?.zh?.name || c.name || '未命名分类',
            module: '产品分类',
            icon: '📁',
          });
        }
      }
    } catch {}

    // 3. 搜索案例
    try {
      const cases = loadFromStorage<any[]>('jinyu_material_cases', []);
      for (const c of cases) {
        if (results.length >= MAX_RESULTS) break;
        const haystack = [
          c.title, c.client,
          c.langData?.en?.title, c.langData?.zh?.title,
          c.langData?.en?.seoTitle, c.langData?.zh?.seoTitle
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'cases',
            label: c.langData?.en?.title || c.langData?.zh?.title || c.title || '未命名案例',
            module: '案例管理',
            icon: '💼',
          });
        }
      }
    } catch {}

    // 4. 搜索应用场景
    try {
      const scenarios = loadFromStorage<any[]>('jinyu_material_scenarios', []);
      for (const s of scenarios) {
        if (results.length >= MAX_RESULTS) break;
        const haystack = [
          s.name, s.desc,
          s.langData?.en?.name, s.langData?.zh?.name,
          s.langData?.en?.desc, s.langData?.zh?.desc
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'scenarios',
            label: s.langData?.en?.name || s.langData?.zh?.name || s.name || '未命名场景',
            module: '应用场景',
            icon: '🖼️',
          });
        }
      }
    } catch {}

    // 5. 搜索新闻
    try {
      const news = loadFromStorage<any[]>('jinyu_admin_news', []);
      for (const n of news) {
        if (results.length >= MAX_RESULTS) break;
        const haystack = [
          n.langData?.en?.title, n.langData?.zh?.title,
          n.langData?.en?.seoTitle, n.langData?.zh?.seoTitle
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'news',
            label: n.langData?.en?.title || n.langData?.zh?.title || '未命名新闻',
            module: '新闻管理',
            icon: '📰',
          });
        }
      }
    } catch {}

    // 6. 搜索 FAQ
    try {
      const faqs = loadFromStorage<any[]>('jinyu_admin_faqs', []);
      for (const f of faqs) {
        if (results.length >= MAX_RESULTS) break;
        const haystack = [
          f.langData?.en?.question, f.langData?.zh?.question,
          f.langData?.en?.answer, f.langData?.zh?.answer
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'faq',
            label: f.langData?.en?.question || f.langData?.zh?.question || '未命名FAQ',
            module: 'FAQ管理',
            icon: '❓',
          });
        }
      }
    } catch {}

    // 7. 搜索公司介绍
    try {
      const company = loadFromStorage<any>('jinyu_material_company', null);
      if (company) {
        const haystack = [
          company.langData?.en?.intro, company.langData?.zh?.intro
        ].filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) {
          results.push({
            tab: 'company',
            label: '公司介绍',
            module: '公司介绍',
            icon: '🏢',
          });
        }
      }
    } catch {}

    // 8. 菜单模块匹配
    const menuItems = [
      { id: 'dashboard', label: '控制台', keywords: '仪表盘 dashboard 统计 数据' },
      { id: 'global-lang', label: '全局多语言', keywords: '语言 翻译 language i18n 多语言' },
      { id: 'products', label: '产品管理', keywords: '产品 product 商品 货品' },
      { id: 'categories', label: '产品分类', keywords: '分类 category 类别 类目' },
      { id: 'cases', label: '案例管理', keywords: '案例 case 案例 项目' },
      { id: 'scenarios', label: '应用场景', keywords: '场景 scenario 应用 场景' },
      { id: 'news', label: '新闻管理', keywords: '新闻 news 博客 blog 文章 资讯' },
      { id: 'faq', label: 'FAQ管理', keywords: 'faq 问题 常见 问答 help' },
      { id: 'company', label: '公司介绍', keywords: '公司 company 关于 about 简介' },
      { id: 'social-links', label: '社交媒体', keywords: '社交媒体 social link 图标 社交 链接 facebook instagram' },
      { id: 'account', label: '账号管理', keywords: '账号 account 密码 用户 管理' },
    ];
    for (const m of menuItems) {
      if (results.length >= MAX_RESULTS) break;
      if (m.label.toLowerCase().includes(q) || m.keywords.toLowerCase().includes(q)) {
        // 避免重复（如果内容搜索已经找到该模块的结果）
        if (!results.some(r => r.tab === m.id)) {
          results.push({
            tab: m.id,
            label: `前往${m.label}`,
            module: '导航',
            icon: '🔍',
          });
        }
      }
    }

    setSearchResults(results);
  }, []);

  // 防抖搜索
  const handleGlobalSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, 200);
  }, [performSearch]);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await authApi.login(username, password);
      if (result.success && result.user) {
        setToken(result.token);
        localStorage.setItem(AUTH_KEY, username);
        setIsLoggedIn(true);
        setCurrentUser(username);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
    setCurrentUser('');
    setActiveTab('dashboard');
  };

  // 未登录显示登录页面
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'global-lang':
        return <GlobalLangConfig />;
      case 'products':
        return <Products />;
      case 'categories':
        return <Categories />;
      case 'cases':
        return <Cases />;
      case 'scenarios':
        return <Scenarios />;
      case 'company':
        return <Company />;
      case 'news':
        return <News />;
      case 'faq':
        return <FAQ />;
      case 'account':
        return <Account currentUser={currentUser} />;
      case 'social-links':
        return <SocialLinks />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      currentUser={currentUser}
      onLogout={handleLogout}
      onGlobalSearch={handleGlobalSearch}
      searchResults={searchResults}
      searchQuery={globalSearchQuery}
      onSearchQueryChange={setGlobalSearchQuery}
    >
      {renderContent()}
    </Layout>
  );
}
