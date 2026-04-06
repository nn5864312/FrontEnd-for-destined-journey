/**
 * 限制数值范围
 * @param {number} val - 默认数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 */
export const clampedMum = (val: number, min: number, max: number) =>
  z.coerce
    .number()
    .prefault(val)
    .transform(val => _.clamp(val, min, max));

/**
 * 数字取整并限制最小值
 * @param {number} val - 默认数值
 * @param {number} min - 最小值
 */
export const minLimitedNum = (val: number, min: number) =>
  z.coerce
    .number()
    .prefault(val)
    .transform(val => Math.max(Math.round(val), min));

/**
 * 截取 record 的前 n 个条目
 * @param {Record<string, T>} record - 待截取的 record
 * @param {number} limit - 限制的条目数
 */
const sliceRecord = <T>(record: Record<string, T>, limit: number): Record<string, T> =>
  _.fromPairs(_.take(_.toPairs(record), limit));

/**
 * 任务 schema
 */
export const TaskSchema = z
  .object({
    状态: z.string().prefault(''),
    关注度: z.enum(['低', '中', '高']).prefault('中'),
    进展: z.string().prefault(''),
    详情: z.string().prefault(''),
    目标: z.string().prefault(''),
    奖励: z.string().prefault(''),
  })
  .prefault({});

/**
 * 基础物品 schema
 */
export const BaseItemSchema = z.object({
  品质: z.string().prefault(''),
  类型: z.string().prefault(''),
  标签: z
    .array(z.string())
    .prefault([])
    .transform(arr => _.uniq(arr))
    .optional(),
  效果: z.record(z.string(), z.string()).prefault({}),
  描述: z.string().prefault(''),
});

/**
 * 装备schema
 */
export const EquipmentSchema = BaseItemSchema.extend({
  部位: z.string().prefault(''),
  强化等级: z.string().prefault('+0'),
  强化保底进度: z.string().prefault('0'),
  耐久度: z.string().prefault('100'),
});

/**
 * 技能 schema
 */
export const SkillSchema = BaseItemSchema.extend({
  消耗: z.string().prefault(''),
}).transform(data => _.pick(data, ['品质', '类型', '消耗', '标签', '效果', '描述']));

/**
 * 状态效果 schema (增益/减益/特殊效果)
 */
export const StatusEffectSchema = z
  .object({
    类型: z.enum(['增益', '减益', '特殊']).prefault('增益'),
    效果: z.string().prefault(''),
    层数: z.coerce.number().prefault(1),
    剩余时间: z.string().prefault(''),
    来源: z.string().prefault(''),
  })
  .prefault({});

/**
 * 背包物品 schema
 */
export const InventoryItemSchema = BaseItemSchema.extend({
  数量: z.coerce.number().prefault(1),
}).transform(data => _.pick(data, ['品质', '类型', '数量', '标签', '效果', '描述']));

/**
 * 基础属性 schema
 */
const DefaultAttr = {
  力量: 0,
  敏捷: 0,
  体质: 0,
  智力: 0,
  精神: 0,
} as const;

export const BaseAttrSchema = z
  .object(_.mapValues(DefaultAttr, () => z.coerce.number().prefault(0)))
  .prefault({});


const DefaultLifeSkillCategories = {
  采集: {},
  钓鱼: {},
  狩猎: {},
  料理: {},
  炼金: {},
  加工: {},
  驯养: {},
  贸易: {},
  耕种: {},
  航海: {},
  物物交换: {},
} as const;

const LifeSkillRankMaxMap = {
  初级: 10,
  见习: 10,
  熟练: 10,
  专家: 10,
  匠人: 10,
  名匠: 30,
  道人: 50,
} as const;

const LifeSkillRankAliases: Record<string, keyof typeof LifeSkillRankMaxMap> = {
  初级: '初级',
  初級: '初级',
  初学者: '初级',
  初學者: '初级',
  Beginner: '初级',
  beginner: '初级',

  见习: '见习',
  見習: '见习',
  Apprentice: '见习',
  apprentice: '见习',

  熟练: '熟练',
  熟練: '熟练',
  Skilled: '熟练',
  skilled: '熟练',

  专家: '专家',
  專家: '专家',
  Professional: '专家',
  professional: '专家',

  匠人: '匠人',
  Artisan: '匠人',
  artisan: '匠人',

  名匠: '名匠',
  Master: '名匠',
  master: '名匠',

  道人: '道人',
  Guru: '道人',
  guru: '道人',
};

