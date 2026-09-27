<template>
  <div class="game-variable-panel">
    <GameVariableDataHeader
      :isRefreshing="isRefreshing"
      :searchQuery="searchQuery"
      @update:search-query="searchQuery = $event"
      @refresh="refreshData"
      @export="exportData"
      @show-stats="showDataStats"
      @show-format-guide="showFormatGuideModal = true"
    />

    <div class="variable-toolbar">
      <label>编辑权限
        <select v-model="editMode" :disabled="isOnlineMode">
          <option value="normal">普通</option>
          <option value="advanced">高级</option>
          <option value="developer">开发者</option>
        </select>
      </label>
      <span class="toolbar-hint">高级模式可编辑数值和文本；开发者模式可编辑对象和数组</span>
      <button :disabled="!changeHistory.length || isOnlineMode || isSaving" @click="undoLastChange">撤销上次修改</button>
    </div>

    <div v-if="searchQuery.trim()" class="path-search-results">
      <strong>路径搜索 · {{ matchingPaths.length }} 条</strong>
      <span v-if="matchingPaths.length === 0">没有找到匹配路径</span>
      <button v-for="result in matchingPaths" :key="result.path" @click="openPath(result.path, result.value)">
        <code>{{ result.path }}</code><span>{{ result.type }}</span>
      </button>
    </div>

    <details v-if="changeHistory.length" class="change-history">
      <summary>修改记录（当前存档 {{ changeHistory.length }} 条）</summary>
      <div v-for="(change, index) in changeHistory" :key="index">
        <code>{{ change.path }}</code> · {{ change.time }} · {{ formatShort(change.before) }} → {{ formatShort(change.after) }}
      </div>
    </details>

    <GameVariableDataSelector
      :dataTypes="dataTypes"
      :selectedType="selectedDataType"
      :getDataCount="getDataCount"
      @update:selected-type="selectedDataType = $event"
    />

    <GameVariableDataDisplay
      :isLoading="isLoading"
      :selectedDataType="selectedDataType"
      :searchQuery="searchQuery"
      :readOnly="isOnlineMode"
      :coreDataViews="coreDataViews"
      :customOptions="customOptions"
      :characterData="characterData"
      :saveData="saveData"
      :worldInfo="worldInfo"
      :memoryData="memoryData"
      :allGameData="allGameData"
      :filteredCoreDataViews="filteredCoreDataViews"
      :filteredCustomOptions="filteredCustomOptions"
      @edit-variable="editVariable"
      @copy-variable="copyVariable"
      @delete-variable="deleteVariable"
      @add-new-variable="addNewVariable"
      @debug-log="debugLogData"
    />

    <GameVariableEditModal
      v-if="showEditModal"
      :editingItem="editingItem"
      @close="closeEditModal"
      @save="saveVariable"
    />

    <GameVariableStatsModal
      v-if="showDataStatsModal"
      :coreDataViews="coreDataViews"
      :customOptions="customOptions"
      :allGameData="allGameData"
      :getMemoryCount="getMemoryCount"
      :getWorldItemCount="getWorldItemCount"
      @close="showDataStatsModal = false"
    />

    <GameVariableFormatGuideModal
      v-if="showFormatGuideModal"
      @close="showFormatGuideModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { get as lodashGet, set as lodashSet } from 'lodash'
import { useGameStateStore } from '@/stores/gameStateStore'
import { useCharacterStore } from '@/stores/characterStore'
import { toast } from '@/utils/toast'
import { panelBus } from '@/utils/panelBus'
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration'
import GameVariableDataHeader from './components/GameVariableDataHeader.vue'
import GameVariableDataSelector from './components/GameVariableDataSelector.vue'
import GameVariableDataDisplay from './components/GameVariableDataDisplay.vue'
import GameVariableEditModal from './components/GameVariableEditModal.vue'
import GameVariableStatsModal from './components/GameVariableStatsModal.vue'
import GameVariableFormatGuideModal from './components/GameVariableFormatGuideModal.vue'
import { useI18n } from '@/i18n'
import { describeVariablePath, validateVariableEdit, type VariableEditMode } from '@/utils/gameVariableEditor'

const { t } = useI18n()

// 🔥 [新架构] 使用 Pinia 作为单一数据源
const gameStateStore = useGameStateStore()
const characterStore = useCharacterStore()
// “联机”存档现在仅表示云端修行，不再启用旧的服务器权威只读限制。
const isOnlineMode = computed(() => false)

