<template>
  <div class="api-management-panel">
    <!-- 头部 -->
    <header class="panel-header">
      <div class="header-left">
        <div class="header-emblem" aria-hidden="true"><span class="emblem-glyph">枢</span></div>
        <div class="header-info">
          <h3 class="panel-title">{{ t('API管理') }}</h3>
          <span class="settings-subtitle">{{ t('管理多个API配置和功能分配') }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="handleImport">
          <Upload :size="16" />
          <span class="btn-text">{{ t('导入') }}</span>
        </button>
        <button class="action-btn" @click="handleExport">
          <Download :size="16" />
          <span class="btn-text">{{ t('导出') }}</span>
        </button>
        <button class="action-btn primary" @click="showAddDialog = true">
          <Plus :size="16" />
          <span class="btn-text">{{ t('新增') }}</span>
        </button>
        <button
          v-if="closable"
          type="button"
          class="icon-btn close-panel"
          :aria-label="t('关闭')"
          :title="t('关闭')"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>
    </header>

    <!-- 内容区域 -->
    <div class="settings-container">
      <!-- API列表区 -->
      <div class="settings-section">
        <div class="section-header">
          <Server :size="15" class="section-icon" />
          <h4 class="section-title">{{ t('API配置列表') }}</h4>
          <span class="section-rule" aria-hidden="true"></span>
          <span class="section-count">{{ apiStore.apiConfigs.length }} {{ t('个配置') }}</span>
        </div>
        <div class="api-list">
          <div
            v-for="api in apiStore.apiConfigs"
            :key="api.id"
            class="api-card"
            :class="{ disabled: !api.enabled, default: api.id === 'default' }"
          >
            <div class="api-card-header">
              <label class="card-toggle" :title="t('启用/禁用')">
                <input
                  type="checkbox"
                  :checked="api.enabled"
                  @change="toggleAPI(api.id)"
                />
                <span class="toggle-slider"></span>
              </label>
              <div class="api-info">
                <span class="api-name">{{ getDisplayName(api) }}</span>
                <span class="api-provider" v-if="!(isTavernEnvFlag && api.id === 'default')">{{ getProviderName(api.provider) }}</span>
                <span class="api-provider tavern-tag" v-else>酒馆配置</span>
              </div>
              <div class="api-actions">
                <button class="icon-btn" @click="testAPI(api)" :title="t('测试连接')">
                  <FlaskConical :size="16" :class="{ 'loading-pulse': testingApiId === api.id }" />
                </button>
                <button class="icon-btn" @click="editAPI(api)" :title="t('编辑')">
                  <Edit2 :size="16" />
                </button>
                <button
                  class="icon-btn danger"
                  @click="deleteAPI(api.id)"
                  :title="t('删除')"
                  :disabled="api.id === 'default'"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
            <div class="api-card-body">
              <!-- 酒馆模式下默认API显示特殊提示 -->
              <template v-if="isTavernEnvFlag && api.id === 'default'">
                <div class="tavern-api-hint">
                  <Beer :size="14" /><span class="hint-text">API配置由酒馆管理，此处无需配置</span>
                </div>
              </template>
              <template v-else>
                <div class="api-detail">
                  <span class="detail-label">{{ t('模型') }}:</span>
                  <span class="detail-value">{{ api.model }}</span>
                </div>
                <div class="api-detail">
                  <span class="detail-label">{{ t('地址') }}:</span>
                  <span class="detail-value url">{{ api.url || t('默认') }}</span>
                </div>
                <div class="api-detail">
                  <span class="detail-label">{{ t('状态') }}:</span>
                  <span class="detail-value" :class="getAPIStatus(api.id)">
                    {{ getAPIStatusText(api.id) }}
                  </span>
                </div>
                <div class="api-detail" v-if="['openai', 'deepseek', 'zhipu', 'volcengine', 'custom', 'gemini', 'claude'].includes(api.provider)">
                  <label class="json-toggle">
                    <input
                      type="checkbox"
                      :checked="api.forceJsonOutput"
                      @change="toggleForceJson(api.id, ($event.target as HTMLInputElement).checked)"
                    />
                    <span>{{ t('强制JSON') }}</span>
                  </label>
                </div>
              </template>
            </div>
            <div class="api-card-footer" v-if="getAssignedFunctions(api.id).length > 0">
              <span class="assigned-label">{{ t('已分配功能') }}:</span>
              <div class="assigned-tags">
                <span
                  v-for="func in getAssignedFunctions(api.id)"
                  :key="func"
                  class="function-tag"
                >
                  {{ getFunctionName(func) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 生成方式 -->
      <div class="settings-section">
        <div class="section-header">
          <Bot :size="15" class="section-icon" />
          <h4 class="section-title">{{ t('生成方式') }}</h4>
          <span class="section-rule" aria-hidden="true"></span>
        </div>
        <div class="settings-list">
          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name" for="api-streaming">{{ t('流式输出') }}</label>
              <span class="setting-desc">{{ t('AI 回复边生成边显示，不用等整段写完') }}</span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input id="api-streaming" type="checkbox" v-model="streamingEnabled" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name" for="api-split">{{ t('分步生成') }}</label>
              <span class="setting-desc">
                {{ splitResponseGeneration
                  ? t('每回合调用两次：第 1 步写正文和行动选项，第 2 步单独生成游戏指令')
                  : t('每回合调用一次，正文和游戏指令一起生成。开启后更稳定，但多一次调用') }}
              </span>
            </div>
            <div class="setting-control">
              <label class="setting-switch">
                <input id="api-split" type="checkbox" v-model="splitResponseGeneration" @change="saveSplitResponseSetting" />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <!-- 仅在分步生成开启时出现 -->
          <template v-if="splitResponseGeneration">
            <div class="setting-item nested">
              <div class="setting-info">
                <label class="setting-name" for="api-step2">{{ t('第 2 步使用的 API') }}</label>
                <span class="setting-desc">{{ t('负责输出结构化指令（JSON）。可以选一个更擅长 JSON 的模型，不选则沿用主流程 API') }}</span>
              </div>
              <div class="setting-control">
                <select
                  id="api-step2"
                  class="setting-select"
                  :value="apiStore.apiAssignments.find(a => a.type === 'instruction_generation')?.apiId"
                  @change="updateAssignment('instruction_generation', ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="api in apiStore.enabledAPIs"
                    :key="api.id"
                    :value="api.id"
                  >
                    {{ api.id === 'default' ? t('沿用主流程 API') : getDisplayName(api) }}
                  </option>
                </select>
              </div>
            </div>

            <div class="setting-item nested">
              <div class="setting-info">
                <label class="setting-name" for="api-step2-stream">{{ t('第 2 步流式传输') }}</label>
                <span class="setting-desc">{{ t('部分 API 不支持，第 2 步报错时请关闭') }}</span>
              </div>
              <div class="setting-control">
                <label class="setting-switch">
                  <input
                    id="api-step2-stream"
                    type="checkbox"
                    :checked="apiStore.aiGenerationSettings.splitStep2Streaming"
                    @change="apiStore.updateAIGenerationSettings({ splitStep2Streaming: ($event.target as HTMLInputElement).checked })"
                  />
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>
          </template>

          <div class="setting-item">
            <div class="setting-info">
              <label class="setting-name" for="api-retry">{{ t('失败重试') }}</label>
              <span class="setting-desc">{{ t('API 调用失败后自动重试的次数，0 为不重试') }}</span>
            </div>
            <div class="setting-control">
              <input
                id="api-retry"
                type="number"
                min="0"
                max="5"
                class="setting-number-input"
                :value="retryCount"
                @input="updateRetryCount(($event.target as HTMLInputElement).value)"
              />
              <span class="input-hint">{{ t('次') }}</span>
            </div>
          </div>

          <template v-if="isTavernEnvFlag">
            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-name" for="api-nsfw">{{ t('成人内容模式') }}</label>
                <span class="setting-desc">{{ t('启用后NPC可能产生成人向互动内容') }}</span>
              </div>
              <div class="setting-control">
                <label class="setting-switch">
                  <input id="api-nsfw" type="checkbox" v-model="nsfwMode" @change="saveNsfwSettings" />
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>

            <div v-if="nsfwMode" class="setting-item nested">
              <div class="setting-info">
                <label class="setting-name" for="api-nsfw-gender">{{ t('性别偏好') }}</label>
                <span class="setting-desc">{{ t('只让所选性别的 NPC 参与成人互动') }}</span>
              </div>
              <div class="setting-control">
                <select id="api-nsfw-gender" v-model="nsfwGenderFilter" class="setting-select" @change="saveNsfwSettings">
                  <option value="female">{{ t('仅女性') }}</option>
                  <option value="male">{{ t('仅男性') }}</option>
                  <option value="all">{{ t('不限性别') }}</option>
                </select>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 功能分配 -->
      <div class="settings-section">
        <div class="section-header">
          <Workflow :size="15" class="section-icon" />
          <h4 class="section-title">{{ t('功能分配') }}</h4>
          <span class="section-rule" aria-hidden="true"></span>
          <span class="mode-badge" :class="isTavernEnvFlag ? 'tavern' : 'web'">
            {{ isTavernEnvFlag ? t('酒馆模式') : t('网页模式') }}
          </span>
        </div>

        <p class="section-hint">
          <component :is="isTavernEnvFlag ? Beer : Globe" :size="14" />
          <span v-if="isTavernEnvFlag">{{ t('主流程固定走酒馆的 API；下面的辅助功能可单独指定 API，不指定则同样走酒馆。') }}</span>
          <span v-else>{{ t('每个功能都可以指定用哪个 API；指定同一个 API 的功能会合并请求。') }}</span>
        </p>

        <div class="settings-list">
          <!-- 主流程 -->
          <div class="setting-item" :class="{ 'tavern-locked': isTavernEnvFlag }">
            <div class="setting-info">
              <span class="setting-name">
                {{ t('主流程') }}
                <span v-if="isTavernEnvFlag" class="locked-badge"><Lock :size="11" /> {{ t('酒馆') }}</span>
              </span>
              <span class="setting-desc">
                {{ splitResponseGeneration ? t('生成正文和行动选项（分步生成的第 1 步）') : t('生成正文、行动选项和游戏指令') }}
              </span>
            </div>
            <div class="setting-control">
              <span v-if="isTavernEnvFlag" class="locked-text">{{ t('使用酒馆配置') }}</span>
              <select
                v-else
                class="setting-select"
                :value="apiStore.apiAssignments.find(a => a.type === 'main')?.apiId"
                @change="updateAssignment('main', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="api in apiStore.enabledAPIs" :key="api.id" :value="api.id">
                  {{ getDisplayName(api) }}
                </option>
              </select>
            </div>
          </div>

          <div class="function-group-header">
            <h5 class="group-title">{{ t('辅助功能') }}</h5>
            <span class="group-desc">{{ t('不指定时使用主流程 API') }}</span>
          </div>

          <div v-for="funcType in auxiliaryFunctions" :key="funcType" class="setting-item">
            <div class="setting-info">
              <span class="setting-name">
                {{ getFunctionName(funcType) }}
                <span v-if="isTavernEnvFlag && isFunctionActive(funcType)" class="mode-indicator">
                  {{ apiStore.getFunctionMode(funcType) === 'raw' ? 'Raw' : t('标准') }}
                </span>
              </span>
              <span class="setting-desc">{{ getFunctionDesc(funcType) }}</span>
            </div>
            <div class="setting-control">
              <div class="control-row">
                <!-- 可开关的功能：先开关，开启后才出现 API 选择 -->
                <label v-if="funcType === 'text_optimization'" class="setting-switch" :title="t('启用')">
                  <input
                    type="checkbox"
                    :checked="apiStore.isFunctionEnabled('text_optimization')"
                    @change="apiStore.setFunctionEnabled('text_optimization', ($event.target as HTMLInputElement).checked)"
                  />
                  <span class="switch-slider"></span>
                </label>

                <template v-if="isFunctionActive(funcType)">
                  <select
                    class="setting-select"
                    :value="apiStore.apiAssignments.find(a => a.type === funcType)?.apiId"
                    @change="updateAssignment(funcType, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="default">{{ t('沿用主流程 API') }}</option>
                    <option
                      v-for="api in apiStore.apiConfigs.filter(a => a.id !== 'default')"
                      :key="api.id"
                      :value="api.id"
                      :disabled="!api.enabled"
                    >
                      {{ getDisplayName(api) }}{{ !api.enabled ? ` (${t('未启用')})` : '' }}
                    </option>
                  </select>

                  <select
                    v-if="isTavernEnvFlag"
                    class="setting-select mode-select"
                    :title="t('Raw：直接发送任务提示词；标准：附带酒馆预设')"
                    :value="apiStore.getFunctionMode(funcType)"
                    @change="updateFunctionMode(funcType, ($event.target as HTMLSelectElement).value as any)"
                  >
                    <option value="raw">Raw</option>
                    <option value="standard">{{ t('标准') }}</option>
                  </select>
                </template>
              </div>
            </div>
          </div>

          <!-- 叙事检索 Embedding 配置：检索开关与同步操作在记忆档案中统一管理 -->
          <div class="function-group-header">
            <h5 class="group-title">叙事检索</h5>
            <span class="group-desc">为历史剧情检索提供 Embedding 模型</span>
          </div>

          <div class="setting-item nested">
            <div class="setting-info">
              <label class="setting-name" for="api-embedding">Embedding API</label>
              <span class="setting-desc">只在这里选择向量模型；叙事检索的开关、同步和召回参数在记忆档案中设置。</span>
            </div>
            <div class="setting-control">
              <select
                id="api-embedding"
                class="setting-select"
                :value="apiStore.apiAssignments.find(a => a.type === 'embedding')?.apiId"
                @change="updateAssignment('embedding', ($event.target as HTMLSelectElement).value)"
              >
                <option value="default">{{ t('沿用主流程 API') }}</option>
                <option
                  v-for="api in apiStore.apiConfigs.filter(a => a.id !== 'default')"
                  :key="api.id"
                  :value="api.id"
                  :disabled="!api.enabled"
                >
                  {{ getDisplayName(api) }}{{ !api.enabled ? ` (${t('未启用')})` : '' }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/编辑API弹窗 -->
    <div v-if="showAddDialog || showEditDialog" class="cc-modal-overlay api-modal-overlay" @click.self="closeDialogs">
      <div class="cc-modal wide" role="dialog" aria-modal="true">
        <div class="cc-modal-head">
          <h3 class="cc-modal-title">{{ showEditDialog ? t('编辑API配置') : t('新增API配置') }}</h3>
          <button type="button" class="cc-modal-close" :aria-label="t('关闭')" @click="closeDialogs">
            <X :size="18" />
          </button>
        </div>
        <div class="cc-modal-body">
          <div class="form-group">
            <label>{{ t('配置名称') }}</label>
            <input v-model="editingAPI.name" class="cc-input" :placeholder="t('例如：主力API')" />
          </div>

          <div class="form-group">
            <label>{{ t('API提供商') }}</label>
            <select v-model="editingAPI.provider" class="cc-input" @change="onProviderChange">
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="deepseek">DeepSeek</option>
              <option value="zhipu">智谱AI</option>
              <option value="volcengine">火山引擎(豆包)</option>
              <option value="siliconflow-embedding">硅基流动(Embedding)</option>
              <option value="custom">{{ t('自定义(OpenAI兼容)') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ t('API地址') }}</label>
            <input
              v-model="editingAPI.url"
              class="cc-input"
              :placeholder="getProviderPresetUrl(editingAPI.provider || 'openai')"
            />
          </div>

          <div class="form-group">
            <label>{{ t('API密钥') }}</label>
            <input
              v-model="editingAPI.apiKey"
              type="password"
              class="cc-input"
              placeholder="sk-..."
            />
          </div>

          <div class="form-group">
            <label>{{ t('模型名称') }}</label>
            <div class="model-select-wrapper">
              <div class="model-input-row">
                <input
                  v-model="editingAPI.model"
                  class="cc-input"
                  :placeholder="getProviderPresetModel(editingAPI.provider || 'openai')"
                  @focus="showModelDropdown = true"
                  @input="filterModels"
                />
                <button type="button" class="cc-btn small fetch-btn" :title="t('获取模型列表')" @click="fetchModelsForEditing" :disabled="isFetchingModels">
                  <RefreshCw :size="16" :class="{ 'loading-pulse': isFetchingModels }" />
                </button>
              </div>
              <div v-if="showModelDropdown && filteredModels.length > 0" class="model-dropdown">
                <div
                  v-for="model in filteredModels"
                  :key="model"
                  class="model-dropdown-item"
                  :class="{ active: editingAPI.model === model }"
                  @mousedown.prevent="selectModel(model)"
                >
                  {{ model }}
                </div>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>{{ t('温度参数') }}</label>
              <input
                v-model.number="editingAPI.temperature"
                type="number"
                class="cc-input"
                min="0"
                max="2"
                step="0.1"
              />
            </div>
            <div class="form-group half">
              <label>{{ t('最大Token数') }}</label>
              <input
                v-model.number="editingAPI.maxTokens"
                type="number"
                class="cc-input"
                min="100"
                :max="getProviderMaxOutputTokens(editingAPI.provider || 'openai')"
              />
            </div>
          </div>

          <!-- 强制JSON输出选项 -->
          <div
            class="form-group"
            v-if="['openai', 'deepseek', 'zhipu', 'volcengine', 'custom', 'gemini', 'claude'].includes(editingAPI.provider || 'openai')"
          >
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="editingAPI.forceJsonOutput"
                class="form-checkbox"
              />
              <span>{{ t('强制JSON格式输出') }}</span>
            </label>
            <div class="form-hint">
              {{ t('启用后，API将强制返回JSON格式。需要在提示词中包含"json"字样并给出JSON格式样例。') }}
              <br/>
              <span class="hint-warning" v-if="editingAPI.provider === 'gemini'">
                ℹ️ {{ t('Gemini使用response_mime_type实现JSON模式') }}
              </span>
              <span class="hint-warning" v-else-if="editingAPI.provider === 'claude'">
                ℹ️ {{ t('Claude使用prefill技巧实现JSON模式') }}
              </span>
              <span class="hint-warning" v-else>
                ⚠️ {{ t('仅支持OpenAI兼容API（如DeepSeek）。使用前请确保提示词中包含JSON格式说明。') }}
              </span>
              <br v-if="editingAPI.provider === 'custom'"/>
              <span class="hint-warning" v-if="editingAPI.provider === 'custom'">
                ⚠️ {{ t('重要：如果使用New-API等中转服务，需确认底层模型支持！') }}
                <br/>
                {{ t('• 底层是OpenAI/DeepSeek/Qwen/GLM-4: ✅ 通常可用') }}
                <br/>
                {{ t('• 底层是Gemini/Claude/旧模型: ❌ 可能报错') }}
                <br/>
                <strong>{{ t('• 务必先用"测试连接"验证！') }}</strong>
              </span>
            </div>
          </div>
        </div>
        <div class="cc-modal-foot">
          <button type="button" class="cc-btn" @click="closeDialogs">{{ t('取消') }}</button>
          <button type="button" class="cc-btn primary" @click="saveAPI">{{ t('保存') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Plus, Edit2, Trash2, Upload, Download, X, RefreshCw, FlaskConical,
  Server, Workflow, Bot, Beer, Globe, Lock,
} from 'lucide-vue-next';
import { useAPIManagementStore, type APIConfig, type APIUsageType } from '@/stores/apiManagementStore';
import { aiService, API_PROVIDER_PRESETS, type APIProvider } from '@/services/aiService';
import { useUIStore } from '@/stores/uiStore';
import { getNsfwSettingsFromStorage, type NsfwGenderFilter } from '@/utils/nsfw';
import { isTavernEnv } from '@/utils/tavern';
import { toast } from '@/utils/toast';
import { useI18n } from '@/i18n';

withDefaults(defineProps<{ closable?: boolean }>(), { closable: false });
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const apiStore = useAPIManagementStore();
const uiStore = useUIStore();

// 初始化加载
onMounted(() => {
  apiStore.loadFromStorage();
  loadAIServiceConfig();
  loadLocalSettings();

});

// AI服务通用配置
const streamingEnabled = ref(true);
const splitResponseGeneration = ref(false); // 分步生成开关，默认关闭
const isTavernEnvFlag = ref(isTavernEnv());
const nsfwMode = ref(true);
const nsfwGenderFilter = ref<NsfwGenderFilter>('female');
const retryCount = ref(1); // 重试次数，默认1次

const readGameSettings = (): Record<string, unknown> => {
  try {
    const raw = localStorage.getItem('dad_game_settings');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const saveGameSettings = (updates: Record<string, unknown>) => {
  const base = readGameSettings();
  localStorage.setItem('dad_game_settings', JSON.stringify({ ...base, ...updates }));
};

const loadAIServiceConfig = () => {
  const config = aiService.getConfig();
  streamingEnabled.value = config.streaming !== false;
};

const loadLocalSettings = () => {
  const nsfwSettings = getNsfwSettingsFromStorage();
  nsfwMode.value = nsfwSettings.nsfwMode;
  nsfwGenderFilter.value = nsfwSettings.nsfwGenderFilter;
  isTavernEnvFlag.value = isTavernEnv();

  // 加载分步生成设置
  const gameSettings = readGameSettings();
  splitResponseGeneration.value = gameSettings.splitResponseGeneration === true; // 默认关闭

  // 加载重试次数设置
  const savedRetryCount = gameSettings.retryCount;
  if (typeof savedRetryCount === 'number' && savedRetryCount >= 0 && savedRetryCount <= 5) {
    retryCount.value = savedRetryCount;
  } else {
    retryCount.value = 1; // 默认1次
  }
};

const saveSplitResponseSetting = () => {
  saveGameSettings({
    splitResponseGeneration: splitResponseGeneration.value,
  });
};

const saveNsfwSettings = () => {
  saveGameSettings({
    enableNsfwMode: nsfwMode.value,
    nsfwGenderFilter: nsfwGenderFilter.value,
  });
};

const updateRetryCount = (value: string) => {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 5) {
    toast.error('重试次数必须在 0-5 之间');
    return;
  }
  retryCount.value = num;
  saveGameSettings({ retryCount: num });

  // 更新 aiService 的配置
  const currentConfig = aiService.getConfig();
  aiService.saveConfig({ ...currentConfig, maxRetries: num });

  toast.success(`重试次数已设置为 ${num} 次`);
};

// 监听通用配置变化
watch(streamingEnabled, () => {
  aiService.saveConfig({
    streaming: streamingEnabled.value
  });
  uiStore.useStreaming = streamingEnabled.value;
});

// 对话框状态
const showAddDialog = ref(false);
const showEditDialog = ref(false);
const editingAPI = ref<Partial<APIConfig>>({
  name: '',
  provider: 'openai',
  url: '',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 16000,
  enabled: true
});
const editingAPIId = ref<string | null>(null);

// 模型获取状态
const isFetchingModels = ref(false);
const availableModels = ref<string[]>([]);
const showModelDropdown = ref(false);

// 过滤后的模型列表
const filteredModels = computed(() => {
  const query = editingAPI.value.model?.toLowerCase() || '';
  if (!query) return availableModels.value;
  return availableModels.value.filter(m => m.toLowerCase().includes(query));
});

// 过滤模型
const filterModels = () => {
  showModelDropdown.value = true;
};

// 选择模型
const selectModel = (model: string) => {
  editingAPI.value.model = model;
  showModelDropdown.value = false;
};

// API测试状态
const testingApiId = ref<string | null>(null);
const apiTestResults = ref<Record<string, 'success' | 'fail' | null>>({});

// 获取提供商名称
const getProviderName = (provider: APIProvider): string => {
  return API_PROVIDER_PRESETS[provider]?.name || provider;
};

/**
 * 获取API的显示名称
 * 酒馆模式下，默认API显示为"酒馆API"
 */
const getDisplayName = (api: APIConfig): string => {
  if (isTavernEnvFlag.value && api.id === 'default') {
    return '🍺 酒馆API';
  }
  return api.name;
};

const getProviderPresetUrl = (provider: APIProvider): string => {
  return API_PROVIDER_PRESETS[provider]?.url || 'https://api.openai.com';
};

const getProviderPresetModel = (provider: APIProvider): string => {
  return API_PROVIDER_PRESETS[provider]?.defaultModel || 'gpt-4o';
};

const getProviderPresetMaxTokens = (provider: APIProvider): number => {
  return API_PROVIDER_PRESETS[provider]?.defaultMaxTokens || 16000;
};

const getProviderMaxOutputTokens = (provider: APIProvider): number => {
  return API_PROVIDER_PRESETS[provider]?.maxOutputTokens || 384000;
};

// 当提供商变化时更新默认值
const onProviderChange = () => {
  const preset = API_PROVIDER_PRESETS[editingAPI.value.provider as APIProvider];
  if (preset) {
    editingAPI.value.url = preset.url;
    editingAPI.value.model = preset.defaultModel;
    editingAPI.value.maxTokens = preset.defaultMaxTokens || 16000;
  }
};

// 获取功能名称
const getFunctionName = (type: APIUsageType): string => {
  const names: Record<APIUsageType, string> = {
    main: '主流程',
    memory_summary: '记忆总结',
    embedding: '叙事检索 Embedding',
    text_optimization: '文本润色',
    instruction_generation: '指令生成（分步）',
    world_generation: '世界生成',
    event_generation: '事件生成',
    sect_generation: '宗门生成',
    crafting: '炼丹炼器',
  };
  return names[type] || type;
};

// 获取功能描述
const getFunctionDesc = (type: APIUsageType): string => {
  const descs: Record<APIUsageType, string> = {
    main: '生成正文、行动选项和游戏指令',
    memory_summary: '把较早的对话和 NPC 记忆压缩成摘要，可用便宜的快速模型',
    embedding: '把历史叙事转成向量，用于长程剧情检索',
    text_optimization: '对 AI 写出的正文再润色一遍（开启后每回合多一次调用）',
    instruction_generation: '分步生成的第 2 步：输出结构化游戏指令',
    world_generation: '开局与探索时生成世界、地点',
    event_generation: '生成世界大事件',
    sect_generation: '生成宗门的藏经阁、贡献商店等内容',
    crafting: '炼丹、炼器时的结果判定',
  };
  return descs[type] || '';
};

const updateFunctionMode = (type: APIUsageType, mode: 'raw' | 'standard') => {
  apiStore.setFunctionMode(type, mode);
  toast.success(`${getFunctionName(type)} ${t('模式已设置为')} ${mode}`);
};

// 获取已分配到某API的功能列表
// 辅助功能（叙事检索的 Embedding 在上方单独配置）
const auxiliaryFunctions: APIUsageType[] = [
  'memory_summary',
  'text_optimization',
  'world_generation',
  'event_generation',
  'sect_generation',
  'crafting',
];

// 功能当前是否生效：可开关的功能在关闭时不显示 API 选择，也不计入卡片上的"已分配"
const isFunctionActive = (type: APIUsageType): boolean => {
  if (type === 'instruction_generation') return splitResponseGeneration.value;
  if (type === 'text_optimization') return apiStore.isFunctionEnabled('text_optimization');
  return true;
};

const getAssignedFunctions = (apiId: string): APIUsageType[] => {
  return apiStore.apiAssignments
    .filter(a => a.apiId === apiId && isFunctionActive(a.type))
    .map(a => a.type);
};

// 获取API状态
const getAPIStatus = (apiId: string): string => {
  const result = apiTestResults.value[apiId];
  if (result === 'success') return 'success';
  if (result === 'fail') return 'fail';
  return 'unknown';
};

const getAPIStatusText = (apiId: string): string => {
  const result = apiTestResults.value[apiId];
  if (result === 'success') return t('连接正常');
  if (result === 'fail') return t('连接失败');
  return t('未测试');
};

// 切换API启用状态
const toggleAPI = (id: string) => {
  apiStore.toggleAPI(id);
};

// 切换强制JSON
const toggleForceJson = (id: string, enabled: boolean) => {
  apiStore.updateAPI(id, { forceJsonOutput: enabled });
  toast.success(enabled ? t('已启用强制JSON') : t('已关闭强制JSON'));
};

// 编辑API
const editAPI = (api: APIConfig) => {
  editingAPI.value = { ...api };
  editingAPIId.value = api.id;
  showEditDialog.value = true;
};

// 删除API
const deleteAPI = (id: string) => {
  if (id === 'default') {
    toast.error(t('不能删除默认API配置'));
    return;
  }

  uiStore.showRetryDialog({
    title: t('确认删除'),
    message: t('确定要删除这个API配置吗？使用它的功能将自动回退到默认API。'),
    confirmText: t('删除'),
    cancelText: t('取消'),
    onConfirm: () => {
      apiStore.deleteAPI(id);
      toast.success(t('API配置已删除'));
    },
    onCancel: () => {}
  });
};

// 测试API连接
const testAPI = async (api: APIConfig) => {
  if (testingApiId.value) return;

  testingApiId.value = api.id;
  try {
    // 根据是否启用强制JSON选择不同的测试提示词
    const testPrompt = api.forceJsonOutput
      ? '你正在进行API连通性测试。请按照以下JSON格式输出测试结果：\n\n示例JSON格式：\n{"status": "ok", "message": "仙途本-连通测试-OK"}\n\n请严格按照上述JSON格式输出。'
      : '你正在进行API连通性测试。请仅输出：仙途本-连通测试-OK';

    // 使用直接测试方法，绕过环境检测
    const response = await aiService.testAPIDirectly({
      provider: api.provider,
      url: api.url,
      apiKey: api.apiKey,
      model: api.model,
      temperature: api.temperature,
      maxTokens: 1000,
      forceJsonOutput: api.forceJsonOutput
    }, testPrompt);

    // 根据是否启用强制JSON进行不同的验证
    let ok = false;
    if (api.forceJsonOutput) {
      try {
        const jsonResponse = JSON.parse(response);
        ok = jsonResponse.status === 'ok' ||
             (jsonResponse.message && jsonResponse.message.includes('仙途本')) ||
             response.toLowerCase().includes('ok');
      } catch {
        // JSON解析失败，尝试普通文本匹配
        ok = response.toLowerCase().includes('仙途本') || response.toLowerCase().includes('ok');
      }
    } else {
      ok = response.toLowerCase().includes('仙途本') || response.toLowerCase().includes('ok');
    }

    apiTestResults.value[api.id] = ok ? 'success' : 'fail';

    if (ok) {
      toast.success(`${api.name} ${t('连接成功')}`);
    } else {
      toast.warning(`${api.name} ${t('响应异常')}`);
    }
  } catch (error) {
    apiTestResults.value[api.id] = 'fail';
    toast.error(`${api.name} ${t('连接失败')}: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    testingApiId.value = null;
  }
};

// 获取模型列表
const fetchModelsForEditing = async () => {
  if (isFetchingModels.value) return;
  if (!editingAPI.value.url || !editingAPI.value.apiKey) {
    toast.warning(t('请先填写API地址和密钥'));
    return;
  }

  isFetchingModels.value = true;
  try {
    // 临时设置配置
    const currentConfig = aiService.getConfig();
    aiService.saveConfig({
      mode: 'custom',
      customAPI: {
        provider: editingAPI.value.provider as APIProvider,
        url: editingAPI.value.url,
        apiKey: editingAPI.value.apiKey,
        model: editingAPI.value.model || 'gpt-4o',
        temperature: editingAPI.value.temperature || 0.7,
        maxTokens: editingAPI.value.maxTokens || 16000
      }
    });

    const models = await aiService.fetchModels();
    availableModels.value = models;
    showModelDropdown.value = true;
    toast.success(`${t('获取到')} ${models.length} ${t('个模型')}`);

    // 恢复配置
    aiService.saveConfig(currentConfig);
  } catch (error) {
    toast.error(t('获取模型列表失败'));
  } finally {
    isFetchingModels.value = false;
  }
};

// 保存API配置
const saveAPI = () => {
  if (!editingAPI.value.name) {
    toast.warning(t('请填写配置名称'));
    return;
  }

  if (showEditDialog.value && editingAPIId.value) {
    // 编辑模式
    apiStore.updateAPI(editingAPIId.value, editingAPI.value);
    toast.success(t('API配置已更新'));
  } else {
    // 新增模式
    const newConfig = {
      name: editingAPI.value.name!,
      provider: editingAPI.value.provider as APIProvider,
      url: editingAPI.value.url || getProviderPresetUrl(editingAPI.value.provider as APIProvider),
      apiKey: editingAPI.value.apiKey || '',
      model: editingAPI.value.model || getProviderPresetModel(editingAPI.value.provider as APIProvider),
      temperature: editingAPI.value.temperature || 0.7,
      maxTokens: editingAPI.value.maxTokens || getProviderPresetMaxTokens(editingAPI.value.provider as APIProvider),
      enabled: true,
      forceJsonOutput: editingAPI.value.forceJsonOutput || false
    };
    apiStore.addAPI(newConfig);
    toast.success(t('API配置已添加'));
  }

  closeDialogs();

  // 同步默认API配置到aiService
  syncDefaultAPIToService();
};

// 同步默认API到aiService
const syncDefaultAPIToService = () => {
  const defaultAPI = apiStore.apiConfigs.find(a => a.id === 'default');
  if (defaultAPI) {
    aiService.saveConfig({
      mode: 'custom',
      customAPI: {
        provider: defaultAPI.provider,
        url: defaultAPI.url,
        apiKey: defaultAPI.apiKey,
        model: defaultAPI.model,
        temperature: defaultAPI.temperature,
        maxTokens: defaultAPI.maxTokens,
        forceJsonOutput: defaultAPI.forceJsonOutput
      }
    });
  }
};

// 更新功能分配
const updateAssignment = (type: APIUsageType, apiId: string) => {
  apiStore.assignAPI(type, apiId);

  // 如果分配指令生成到独立API，自动开启分步生成
  if (type === 'instruction_generation' && apiId !== 'default') {
    if (!splitResponseGeneration.value) {
      splitResponseGeneration.value = true;
      saveSplitResponseSetting();
      toast.success('已自动开启分步生成（指令生成需要分步模式）');
    }
  }

  toast.success(`${getFunctionName(type)} ${t('已分配到')} ${apiStore.apiConfigs.find(a => a.id === apiId)?.name || 'API'}`);
};

// 关闭对话框
const closeDialogs = () => {
  showAddDialog.value = false;
  showEditDialog.value = false;
  editingAPIId.value = null;
  editingAPI.value = {
    name: '',
    provider: 'openai',
    url: '',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: getProviderPresetMaxTokens('openai'),
    enabled: true
  };
  availableModels.value = [];
};

// 导出配置
const handleExport = () => {
  const data = apiStore.exportConfig();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `仙途-API配置-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(t('API配置已导出'));
};

// 导入配置
const handleImport = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      apiStore.importConfig(data);
      syncDefaultAPIToService();
      toast.success(t('API配置已导入'));
    } catch (error) {
      toast.error(t('导入失败，请检查文件格式'));
    }
  };
  input.click();
};
</script>

<style scoped>
/* ============================================================
   API 管理 —— 令牌见 styles/xian-tokens.css，弹窗用 cc-modal
   ============================================================ */
.api-management-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--cc-shell-bg);
  color: var(--cc-text);
}

/* ---------- 头部 ---------- */
.panel-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  padding: 1.1rem 1.25rem 1rem;
  flex-shrink: 0;
  /* 覆盖 panel-theme.css 的通用卡片式头部 */
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--cc-border);
  border-radius: 0;
  backdrop-filter: none;
}

.panel-header::after {
  content: '';
  position: absolute;
  left: 1.25rem;
  right: 1.25rem;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--cc-gold-rgb), 0.55), transparent);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.header-emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(var(--cc-accent-rgb), 0.25) 0%, rgba(var(--cc-accent-rgb), 0.06) 75%);
  box-shadow: 0 0 0 1px rgba(var(--cc-gold-rgb), 0.5);
}

