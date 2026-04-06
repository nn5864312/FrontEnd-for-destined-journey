import { FC, useState } from 'react';
import { useDeleteConfirm } from '../../core/hooks';
import { useEditorSettingStore } from '../../core/stores';
import {
  Ascension,
  Card,
  DeleteConfirmModal,
  DetailSheet,
  EditableField,
  ResourceBar,
  StatusEffectDisplay,
} from '../../shared/components';
import { withMvuData, WithMvuDataProps } from '../../shared/hoc';
import styles from './StatusTab.module.scss';

/** 字段类型 */
type FieldType = 'text' | 'number' | 'tags' | 'select';
type DetailKey = 'status-effects' | 'ascension' | 'life-skills';

/** 基础信息字段配置 */
interface BasicInfoFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  editable: boolean;
  defaultValue: string | number | string[];
  prefix?: string;
}

interface LifeSkillViewModel {
  key: LifeSkillKey;
  label: LifeSkillKey;
  level: string;
  currentExp: number;
  maxExp: number;
  mastery: number;
  progress: number;
  active: boolean;
  pathBase: string;
}

// 基础信息字段
const BasicInfoFields: BasicInfoFieldConfig[] = [
  { key: '种族', label: '种族', type: 'text', editable: true, defaultValue: '未知' },
  { key: '职业', label: '职业', type: 'tags', editable: true, defaultValue: [] },
  { key: '身份', label: '身份', type: 'tags', editable: true, defaultValue: [] },
  { key: '生命层级', label: '生命层级', type: 'text', editable: false, defaultValue: '第一层级' },
  { key: '等级', label: '等级', type: 'number', editable: false, defaultValue: 1, prefix: 'Lv.' },
  { key: '冒险者等级', label: '冒险者等级', type: 'text', editable: true, defaultValue: '未评级' },
];

// 资源条配置
const ResourceFields = [
  { label: 'HP', currentKey: '生命值', maxKey: '生命值上限', type: 'hp' as const },
  { label: 'MP', currentKey: '法力值', maxKey: '法力值上限', type: 'mp' as const },
  { label: 'SP', currentKey: '体力值', maxKey: '体力值上限', type: 'sp' as const },
] as const;

