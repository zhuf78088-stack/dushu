import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000
})

// 请求拦截器：自动添加token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    const detail = error.response?.data?.detail
    ElMessage.error(detail ? `${msg}：${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : msg)

    // 401跳转登录
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.hash = '#/login'
    }

    return Promise.reject(error)
  }
)

// ====== 认证 ======
export const authApi = {
  login: (data) => request.post('/auth/login', data),
  getMe: () => request.get('/auth/me')
}

// ====== 公司 ======
export const companyApi = {
  getList: () => request.get('/companies'),
  getById: (id) => request.get(`/companies/${id}`),
  create: (data) => request.post('/companies', data),
  update: (id, data) => request.put(`/companies/${id}`, data),
  delete: (id) => request.delete(`/companies/${id}`)
}

// ====== 用户 ======
export const userApi = {
  getList: () => request.get('/users'),
  create: (data) => request.post('/users', data),
  update: (id, data) => request.put(`/users/${id}`, data),
  delete: (id) => request.delete(`/users/${id}`)
}

// ====== 推送任务 ======
export const pushTaskApi = {
  getList: (params) => request.get('/push-tasks', { params }),
  create: (data) => request.post('/push-tasks', data),
  update: (id, data) => request.put(`/push-tasks/${id}`, data),
  delete: (id) => request.delete(`/push-tasks/${id}`),
  batchDelete: (ids) => request.post('/push-tasks/batch-delete', { ids }),
  trigger: (id) => request.post(`/push-tasks/${id}/trigger`),
  importBatch: (companyId, tasks) => request.post(`/push-tasks/import/${companyId}`, { tasks })
}