.header-emblem::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 1px dashed rgba(var(--cc-gold-rgb), 0.4);
}

.emblem-glyph {
  font-family: var(--cc-calligraphy);
  font-size: 1.35rem;
  line-height: 1;
  color: var(--cc-accent);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.panel-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--cc-text);
}

.settings-subtitle {
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: var(--cc-text-3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  /* 抵消全局 48px 圆形 .action-btn 样式 */
  width: auto !important;
  height: auto !important;
  min-width: 0;
  min-height: 34px;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 6px;
  background: var(--cc-surface-2);
  color: var(--cc-text);
  font-family: inherit;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, filter 0.2s ease;
}

.action-btn svg {
  color: var(--cc-gold);
}

.action-btn .btn-text {
  display: inline;
  width: auto;
  font-size: inherit;
  color: inherit;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--cc-surface-hover);
  border-color: rgba(var(--cc-gold-rgb), 0.6);
}

.action-btn.primary {
  border-color: var(--cc-primary-border);
  background: var(--cc-primary-bg);
  color: #fff;
  box-shadow: var(--cc-primary-shadow);
}

.action-btn.primary svg {
  color: #fff;
}

.action-btn.primary:hover {
  filter: brightness(1.1);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--cc-border);
  border-radius: 6px;
  background: var(--cc-surface-2);
  color: var(--cc-text-2);
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.icon-btn:hover:not(:disabled) {
  color: var(--cc-accent);
  border-color: rgba(var(--cc-accent-rgb), 0.45);
}

