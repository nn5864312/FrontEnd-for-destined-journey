import {
  clampedMum,
  IdentitySchema,
  InventoryItemSchema,
  LifeSkillsSchema,
  minLimitedNum,
  StatusEffectSchema,
  TaskSchema,
} from './utils';

// 自定义经验表：索引对应等级，值为升到下一级所需经验
// 等级 1 -> 需要 100 经验升到 2，等级 25 后为 MAX
const EXP_TABLE: number[] = [
  0,       // 占位，等级 0 不用
  100,     // 1 → 2
  200,     // 2 → 3
  400,     // 3 → 4
  800,     // 4 → 5
  1500,    // 5 → 6
  3000,    // 6 → 7
  6000,    // 7 → 8
  10000,   // 8 → 9
  16000,   // 9 → 10
  25000,   // 10 → 11
  40000,   // 11 → 12
  65000,   // 12 → 13
  100000,  // 13 → 14
  150000,  // 14 → 15
  220000,  // 15 → 16
  320000,  // 16 → 17
  450000,  // 17 → 18
  620000,  // 18 → 19
  850000,  // 19 → 20
  1150000, // 20 → 21
  1550000, // 21 → 22
  2100000, // 22 → 23
  2800000, // 23 → 24
  3800000, // 24 → 25
  5000000  // 25 → MAX（占位，实际不会用到）
];

/**
 * 玩家信息
 */
const player = z
  .object({
    ...IdentitySchema.shape,
    累计经验值: z.coerce.number().prefault(0),
    升级所需经验: z.union([z.coerce.number().prefault(100), z.literal('MAX')]),
    冒险者等级: z.string().prefault('未评级'),
    生命值: z.coerce.number().prefault(0),
    生命值上限: z.coerce.number().prefault(0),
    法力值: z.coerce.number().prefault(0),
    法力值上限: z.coerce.number().prefault(0),
    体力值: z.coerce.number().prefault(0),
    体力值上限: z.coerce.number().prefault(0),
    属性点: z.coerce.number().prefault(0),
    背包: z
      .record(z.string(), InventoryItemSchema)
      .prefault({})
      .transform(items => _.pickBy(items, item => item.数量 > 0)),
    金钱: z.coerce.number().prefault(0).transform(Math.round),
    状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),
    生活职业: LifeSkillsSchema.prefault({}),
  })
  .prefault({})
  .transform(data => {
    // 自定义经验表逻辑：根据累计经验值计算等级和剩余经验
    let currentLevel = data.等级;
    let currentExp = data.累计经验值;
    const nextRequiredExp = currentLevel >= 25 ? 'MAX' : EXP_TABLE[currentLevel];

    const processed = {
      ...data,
      等级: currentLevel,
      累计经验值: currentExp,
      升级所需经验: nextRequiredExp,
      生命值: _.clamp(data.生命值, 0, data.生命值上限),
      法力值: _.clamp(data.法力值, 0, data.法力值上限),
      体力值: _.clamp(data.体力值, 0, data.体力值上限),
    };

    return _.pick(processed, [
      // 基础信息
      '种族',
      '身份',
      '职业',
      '生命层级',
      // 等级系统
      '等级',
      '累计经验值',
      '升级所需经验',
      '冒险者等级',
      // 属性点（在属性前面）
      '属性点',
      // 属性
      '属性',
      // 资源值
      '生命值上限',
      '生命值',
      '法力值上限',
      '法力值',
      '体力值上限',
      '体力值',
      // 状态效果
      '状态效果',
      // 生活职业
      '生活职业',
      // 物品与金钱
      '金钱',
      '背包',
      // 装备、技能、登神长阶
      '装备',
      '技能',
      '登神长阶',
    ]);
  });

/**
 * 关系列表信息
 */
const partners = z
  .record(
    z.string(),
    z
      .object({
        ...IdentitySchema.shape,
        在场: z.boolean().prefault(false),
        性格: z.string().prefault(''),
        喜爱: z.string().prefault(''),
        外貌: z.string().prefault(''),
        着装: z.string().prefault(''),
        命定契约: z.boolean().prefault(false),
        好感度: clampedMum(0, -100, 100),
        状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),
        背包: z
          .record(z.string(), InventoryItemSchema)
          .prefault({})
          .transform(items => _.pickBy(items, item => item.数量 > 0)),
        心里话: z.string().prefault(''),
        背景故事: z.string().prefault(''),
      })
      .prefault({})
      .transform(data =>
        _.pick(data, [
          // 状态信息
          '在场',
          // 基础信息
          '种族',
          '身份',
          '职业',
          '生命层级',
          // 外貌特征
          '性格',
          '喜爱',
          '外貌',
          '着装',
          // 等级
          '等级',
          // 属性
          '属性',
          '状态效果',
          // 物品
          '背包',
          // 装备、技能、登神长阶
          '装备',
          '技能',
          '登神长阶',
          // 关系信息
          '命定契约',
          '好感度',
          // 故事信息
          '心里话',
          '背景故事',
        ]),
      ),
  )
  .prefault({});

/**
 * 新闻信息
 */
const news = z.object({
  阿斯塔利亚快讯: z
    .object({
      势力要闻: z.string().prefault(''),
      尊位行迹: z.string().prefault(''),
      军事行动: z.string().prefault(''),
      经济动脉: z.string().prefault(''),
      灾害预警: z.string().prefault(''),
    })
    .prefault({}),
  酒馆留言板: z
    .object({
      高额悬赏: z.string().prefault(''),
      冒险发现: z.string().prefault(''),
      怪物异动: z.string().prefault(''),
      通缉要犯: z.string().prefault(''),
      宝物传闻: z.string().prefault(''),
    })
    .prefault({}),
  午后茶会: z
    .object({
      社交逸闻: z.string().prefault(''),
      千里远望: z.string().prefault(''),
      命运涟漪: z.string().prefault(''),
      邂逅预兆: z.string().prefault(''),
    })
    .prefault({}),
});

export const Schema = z.object({
  事件: z.record(z.any(), z.any()).prefault({}),
  世界: z
    .object({
      时间: z.string().prefault(''),
      地点: z.string().prefault(''),
    })
    .prefault({}),
  任务列表: z.record(z.string(), TaskSchema).prefault({}),
  主角: player.prefault({}),
  命运点数: minLimitedNum(0, 0),
  关系列表: partners,
  新闻: news.prefault({}),
});
