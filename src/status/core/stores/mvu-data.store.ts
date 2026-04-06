import { Schema } from '@/data_schema/schema';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { StatData } from '../types';

interface MvuDataState {
  /** MVU 数据 */
  data: StatData | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 最后刷新时间 */
  lastRefreshTime: Date | null;
}

interface MvuDataActions {
  /** 刷新数据 (Read) */
  refresh: () => void;
  /** 更新指定路径的值 */
  updateField: (path: string, value: unknown) => Promise<boolean>;
  /** 删除指定路径的值 */
  deleteField: (path: string) => Promise<boolean>;
}

type MvuDataStore = MvuDataState & MvuDataActions;

type LifeSkillEntry = {
  等级: string;
  当前经验: number;
  升级所需经验: number;
  熟练度: number;
};

type LifeSkillsTree = {
  分类: Record<string, LifeSkillEntry>;
};

const DEFAULT_LIFE_SKILL_ENTRY = (): LifeSkillEntry => ({
  等级: '初级 1',
  当前经验: 0,
  升级所需经验: 100,
  熟练度: 0,
});

const LIFE_SKILL_NAMES = [
  '采集',
  '钓鱼',
  '狩猎',
  '料理',
  '炼金',
  '加工',
  '驯养',
  '贸易',
  '耕种',
  '航海',
  '物物交换',
] as const;

const createDefaultLifeSkillsTree = (): LifeSkillsTree => ({
  分类: Object.fromEntries(LIFE_SKILL_NAMES.map(name => [name, DEFAULT_LIFE_SKILL_ENTRY()])) as Record<string, LifeSkillEntry>,
});

const ensureLifeSkillTree = (rawData: unknown): { nextRawData: Record<string, unknown>; changed: boolean } => {
  const baseData = _.isPlainObject(rawData) ? _.cloneDeep(rawData) : {};
  const nextRawData = baseData as Record<string, unknown>;

  const currentLifeSkills = _.get(nextRawData, '主角.生活职业');
  const defaultTree = createDefaultLifeSkillsTree();

  // 用户当前已不再使用“当前主修 / 总熟练度”，这里仅保证“分类 -> 11 项 -> 4 字段”存在。
  const normalizedLifeSkills = _.merge({}, defaultTree, _.isPlainObject(currentLifeSkills) ? currentLifeSkills : {});

  // 强制去掉旧结构残留字段，避免旧树与新树混用。
  if (_.isPlainObject(normalizedLifeSkills)) {
    delete (normalizedLifeSkills as Record<string, unknown>).当前主修;
    delete (normalizedLifeSkills as Record<string, unknown>).总熟练度;
  }

  const existedBefore = _.has(nextRawData, '主角.生活职业');
  const changed = !existedBefore || !_.isEqual(currentLifeSkills, normalizedLifeSkills);

  if (changed) {
    _.set(nextRawData, '主角.生活职业', normalizedLifeSkills);
  }

  return { nextRawData, changed };
};

const persistStatData = async (messageId: number, statData: unknown): Promise<void> => {
  await waitGlobalInitialized('Mvu');
  const mvuData = Mvu.getMvuData({
    type: 'message',
    message_id: messageId,
  });

  _.set(mvuData, 'stat_data', statData);

  await Mvu.replaceMvuData(mvuData, {
    type: 'message',
    message_id: messageId,
  });
};

export const useMvuDataStore = create<MvuDataStore>()(
  immer((set, get) => ({
    // State
    data: null,
    loading: true,
    error: null,
    lastRefreshTime: null,

    // Actions

    /**
     * 刷新数据
     */
    refresh: () => {
      set(state => {
        state.loading = true;
      });

      void (async () => {
        try {
          const messageId = getCurrentMessageId();

          // 获取当前消息楼层的变量数据
          const variables = getVariables({
            type: 'message',
            message_id: messageId,
          });

          // 提取原始 stat_data
          const rawData = _.get(variables, 'stat_data', {});

          // 方案 A：先对原始树做一次“硬迁移”，确保主角.生活职业完整存在，
          // 不再只依赖 schema.prefault 在显示层临时补默认值。
          const { nextRawData, changed: treeChanged } = ensureLifeSkillTree(rawData);

          if (treeChanged) {
            await persistStatData(messageId, nextRawData);
            console.log('[StatusBar] 已强制补全主角.生活职业树并写回原始 stat_data');
          }

          // 对“补树后”的原始数据再做 schema 规范化
          const result = Schema.safeParse(nextRawData);

          if (!result.success) {
            console.warn('[StatusBar] 数据校验失败:', result.error);
            set(state => {
              state.error = `数据格式错误：${result.error.message || '未知错误'}`;
              state.loading = false;
            });

            return;
          }

          // 若 schema 还补出了其它缺失字段，则同步等待写回，避免仅显示层有新树。
          if (!_.isEqual(nextRawData, result.data)) {
            await persistStatData(messageId, result.data);
            console.log('[StatusBar] 已将 schema 规范化结果写回原始 stat_data');
          }

          set(state => {
            state.data = result.data;
            state.loading = false;
            state.error = null;
            state.lastRefreshTime = new Date();
          });

          console.log('[StatusBar] 数据已刷新');
        } catch (e) {
          console.error('[StatusBar] 加载数据失败:', e);
          set(state => {
            state.error = e instanceof Error ? e.message : '未知错误';
            state.loading = false;
          });
        }
      })();
    },

    /**
     * 更新指定路径的值
     */
    updateField: async (path: string, value: unknown): Promise<boolean> => {
      try {
        await waitGlobalInitialized('Mvu');
        const mvuData = Mvu.getMvuData({
          type: 'message',
          message_id: getCurrentMessageId(),
        });

        // 更新值
        _.set(mvuData, `stat_data.${path}`, value);

        // 写回
        await Mvu.replaceMvuData(mvuData, {
          type: 'message',
          message_id: getCurrentMessageId(),
        });

        // 刷新本地状态
        get().refresh();

        return true;
      } catch (e) {
        console.error('[StatusBar] 更新数据失败:', e);
        return false;
      }
    },

    /**
     * 删除指定路径的值
     */
    deleteField: async (path: string): Promise<boolean> => {
      try {
        await waitGlobalInitialized('Mvu');
        const mvuData = Mvu.getMvuData({
          type: 'message',
          message_id: getCurrentMessageId(),
        });

        // 删除值
        _.unset(mvuData, `stat_data.${path}`);

        // 写回
        await Mvu.replaceMvuData(mvuData, {
          type: 'message',
          message_id: getCurrentMessageId(),
        });

        // 刷新本地状态
        get().refresh();

        return true;
      } catch (e) {
        console.error('[StatusBar] 删除数据失败:', e);
        return false;
      }
    },
  })),
);