.icon-btn.danger:hover:not(:disabled) {
  color: var(--cc-danger);
  background: rgba(var(--cc-danger-rgb), 0.1);
  border-color: rgba(var(--cc-danger-rgb), 0.45);
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.icon-btn.close-panel {
  width: 34px;
  height: 34px;
  border-color: transparent;
  background: transparent;
}

.loading-pulse {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 内容 ---------- */
.settings-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.1rem 1.25rem 1.5rem;
}

.settings-section + .settings-section {
  margin-top: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.25rem 0.7rem;
}

.section-icon {
  flex-shrink: 0;
  color: var(--cc-gold);
}

.section-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  white-space: nowrap;
  color: var(--cc-text);
}

.section-rule {
  position: relative;
  flex: 1;
  height: 1px;
  margin-left: 0.4rem;
  background: linear-gradient(90deg, rgba(var(--cc-gold-rgb), 0.45), transparent);
}

.section-rule::before {
  content: '';
  position: absolute;
  left: -2px;
  top: -2px;
  width: 5px;
  height: 5px;
  background: var(--cc-gold);
  transform: rotate(45deg);
}

.section-count {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--cc-text-3);
}

.mode-badge {
  flex-shrink: 0;
  padding: 0.12rem 0.55rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.45);
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--cc-gold);
}

