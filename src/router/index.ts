/**
 * 仙途 (XianTu) - 路由配置
 * @author 千夜 | GitHub: qianye60 | Bilibili: 477576651
 * @license CC BY-NC-SA 4.0 - 商业使用需授权
 */
import { createRouter, createMemoryHistory } from 'vue-router';
import ModeSelection from '../views/ModeSelection.vue';
import CharacterCreation from '../views/CharacterCreation.vue';
import LoginView from '../views/LoginView.vue';
import WorkshopView from '../views/WorkshopView.vue';
import GameView from '../views/GameView.vue';
import AccountCenter from '../views/AccountCenter.vue';

// 创建一个包装组件来传递fullscreen属性
import { h } from 'vue';
import { useRouter } from 'vue-router';
import CharacterManagement from '../components/character-creation/CharacterManagement.vue';

const FullscreenCharacterManagement = {
  setup() {
    const router = useRouter();

    const handleClose = () => {
      router.push('/');
    };

    const handleCharacterSelected = () => {
      router.push('/game');
    };

    return () =>
      h(CharacterManagement, {
        fullscreen: true,
        onClose: handleClose,
        onCharacterSelected: handleCharacterSelected,
      });
  },
};

// 静态导入所有组件，避免代码分割
import MainGamePanel from '../components/dashboard/MainGamePanel.vue';
import MemoryCenterPanel from '../components/dashboard/MemoryCenterPanel.vue';
import CharacterPage from '../views/game/CharacterPage.vue';
import NpcsPage from '../views/game/NpcsPage.vue';
import InventoryPage from '../views/game/InventoryPage.vue';
import TechniquesPage from '../views/game/TechniquesPage.vue';
import ThousandDaoPage from '../views/game/ThousandDaoPage.vue';
import SettingsPanel from '../components/dashboard/SettingsPanel.vue';
import SavePage from '../views/game/SavePage.vue';
import WorldMapRoute from '../components/dashboard/WorldMapRoute.vue';
import EventsPage from '../views/game/EventsPage.vue';
import CraftingPage from '../views/game/CraftingPage.vue';
import SectPanel from '../components/dashboard/SectPanel.vue';
import SectSystemPanel from '../components/dashboard/SectSystemPanel.vue';
import SectMembersContent from '../components/dashboard/components/SectMembersContent.vue';
import SectLibraryContent from '../components/dashboard/components/SectLibraryContent.vue';
import SectContributionContent from '../components/dashboard/components/SectContributionContent.vue';
import SectTasksContent from '../components/dashboard/components/SectTasksContent.vue';
import SectManagementContent from '../components/dashboard/components/SectManagementContent.vue';
import GameVariablePanel from '../components/dashboard/GameVariablePanel.vue';
import PromptManagementPanel from '../components/dashboard/PromptManagementPanel.vue';
import APIManagementPanel from '../components/dashboard/APIManagementPanel.vue';

const routes = [
  {
    path: '/',
    name: 'ModeSelection',
    component: ModeSelection,
  },
  {
    path: '/creation',
    name: 'CharacterCreation',
    component: CharacterCreation,
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
  },
  {
    path: '/workshop',
    name: 'Workshop',
    component: WorkshopView,
  },
  {
    path: '/account',
    name: 'AccountCenter',
    component: AccountCenter,
  },
  {
    // 提示词管理 - 独立顶级路由，不需要加载游戏数据
    path: '/prompts',
    name: 'PromptsStandalone',
    component: PromptManagementPanel,
  },
  {
    path: '/game',
    name: 'Game',
    component: GameView,
    children: [
      {
        path: '',
        name: 'GameMain',
        component: MainGamePanel,
      },
      {
        path: 'memory',
        name: 'Memory',
        component: MemoryCenterPanel,
      },
      {
        path: 'character-details',
        name: 'CharacterDetails',
        component: CharacterPage,
      },
      {
        path: 'npcs',
        name: 'Npcs',
        component: NpcsPage,
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: InventoryPage,
      },
      {
        path: 'techniques',
        name: 'Techniques',
        component: TechniquesPage,
      },
      {
        path: 'thousand-dao',
        name: 'ThousandDao',
        component: ThousandDaoPage,
      },
      {
        path: 'settings',
        name: 'Settings',
        component: SettingsPanel,
      },
      {
        path: 'save',
        name: 'Save',
        component: SavePage,
      },
      {
        path: 'world-map',
        name: 'WorldMap',
        component: WorldMapRoute,
      },
      {
        path: 'events',
        name: 'Events',
        component: EventsPage,
      },
      {
        path: 'crafting',
        name: 'Crafting',
        component: CraftingPage,
      },
      {
        path: 'sect',
        name: 'Sect',
        component: SectSystemPanel,
        children: [
          {
            path: '',
            redirect: { name: 'SectOverview' },
          },
          {
            path: 'overview',
            name: 'SectOverview',
            component: SectPanel,
          },
          {
            path: 'members',
            name: 'SectMembers',
            component: SectMembersContent,
          },
          {
            path: 'management',
            name: 'SectManagement',
            component: SectManagementContent,
          },
          {
            path: 'library',
            name: 'SectLibrary',
            component: SectLibraryContent,
          },
          {
            path: 'tasks',
            name: 'SectTasks',
            component: SectTasksContent,
          },
          {
            path: 'contribution',
            name: 'SectContribution',
            component: SectContributionContent,
          },
        ],
      },
      {
        path: 'game-variables',
        name: 'GameVariables',
        component: GameVariablePanel,
      },
      {
        path: 'prompts',
        name: 'Prompts',
        component: PromptManagementPanel,
      },
      {
        path: 'api-management',
        name: 'APIManagement',
        component: APIManagementPanel,
      },
    ],
  },
  {
    path: '/management',
    name: 'CharacterManagement',
    component: FullscreenCharacterManagement,
  },
];

const router = createRouter({
  history: createMemoryHistory(),
  routes,
});

export default router;