const LifeSkillLevelExpTable = {
  '初级 1': 100,
  '初级 2': 400,
  '初级 3': 600,
  '初级 4': 1200,
  '初级 5': 1900,
  '初级 6': 2900,
  '初级 7': 4000,
  '初级 8': 5400,
  '初级 9': 6900,
  '初级 10': 8600,
  '见习 1': 10600,
  '见习 2': 13100,
  '见习 3': 15900,
  '见习 4': 18800,
  '见习 5': 22000,
  '见习 6': 25400,
  '见习 7': 29100,
  '见习 8': 33000,
  '见习 9': 37100,
  '见习 10': 41500,
  '熟练 1': 46100,
  '熟练 2': 52300,
  '熟练 3': 58800,
  '熟练 4': 65600,
  '熟练 5': 72700,
  '熟练 6': 80100,
  '熟练 7': 87800,
  '熟练 8': 95800,
  '熟练 9': 104100,
  '熟练 10': 117400,
  '专家 1': 131200,
  '专家 2': 150200,
  '专家 3': 174600,
  '专家 4': 204600,
  '专家 5': 245100,
  '专家 6': 296500,
  '专家 7': 363900,
  '专家 8': 452600,
  '专家 9': 568100,
  '专家 10': 720800,
  '匠人 1': 873600,
  '匠人 2': 1074400,
  '匠人 3': 1339100,
  '匠人 4': 1641000,
  '匠人 5': 1990900,
  '匠人 6': 2452600,
  '匠人 7': 3015300,
  '匠人 8': 3663100,
  '匠人 9': 4470600,
  '匠人 10': 5490800,
  '名匠 1': 6511100,
  '名匠 2': 7536500,
  '名匠 3': 8567100,
  '名匠 4': 9603000,
  '名匠 5': 10644300,
  '名匠 6': 11691100,
  '名匠 7': 12743500,
  '名匠 8': 13801600,
  '名匠 9': 14865500,
  '名匠 10': 15935300,
  '名匠 11': 17011100,
  '名匠 12': 18093000,
  '名匠 13': 19181100,
  '名匠 14': 20275500,
  '名匠 15': 21376300,
  '名匠 16': 22483600,
  '名匠 17': 23597500,
  '名匠 18': 24718100,
  '名匠 19': 25845500,
  '名匠 20': 26979800,
  '名匠 21': 28121100,
  '名匠 22': 29269500,
  '名匠 23': 30425100,
  '名匠 24': 31588000,
  '名匠 25': 32758300,
  '名匠 26': 33936100,
  '名匠 27': 35121500,
  '名匠 28': 36314600,
  '名匠 29': 37515500,
  '名匠 30': 38724300,
  '道人 1': 39941100,
  '道人 2': 41166000,
  '道人 3': 42399100,
  '道人 4': 43640500,
  '道人 5': 44890300,
  '道人 6': 46148600,
  '道人 7': 47415500,
  '道人 8': 48691100,
  '道人 9': 49975500,
  '道人 10': 51268800,
  '道人 11': 52571100,
  '道人 12': 53882500,
  '道人 13': 55203100,
  '道人 14': 56533000,
  '道人 15': 57872300,
  '道人 16': 59221100,
  '道人 17': 60579500,
  '道人 18': 61947600,
  '道人 19': 63325500,
  '道人 20': 64713300,
  '道人 21': 66101100,
  '道人 22': 70000000,
  '道人 23': 71100000,
  '道人 24': 72300000,
  '道人 25': 73600000,
  '道人 26': 75000000,
  '道人 27': 76500000,
  '道人 28': 78100000,
  '道人 29': 79800000,
  '道人 30': 81600000,
  '道人 31': 83500000,
  '道人 32': 85500000,
  '道人 33': 87600000,
  '道人 34': 89800000,
  '道人 35': 92100000,
  '道人 36': 94000000,
  '道人 37': 95500000,
  '道人 38': 96700000,
  '道人 39': 97600000,
  '道人 40': 98200000,
  '道人 41': 98600000,
  '道人 42': 98900000,
  '道人 43': 99100000,
  '道人 44': 99250000,
  '道人 45': 99360000,
  '道人 46': 99450000,
  '道人 47': 99520000,
  '道人 48': 99580000,
  '道人 49': 99640000,
  '道人 50': 99700000,
} as const;

const DEFAULT_LIFE_SKILL_LEVEL = '初级 1';
const DEFAULT_LIFE_SKILL_EXP = LifeSkillLevelExpTable[DEFAULT_LIFE_SKILL_LEVEL];

