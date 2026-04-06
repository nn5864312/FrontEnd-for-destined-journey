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

      try {
        const messageId = getCurrentMessageId();

        // 获取当前消息楼层的变量数据
        const variables = getVariables({
          type: 'message',
          message_id: messageId,
        });

        // 提取并解析 stat_data
        const rawData = _.get(variables, 'stat_data', {});
        const result = Schema.safeParse(rawData);

        if (!result.success) {
          console.warn('[StatusBar] 数据校验失败:', result.error);
          set(state => {
            state.error = `数据格式错误：${result.error.message || '未知错误'}`;
            state.loading = false;
          });

          return;
        }

        // 关键迁移：若 schema 补出了旧树缺失的字段（如生活职业），
        // 则将规范化后的 stat_data 真正写回底层变量，避免仅显示层有默认值、
        // 下一轮 patch 仍基于旧树执行的问题。
        if (!_.isEqual(rawData, result.data)) {
          void (async () => {
            try {
              await waitGlobalInitialized('Mvu');
              const mvuData = Mvu.getMvuData({
                type: 'message',
                message_id: messageId,
              });

              _.set(mvuData, 'stat_data', result.data);

              await Mvu.replaceMvuData(mvuData, {
                type: 'message',
                message_id: messageId,
              });

              console.log('[StatusBar] 已将 schema 规范化结果写回原始 stat_data');
            } catch (e) {
              console.error('[StatusBar] 写回规范化 stat_data 失败:', e);
            }
          })();
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
