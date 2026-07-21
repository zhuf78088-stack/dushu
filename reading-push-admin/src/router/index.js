import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('../views/LayoutView.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: '数据概览', icon: 'DataLine' }
      },
      {
        path: 'reading-push',
        name: 'ReadingPush',
        component: () => import('../views/CompanyView.vue'),
        meta: { title: '读书推送', icon: 'Reading' }
      },
      {
        path: 'reading-push/:companyId',
        name: 'CompanyPushTasks',
        component: () => import('../views/PushTaskView.vue'),
        meta: { title: '推送任务', icon: 'Bell' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/UserView.vue'),
        meta: { title: '用户管理', icon: 'UserFilled' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (!to.meta.public && !authStore.isLoggedIn) {
    next('/login')
  } else if (to.path === '/login' && authStore.isLoggedIn) {
    next('/')
  } else if (to.path === '/users' && !authStore.isSuperAdmin) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