.mode-badge.web {
  color: var(--cc-accent);
  border-color: rgba(var(--cc-accent-rgb), 0.45);
}

/* ---------- API 卡片 ---------- */
.api-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.api-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.api-card:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.4);
  box-shadow: var(--cc-glow);
}

.api-card.default {
  border-color: rgba(var(--cc-gold-rgb), 0.35);
}

.api-card.disabled {
  opacity: 0.55;
}

.api-card-header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--cc-divider);
}

.api-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.api-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--cc-text);
}

.api-card.default .api-name::after {
  content: '默认';
  margin-left: 0.4rem;
  padding: 0 0.3rem;
  border-radius: 3px;
  background: var(--cc-seal);
  color: var(--cc-seal-text);
  font-size: 0.65rem;
  font-weight: 500;
  vertical-align: 2px;
}

.api-provider {
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  color: var(--cc-text-3);
}

.api-provider.tavern-tag {
  color: var(--cc-gold);
}

.api-actions {
  display: flex;
  gap: 0.3rem;
}

.api-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem 0.85rem;
}

.api-detail {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
  font-size: 0.8rem;
}

.detail-label {
  flex-shrink: 0;
  min-width: 2.5rem;
  color: var(--cc-text-3);
}

.detail-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--cc-text-2);
}

