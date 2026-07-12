<template>
  <div class="app-container tob-home">
    <section class="summary">
      <div>
        <p class="eyebrow">CareBook ToB Tenant Platform</p>
        <h1>机构租户工作台</h1>
        <p class="desc">面向外部机构的多租户后台，聚焦租户、人员、设备、工牌绑定、录音、GPS、设备事件和日报。</p>
      </div>
    </section>

    <section class="quick-grid">
      <router-link v-for="item in quickEntries" :key="item.path" class="entry" :to="item.path">
        <svg-icon :icon-class="item.icon" class-name="entry-icon" />
        <span>{{ item.title }}</span>
      </router-link>
    </section>
  </div>
</template>

<script setup name="Index">
const quickEntries = [
  { title: '租户管理', path: '/system/tenant', icon: 'peoples' },
  { title: '用户管理', path: '/system/user', icon: 'user' },
  { title: '角色权限', path: '/system/role', icon: 'peoples' },
  { title: '设备管理', path: '/tenant-care/device', icon: 'monitor' },
  { title: '人员管理', path: '/tenant-care/caregiver', icon: 'people' },
  { title: '录音记录', path: '/tenant-care/record', icon: 'message' },
  { title: '日报查看', path: '/tenant-care/report', icon: 'chart' },
]
</script>

<style scoped lang="scss">
.tob-home {
  min-height: calc(100vh - 84px);
  background: #f5f7fb;
}

.summary {
  display: flex;
  align-items: center;
  min-height: 180px;
  padding: 32px;
  color: #fff;
  background: #1f2a44;
  border-radius: 8px;
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 13px;
  color: #9fb3d9;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.desc {
  max-width: 760px;
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 1.7;
  color: #d7deed;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.entry {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 82px;
  padding: 18px;
  color: #26344d;
  text-decoration: none;
  background: #fff;
  border: 1px solid #e4e8f0;
  border-radius: 8px;
}

.entry:hover {
  color: #2563eb;
  border-color: #9dbcf9;
}

.entry-icon {
  width: 22px;
  height: 22px;
}
</style>
