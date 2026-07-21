<template>
  <div class="push-task-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button :icon="ArrowLeft" @click="goBack" link>返回</el-button>
            <span>{{ companyName }} - 推送任务管理</span>
          </div>
          <div class="header-right">
            <el-button :icon="RefreshRight" @click="fetchList" :loading="loading">刷新</el-button>
            <el-button type="success" :icon="Upload" @click="importDialogVisible = true">Excel导入</el-button>
            <el-button type="primary" :icon="Plus" @click="handleAdd">新增任务</el-button>
            <el-button type="danger" :icon="Delete" @click="handleBatchDelete" :disabled="selectedIds.length === 0">批量删除 ({{ selectedIds.length }})</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-form :inline="true" class="search-form">
          <el-form-item label="推送日期">
            <el-date-picker
              v-model="search.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              clearable
              style="width: 280px"
              value-format="YYYY-MM-DD"
              :shortcuts="dateShortcuts"
            />
          </el-form-item>
          <el-form-item label="书籍名称">
            <el-input v-model="search.bookName" placeholder="请输入" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="推送内容">
            <el-input v-model="search.content" placeholder="请输入" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="执行状态">
            <el-select v-model="search.execStatus" placeholder="全部" clearable style="width: 110px">
              <el-option label="待推送" value="pending" />
              <el-option label="已推送" value="pushed" />
            </el-select>
          </el-form-item>
          <el-form-item label="任务状态">
            <el-select v-model="search.status" placeholder="全部" clearable style="width: 110px">
              <el-option label="生效" value="active" />
              <el-option label="失效" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button :icon="Refresh" @click="handleResetSearch">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      <el-table :data="filteredData" v-loading="loading" stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="push_date" label="推送日期" width="120" sortable />
        <el-table-column prop="push_title" label="推送标题" width="130" show-overflow-tooltip />
        <el-table-column prop="book_name" label="推送书籍名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="content" label="推送书籍内容" min-width="220" show-overflow-tooltip />
        <el-table-column prop="exec_status" label="执行状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.exec_status === 'pushed' ? 'success' : 'primary'">
              {{ row.exec_status === 'pushed' ? '已推送' : '待推送' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="任务状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '生效' : '失效' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="120" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="success" link :icon="Promotion" @click="handleTriggerPush(row)">手动推送</el-button>
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑推送任务' : '新增推送任务'" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="推送日期" prop="pushDate">
          <el-date-picker v-model="form.pushDate" type="date" placeholder="选择推送日期" style="width: 100%" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="推送标题">
          <el-input v-model="form.pushTitle" placeholder="不填默认为【每日分享】" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="推送书籍名称" prop="bookName">
          <el-input v-model="form.bookName" placeholder="请输入书籍名称" />
        </el-form-item>
        <el-form-item label="推送书籍内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="6" placeholder="请输入要推送的书籍内容" />
        </el-form-item>
        <el-form-item label="执行状态" prop="execStatus">
          <el-radio-group v-model="form.execStatus">
            <el-radio label="pending">待推送</el-radio>
            <el-radio label="pushed">已推送</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="任务状态" prop="status">
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

    <!-- Excel导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="Excel批量导入推送任务" width="500px">
      <el-alert title="导入说明" type="info" :closable="false" style="margin-bottom: 16px;">
        <div style="font-size: 12px; line-height: 1.8; margin-top: 8px;">
          <p>Excel需包含以下列：推送日期(YYYY-MM-DD)、推送标题(选填)、书籍名称、书籍内容。导入后任务状态默认为生效，推送时间以公司配置为准。</p>
          <p style="margin-top: 4px;"><el-link type="primary" @click="downloadTemplate">点击下载导入模板</el-link></p>
        </div>
      </el-alert>
      <el-upload ref="uploadRef" drag action="#" :auto-upload="false" :on-change="handleFileChange" accept=".xlsx,.xls" :limit="1">
        <el-icon class="el-icon--upload" size="48"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">仅支持 .xlsx / .xls 格式</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="handleImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Edit, Delete, Upload, UploadFilled, Promotion, Refresh, RefreshRight } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { pushTaskApi, companyApi } from '../api'

const route = useRoute()
const router = useRouter()

const companyId = computed(() => Number(route.params.companyId))
const companyName = ref('')

const loading = ref(false)
const tableData = ref([])
const selectedIds = ref([])

// 多选变更
const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(row => row.id)
}

// 批量删除
const handleBatchDelete = async () => {
  await ElMessageBox.confirm(
    `确定要删除选中的 ${selectedIds.value.length} 条推送任务吗？此操作不可恢复。`,
    '批量删除确认',
    { type: 'warning', confirmButtonText: '确认删除' }
  )
  loading.value = true
  try {
    await pushTaskApi.batchDelete(selectedIds.value)
    ElMessage.success(`成功删除 ${selectedIds.value.length} 条推送任务`)
    selectedIds.value = []
    fetchList()
  } finally {
    loading.value = false
  }
}

// 分字段搜索
const search = reactive({
  dateRange: null,
  bookName: '',
  content: '',
  execStatus: '',
  status: ''
})

// 日期快捷选项
const dateShortcuts = [
  {
    text: '今天',
    value: () => {
      const today = new Date().toISOString().split('T')[0]
      return [today, today]
    }
  },
  {
    text: '昨天',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const day = d.toISOString().split('T')[0]
      return [day, day]
    }
  },
  {
    text: '本周',
    value: () => {
      const now = new Date()
      const dayOfWeek = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return [monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]
    }
  },
  {
    text: '本月',
    value: () => {
      const now = new Date()
      const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const last = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
      return [first, last]
    }
  }
]