.detail-value.url {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.75rem;
}

.detail-value.success {
  color: var(--cc-success);
}

.detail-value.fail {
  color: var(--cc-danger);
}

.detail-value.unknown {
  color: var(--cc-text-3);
}

.tavern-api-hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--cc-gold);
}

.json-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--cc-text-2);
  cursor: pointer;
}

.json-toggle input,
.checkbox-label input {
  accent-color: var(--cc-accent);
}

.api-card-footer {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem 0.7rem;
  border-top: 1px dashed var(--cc-divider);
}

.assigned-label {
  font-size: 0.72rem;
  line-height: 1.6rem;
  color: var(--cc-text-3);
}

.assigned-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.function-tag {
  padding: 0.1rem 0.5rem;
  border: 1px solid rgba(var(--cc-gold-rgb), 0.35);
  border-radius: 999px;
  background: rgba(var(--cc-gold-rgb), 0.07);
  font-size: 0.72rem;
  color: var(--cc-gold);
}

/* 卡片开关 / 设置开关 */
.card-toggle,
.setting-switch {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  width: 38px;
  height: 20px;
}

.card-toggle input,
.setting-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider,
.switch-slider {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: var(--cc-inset);
  border: 1px solid var(--cc-border-strong);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.toggle-slider::before,
.switch-slider::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f5f2ea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.22s cubic-bezier(0.3, 1.4, 0.5, 1);
}

