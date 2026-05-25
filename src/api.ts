const API_BASE = '';
const TOKEN_KEY = 'jinyu_material_token';

// 获取存储的 JWT token
function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function api<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  // 自动附加 JWT token
  const token = getToken();
  if (token) {
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  // 401 时自动清除过期 token
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('jinyu_material_current_user');
    window.location.reload();
    throw new Error('登录已过期');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// 导出 token 操作函数，供 App.tsx 使用
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ============ 产品 API ============

export const productsApi = {
  getAll: () => api<Product[]>('/api/products'),
  getById: (id: number) => api<Product>(`/api/products/${id}`),
  create: (data: Partial<Product>) => api<Product>('/api/products', { method: 'POST', body: data }),
  update: (id: number, data: Partial<Product>) => api<Product>(`/api/products/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) => api<{ success: boolean }>(`/api/products/${id}`, { method: 'DELETE' }),
};

// ============ 翻译 API ============

export const i18nApi = {
  get: (lang: string) => api<Record<string, string>>(`/api/i18n/${lang}`),
  save: (lang: string, data: Record<string, string>) => api<{ success: boolean }>('/api/i18n', { method: 'POST', body: { lang, data } }),
};

// ============ 设置 API ============

export const settingsApi = {
  get: () => api<any>('/api/settings'),
  save: (data: any) => api<{ success: boolean }>('/api/settings', { method: 'POST', body: data }),
};

// ============ 联系表单 API ============

export const contactApi = {
  submit: (data: { name: string; email: string; message: string; phone?: string; company?: string }) =>
    api<{ success: boolean; message: string }>('/api/contact', { method: 'POST', body: data }),
  getAll: () => api<any[]>('/api/contacts'),
};

// ============ 新闻 API ============

export const newsApi = {
  getAll: () => api<NewsItem[]>('/api/news'),
  create: (data: Partial<NewsItem>) => api<NewsItem>('/api/news', { method: 'POST', body: data }),
  update: (id: number, data: Partial<NewsItem>) => api<NewsItem>(`/api/news/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) => api<{ success: boolean }>(`/api/news/${id}`, { method: 'DELETE' }),
};

// ============ 案例研究 API ============

export const casesApi = {
  getAll: () => api<CaseItem[]>('/api/cases'),
  create: (data: Partial<CaseItem>) => api<CaseItem>('/api/cases', { method: 'POST', body: data }),
  update: (id: number, data: Partial<CaseItem>) => api<CaseItem>(`/api/cases/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) => api<{ success: boolean }>(`/api/cases/${id}`, { method: 'DELETE' }),
};

// ============ 分类 API ============

export const categoriesApi = {
  getAll: () => api<Category[]>('/api/categories'),
  create: (data: Partial<Category>) => api<Category>('/api/categories', { method: 'POST', body: data }),
  update: (id: number, data: Partial<Category>) => api<Category>(`/api/categories/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) => api<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
};

// ============ 应用场景 API ============

export const scenariosApi = {
  getAll: () => api<Scenario[]>('/api/scenarios'),
  create: (data: Partial<Scenario>) => api<Scenario>('/api/scenarios', { method: 'POST', body: data }),
  update: (id: number, data: Partial<Scenario>) => api<Scenario>(`/api/scenarios/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) => api<{ success: boolean }>(`/api/scenarios/${id}`, { method: 'DELETE' }),
};

// ============ 公司信息 API ============

export const companyApi = {
  get: () => api<any>('/api/company'),
  save: (data: any) => api<{ success: boolean }>('/api/company', { method: 'POST', body: data }),
};

// ============ 账号 API ============

export const authApi = {
  login: (username: string, password: string) =>
    api<{ success: boolean; user?: any; error?: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    }),
  getAccounts: () => api<any[]>('/api/auth'),
  getPassword: (id: number) =>
    api<{ password: string }>(`/api/auth/accounts/${id}/password`),
  register: (data: { username: string; password: string; role?: string }) =>
    api<{ success: boolean; user?: any }>('/api/auth/register', { method: 'POST', body: data }),
  updateAccount: (id: number, data: { password?: string; role?: string }) =>
    api<{ success: boolean }>(`/api/auth/accounts/${id}`, { method: 'PUT', body: data }),
  deleteAccount: (id: number) =>
    api<{ success: boolean }>(`/api/auth/accounts/${id}`, { method: 'DELETE' }),
};

// ============ 类型定义 ============

interface Product {
  id: number;
  name: string;
  category: string;
  status: string;
  images: string[];
  namesByLang?: Record<string, string>;
  specsByLang?: Record<string, any[]>;
  featuresByLang?: Record<string, string[]>;
}

interface NewsItem {
  id: number;
  title: string;
  date: string;
  views: number;
  status: string;
  images?: string[];
  content?: string;
}

interface CaseItem {
  id: number;
  title: string;
  client: string;
  date: string;
  status: string;
  image?: string;
  description?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  description?: string;
}

interface Scenario {
  id: number;
  title: string;
  icon: string;
  description?: string;
}
