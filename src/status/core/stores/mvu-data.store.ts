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

const VARIABLE_OPTION = {
  type: 'message' as const,
  message_id: -1,
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
  分类: Object.fromEntries(LIFE_SKILL_NAMES.map(name => [name, DEFAULT_LIFE_SKILL_ENTRY()])) as Record<
    string,
    LifeSkillEntry
  >,
});

const ensureLifeSkillTree = (rawData: unknown): { nextRawData: Record<string, unknown>; changed: boolean } => {
  const baseData = _.isPlainObject(rawData) ? _.cloneDeep(rawData) : {};
  const nextRawData = baseData as Record<string, unknown>;

  const currentLifeSkills = _.get(nextRawData, '主角.生活职业');
  const defaultTree = createDefaultLifeSkillsTree();
  const normalizedLifeSkills = _.merge({}, defaultTree, _.isPlainObject(currentLifeSkills) ? currentLifeSkills : {});

  // 用户已不再使用旧字段，迁移时强制清掉，保证结构稳定。
  if (_.isPlainObject(normalizedLifeSkills)) {
    delete (normalizedLifeSkills as Record<string, unknown>).当前主修;
    delete (normalizedLifeSkills as Record<string, unknown>).总熟练度;
  }

  const changed = !_.isEqual(currentLifeSkills, normalizedLifeSkills);
  if (changed) {
    _.set(nextRawData, '主角.生活职业', normalizedLifeSkills);
  }

  return { nextRawData, changed };
};

const normalizeStatData = (
  rawData: unknown,
):
  | {
      success: true;
      data: StatData;
      changed: boolean;
    }
  | {
      success: false;
      error: unknown;
    } => {
  const { nextRawData, changed: treeChanged } = ensureLifeSkillTree(rawData);
  const result = Schema.safeParse(nextRawData);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  return {
    success: true,
    data: result.data,
    changed: treeChanged || !_.isEqual(nextRawData, result.data),
  };
};

const readRawStatData = (): unknown => _.get(getVariables(VARIABLE_OPTION), 'stat_data', {});

const writeStatData = async (statData: unknown): Promise<void> => {
  await Promise.resolve(
    updateVariablesWith(variables => {
      _.set(variables, 'stat_data', statData);
    }, VARIABLE_OPTION),
  );
};

const normalizePath = (path: string): string => {
  if (!path) {
    return path;
  }

  return path.startsWith('stat_data.') ? path.slice('stat_data.'.length) : path;
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
     *
     * 按 util/vue_mvu.ts 的思路：
     * - 固定读取 message:-1 的消息变量链
     * - 先对底层原始 stat_data 做硬迁移（补全主角.生活职业树）
     * - 再交给 Schema 规范化
     * - 若规范化结果与原始数据不同，则直接写回消息变量
     */
    refresh: () => {
      set(state => {
        state.loading = true;
      });

      void (async () => {
        try {
          await waitGlobalInitialized('Mvu');

          const rawData = readRawStatData();
          const normalized = normalizeStatData(rawData);

          if (!normalized.success) {
            console.warn('[StatusBar] 数据校验失败:', normalized.error);
            set(state => {
              state.error = '数据格式错误';
              state.loading = false;
            });
            return;
          }

          if (normalized.changed) {
            await writeStatData(normalized.data);
            console.log('[StatusBar] 已按 vue_mvu 风格同步并写回 stat_data');
          }

          set(state => {
            state.data = normalized.data;
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

        const normalizedPath = normalizePath(path);
        const rawData = readRawStatData();
        const { nextRawData } = ensureLifeSkillTree(rawData);
        _.set(nextRawData, normalizedPath, value);

        const normalized = normalizeStatData(nextRawData);
        if (!normalized.success) {
          console.warn('[StatusBar] 更新字段时数据校验失败:', normalized.error);
          return false;
        }

        await writeStatData(normalized.data);
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

        const normalizedPath = normalizePath(path);
        const rawData = readRawStatData();
        const { nextRawData } = ensureLifeSkillTree(rawData);
        _.unset(nextRawData, normalizedPath);

        const normalized = normalizeStatData(nextRawData);
        if (!normalized.success) {
          console.warn('[StatusBar] 删除字段时数据校验失败:', normalized.error);
          return false;
        }

        await writeStatData(normalized.data);
        get().refresh();
        return true;
      } catch (e) {
        console.error('[StatusBar] 删除数据失败:', e);
        return false;
      }
    },
  })),
);