// 类型定义
type GameVariableValue = string | number | boolean | object | null | undefined

interface EditingItem {
  type: string
  key: string
  value: GameVariableValue
}

// 状态管理
const isLoading = ref(false)
const isRefreshing = ref(false)
const lastUpdateTime = ref('')
const selectedDataType = ref('saveData') // 默认显示存档数据
const searchQuery = ref('')
const showDataStatsModal = ref(false)
const showFormatGuideModal = ref(false)
const editingItem = ref<EditingItem | null>(null)
const showEditModal = ref(false)
const editMode = ref<VariableEditMode>('normal')
const isSaving = ref(false)
type VariableChange = { path: string; before: unknown; after: unknown; time: string }
const changeHistory = ref<VariableChange[]>([])
const activeSaveKey = computed(() => {
  const active = characterStore.rootState.当前激活存档
  return active ? `${active.角色ID}::${active.存档槽位}` : ''
})
watch(activeSaveKey, () => { changeHistory.value = [] })
const customVariables = ref<Record<string, GameVariableValue>>({})
const reservedCustomKeys = new Set(['游戏版本', '架构模式'])
const customVariablesStorageKey = computed(() => activeSaveKey.value ? `xiantu.custom-variables.${activeSaveKey.value}` : '')
const loadCustomVariables = () => {
  customVariables.value = {}
  const key = customVariablesStorageKey.value
  if (!key) return
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) customVariables.value = parsed
  } catch {
    customVariables.value = {}
  }
}
const persistCustomVariables = () => {
  const key = customVariablesStorageKey.value
  if (key) localStorage.setItem(key, JSON.stringify(customVariables.value))
}
watch(customVariablesStorageKey, loadCustomVariables, { immediate: true })

// 🔥 [新架构] 数据从 Pinia Store 获取

const saveDataView = computed(() => {
  if (!gameStateStore.isGameLoaded) return {}

  const activeSlot = characterStore.activeSaveSlot
  const activeProfile = characterStore.activeCharacterProfile
  const onlineSync = activeProfile?.模式 === '联机' ? activeProfile.存档?.云端同步信息 : undefined

  const raw = (gameStateStore.toSaveData() as any) || {}
  const v3 = isSaveDataV3(raw) ? raw : migrateSaveDataToLatest(raw).migrated

  // 只展示 V3 五域，彻底隐藏任何旧顶层 key（即使仍残留在对象上）
  const data: any = {
    元数据: v3.元数据,
    角色: v3.角色,
    社交: v3.社交,
    世界: v3.世界,
    系统: v3.系统,
  }

  data.元数据 = {
    ...(data.元数据 && typeof data.元数据 === 'object' ? data.元数据 : {}),
    存档ID: activeSlot?.id ?? activeSlot?.存档名 ?? undefined,
    角色ID: characterStore.rootState.当前激活存档?.角色ID,
    模式: activeProfile?.模式,
    游玩时长: activeSlot?.游戏时长,
    创建时间: activeSlot?.保存时间 ?? undefined,
    更新时间: activeSlot?.最后保存时间 ?? activeSlot?.保存时间 ?? undefined
  }

  if (onlineSync) {
    if (!data.系统 || typeof data.系统 !== 'object') data.系统 = {}
    if (!data.系统.联机 || typeof data.系统.联机 !== 'object') data.系统.联机 = {}
    data.系统.联机.同步状态 = onlineSync
  }

  return data
})

const coreDataViews = computed(() => {
  if (!gameStateStore.isGameLoaded) return {}

  // 通过访问 $state 强制依赖追踪
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _state = gameStateStore.$state

  return {
    [t('存档数据 (短路径)')]: saveDataView.value,
    [t('角色')]: gameStateStore.character,
    [t('记忆')]: gameStateStore.memory,
    [t('世界')]: gameStateStore.worldInfo
  }
})

const customOptions = computed(() => {
  return {
    [t('游戏版本')]: '2.0.0',
    [t('架构模式')]: 'Pinia内存 + DB持久化',
    ...customVariables.value,
  }
})

const characterData = computed(() => {
  return gameStateStore.character || {}
})