const normalizeLifeSkillLevel = (value: unknown) => {
  const normalized = _.trim(_.toString(value ?? ''));
  if (!normalized) {
    return DEFAULT_LIFE_SKILL_LEVEL;
  }

  const match = normalized.match(/^([^\d]+)\s*(\d{1,2})$/);
  if (!match) {
    return DEFAULT_LIFE_SKILL_LEVEL;
  }

  const rankKey = _.trim(match[1]);
  const levelNum = Number(match[2]);
  const canonicalRank = LifeSkillRankAliases[rankKey];

  if (!canonicalRank) {
    return DEFAULT_LIFE_SKILL_LEVEL;
  }

  const safeLevel = _.clamp(Math.round(levelNum), 1, LifeSkillRankMaxMap[canonicalRank]);
  return `${canonicalRank} ${safeLevel}` as keyof typeof LifeSkillLevelExpTable;
};

const getLifeSkillExpByLevel = (level: string) =>
  LifeSkillLevelExpTable[level as keyof typeof LifeSkillLevelExpTable] ?? DEFAULT_LIFE_SKILL_EXP;

export const LifeSkillEntrySchema = z
  .object({
    等级: z.string().prefault(DEFAULT_LIFE_SKILL_LEVEL),
    当前经验: z.coerce.number().prefault(0),
    升级所需经验: z.coerce.number().prefault(DEFAULT_LIFE_SKILL_EXP),
    熟练度: z.coerce.number().prefault(0),
  })
  .prefault({})
  .transform(data => {
    const normalizedLevel = normalizeLifeSkillLevel(data.等级);

    return {
      等级: normalizedLevel,
      当前经验: Math.max(0, Math.round(data.当前经验)),
      升级所需经验: getLifeSkillExpByLevel(normalizedLevel),
      熟练度: Math.max(0, Math.round(data.熟练度)),
    };
  });

export const LifeSkillsSchema = z
  .object({
    当前主修: z.string().prefault(''),
    总熟练度: z.coerce.number().prefault(0),
    分类: z
      .object(_.mapValues(DefaultLifeSkillCategories, () => LifeSkillEntrySchema.prefault({})))
      .prefault({}),
  })
  .prefault({})
  .transform(data => ({
    当前主修: _.trim(data.当前主修 || ''),
    分类: _.mapValues(data.分类, item => {
      const normalizedLevel = normalizeLifeSkillLevel(item.等级);
      return {
        ...item,
        等级: normalizedLevel,
        升级所需经验: getLifeSkillExpByLevel(normalizedLevel),
      };
    }),
    总熟练度: Math.max(0, _.sumBy(_.values(data.分类), item => item.熟练度 ?? 0)),
  }));

/**
 * 登神长阶 schema
 *
 * 状态约束：
 * - 有法则时：权能和要素清空，不可再获得
 * - 有权能时：要素清空，不可再获得
 * - 正常情况（无权能 且 无法则）：可收集要素（最多3个）
 */
export const AscensionSchema = z
  .object({
    是否开启: z.boolean().prefault(false),
    要素: z.record(z.string(), z.record(z.string(), z.string())).prefault({}),
    权能: z.record(z.string(), z.record(z.string(), z.string())).prefault({}),
    法则: z.record(z.string(), z.record(z.string(), z.string())).prefault({}),
    神位: z.string().prefault(''),
    神国: z
      .object({
        名称: z.string().prefault(''),
        描述: z.string().prefault(''),
      })
      .prefault({}),
  })
  .prefault({})
  .transform(data => {
    const lawNum = _.size(data.法则);
    const powerNum = _.size(data.权能);
    const powerLimit = 1;
    const eleLimit = 3;
    const lawLimit = data.神国?.名称 ? Number.POSITIVE_INFINITY : data.神位 ? 2 : 1;

    // 有法则：权能和要素永久清空
    if (lawNum > 0) {
      return {
        ...data,
        要素: {},
        权能: {},
        法则: sliceRecord(data.法则, lawLimit),
      };
    }

    // 有权能：要素清空
    if (powerNum > 0) {
      return {
        ...data,
        要素: {},
        权能: sliceRecord(data.权能, powerLimit),
        法则: sliceRecord(data.法则, lawLimit),
      };
    }

    // 无权能且无法则：正常收集要素
    return {
      ...data,
      要素: sliceRecord(data.要素, eleLimit),
      权能: sliceRecord(data.权能, powerLimit),
      法则: {},
    };
  });

/**
 * 通用角色身份信息 schema
 */
export const IdentitySchema = z.object({
  等级: clampedMum(1, 1, 25),
  生命层级: z.string().prefault(''),
  种族: z.string().prefault(''),
  身份: z
    .array(z.string())
    .prefault([])
    .transform(arr => _.uniq(arr)),
  职业: z
    .array(z.string())
    .prefault([])
    .transform(arr => _.uniq(arr)),
  属性: BaseAttrSchema,
  装备: z.record(z.string(), EquipmentSchema).prefault({}),
  技能: z.record(z.string(), SkillSchema).prefault({}),
  登神长阶: AscensionSchema,
});