input:checked + .toggle-slider,
input:checked + .switch-slider {
  background: var(--cc-primary-bg);
  border-color: rgba(var(--cc-gold-rgb), 0.6);
}

input:checked + .toggle-slider::before,
input:checked + .switch-slider::before {
  transform: translateX(18px);
}

input:focus-visible + .toggle-slider,
input:focus-visible + .switch-slider {
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.3);
}

.setting-switch:not(.compact) {
  width: 42px;
  height: 22px;
}

.setting-switch:not(.compact) .switch-slider::before {
  width: 16px;
  height: 16px;
}

.setting-switch:not(.compact) input:checked + .switch-slider::before {
  transform: translateX(20px);
}

/* ---------- 区块说明 ---------- */
.section-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: -0.2rem 0.25rem 0.7rem;
  font-size: 0.78rem;
  line-height: 1.6;
  color: var(--cc-text-3);
}

.section-hint svg {
  flex-shrink: 0;
  margin-top: 0.2rem;
  color: var(--cc-gold);
}

/* ---------- 设置列表 ---------- */
.settings-list {
  border: 1px solid var(--cc-border);
  border-radius: 10px;
  background: var(--cc-surface);
  overflow: hidden;
}

.function-group-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.7rem 1rem 0.5rem;
  background: rgba(var(--cc-gold-rgb), 0.05);
  border-bottom: 1px solid var(--cc-divider);
}