const saveData = computed(() => {
  if (!gameStateStore.isGameLoaded) return {}
  return saveDataView.value
})
const matchingPaths = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query || !gameStateStore.isGameLoaded) return []
  const results: Array<{ path: string; value: unknown; type: string }> = []
  const stack: Array<{ path: string; value: unknown; depth: number }> = Object.entries(saveData.value)
    .map(([path, value]) => ({ path, value, depth: 0 }))
  while (stack.length && results.length < 60) {
    const node = stack.pop()!
    if (node.path.toLowerCase().includes(query)) {
      results.push({ path: node.path, value: node.value, type: describeVariablePath(node.path) })
    }
    if (node.depth < 7 && node.value && typeof node.value === 'object') {
      for (const [key, value] of Object.entries(node.value)) {
        stack.push({ path: `${node.path}.${key}`, value, depth: node.depth + 1 })
      }
    }
  }
  return results
})
const formatShort = (value: unknown) => {
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}
const openPath = (path: string, value: unknown) => {
  selectedDataType.value = 'saveData'
  editVariable({ type: 'saveData', key: path, value: value as GameVariableValue })
}
const worldInfo = computed(() => gameStateStore.worldInfo || {})
const memoryData = computed(() => gameStateStore.memory || {})
const allGameData = computed(() => ({
  ...coreDataViews.value,
  ...customOptions.value
}))

// 过滤后的变量（用于搜索）
const filteredCoreDataViews = computed(() => {
  if (!searchQuery.value) return coreDataViews.value
  const query = searchQuery.value.toLowerCase()
  return Object.fromEntries(
    Object.entries(coreDataViews.value).filter(([key]) =>
      key.toLowerCase().includes(query)
    )
  )
})

const filteredCustomOptions = computed(() => {
  if (!searchQuery.value) return customOptions.value
  const query = searchQuery.value.toLowerCase()
  return Object.fromEntries(
    Object.entries(customOptions.value).filter(([key]) =>
      key.toLowerCase().includes(query)
    )
  )
})

// 获取数据计数
const getDataCount = (type: string) => {
  switch (type) {
    case 'core': return Object.keys(coreDataViews.value).length
    case 'custom': return Object.keys(customOptions.value).length
    case 'character': return Object.keys(characterData.value).length
    case 'saveData': return Object.keys(saveData.value).length
    case 'worldInfo': return getWorldItemCount()
    case 'memory': return getMemoryCount()
    case 'raw': return Object.keys(allGameData.value).length
    default: return 0
  }
}

const getMemoryCount = () => {
  if (typeof memoryData.value === 'object' && memoryData.value !== null) {
    return Object.keys(memoryData.value).length
  }
  return 0
}

const getWorldItemCount = () => {
  if (typeof worldInfo.value === 'object' && worldInfo.value !== null) {
    return Object.keys(worldInfo.value).length
  }
  return 0
}

// 数据类型配置 - 将存档数据放在第一个
const dataTypes = [
  { key: 'saveData',  label: t('存档数据(短路径)'), icon: 'Archive' },
  { key: 'core',      label: t('核心数据'), icon: 'Database' },
  { key: 'character', label: t('角色数据'), icon: 'Users' },
  { key: 'worldInfo', label: t('世界信息'), icon: 'Book' },
  { key: 'memory',    label: t('记忆数据'), icon: 'Brain' },
  { key: 'custom',    label: t('自定义选项'), icon: 'Settings' },
  { key: 'raw',       label: t('原始数据'), icon: 'Code' }
]

