<template>
  <div class="user-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增用户</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="role" label="角色" width="110">
          <template #default="{ row }">
            <el-tag :type="row.role === 'superadmin' ? 'danger' : 'primary'">
              {{ row.role === 'superadmin' ? '超级管理员' : '操作员' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属公司" min-width="180">
          <template #default="{ row }">
            <template v-if="row.role === 'superadmin'">
              <el-tag size="small" type="info">全部公司</el-tag>
            </template>
            <template v-else>
              <el-tag
                v-for="cid in (row.company_ids || [])"
                :key="cid"
                size="small"
                type="primary"
                style="margin-right: 4px; margin-bottom: 2px;"
              >
                {{ getCompanyName(cid) }}
              </el-tag>
              <span v-if="!(row.company_ids && row.company_ids.length)" style="color: #999;">未分配</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '生效' : '失效' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="120" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-radio-group v-model="form.role">
            <el-radio label="superadmin">超级管理员</el-radio>
            <el-radio label="operator">操作员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.role === 'operator'" label="所属公司" prop="companyIds">
          <el-select v-model="form.companyIds" placeholder="请选择所属公司（可多选）" multiple style="width: 100%">
            <el-option v-for="c in companyList" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { userApi, companyApi } from '../api'

const loading = ref(false)
const tableData = ref([])
const companyList = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()

const form = reactive({
  id: null,
  username: '',
  name: '',
  password: '',
  role: 'operator',
  companyIds: [],
  status: 'active'
})

const rules = computed(() => ({
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [{ required: !isEdit.value, message: '请输入密码', trigger: 'blur' }],
  companyIds: [{ required: true, message: '请至少选择一个所属公司', trigger: 'change' }]
}))

const fetchList = async () => {
  loading.value = true
  try {
    const res = await userApi.getList()
    tableData.value = res.data
  } finally {
    loading.value = false
  }
}

const fetchCompanies = async () => {
  const res = await companyApi.getList()
  companyList.value = res.data
}

const getCompanyName = (cid) => {
  const c = companyList.value.find(item => item.id === cid)
  return c ? c.name : `公司#${cid}`
}

const resetForm = () => {
  form.id = null
  form.username = ''
  form.name = ''
  form.password = ''
  form.role = 'operator'
  form.companyIds = []
  form.status = 'active'
}

const handleAdd = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.username = row.username
  form.name = row.name
  form.password = ''
  form.role = row.role
  form.companyIds = row.company_ids || []
  form.status = row.status
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm(`确定要删除用户「${row.name}」吗？`, '提示', { type: 'warning' })
  await userApi.delete(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const data = {
    username: form.username,
    name: form.name,
    password: form.password || undefined,
    role: form.role,
    companyIds: form.role === 'operator' ? form.companyIds : [],
    status: form.status
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await userApi.update(form.id, data)
      ElMessage.success('修改成功')
    } else {
      await userApi.create(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchList()
  fetchCompanies()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
