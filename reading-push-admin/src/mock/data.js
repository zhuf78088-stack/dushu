import { ref } from 'vue'

// 公司数据
export const companies = ref([
  { id: 1, name: '美策广告', contact: '张经理', phone: '13800138001', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=meice001', status: 'active', createdAt: '2024-06-01' },
  { id: 2, name: '小明科技', contact: '李总', phone: '13900139002', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xiaoming002', status: 'active', createdAt: '2024-06-10' },
  { id: 3, name: '星辰教育', contact: '王老师', phone: '13700137003', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xingchen003', status: 'inactive', createdAt: '2024-06-15' }
])

// 用户数据
export const users = ref([
  { id: 1, username: 'admin', name: '超级管理员', role: 'superadmin', companyId: null, companyName: '-', status: 'active', createdAt: '2024-06-01' },
  { id: 2, username: 'meice', name: '美策操作员', role: 'operator', companyId: 1, companyName: '美策广告', status: 'active', createdAt: '2024-06-05' },
  { id: 3, username: 'xiaoming', name: '小明操作员', role: 'operator', companyId: 2, companyName: '小明科技', status: 'active', createdAt: '2024-06-12' },
  { id: 4, username: 'xingchen', name: '星辰操作员', role: 'operator', companyId: 3, companyName: '星辰教育', status: 'inactive', createdAt: '2024-06-20' }
])

// 推送任务数据
export const pushTasks = ref([
  { id: 1, companyId: 1, companyName: '美策广告', title: '今日读书分享', pushDate: '2024-07-07', pushTime: '00:00', bookName: '《高效能人士的七个习惯》', content: '第一章 积极主动...', status: 'active', execStatus: 'pushed', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=meice001', createdAt: '2024-07-01' },
  { id: 2, companyId: 1, companyName: '美策广告', title: '今日读书分享', pushDate: '2024-07-08', pushTime: '00:00', bookName: '《高效能人士的七个习惯》', content: '第二章 以终为始...', status: 'active', execStatus: 'pending', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=meice001', createdAt: '2024-07-01' },
  { id: 3, companyId: 1, companyName: '美策广告', title: '今日读书分享', pushDate: '2024-07-09', pushTime: '00:00', bookName: '《高效能人士的七个习惯》', content: '第三章 第一节...', status: 'active', execStatus: 'pending', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=meice001', createdAt: '2024-07-01' },
  { id: 4, companyId: 2, companyName: '小明科技', title: '晨读分享', pushDate: '2024-07-10', pushTime: '09:00', bookName: '《深度工作》', content: '第一章 深度工作是有价值的...', status: 'active', execStatus: 'pending', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xiaoming002', createdAt: '2024-07-05' },
  { id: 5, companyId: 2, companyName: '小明科技', title: '晨读分享', pushDate: '2024-07-11', pushTime: '09:00', bookName: '《深度工作》', content: '第二章 深度工作是少见的...', status: 'inactive', execStatus: 'pending', webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xiaoming002', createdAt: '2024-07-05' }
])

let companyIdCounter = 4
let userIdCounter = 5
let taskIdCounter = 6

export const addCompany = (data) => {
  const newCompany = { id: companyIdCounter++, ...data, createdAt: new Date().toISOString().split('T')[0] }
  companies.value.push(newCompany)
  return newCompany
}

export const updateCompany = (id, data) => {
  const idx = companies.value.findIndex(c => c.id === id)
  if (idx !== -1) {
    companies.value[idx] = { ...companies.value[idx], ...data }
  }
}

export const deleteCompany = (id) => {
  const idx = companies.value.findIndex(c => c.id === id)
  if (idx !== -1) companies.value.splice(idx, 1)
}

export const addUser = (data) => {
  const newUser = { id: userIdCounter++, ...data, createdAt: new Date().toISOString().split('T')[0] }
  users.value.push(newUser)
  return newUser
}

export const updateUser = (id, data) => {
  const idx = users.value.findIndex(u => u.id === id)
  if (idx !== -1) {
    users.value[idx] = { ...users.value[idx], ...data }
  }
}

export const deleteUser = (id) => {
  const idx = users.value.findIndex(u => u.id === id)
  if (idx !== -1) users.value.splice(idx, 1)
}

export const addPushTask = (data) => {
  const newTask = { id: taskIdCounter++, ...data, createdAt: new Date().toISOString().split('T')[0] }
  pushTasks.value.push(newTask)
  return newTask
}

export const updatePushTask = (id, data) => {
  const idx = pushTasks.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    pushTasks.value[idx] = { ...pushTasks.value[idx], ...data }
  }
}

export const deletePushTask = (id) => {
  const idx = pushTasks.value.findIndex(t => t.id === id)
  if (idx !== -1) pushTasks.value.splice(idx, 1)
}

export const batchAddPushTasks = (dataList) => {
  const added = []
  for (const data of dataList) {
    const newTask = { id: taskIdCounter++, ...data, createdAt: new Date().toISOString().split('T')[0] }
    pushTasks.value.push(newTask)
    added.push(newTask)
  }
  return added
}
