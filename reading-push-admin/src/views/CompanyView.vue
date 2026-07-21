<template>
  <div class="company-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>读书推送</span>
          <el-button v-if="authStore.isSuperAdmin" type="primary" :icon="Plus" @click="handleAdd">新增公司</el-button>
        </div>
      </template>

      <div class="search-bar">
        <el-form :inline="true" class="search-form">
          <el-form-item label="公司名称">
            <el-input v-model="search.name" placeholder="请输入" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="联系人">
            <el-input v-model="search.contact" placeholder="请输入" clearable style="width: 120px" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="search.phone" placeholder="请输入" clearable style="width: 130px" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="search.status" placeholder="全部" clearable style="width: 100px">
              <el-option label="生效" value="active" />
              <el-option label="失效" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button :icon="Refresh" @click="handleResetSearch">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="filteredData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="公司名称" min-width="140" />
        <el-table-column prop="contact" label="联系人" width="100" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column prop="webhook" label="Webhook地址" min-width="280" show-overflow-tooltip />
        <el-table-column prop="push_time" label="默认推送时间" width="120" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '生效' : '失效' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="120" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="warning" link :icon="Bell" @click="goPushTasks(row)">读书推送</el-button>
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)" v-if="authStore.isSuperAdmin">编辑</el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)" v-if="authStore.isSuperAdmin">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑公司' : '新增公司'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="公司名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入公司名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contact">
          <el-input v-model="form.contact" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="Webhook地址" prop="webhook">
          <el-input v-model="form.webhook" type="textarea" :rows="2" placeholder="请输入企业微信群Webhook地址" />
        </el-form-item>
        <el-form-item label="默认推送时间" prop="pushTime">
          <el-time-picker v-model="form.pushTime" placeholder="选择默认推送时间" style="width: 100%" format="HH:mm" value-format="HH:mm" />
        </el-form-item>
        <el-form-item label="开头语" prop="greeting">
          <el-input v-model="form.greeting" type="textarea" :rows="2" placeholder="请输入推送开头语（选填）" />
        </el-form-item>
        <el-form-item label="天气预报">
          <el-switch v-model="form.weatherEnabled" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item v-if="form.weatherEnabled" label="选择城市" prop="weatherCity">
          <el-cascader
            v-model="form.weatherCity"
            :options="CITY_OPTIONS"
            placeholder="请选择省份和城市"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio label="active">生效</el-radio>
            <el-radio label="inactive">失效</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Bell, Refresh } from '@element-plus/icons-vue'
import { companyApi, pushTaskApi } from '../api'
import { useAuthStore } from '../stores/auth'
import { CITY_OPTIONS } from '../utils/cities'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const tableData = ref([])

// 分字段搜索
const search = reactive({ name: '', contact: '', phone: '', status: '' })

const filteredData = computed(() => {
  return tableData.value.filter(row => {
    if (search.name && !row.name.toLowerCase().includes(search.name.toLowerCase())) return false
    if (search.contact && !row.contact.toLowerCase().includes(search.contact.toLowerCase())) return false
    if (search.phone && !row.phone.includes(search.phone)) return false
    if (search.status && row.status !== search.status) return false
    return true
  })
})

const handleResetSearch = () => {
  search.name = ''
  search.contact = ''
  search.phone = ''
  search.status = ''
}

const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()

const form = reactive({
  id: null, name: '', contact: '', phone: '', webhook: '', pushTime: '09:00',
  greeting: '', weatherEnabled: false, weatherCity: [], status: 'active'
})

const rules = {
  name: [{ required: true, message: '请输入公司名称', trigger: 'blur' }],
  webhook: [{ required: true, message: '请输入Webhook地址', trigger: 'blur' }]
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await companyApi.getList()
    tableData.value = res.data
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.id = null; form.name = ''; form.contact = ''; form.phone = ''; form.webhook = ''; form.pushTime = '09:00'
  form.greeting = ''; form.weatherEnabled = false; form.weatherCity = []; form.status = 'active'
}

const goPushTasks = (row) => { router.push(`/reading-push/${row.id}`) }

const handleAdd = () => { isEdit.value = false; resetForm(); dialogVisible.value = true }

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id; form.name = row.name; form.contact = row.contact
  form.phone = row.phone; form.webhook = row.webhook; form.pushTime = row.push_time
  form.greeting = row.greeting || ''
  form.weatherEnabled = !!row.weather_enabled
  // 将存储的城市名转换回 Cascader 需要的路径数组 [省份, 城市]
  if (row.weather_city) {
    for (const prov of CITY_OPTIONS) {
      const city = prov.children?.find(c => c.value === row.weather_city)
      if (city) { form.weatherCity = [prov.value, city.value]; break }
    }
  } else {
    form.weatherCity = []
  }
  form.status = row.status
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  // 先查询该公司下有多少推送任务
  let taskMsg = ''
  try {
    const taskRes = await pushTaskApi.getList({ companyId: row.id })
    const count = taskRes.data.length
    if (count > 0) {
      taskMsg = `\n\n该企业下有 ${count} 条推送任务，删除企业后将同时删除这些任务，此操作不可恢复。`
    }
  } catch { /* 静默 */ }

  await ElMessageBox.confirm(
    `确定要删除「${row.name}」吗？${taskMsg}`,
    '删除企业确认',
    { type: 'warning', confirmButtonText: '确认删除' }
  )
  await companyApi.delete(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      ...form,
      weatherCity: Array.isArray(form.weatherCity) && form.weatherCity.length > 0
        ? form.weatherCity[form.weatherCity.length - 1]
        : ''
    }
    if (isEdit.value) {
      await companyApi.update(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await companyApi.create(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    submitting.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-bar { margin-bottom: 16px; }
.search-form { display: flex; flex-wrap: wrap; align-items: center; gap: 0; }
.search-form .el-form-item { margin-bottom: 8px; margin-right: 12px; }
</style>