// 🔥 [新架构] 刷新数据 = 从 gameStateStore 重新读取
const refreshData = async () => {
  isRefreshing.value = true
  isLoading.value = true

  try {
    // 检查游戏是否已加载
    if (!gameStateStore.isGameLoaded) {
      toast.warning(t('请先加载游戏存档'))
      return
    }

    lastUpdateTime.value = new Date().toLocaleString('zh-CN')
    toast.success(t('数据已从Pinia Store刷新'))
  } catch (error) {
    console.error('[游戏变量] 刷新失败:', error)
    toast.error(t('数据刷新失败: ') + (error instanceof Error ? error.message : t('未知错误')))
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

const exportData = () => {
  try {
    const dataStr = JSON.stringify(allGameData.value, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `game-variables-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(t('数据导出成功'))
  } catch (error) {
    console.error('[游戏变量] 导出失败:', error)
    toast.error(t('数据导出失败'))
  }
}

const showDataStats = () => {
  showDataStatsModal.value = true
}

const addNewVariable = () => {
  if (isOnlineMode.value) return
  editingItem.value = { type: 'custom', key: '', value: '' }
  showEditModal.value = true
}

const editVariable = (item: EditingItem) => {
  if (isOnlineMode.value) {
    toast.warning(t('联机模式下不允许直接修改变量（服务器权威控制）'))
    return
  }
  if (item.type === 'custom') {
    editingItem.value = { ...item }
    showEditModal.value = true
    return
  }
  if (item.type !== 'saveData') {
    toast.warning(t('该视图为只读展示，请切换到「存档数据(短路径)」后再编辑具体路径'))
    return
  }
  const validationError = validateVariableEdit(gameStateStore.toSaveData(), item.key, item.value, editMode.value)
  if (validationError) {
    toast.warning(validationError)
    return
  }
  editingItem.value = { ...item }
  showEditModal.value = true
}

const copyVariable = async (event: { key: string; value: GameVariableValue }) => {
  try {
    const text = typeof event.value === 'object' ? JSON.stringify(event.value, null, 2) : String(event.value)
    await navigator.clipboard.writeText(`${event.key}: ${text}`)
    toast.success(t('已复制到剪贴板'))
  } catch (error) {
    console.error('[游戏变量] 复制失败:', error)
    toast.error(t('复制失败'))
  }
}

const deleteVariable = async (item?: { type: string; key: string }) => {
  if (isOnlineMode.value) {
    toast.warning(t('联机模式下不允许直接删除变量（服务器权威控制）'))
    return
  }
  if (item?.type === 'custom' && item.key && Object.prototype.hasOwnProperty.call(customVariables.value, item.key)) {
    if (!confirm(`确定删除自定义变量“${item.key}”吗？`)) return
    const before = customVariables.value[item.key]
    const next = { ...customVariables.value }
    delete next[item.key]
    customVariables.value = next
    persistCustomVariables()
    changeHistory.value.unshift({ path: `自定义.${item.key}`, before, after: undefined, time: new Date().toLocaleTimeString('zh-CN') })
    toast.success(`已删除自定义变量 ${item.key}`)
    return
  }
  toast.warning(t('该字段不支持直接删除'))
}

const saveVariable = async (item: EditingItem) => {
  if (!item) {
    toast.error(t('没有要保存的数据'))
    return
  }
  if (!gameStateStore.isGameLoaded) {
    toast.warning(t('请先加载游戏存档'))
    return
  }
  if (isOnlineMode.value) {
    toast.warning(t('联机模式下不允许直接修改变量（服务器权威控制）'))
    return
  }
  if (item.type === 'custom') {
    const key = item.key.trim()
    if (!key || key.length > 80 || /[.\[\]{}]/.test(key) || reservedCustomKeys.has(key)) {
      toast.warning('自定义变量名不能为空，不能覆盖系统选项，且不能包含 . [ ] { }')
      isSaving.value = false
      return
    }
    const before = customVariables.value[key]
    customVariables.value = { ...customVariables.value, [key]: item.value }
    persistCustomVariables()
    changeHistory.value.unshift({ path: `自定义.${key}`, before, after: item.value, time: new Date().toLocaleTimeString('zh-CN') })
    changeHistory.value = changeHistory.value.slice(0, 20)
    toast.success(`已保存自定义变量 ${key}`)
    closeEditModal()
    isSaving.value = false
    return
  }
  if (item.type !== 'saveData') {
    toast.warning(t('该视图不支持保存修改，请在「存档数据(短路径)」中编辑具体路径'))
    return
  }

  if (isSaving.value) return
  isSaving.value = true
  try {
    const { key, value } = item

    // ✅ 直接对 V3 五域 SaveData 打补丁，然后重新 loadFromSaveData（避免派生字段覆盖）
    const current = gameStateStore.toSaveData()
    if (!current) {
      toast.error(t('未获取到存档数据（存档可能未完整加载）'))
      return
    }
    const v3 = isSaveDataV3(current) ? current : migrateSaveDataToLatest(current as any).migrated
    const validationError = validateVariableEdit(v3, key, value, editMode.value)
    if (validationError) {
      toast.warning(validationError)
      return
    }
    const before = JSON.parse(JSON.stringify(lodashGet(v3, key)))
    const next = JSON.parse(JSON.stringify(v3))
    lodashSet(next, key, value)
    gameStateStore.loadFromSaveData(next as any)
    try {
      await gameStateStore.saveGame()
    } catch (saveError) {
      gameStateStore.loadFromSaveData(v3 as any)
      throw saveError
    }

    changeHistory.value.unshift({
      path: key,
      before,
      after: JSON.parse(JSON.stringify(value)),
      time: new Date().toLocaleTimeString('zh-CN'),
    })
    changeHistory.value = changeHistory.value.slice(0, 20)

    toast.success(t('✅ 已成功更新 ') + `${key}`)
    closeEditModal()
    await refreshData()
    return
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : t('未知错误')
    toast.error(t('保存失败: ') + `${errorMsg}`)
    console.error('[游戏变量] 保存失败:', error)
  } finally {
    isSaving.value = false
  }
}

const undoLastChange = async () => {
  const last = changeHistory.value[0]
  if (!last || isSaving.value || isOnlineMode.value) return
  if (last.path.startsWith('自定义.')) {
    const key = last.path.slice('自定义.'.length)
    const next = { ...customVariables.value }
    if (last.before === undefined) delete next[key]
    else next[key] = last.before as GameVariableValue
    customVariables.value = next
    persistCustomVariables()
    changeHistory.value.shift()
    toast.success(`已撤销 ${last.path}`)
    return
  }
  const current = gameStateStore.toSaveData()
  if (!current) return
  isSaving.value = true
  try {
    const next = JSON.parse(JSON.stringify(current))
    lodashSet(next, last.path, last.before)
    gameStateStore.loadFromSaveData(next as any)
    await gameStateStore.saveGame()
    changeHistory.value.shift()
    toast.success(`已撤销 ${last.path}`)
  } catch (error) {
    gameStateStore.loadFromSaveData(current as any)
    toast.error(`撤销失败：${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    isSaving.value = false
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  editingItem.value = null
}

const debugLogData = () => {
  console.group('[游戏变量] 详细调试信息 (Pinia模式)')
  console.log(t('基本统计:'), {
    [t('游戏已加载')]: gameStateStore.isGameLoaded,
    [t('角色名')]: gameStateStore.character?.名字,
    coreDataViewsCount: Object.keys(coreDataViews.value).length,
    customOptionsCount: Object.keys(customOptions.value).length,
    lastUpdateTime: lastUpdateTime.value
  })
  console.log(t('核心数据键名:'), Object.keys(coreDataViews.value))
  console.log(t('自定义选项键名:'), Object.keys(customOptions.value))
  console.log(t('完整SaveData:'), gameStateStore.toSaveData())
  console.groupEnd()
  toast.success(t('调试信息已输出到控制台'))
}

// 组件挂载
const refreshHandler = () => refreshData()
const exportHandler = () => exportData()
const statsHandler = () => showDataStats()
onMounted(() => {
  refreshData()
  panelBus.on('refresh', refreshHandler)
  panelBus.on('export', exportHandler)
  panelBus.on('stats', statsHandler)
})
onBeforeUnmount(() => {
  panelBus.off('refresh', refreshHandler)
  panelBus.off('export', exportHandler)
  panelBus.off('stats', statsHandler)
})
</script>

<style scoped>
.game-variable-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  overflow: hidden;
}
.variable-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 14px; border-bottom: 1px solid var(--color-border); }
.variable-toolbar label { display: flex; align-items: center; gap: 6px; }
.variable-toolbar select, .variable-toolbar button { padding: 5px 9px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
.toolbar-hint { color: var(--color-text-secondary); font-size: 0.8rem; flex: 1; }
.path-search-results { max-height: 190px; overflow: auto; display: flex; flex-direction: column; gap: 4px; padding: 8px 14px; border-bottom: 1px solid var(--color-border); }
.path-search-results button { text-align: left; display: flex; justify-content: space-between; gap: 12px; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
.path-search-results code { overflow-wrap: anywhere; }
.path-search-results span { color: var(--color-text-secondary); white-space: nowrap; }
.change-history { padding: 6px 14px; color: var(--color-text-secondary); font-size: 0.8rem; max-height: 130px; overflow: auto; }
.change-history div { padding: 4px 0; overflow-wrap: anywhere; }
</style>