.function-group-header:not(:first-child) {
  border-top: 1px solid var(--cc-border);
}

.group-title {
  position: relative;
  margin: 0;
  padding-left: 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--cc-gold);
}

.group-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 5px;
  height: 5px;
  background: var(--cc-gold);
  transform: translateY(-50%) rotate(45deg);
}

.group-desc {
  font-size: 0.72rem;
  color: var(--cc-text-3);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  transition: background 0.2s ease;
}

.setting-item:hover {
  background: var(--cc-surface-hover);
}

.setting-item + .setting-item {
  border-top: 1px solid var(--cc-divider);
}

/* 从属于上一个开关的子设置：缩进 + 金色引线 */
.setting-item.nested {
  position: relative;
  padding-left: 2.1rem;
  background: rgba(var(--cc-gold-rgb), 0.03);
  animation: nested-in 0.22s ease;
}

.setting-item.nested::before {
  content: '';
  position: absolute;
  left: 1.15rem;
  top: 0;
  bottom: 50%;
  width: 0.55rem;
  border-left: 1px solid rgba(var(--cc-gold-rgb), 0.5);
  border-bottom: 1px solid rgba(var(--cc-gold-rgb), 0.5);
  border-bottom-left-radius: 4px;
}

@keyframes nested-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.setting-item.tavern-locked {
  background: rgba(var(--cc-gold-rgb), 0.04);
}

