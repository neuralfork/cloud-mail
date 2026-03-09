<template>
  <div class="account-box">
    <div class="header-actions">
      <div class="search">
        <el-input
            v-model="params.email"
            class="search-input"
            :placeholder="$t('searchByEmail')"
        />
      </div>
      <div class="search">
        <el-input
            v-model="params.userEmail"
            class="search-input"
            :placeholder="$t('searchUser')"
        />
      </div>
      <el-select
          v-model="params.isDel"
          class="status-select"
          :style="`width: ${locale === 'en' ? 95 : 80}px`"
          @change="onStatusChange"
      >
        <el-option :key="-1" :label="$t('all')" :value="-1"/>
        <el-option :key="0" :label="$t('active')" :value="0"/>
        <el-option :key="1" :label="$t('deleted')" :value="1"/>
      </el-select>
      <el-button type="warning" plain @click="scanDialogShow = true">GPT Ban Scan</el-button>
      <Icon class="icon" icon="ion:reload" width="18" height="18" @click="refresh"/>
    </div>

    <el-scrollbar ref="scrollbarRef" class="scrollbar">
      <div>
        <div class="loading" :class="tableLoading ? 'loading-show' : 'loading-hide'" :style="first ? 'background: transparent' : ''">
          <loading/>
        </div>
        <el-table
            :empty-text="first ? '' : null"
            :data="list"
            style="width: 100%;"
            :default-sort="{ prop: 'createTime', order: 'descending' }"
            @sort-change="onSortChange"
        >
          <el-table-column show-overflow-tooltip :label="$t('emailAccount')" min-width="220" prop="email"/>
          <el-table-column show-overflow-tooltip :label="$t('userAccount')" min-width="220" prop="userEmail"/>
          <el-table-column show-overflow-tooltip :label="$t('username')" min-width="150" prop="name" sortable="custom"/>
          <el-table-column :label="$t('tabRegisteredAt')" min-width="160" prop="createTime" sortable="custom">
            <template #default="props">
              {{ tzDayjs(props.row.createTime).format('YYYY-MM-DD HH:mm') }}
            </template>
          </el-table-column>
          <el-table-column min-width="120" :label="$t('tabStatus')" prop="isDel">
            <template #default="props">
              <el-tag type="info" disable-transitions v-if="props.row.isDel === 1">{{ $t('deleted') }}</el-tag>
              <el-tag type="danger" disable-transitions v-else-if="props.row.status === 1">GPT Ban</el-tag>
              <el-tag type="primary" disable-transitions v-else>{{ $t('active') }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination" v-if="total > params.size">
          <el-pagination
              background
              :current-page="params.num"
              :page-size="params.size"
              :page-sizes="[10, 15, 20, 25, 30, 50]"
              layout="prev, pager, next, sizes, total"
              :total="total"
              @size-change="sizeChange"
              @current-change="numChange"
          />
        </div>
      </div>
    </el-scrollbar>

    <el-dialog v-model="scanDialogShow" title="GPT Ban Scan" width="360">
      <div class="scan-box">
        <el-checkbox v-model="removeAfterMark">Delete matched accounts</el-checkbox>
        <el-button type="primary" :loading="scanLoading" @click="scanGptBan">Run Scan</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import {defineOptions, onBeforeUnmount, reactive, ref, watch} from 'vue'
import {Icon} from "@iconify/vue";
import loading from "@/components/loading/index.vue";
import {useI18n} from 'vue-i18n';
import {accountListAll, accountMarkGptBan} from "@/request/account.js";
import {tzDayjs} from "@/utils/day.js";

defineOptions({
  name: 'account'
})

const {locale} = useI18n();
const list = ref([])
const total = ref(0)
const first = ref(true)
const tableLoading = ref(true)
const scrollbarRef = ref(null)
const scanDialogShow = ref(false)
const removeAfterMark = ref(false)
const scanLoading = ref(false)

const params = reactive({
  num: 1,
  size: 15,
  email: '',
  userEmail: '',
  isDel: -1,
  sortBy: 'createTime',
  sortOrder: 'desc'
})

let keywordTimer = null

watch(() => [params.email, params.userEmail], () => {
  if (keywordTimer) {
    clearTimeout(keywordTimer)
  }
  keywordTimer = setTimeout(() => {
    params.num = 1
    getList(false)
  }, 300)
})

onBeforeUnmount(() => {
  if (keywordTimer) {
    clearTimeout(keywordTimer)
  }
})

getList()

function onStatusChange() {
  params.num = 1
  getList()
}

function onSortChange({prop, order}) {
  if (!prop) {
    return
  }

  params.sortBy = prop === 'name' ? 'name' : 'createTime'

  if (!order) {
    params.sortOrder = 'desc'
  } else {
    params.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  }

  params.num = 1
  getList()
}

function refresh() {
  params.num = 1
  params.email = ''
  params.userEmail = ''
  params.isDel = -1
  params.sortBy = 'createTime'
  params.sortOrder = 'desc'
  getList()
}

function numChange(num) {
  params.num = num
  getList()
}

function sizeChange(size) {
  params.size = size
  params.num = 1
  getList()
}

function scanGptBan() {
  scanLoading.value = true
  accountMarkGptBan(removeAfterMark.value).then(data => {
    ElMessage({
      message: `Scanned ${data.total}, marked ${data.marked}, deleted ${data.deleted}`,
      type: 'success',
      plain: true,
    })
    scanDialogShow.value = false
    getList(false)
  }).finally(() => {
    scanLoading.value = false
  })
}

function getList(loading = true) {
  tableLoading.value = loading
  const query = {...params}

  if (query.isDel === -1) {
    delete query.isDel
  }

  accountListAll(query).then(data => {
    list.value = data.list
    total.value = data.total
    scrollbarRef.value?.setScrollTop(0)
  }).finally(() => {
    tableLoading.value = false
    setTimeout(() => {
      first.value = false
    }, 200)
  })
}
</script>

<style scoped lang="scss">
.account-box {
  overflow: hidden;
  height: 100%;
}

.header-actions {
  padding: 9px 15px;
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  align-items: center;
  box-shadow: var(--header-actions-border);
  font-size: 18px;

  .search-input {
    width: min(200px, calc(100vw - 140px));
  }

  .search {
    :deep(.el-input-group) {
      height: 28px;
    }

    :deep(.el-input__inner) {
      height: 28px;
    }
  }

  .icon {
    cursor: pointer;
  }
}

.scrollbar {
  width: 100%;
  overflow: auto;
  height: calc(100% - 50px);
}

.loading {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--loadding-background);
  left: 0;
  z-index: 2;
  top: 0;
  width: 100%;
  height: 100%;
}

.loading-show {
  transition: all 200ms ease 200ms;
  opacity: 1;
}

.loading-hide {
  pointer-events: none;
  transition: var(--loading-hide-transition);
  opacity: 0;
}

.pagination {
  margin-top: 15px;
  margin-bottom: 20px;
  padding-right: 30px;
  width: 100%;
  display: flex;
  justify-content: end;

  @media (max-width: 767px) {
    padding-right: 10px;
  }
}

.status-select {
  :deep(.el-select__wrapper) {
    min-height: 28px;
  }
}

.scan-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
