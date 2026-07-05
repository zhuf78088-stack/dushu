<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: #e6f7ff; color: #1890ff;">
            <el-icon size="28"><OfficeBuilding /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.companyCount }}</div>
            <div class="stat-label">合作企业</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: #f6ffed; color: #52c41a;">
            <el-icon size="28"><UserFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.userCount }}</div>
            <div class="stat-label">系统用户</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: #fff7e6; color: #fa8c16;">
            <el-icon size="28"><Bell /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.taskCount }}</div>
            <div class="stat-label">推送任务</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: #fff1f0; color: #f5222d;">
            <el-icon size="28"><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.pushedCount }}</div>
            <div class="stat-label">已推送</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 推送任务状态分布 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :span="12">
        <el-card>
          <template #header><span>推送任务状态分布</span></template>
          <div class="status-list">
            <div class="status-item">
              <div class="status-dot" style="background: #52c41a;"></div>
              <span class="status-name">待推送</span>
              <span class="status-count">{{ stats.pendingCount }}</span>
            </div>
            <div class="status-item">
              <div class="status-dot" style="background: #1890ff;"></div>
              <span class="status-name">已推送</span>
              <span class="status-count">{{ stats.pushedCount }}</span>
            </div>
            <div class="status-item">
              <div class="status-dot" style="background: #fa8c16;"></div>
              <span class="status-name">生效中</span>
              <span class="status-count">{{ stats.activeCount }}</span>
            </div>
            <div class="status-item">
              <div class="status-dot" style="background: #bfbfbf;"></div>
              <span class="status-name">已失效</span>
              <span class="status-count">{{ stats.inactiveCount }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>最近推送任务</span></template>
          <el-empty v-if="recentTasks.length === 0" description="暂无推送任务" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="task in recentTasks"
              :key="task.id"
              :type="task.exec_status === 'pushed' ? 'success' : 'primary'"
              :timestamp="task.push_time"
            >
              <div class="timeline-content">
                <div class="timeline-title">{{ task.title || '读书推送' }}</div>
                <div class="timeline-desc">{{ task.company_name }} · {{ task.book_name }}</div>
                <el-tag v-if="task.exec_status === 'pushed'" type="success" size="small">已推送</el-tag>
                <el-tag v-else type="primary" size="small">待推送</el-tag>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { OfficeBuilding, UserFilled, Bell, CircleCheck } from '@element-plus/icons-vue'
import { companyApi, userApi, pushTaskApi } from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const stats = reactive({
  companyCount: 0,
  userCount: 0,
  taskCount: 0,
  pendingCount: 0,
  pushedCount: 0,
  activeCount: 0,
  inactiveCount: 0
})

const recentTasks = ref([])

const fetchStats = async () => {
  try {
    const [companyRes, userRes, taskRes] = await Promise.all([
      companyApi.getList(),
      userApi.getList(),
      pushTaskApi.getList()
    ])

    stats.companyCount = companyRes.data.length
    stats.userCount = userRes.data.length

    const tasks = taskRes.data
    stats.taskCount = tasks.length
    stats.pendingCount = tasks.filter(t => t.exec_status === 'pending').length
    stats.pushedCount = tasks.filter(t => t.exec_status === 'pushed').length
    stats.activeCount = tasks.filter(t => t.status === 'active').length
    stats.inactiveCount = tasks.filter(t => t.status === 'inactive').length

    // 最近5条任务
    recentTasks.value = tasks.slice(-5).reverse()
  } catch {
    // 静默处理
  }
}

onMounted(fetchStats)
</script>

<style scoped>
.stat-row { margin-bottom: 20px; }
.stat-card { display: flex; align-items: center; padding: 10px; }
.stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 16px; }
.stat-info { flex: 1; }
.stat-value { font-size: 28px; font-weight: 700; color: #333; line-height: 1.2; }
.stat-label { font-size: 13px; color: #999; margin-top: 4px; }
.chart-row { margin-bottom: 20px; }
.status-list { padding: 10px 0; }
.status-item { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.status-item:last-child { border-bottom: none; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 12px; }
.status-name { flex: 1; font-size: 14px; color: #666; }
.status-count { font-size: 20px; font-weight: 600; color: #333; }
.timeline-content { padding: 4px 0; }
.timeline-title { font-size: 14px; font-weight: 600; color: #333; }
.timeline-desc { font-size: 12px; color: #999; margin: 4px 0; }
</style>
