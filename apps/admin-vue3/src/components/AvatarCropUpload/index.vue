<template>
  <div class="avatar-crop-upload">
    <div class="avatar-trigger" @click="editCropper">
      <el-avatar :src="resolvedImage" :size="size" :shape="shape">
        <el-icon><Plus /></el-icon>
      </el-avatar>
      <span v-if="showHint" class="avatar-trigger__hint">{{ hint }}</span>
    </div>
    <el-dialog :title="title" v-model="open" width="800px" append-to-body @opened="modalOpened" @close="closeDialog">
      <el-row>
        <el-col :xs="24" :md="12" :style="{ height: '350px' }">
          <vue-cropper
            v-if="visible"
            ref="cropperRef"
            :img="options.img"
            :info="true"
            :autoCrop="options.autoCrop"
            :autoCropWidth="options.autoCropWidth"
            :autoCropHeight="options.autoCropHeight"
            :fixedBox="options.fixedBox"
            :outputType="options.outputType"
            @realTime="realTime"
          />
        </el-col>
        <el-col :xs="24" :md="12" :style="{ height: '350px' }">
          <div class="avatar-upload-preview">
            <img :src="options.previews.url || resolvedImage" :style="options.previews.img" />
          </div>
        </el-col>
      </el-row>
      <br />
      <el-row>
        <el-col :lg="2" :md="2">
          <el-upload action="#" :http-request="requestUpload" :show-file-list="false" :before-upload="beforeUpload">
            <el-button>
              选择
              <el-icon class="el-icon--right"><Upload /></el-icon>
            </el-button>
          </el-upload>
        </el-col>
        <el-col :lg="{ span: 1, offset: 2 }" :md="2">
          <el-button icon="Plus" @click="changeScale(1)" />
        </el-col>
        <el-col :lg="{ span: 1, offset: 1 }" :md="2">
          <el-button icon="Minus" @click="changeScale(-1)" />
        </el-col>
        <el-col :lg="{ span: 1, offset: 1 }" :md="2">
          <el-button icon="RefreshLeft" @click="rotateLeft()" />
        </el-col>
        <el-col :lg="{ span: 1, offset: 1 }" :md="2">
          <el-button icon="RefreshRight" @click="rotateRight()" />
        </el-col>
        <el-col :lg="{ span: 2, offset: 6 }" :md="2">
          <el-button type="primary" @click="uploadImg">提交</el-button>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script setup>
import 'vue-cropper/dist/index.css'
import { VueCropper } from 'vue-cropper'
import { uploadAvatar } from '@/api/system/user'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '修改头像',
  },
  size: {
    type: Number,
    default: 96,
  },
  shape: {
    type: String,
    default: 'circle',
  },
  hint: {
    type: String,
    default: '点击上传头像',
  },
  showHint: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['update:modelValue'])
const { proxy } = getCurrentInstance()

const open = ref(false)
const visible = ref(false)
const cropperRef = ref()

function resolveAvatarUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  return import.meta.env.VITE_APP_BASE_API + url
}

function canLoadInCropper(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return true
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true
  try {
    return new URL(url).origin === window.location.origin
  } catch (error) {
    return false
  }
}

function getCropperImage(url) {
  const resolvedUrl = resolveAvatarUrl(url)
  return canLoadInCropper(resolvedUrl) ? resolvedUrl : ''
}

const resolvedImage = computed(() => resolveAvatarUrl(props.modelValue))

const options = reactive({
  img: resolvedImage.value,
  autoCrop: true,
  autoCropWidth: 200,
  autoCropHeight: 200,
  fixedBox: true,
  outputType: 'png',
  previews: {},
})

watch(
  () => props.modelValue,
  (value) => {
    if (!open.value) {
      options.img = resolveAvatarUrl(value)
    }
  },
  { immediate: true },
)

function editCropper() {
  options.img = getCropperImage(props.modelValue)
  options.previews = {}
  open.value = true
}

function modalOpened() {
  visible.value = true
}

function closeDialog() {
  options.img = resolvedImage.value
  options.previews = {}
  visible.value = false
}

function requestUpload() {}

function rotateLeft() {
  cropperRef.value?.rotateLeft()
}

function rotateRight() {
  cropperRef.value?.rotateRight()
}

function changeScale(num) {
  cropperRef.value?.changeScale(num || 1)
}

function beforeUpload(file) {
  if (file.type.indexOf('image/') === -1) {
    proxy.$modal.msgError('文件格式错误，请上传图片类型,如：JPG，PNG后缀的文件。')
    return false
  }
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => {
    options.img = reader.result
  }
  return false
}

function uploadImg() {
  if (!options.img) {
    proxy.$modal.msgError('请选择要上传的头像图片')
    return
  }
  cropperRef.value?.getCropBlob((data) => {
    const formData = new FormData()
    formData.append('avatarfile', data)
    uploadAvatar(formData).then((response) => {
      const avatarUrl = resolveAvatarUrl(response.data.imgUrl)
      emit('update:modelValue', avatarUrl)
      options.img = avatarUrl
      open.value = false
      visible.value = false
      proxy.$modal.msgSuccess('头像上传成功')
    })
  })
}

function realTime(data) {
  options.previews = data
}
</script>

<style scoped>
.avatar-crop-upload {
  display: inline-flex;
  align-items: center;
}

.avatar-trigger {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.avatar-trigger__hint {
  color: #909399;
  font-size: 13px;
}
</style>
