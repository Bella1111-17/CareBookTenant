<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="设备号" prop="deviceNo">
        <el-input v-model="queryParams.deviceNo" placeholder="设备号" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="用户ID" prop="userId">
        <el-input-number v-model="queryParams.userId" :min="1" placeholder="用户ID" style="width: 140px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="gpsList">
      <el-table-column label="设备号" align="center" prop="deviceNo" width="150" show-overflow-tooltip />
      <el-table-column label="用户ID" align="center" prop="userId" width="90" />
      <el-table-column label="经度" align="center" prop="longitude" width="120" />
      <el-table-column label="纬度" align="center" prop="latitude" width="120" />
      <el-table-column label="定位方式" align="center" prop="locationType" width="80">
        <template #default="scope">
          <el-tag :type="scope.row.locationType === 'WIFI' ? 'warning' : 'success'" size="small">
            {{ scope.row.locationType || 'GPS' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="上报时间" align="center" prop="reportTime" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.reportTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="地址" align="center" prop="address" min-width="200" show-overflow-tooltip />
      <el-table-column label="接收时间" align="center" prop="createdAt" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center">
        <template #default="scope">
          <el-button link type="primary" icon="Location" @click="openMap(scope.row)">地图</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
  </div>
</template>

<script setup name="SmartBadgeGps">
import { gpsLogList } from "@/api/system/smart-badge/index";

const { proxy } = getCurrentInstance();
const gpsList = ref([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const data = reactive({ queryParams: { pageNum: 1, pageSize: 10, deviceNo: undefined, userId: undefined } });
const { queryParams } = toRefs(data);

function getList() {
  loading.value = true;
  const q = { ...queryParams.value };
  if (!q.userId) delete q.userId;
  gpsLogList(q).then(res => { gpsList.value = res.data.list; total.value = res.data.total; loading.value = false; });
}
function handleQuery() { queryParams.value.pageNum = 1; getList(); }
function resetQuery() { proxy.resetForm("queryRef"); handleQuery(); }
function openMap(row) {
  if (row.latitude && row.longitude) {
    window.open(`https://uri.amap.com/marker?position=${row.longitude},${row.latitude}`, '_blank');
  } else {
    proxy.$modal.msgWarning('无有效坐标');
  }
}
getList();
</script>