const filteredData = computed(() => {
  return tableData.value.filter(row => {
    if (search.dateRange && search.dateRange.length === 2) {
      const [start, end] = search.dateRange
      if (row.push_date < start || row.push_date > end) return false
    }
    if (search.bookName && !row.book_name.toLowerCase().includes(search.bookName.toLowerCase())) return false
    if (search.content && !row.content.toLowerCase().includes(search.content.toLowerCase())) return false
    if (search.execStatus && row.exec_status !== search.execStatus) return false
    if (search.status && row.status !== search.status) return false
    return true
  })
})

const handleResetSearch = () => {
  search.dateRange = null
  search.bookName = ''
  search.content = ''
  search.execStatus = ''
  search.status = ''
}

// 表单相关
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()

const form = reactive({
  id: null,
  companyId: null,
  companyName: '',
  pushDate: '',
  pushTitle: '',
  bookName: '',
  content: '',
  webhook: '',
  title: '今日读书分享',
  status: 'active',
  execStatus: 'pending'
})

const rules = {
  pushDate: [{ required: true, message: '请选择推送日期', trigger: 'change' }],
  bookName: [{ required: true, message: '请输入书籍名称', trigger: 'blur' }],
  content: [{ required: true, message: '请输入书籍内容', trigger: 'blur' }]
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await pushTaskApi.getList({ companyId: companyId.value })
    tableData.value = res.data
  } finally {
    loading.value = false
  }
}

const fetchCompany = async () => {
  const res = await companyApi.getById(companyId.value)
  companyName.value = res.data.name
  form.webhook = res.data.webhook
}

const resetForm = () => {
  form.id = null
  form.companyId = companyId.value
  form.companyName = companyName.value
  form.pushDate = ''
  form.pushTitle = ''
  form.bookName = ''
  form.content = ''
  form.title = '今日读书分享'
  form.status = 'active'
  form.execStatus = 'pending'
}

const goBack = () => {
  router.push('/reading-push')
}

const handleAdd = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.companyId = row.company_id
  form.companyName = row.company_name
  form.pushDate = row.push_date
  form.pushTitle = row.push_title || ''
  form.bookName = row.book_name
  form.content = row.content
  form.webhook = row.webhook
  form.title = row.title
  form.status = row.status
  form.execStatus = row.exec_status
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该推送任务吗？', '提示', { type: 'warning' })
  await pushTaskApi.delete(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const data = {
    companyId: form.companyId,
    companyName: form.companyName,
    title: form.title,
    pushTitle: form.pushTitle || '【每日分享】',
    pushDate: form.pushDate,
    bookName: form.bookName,
    content: form.content,
    webhook: form.webhook,
    status: form.status,
    execStatus: form.execStatus
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await pushTaskApi.update(form.id, data)
      ElMessage.success('修改成功')
    } else {
      await pushTaskApi.create(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    submitting.value = false
  }
}

// 手动触发推送
const handleTriggerPush = async (row) => {
  await ElMessageBox.confirm(
    `确定要手动推送该任务吗？\n\n书籍：${row.book_name}\n日期：${row.push_date}\n\n推送后将把内容发送到企业微信群。`,
    '确认推送',
    {
      confirmButtonText: '确认推送',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  try {
    await pushTaskApi.trigger(row.id)
    ElMessage.success(`推送成功！已将「${row.book_name}」内容推送至企业微信群`)
    fetchList()
  } catch (err) {
    // 错误已在拦截器中处理
  }
}

// Excel导入
const importDialogVisible = ref(false)
const importing = ref(false)
const uploadRef = ref()
const importedData = ref([])

// Excel日期序列号转 YYYY-MM-DD 格式；已是字符串则直接返回
const excelSerialToDate = (val) => {
  if (typeof val === 'number' && val > 1) {
    // Excel 日期序列号：以 1900-01-01 为第 1 天（含闰年 bug）
    const date = new Date((val - 25569) * 86400000)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val || '')
}

const handleFileChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    importedData.value = json
  }
  reader.readAsArrayBuffer(file.raw)
}

const handleImport = async () => {
  if (importedData.value.length < 2) {
    ElMessage.warning('文件数据为空或格式不正确')
    return
  }

  importing.value = true
  try {
    const rows = importedData.value.slice(1)
    const tasks = []
    const hasPushTitle = rows[0] && rows[0].length >= 4
    for (const row of rows) {
      if (row.length < 2) continue
      tasks.push({
        pushDate: excelSerialToDate(row[0]),
        pushTitle: hasPushTitle ? String(row[1] || '') : '',
        bookName: String(hasPushTitle ? (row[2] || '') : (row[1] || '')),
        content: String(hasPushTitle ? (row[3] || '') : (row[2] || ''))
      })
    }

    await pushTaskApi.importBatch(companyId.value, tasks)
    ElMessage.success(`成功导入 ${tasks.length} 条推送任务`)
    importDialogVisible.value = false
    importedData.value = []
    uploadRef.value?.clearFiles()
    fetchList()
  } finally {
    importing.value = false
  }
}

const downloadTemplate = () => {
  const headers = ['推送日期', '推送标题', '书籍名称', '书籍内容']
  const example = ['2024-07-07', '【每日分享】', '《高效能人士的七个习惯》', '第一章 积极主动的内容...']
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '推送任务模板')
  XLSX.writeFile(wb, '推送任务导入模板.xlsx')
}

onMounted(() => {
  fetchCompany()
  fetchList()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.header-right {
  display: flex;
  gap: 10px;
}

.search-bar {
  margin-bottom: 16px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.search-form .el-form-item {
  margin-bottom: 8px;
  margin-right: 12px;
}
</style>
