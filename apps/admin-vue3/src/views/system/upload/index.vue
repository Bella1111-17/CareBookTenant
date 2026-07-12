<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="文件名称" prop="newFileName">
        <el-input
          v-model="queryParams.newFileName"
          placeholder="请输入文件名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="存储路径" prop="fileName">
        <el-input
          v-model="queryParams.fileName"
          placeholder="请输入存储路径"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作栏 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Upload"
          @click="handleUpload"
          v-hasPermi="['system:upload:upload']"
        >上传文件</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:upload:remove']"
        >删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <!-- 数据表格 -->
    <el-table v-loading="loading" :data="uploadList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="文件名称" align="center" prop="newFileName" show-overflow-tooltip />
      <el-table-column label="存储路径" align="center" prop="fileName" show-overflow-tooltip />
      <el-table-column label="文件大小" align="center" prop="size" width="100">
        <template #default="scope">
          <span>{{ formatFileSize(scope.row.size) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="扩展名" align="center" prop="ext" width="80" />
      <el-table-column label="状态" align="center" prop="status" width="80">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="Link"
            @click="copyUrl(scope.row)"
          >复制链接</el-button>
          <el-button
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:upload:remove']"
          >删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 上传对话框 -->
    <el-dialog :title="uploadTitle" v-model="uploadOpen" width="500px" append-to-body>
      <el-upload
        ref="uploadRef"
        :action="uploadAction"
        :headers="uploadHeaders"
        :file-list="fileList"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
        :before-upload="beforeUpload"
        :limit="1"
        :auto-upload="false"
        drag
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            单个文件不超过 {{ maxSize }}MB，支持任意格式
          </div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitUpload">确 定</el-button>
          <el-button @click="cancelUpload">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Upload">
import { listUpload, delUpload, batchDelUpload } from "@/api/system/upload";
import { getToken } from "@/utils/auth";

const { proxy } = getCurrentInstance();
const { sys_normal_disable } = proxy.useDict("sys_normal_disable");

const uploadList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const uploadOpen = ref(false);
const uploadTitle = ref("");
const fileList = ref([]);
const maxSize = ref(10);

const uploadAction = ref(import.meta.env.VITE_APP_BASE_API + "/common/upload");
const uploadHeaders = ref({ Authorization: "Bearer " + getToken() });
const uploadRef = ref(null);

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    newFileName: undefined,
    fileName: undefined
  }
});

const { queryParams, form } = toRefs(data);

/** 查询文件列表 */
function getList() {
  loading.value = true;
  listUpload(queryParams.value).then(response => {
    uploadList.value = response.data.list;
    total.value = response.data.total;
    loading.value = false;
  });
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef");
  handleQuery();
}

/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.uploadId);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 上传按钮 */
function handleUpload() {
  fileList.value = [];
  uploadOpen.value = true;
  uploadTitle.value = "上传文件";
}

/** 提交上传 */
function submitUpload() {
  uploadRef.value.submit();
}

/** 上传成功 */
function handleUploadSuccess(response, file) {
  if (response.code === 200) {
    proxy.$modal.msgSuccess("上传成功");
    uploadOpen.value = false;
    getList();
  } else {
    proxy.$modal.msgError(response.msg || "上传失败");
  }
}

/** 上传失败 */
function handleUploadError(error) {
  proxy.$modal.msgError("上传失败，请检查网络");
}

/** 上传前校验 */
function beforeUpload(file) {
  const isLt = file.size / 1024 / 1024 < maxSize.value;
  if (!isLt) {
    proxy.$modal.msgError(`文件大小不能超过 ${maxSize.value}MB`);
    return false;
  }
  return true;
}

/** 取消上传 */
function cancelUpload() {
  uploadOpen.value = false;
  fileList.value = [];
}

/** 删除按钮操作 */
function handleDelete(row) {
  const uploadIds = row.uploadId || ids.value.join(",");
  proxy.$modal.confirm('是否确认删除文件编号为"' + uploadIds + '"的数据项？').then(function() {
    if (row.uploadId) {
      return delUpload(row.uploadId);
    } else {
      return batchDelUpload(ids.value);
    }
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => {});
}

/** 复制文件链接 */
function copyUrl(row) {
  if (row.url) {
    navigator.clipboard.writeText(row.url).then(() => {
      proxy.$modal.msgSuccess("链接已复制到剪贴板");
    }).catch(() => {
      proxy.$modal.msgError("复制失败，请手动复制");
    });
  }
}

/** 格式化文件大小 */
function formatFileSize(size) {
  if (!size) return "0 B";
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
  return (size / 1024 / 1024).toFixed(2) + " MB";
}

getList();
</script>