.setting-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.setting-name {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--cc-text);
}

.setting-desc {
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--cc-text-3);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.inline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.toggle-label,
.input-hint,
.locked-text {
  font-size: 0.78rem;
  color: var(--cc-text-3);
}

.locked-badge,
.mode-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.02rem 0.4rem;
  border-radius: 3px;
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.locked-badge {
  background: rgba(var(--cc-gold-rgb), 0.15);
  color: var(--cc-gold);
}

.mode-indicator {
  border: 1px solid var(--cc-border);
  color: var(--cc-text-3);
}

.setting-select,
.setting-number-input {
  min-width: 150px;
  max-width: 100%;
  padding: 0.4rem 2rem 0.4rem 0.7rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 6px;
  background: var(--cc-inset) var(--cc-caret) no-repeat right 0.65rem center / 12px;
  color: var(--cc-text);
  font-family: inherit;
  font-size: 0.82rem;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.setting-select.mode-select {
  min-width: 84px;
}

.setting-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.setting-number-input {
  width: 72px;
  min-width: 0;
  padding-right: 0.5rem;
  background-image: none;
  text-align: center;
  cursor: text;
}

.setting-select:hover:not(:disabled),
.setting-number-input:hover {
  border-color: rgba(var(--cc-gold-rgb), 0.6);
}

.setting-select:focus-visible,
.setting-number-input:focus {
  outline: none;
  border-color: var(--cc-accent);
  box-shadow: 0 0 0 3px rgba(var(--cc-accent-rgb), 0.18);
}

/* ---------- 新增/编辑弹窗（外观见 cc-modal） ---------- */
.api-modal-overlay {
  z-index: 2100;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group > label {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--cc-text-2);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.model-select-wrapper {
  position: relative;
}

.model-input-row {
  display: flex;
  gap: 0.5rem;
}

.fetch-btn {
  flex-shrink: 0;
  padding-inline: 0.7rem;
}

.model-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 220px;
  overflow-y: auto;
  padding: 0.3rem;
  border: 1px solid var(--cc-border-strong);
  border-radius: 6px;
  background: var(--cc-shell-bg);
  box-shadow: var(--cc-shell-shadow);
}

.model-dropdown-item {
  padding: 0.45rem 0.6rem;
  border-radius: 4px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.8rem;
  color: var(--cc-text-2);
  cursor: pointer;
}

.model-dropdown-item:hover {
  background: var(--cc-surface-hover);
  color: var(--cc-text);
}

.model-dropdown-item.active {
  color: var(--cc-accent);
  background: rgba(var(--cc-accent-rgb), 0.1);
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  color: var(--cc-text);
  cursor: pointer;
}

.form-hint {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--cc-divider);
  border-radius: 6px;
  background: var(--cc-surface);
  font-size: 0.76rem;
  line-height: 1.7;
  color: var(--cc-text-3);
}

.hint-warning {
  color: var(--cc-warning);
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .panel-header {
    padding: 0.9rem 0.9rem 0.8rem;
  }

  .settings-subtitle {
    display: none;
  }

  .header-actions .action-btn {
    padding: 0.4rem 0.6rem;
  }

  .settings-container {
    padding: 0.9rem 0.75rem 1.25rem;
  }

  .api-list {
    grid-template-columns: 1fr;
  }

  .setting-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }

  .setting-control {
    justify-content: flex-end;
  }

  .setting-select {
    flex: 1;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .header-actions .btn-text {
    display: none;
  }
}
</style>