const LifeSkillOrder = [
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

type LifeSkillKey = (typeof LifeSkillOrder)[number];

const DEFAULT_LIFE_SKILL_LEVEL = '初学者 1';

const normalizeLifeSkillLevel = (value: unknown) => {
  const normalized = _.trim(_.toString(value ?? ''));
  return normalized || DEFAULT_LIFE_SKILL_LEVEL;
};

const normalizeLifeSkillNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

const getLifeSkillProgress = (currentExp: number, maxExp: number) => {
  const safeMax = Math.max(maxExp, 1);
  const safeCurrent = _.clamp(currentExp, 0, safeMax);
  return Math.round((safeCurrent / safeMax) * 100);
};

const isLifeSkillActive = (entry: { level: string; currentExp: number; mastery: number }) =>
  entry.mastery > 0 || entry.currentExp > 0 || entry.level !== DEFAULT_LIFE_SKILL_LEVEL;

/**
 * 状态页内容组件
 */
const StatusTabContent: FC<WithMvuDataProps> = ({ data }) => {
  const editEnabled = useEditorSettingStore(state => state.editEnabled);
  const { deleteTarget, setDeleteTarget, handleDelete, cancelDelete, isConfirmOpen } =
    useDeleteConfirm();
  const [activeDetail, setActiveDetail] = useState<DetailKey | null>(null);
  const player = data.主角;

  /**
   * 格式化基础信息显示值
   */
  const formatDisplayValue = (field: BasicInfoFieldConfig) => {
    const value = _.get(player, field.key);

    if (field.type === 'tags') {
      if (_.isArray(value) && value.length > 0) {
        return value.join(' / ');
      }
      return '无';
    }

    const displayValue = value ?? field.defaultValue ?? '';
    if (displayValue === '') {
      return '无';
    }
    return field.prefix ? `${field.prefix}${displayValue}` : displayValue;
  };

  /**
   * 渲染基础信息字段
   */
  const renderBasicInfoField = (field: BasicInfoFieldConfig) => {
    const value = _.get(player, field.key);
    const path = `主角.${field.key}`;

    if (!editEnabled || !field.editable) {
      return (
        <div key={field.key} className={styles.basicInfoRow}>
          <span className={styles.basicInfoLabel}>{field.label}</span>
          <span className={styles.basicInfoValue}>{formatDisplayValue(field)}</span>
        </div>
      );
    }

    return (
      <div key={field.key} className={styles.basicInfoRow}>
        <span className={styles.basicInfoLabel}>{field.label}</span>
        <EditableField path={path} value={value ?? field.defaultValue} type={field.type} />
      </div>
    );
  };

  /**
   * 渲染资源值（编辑模式下可调整当前值和上限）
   */
  const renderResourceField = (field: (typeof ResourceFields)[number]) => {
    const current = _.get(player, field.currentKey, 0);
    const max = _.get(player, field.maxKey, 0);

    if (!editEnabled) {
      return (
        <ResourceBar
          key={field.type}
          label={field.label}
          current={current}
          max={max}
          type={field.type}
        />
      );
    }

    return (
      <div key={field.type} className={styles.resourceEditRow}>
        <span className={styles.resourceLabel}>{field.label}</span>
        <div className={styles.resourceEditors}>
          <EditableField
            path={`主角.${field.currentKey}`}
            value={current}
            type="number"
            numberConfig={{ min: 0, max: max, step: 1 }}
          />
          <span className={styles.resourceSeparator}>/</span>
          <EditableField
            path={`主角.${field.maxKey}`}
            value={max}
            type="number"
            numberConfig={{ min: 0, step: 1 }}
          />
        </div>
      </div>
    );
  };

  const statusEffects = player.状态效果 ?? {};
  const effectEntries = Object.entries(statusEffects);
  const effectStats = {
    total: effectEntries.length,
  };

  const ascension = player.登神长阶;
  const ascensionParts = [
    Object.keys(ascension?.要素 ?? {}).length
      ? `要素 ${Object.keys(ascension?.要素 ?? {}).length}`
      : '',
    Object.keys(ascension?.权能 ?? {}).length
      ? `权能 ${Object.keys(ascension?.权能 ?? {}).length}`
      : '',
    Object.keys(ascension?.法则 ?? {}).length
      ? `法则 ${Object.keys(ascension?.法则 ?? {}).length}`
      : '',
    ascension?.神位 ? `神位 ${ascension.神位}` : '',
    ascension?.神国?.名称 ? `神国 ${ascension.神国.名称}` : '',
  ];

  const ascensionSummary = ascension?.是否开启
    ? _.compact(ascensionParts).join(' · ') || '已开启'
    : '未开启';

  const lifeSkillState = player.生活职业;
  const lifeSkillEntries = LifeSkillOrder.map((name): LifeSkillViewModel => {
    const raw = _.get(lifeSkillState, `分类.${name}`, {});
    const level = normalizeLifeSkillLevel(_.get(raw, '等级'));
    const currentExp = normalizeLifeSkillNumber(_.get(raw, '当前经验'), 0);
    const maxExp = Math.max(normalizeLifeSkillNumber(_.get(raw, '升级所需经验'), 100), 1);
    const mastery = normalizeLifeSkillNumber(_.get(raw, '熟练度'), 0);

    return {
      key: name,
      label: name,
      level,
      currentExp,
      maxExp,
      mastery,
      progress: getLifeSkillProgress(currentExp, maxExp),
      active: isLifeSkillActive({ level, currentExp, mastery }),
      pathBase: `主角.生活职业.分类.${name}`,
    };
  });

  const rankedLifeSkillEntries = [...lifeSkillEntries].sort(
    (a, b) => b.mastery - a.mastery || b.progress - a.progress || b.currentExp - a.currentExp,
  );
  const activeLifeSkillEntries = rankedLifeSkillEntries.filter(item => item.active);
  const lifeSkillCategoryCount = lifeSkillEntries.length;
  const lifeSkillRecordedCount = activeLifeSkillEntries.length;
  const lifeSkillTotalMastery = normalizeLifeSkillNumber(
    _.get(lifeSkillState, '总熟练度'),
    _.sumBy(lifeSkillEntries, item => item.mastery),
  );
  const lifeSkillPrimary =
    _.trim(_.get(lifeSkillState, '当前主修', '')) || activeLifeSkillEntries[0]?.label || '未设定';
  const lifeSkillPreviewEntries = activeLifeSkillEntries.slice(0, 3);
  const lifeSkillSummary = lifeSkillRecordedCount
    ? `主修 ${lifeSkillPrimary} · 总熟练度 ${lifeSkillTotalMastery} · 已记录 ${lifeSkillRecordedCount}/${lifeSkillCategoryCount}`
    : `黑沙式生活信息面板 · ${lifeSkillCategoryCount} 项分类待记录`;
  const lifeSkillSheetSubtitle = `当前主修 ${lifeSkillPrimary} · 总熟练度 ${lifeSkillTotalMastery} · 已记录 ${lifeSkillRecordedCount}/${lifeSkillCategoryCount}`;

  const renderLifeSkillCard = (entry: LifeSkillViewModel) => (
    <div key={entry.key} className={styles.lifeSkillCard}>
      <div className={styles.lifeSkillCardHeader}>
        <div className={styles.lifeSkillCardTitleGroup}>
          <span className={styles.lifeSkillCardTitle}>{entry.label}</span>
          <span className={styles.lifeSkillCardLevel}>{entry.level}</span>
        </div>
        <span className={styles.lifeSkillCardMastery}>熟练度 {entry.mastery}</span>
      </div>

      <div className={styles.lifeSkillBar} aria-hidden="true">
        <div className={styles.lifeSkillBarFill} style={{ width: `${entry.progress}%` }} />
      </div>

      <div className={styles.lifeSkillExpRow}>
        <span className={styles.lifeSkillExpText}>当前 EXP</span>
        <span className={styles.lifeSkillExpValue}>
          {entry.currentExp} / {entry.maxExp}
        </span>
      </div>

      {editEnabled ? (
        <div className={styles.lifeSkillEditorGrid}>
          <div className={styles.lifeSkillEditorRow}>
            <span className={styles.lifeSkillEditorLabel}>等级</span>
            <EditableField path={`${entry.pathBase}.等级`} value={entry.level} type="text" />
          </div>
          <div className={styles.lifeSkillEditorRow}>
            <span className={styles.lifeSkillEditorLabel}>当前 EXP</span>
            <EditableField
              path={`${entry.pathBase}.当前经验`}
              value={entry.currentExp}
              type="number"
              numberConfig={{ min: 0, step: 1 }}
            />
          </div>
          <div className={styles.lifeSkillEditorRow}>
            <span className={styles.lifeSkillEditorLabel}>升级 EXP</span>
            <EditableField
              path={`${entry.pathBase}.升级所需经验`}
              value={entry.maxExp}
              type="number"
              numberConfig={{ min: 1, step: 1 }}
            />
          </div>
          <div className={styles.lifeSkillEditorRow}>
            <span className={styles.lifeSkillEditorLabel}>熟练度</span>
            <EditableField
              path={`${entry.pathBase}.熟练度`}
              value={entry.mastery}
              type="number"
              numberConfig={{ min: 0, step: 1 }}
            />
          </div>
        </div>
      ) : (
        <div className={styles.lifeSkillFootnote}>
          {entry.active
            ? `进度 ${entry.progress}%`
            : '未记录进度，可在编辑模式中填写等级、熟练度与经验值。'}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.statusTab}>
      <Card className={`${styles.statusTabCard} ${styles.overviewCard}`}>
        <div className={styles.overviewHeader}>
          <div className={styles.overviewHeading}>
            <span className={styles.overviewEyebrow}>角色总览</span>
            <div className={styles.overviewTitleRow}>
              <div className={styles.overviewIdentityBlock}>
                <div className={styles.overviewIdentityTopRow}>
                  <span className={styles.overviewLevel}>Lv.{player.等级 ?? 1}</span>
                  <span className={styles.overviewTier}>{player.生命层级 || '未记录生命层级'}</span>
                </div>
                <span className={styles.overviewSubtitle}>
                  {player.冒险者等级 || '未评级冒险者'}
                </span>
              </div>
            </div>

            <div className={styles.overviewStats}>
              {_.map(player.属性, (value, key) => (
                <div key={key} className={styles.overviewStatItem}>
                  <span className={styles.overviewStatLabel}>{key}</span>
                  {editEnabled ? (
                    <EditableField
                      path={`主角.属性.${key}`}
                      value={value ?? 0}
                      type="number"
                      numberConfig={{ min: 0, max: 20, step: 1 }}
                    />
                  ) : (
                    <span className={styles.overviewStatValue}>{value ?? 0}</span>
                  )}
                </div>
              ))}
              <div className={styles.overviewStatItem}>
                <span className={styles.overviewStatLabel}>属性点</span>
                {editEnabled ? (
                  <EditableField
                    path="主角.属性点"
                    value={player.属性点 ?? 0}
                    type="number"
                    numberConfig={{ min: 0, step: 1 }}
                  />
                ) : (
                  <span className={styles.overviewStatValue}>{player.属性点 ?? 0}</span>
                )}
              </div>
            </div>

            <div className={styles.overviewSummaryGrid}>
              <div className={styles.overviewSummaryItem}>
                <span className={styles.overviewStatLabel}>状态效果</span>
                <StatusEffectDisplay
                  effects={statusEffects}
                  mode="chips"
                  maxVisible={4}
                  showRemainingCount
                  emptyText="无效果"
                />
              </div>
              <div className={styles.overviewSummaryItem}>
                <span className={styles.overviewStatLabel}>登神长阶</span>
                <span className={styles.overviewStatSummary}>{ascensionSummary}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.resources}>
          {editEnabled ? (
            <>
              {ResourceFields.map(field => renderResourceField(field))}
              <div className={styles.resourceEditRow}>
                <span className={styles.resourceLabel}>EXP</span>
                <div className={styles.resourceEditors}>
                  <EditableField
                    path="主角.累计经验值"
                    value={player.累计经验值 ?? 0}
                    type="number"
                    numberConfig={{
                      min: 0,
                      max: undefined,
                      step: 1,
                    }}
                  />
                  <span className={styles.resourceSeparator}>/</span>
                  <EditableField
                    path="主角.升级所需经验"
                    value={player.升级所需经验 ?? 0}
                    type="number"
                    numberConfig={{
                      min: 0,
                      step: 1,
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {ResourceFields.map(field => (
                <ResourceBar
                  key={field.type}
                  label={field.label}
                  current={_.get(player, field.currentKey, 0)}
                  max={_.get(player, field.maxKey, 0)}
                  type={field.type}
                />
              ))}
              <ResourceBar
                label="EXP"
                current={player.累计经验值 ?? 0}
                max={_.isNumber(player.升级所需经验) ? player.升级所需经验 : 999}
                type="exp"
              />
            </>
          )}
        </div>
      </Card>

      <div className={styles.primaryGrid}>
        <Card title="角色档案" className={styles.statusTabCard}>
          <div className={styles.basicInfo}>{BasicInfoFields.map(field => renderBasicInfoField(field))}</div>
        </Card>
      </div>

      <div className={styles.secondaryStack}>
        <button
          className={styles.detailEntryCard}
          onClick={() => setActiveDetail('status-effects')}
          type="button"
        >
          <div className={styles.detailEntryHeader}>
            <div>
              <div className={styles.detailEntryTitle}>状态效果</div>
              <div className={styles.detailEntrySummary}>
                <StatusEffectDisplay
                  effects={statusEffects}
                  mode="chips"
                  compact
                  maxVisible={4}
                  showRemainingCount
                  emptyText="无效果"
                />
              </div>
            </div>
            <div className={styles.detailEntryMeta}>
              <span className={styles.detailEntryCount}>{effectStats.total}</span>
              <i className={`fa-solid fa-chevron-right ${styles.detailEntryChevron}`} />
            </div>
          </div>
        </button>

        <button
          className={styles.detailEntryCard}
          onClick={() => setActiveDetail('ascension')}
          type="button"
        >
          <div className={styles.detailEntryHeader}>
            <div>
              <div className={styles.detailEntryTitle}>登神长阶</div>
              <div className={styles.detailEntrySummary}>{ascensionSummary}</div>
            </div>
            <div className={styles.detailEntryMeta}>
              <span className={styles.detailEntryCount}>
                {ascension?.是否开启 ? '已开启' : '未开启'}
              </span>
              <i className={`fa-solid fa-chevron-right ${styles.detailEntryChevron}`} />
            </div>
          </div>
        </button>

        <button
          className={styles.detailEntryCard}
          onClick={() => setActiveDetail('life-skills')}
          type="button"
        >
          <div className={styles.detailEntryHeader}>
            <div>
              <div className={styles.detailEntryTitle}>生活职业</div>
              <div className={styles.lifeSkillEntryHeadline}>{lifeSkillSummary}</div>
              {lifeSkillPreviewEntries.length > 0 ? (
                <div className={styles.lifeSkillPreviewList}>
                  {lifeSkillPreviewEntries.map(item => (
                    <span key={item.key} className={styles.lifeSkillPreviewChip}>
                      <span className={styles.lifeSkillPreviewName}>{item.label}</span>
                      <span className={styles.lifeSkillPreviewLevel}>{item.level}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className={styles.detailEntrySummary}>已预设 11 项黑沙式生活分类，等待填写等级与经验。</div>
              )}
            </div>
            <div className={styles.detailEntryMeta}>
              <span className={styles.detailEntryCount}>{lifeSkillRecordedCount || lifeSkillCategoryCount}</span>
              <i className={`fa-solid fa-chevron-right ${styles.detailEntryChevron}`} />
            </div>
          </div>
        </button>
      </div>

      <DetailSheet
        open={activeDetail === 'status-effects'}
        title="状态效果"
        subtitle={effectStats.total ? Object.keys(statusEffects).join('、') : '无效果'}
        onClose={() => setActiveDetail(null)}
      >
        <StatusEffectDisplay
          effects={statusEffects}
          editEnabled={editEnabled}
          pathPrefix="主角.状态效果"
          onDelete={(name: string) =>
            setDeleteTarget({
              type: '状态效果',
              path: `主角.状态效果.${name}`,
              name,
            })
          }
        />
      </DetailSheet>

      <DetailSheet
        open={activeDetail === 'ascension'}
        title="登神长阶"
        subtitle={ascensionSummary}
        onClose={() => setActiveDetail(null)}
      >
        <Ascension data={player.登神长阶} editEnabled={editEnabled} pathPrefix="主角.登神长阶" />
      </DetailSheet>

      <DetailSheet
        open={activeDetail === 'life-skills'}
        title="生活职业"
        subtitle={lifeSkillSheetSubtitle}
        onClose={() => setActiveDetail(null)}
      >
        <div className={styles.lifeSkillsSheet}>
          <div className={styles.lifeSkillHero}>
            <div className={styles.lifeSkillHeroHeader}>
              <span className={styles.lifeSkillHeroEyebrow}>Black Desert 风格生活信息</span>
              <div className={styles.lifeSkillHeroTitle}>分类等级 · 熟练度 · 经验进度</div>
              <div className={styles.lifeSkillHeroDescription}>
                面板结构参考黑色沙漠 Life Skill 信息页，先提供静态字段与可编辑展示，不接自动升级逻辑。
              </div>
            </div>

            <div className={styles.lifeSkillHeroCards}>
              <div className={styles.lifeSkillHeroCard}>
                <span className={styles.lifeSkillHeroCardLabel}>当前主修</span>
                {editEnabled ? (
                  <EditableField
                    path="主角.生活职业.当前主修"
                    value={_.get(lifeSkillState, '当前主修', '')}
                    type="text"
                  />
                ) : (
                  <span className={styles.lifeSkillHeroCardValue}>{lifeSkillPrimary}</span>
                )}
              </div>
              <div className={styles.lifeSkillHeroCard}>
                <span className={styles.lifeSkillHeroCardLabel}>总熟练度</span>
                <span className={styles.lifeSkillHeroCardValue}>{lifeSkillTotalMastery}</span>
                <span className={styles.lifeSkillHeroCardHint}>按各分类熟练度汇总显示</span>
              </div>
              <div className={styles.lifeSkillHeroCard}>
                <span className={styles.lifeSkillHeroCardLabel}>已记录进度</span>
                <span className={styles.lifeSkillHeroCardValue}>
                  {lifeSkillRecordedCount}/{lifeSkillCategoryCount}
                </span>
                <span className={styles.lifeSkillHeroCardHint}>默认预设全部黑沙生活分类</span>
              </div>
            </div>
          </div>

          <div className={styles.lifeSkillGrid}>{lifeSkillEntries.map(renderLifeSkillCard)}</div>
        </div>
      </DetailSheet>

      <DeleteConfirmModal
        open={isConfirmOpen}
        target={deleteTarget}
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

/**
 * 状态页组件（使用 HOC 包装）
 */
export const StatusTab = withMvuData({ baseClassName: styles.statusTab })(StatusTabContent);
