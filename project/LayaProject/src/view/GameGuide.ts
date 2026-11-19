import { PATROL } from "../config/PatrolConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { GROWTH, RULE, TOWERS } from "../game/GameConfig";
import { BLAST_TACTIC, DRAGON_POISON, DRAGON_POISON_TACTIC, HAND_SPEED, HAND_SPEED_TACTIC, KING_MERCY, KING_MERCY_TACTIC, MIND_LOCK_TACTIC, RAGE_TACTIC, SHIELD_TACTIC, SPLIT_TACTIC, SUMMON_CHARGE, SUMMON_TACTIC, TACTIC_NIGHT_USES, TACTIC_SLOTS, TACTIC_USE, TIMED_BLAST, tacticDefinition, ZHOU_LOVE_HEAL, ZHOU_LOVE_TACTIC } from "../config/TacticConfig";
import { STARTER_LESSONS } from "./config/StarterGuideConfig";

function tacticRequirement(id: string) {
    const { unlockWaves, wood, food } = tacticDefinition(id);
    return `当前村庄守住 ${unlockWaves} 波后，可用 ${wood} 木、${food} 粮学会。`;
}

/** 游戏内只读手册：依据当前 VillageRules/Growth/BattleSimulation，数值引用同一配置。
 * 章节仅用于表现，不写存档、不提交命令；改玩法时同步说明，避免单独维护另一份数值表。
 */
export const GUIDE_CHAPTERS: ReadonlyArray<{ title: string; sections: ReadonlyArray<{ title: string; body: string; tactic?: string }> }> = [
    { title: "起步", sections: [
        { title: "智卓的前五波指引", body: STARTER_LESSONS.map(({ title, text }, index) => `第 ${index + 1} 波 · ${title}\n${text}`).join("\n\n") },
        { title: "先经营，再守夜", body: "白天没有倒计时，可以安排工作、成家、迎接孩子和建设。准备好后点“开始守夜”，先查看产出、口粮和防线，再确认出战。守住后进入新一天，继续经营同一座村庄。" },
        { title: "粮、木、人分别是什么", body: "麦穗代表粮食，用于口粮、迎接孩子和升级。木料代表木材，用于建设、升级及修门。图标旁的 80/200 表示现有 80、最多储存 200。双人图标旁的 6/8 表示在村 6 人、住房可容纳 8 人，孩子和老人也占名额。k 表示千，m 表示百万，b 表示十亿，t 表示万亿，q 表示千万亿。" },
        { title: "开村与每日口粮", body: `每天进入游戏可确认领取 ${RULE.dailyFood} 粮，按设备本地日期算一天。粮仓放不下时只补到上限，面板写明实际到账；满仓为 0，确认后也计作当天已领。同一村庄当天重进不重复领取；每次重新开村可再领一份，不累计补领。夜间领取只补库存，不能解除已经开始的当夜缺粮减益。` },
        { title: "产出不是即时到账", body: `开始守夜时，先加入当天产粮和产木，再扣全村口粮，最后按仓储上限保留。普通成人和老人每夜基础吃 ${RULE.adultRation} 粮，节俭者吃 1 粮，孩子吃 ${RULE.childRation} 粮；冬季和村规会调整消耗。白天可先看底部的产出预告。` },
        { title: "不满足条件时看哪里", body: "灰色条目会写出目前首先需要解决的原因；补足后会重新检查其他条件。费用按“现有/所需”显示，不够的数值标红。出生和旅人都需要住房空位；升级费用超出仓储时，要先修缮民居。" },
        { title: "随时退出，进度本地保存", body: "操作成功后自动保存。退出期间不会生产、成长或战斗，回来后点继续。夜战中退出再重进，会从已保存的本夜开头重打；本夜临时换人和战技使用也按战前状态重置。读取失败按提示核对，异版进度需明确确认才能放弃重开。" },
        { title: "好友榜与重新开村", body: "守住一波后，左侧出现排行榜。打开时按微信提示完成授权，以单局最高成功防守波数排行。确认重新开村会清空本机村庄进度，排行、战技和每日任务分别在新局守住第 1、3、6 波后开放。已同步的微信好友榜最高成绩会保留。" }
    ] },
    { title: "村民", sections: [
        { title: "来了就干活，也能自己调岗", body: "未退休的成年人会自动补生产空岗：先匹配农艺或伐木专长，其余先农田、后伐木。没有空岗时显示“待安排”。在村民名册里点开个人可调岗，岗位已满也能选择替换当前工人。照料孩子需要你指定。" },
        { title: "白天工作，夜晚守塔", body: "白天岗位和夜间驻塔独立，一个人可以白天种田、砍木或照料，夜晚再守塔。已建塔有合格成年人就自动补人；点击塔可换人。每人最多守一座塔，选中其他塔的驻守者时，两个人直接对调。" },
        { title: "“距退休”是什么意思", body: `普通新成人可劳作 ${RULE.adultNights} 夜，精英、英雄、传说分别可劳作 ${VILLAGER_QUALITY.ELITE.adultNights}、${VILLAGER_QUALITY.HERO.adultNights}、${VILLAGER_QUALITY.LEGENDARY.adultNights} 夜。每成功守住一夜，剩余时间减 1，失败或退出不减。开村人的年龄不同，所以有人较早退休。剩余时间不会因休息增加；要提前养育孩子、接纳旅人接班。` },
        { title: "退休后仍是村里的一员", body: `劳作时间用完会变成老人，退出工作和驻塔，不能再成家、生育或照料。普通老人养老 ${RULE.elderNights} 个成功守夜夜晚，精英、英雄、传说分别 ${VILLAGER_QUALITY.ELITE.elderNights}、${VILLAGER_QUALITY.HERO.elderNights}、${VILLAGER_QUALITY.LEGENDARY.elderNights} 夜；仍吃口粮、占住房。养老结束后寿终离村，进入家谱，才空出人口名额。` },
        { title: "家谱留住先辈", body: `家谱只记录已寿终的村民，刚退休的老人仍在名册中。普通记录保留最近 ${RULE.historyCap} 位，可珍藏 ${RULE.favoriteCap} 位；珍藏满了可先取消一位，再收藏其他先辈。` },
        { title: "旅人补充新伙伴", body: "清晨可能有旅人来访，可以欢迎或谢绝。有空住房才能接纳；清晨不能临时建房，满员可先谢绝，再在白天准备住房。成年男女出现断档时，会优先带来缺少的性别，但来访有间隔，不会每夜都补人。" },
        { title: "遇见特殊品质村民", body: `孩子或来访旅人可能是精英。本局守住 ${VILLAGER_QUALITY.HERO.minWins} 波后可能遇到英雄，守住 ${VILLAGER_QUALITY.LEGENDARY.minWins} 波后可能遇到传说。三档分别有青、紫、金色脚环，耕伐、照料和驻塔更强。品质在出生或来访时决定，孩子仍需照料 ${RULE.growNights} 夜成年。` }
    ] },
    { title: "家庭", sections: [
        { title: "怎样让两个人成家", body: "打开“家庭”，在“成家”页点“安排村民成家”，再依次选择两位村民。双方要已成年、未退休、没有配偶，且为一男一女。直系亲属、兄弟姐妹不能成家。成家不消耗资源，村民会走到一起并出现红心。" },
        { title: "迎接孩子：父母的条件", body: `父母双方都要未退休，而且各自距离退休至少还有 ${RULE.parentMinNights} 夜。例如一人剩 5 夜、另一人剩 2 夜，就不能再迎接；等待不会恢复劳作时间。父母任意一方已有未成年孩子时，要先照料其长大，包括再婚前的孩子。` },
        { title: "迎接孩子：住房与粮食", body: `村里需要至少 1 个空住房名额，并准备 ${RULE.birthCost} 粮。在“养育”页找到对应的家庭，点“迎接孩子”，选择一位未退休且未在照料其他孩子的成人。父亲或母亲本人也能照料，不要求额外第三个人。选人后立即扣粮、孩子出生并保存。灰色按钮上方会显示当前不满足的原因。` },
        { title: "一对夫妻能有几个孩子", body: `没有固定的终生孩子数量上限。每次出生后至少再成功守住 ${RULE.birthCooldown} 夜，且已有孩子成年、父母年龄等条件仍满足，才能迎接下一个。这里的“夜”按成功守夜计算，不是真实等待时间；只有活着且未退休并不足以满足全部条件。` },
        { title: "孩子怎样长大", body: `有人照料并成功守夜，成长就加 1；累计 ${RULE.growNights} 次后成年。当天出生并安排照料，当夜就能计入第 1 次。无人照料时不会成长，仍吃口粮；可在成人详情中安排照料。照料者退休或换工作后，记得重新安排。` },
        { title: "成年、天赋与专长", body: "孩子继承父母中的一项先天天赋。成年后从已给出的三项专长中选一项，随后自动补生产空岗；有空塔时也会自动参加驻守。选择结果和候选都会保存，退出不会重新抽取。" },
        { title: "男女与代际接班", body: "出生性别会温和偏向村里较少的一方，仍有随机性，不按一男一女固定轮换。留出住房和口粮，分批迎接孩子；结合旅人接纳，避免同一批成年人同时退休后缺少接班人。" }
    ] },
    { title: "建设", sections: [
        { title: "增建民居增加住的人", body: "住宅扩建从1级8名额开始，每升1级增加1个名额，最多100级、107人。扩建消耗木材和粮食，费用随等级增长，条目会显示具体数额。孩子和老人也占住房。地图最多同时展示20人，名册、工作产出、口粮和成长仍按全员结算。" },
        { title: "修缮民居增加存的资源", body: "修缮提高粮、木各自的仓储，扩建提高人口容量，两者独立。修缮级别越高，仓储增长越多；费用超出仓储时先修缮，再攒材料。" },
        { title: "农田与伐木场持续提效", body: "升级提高每位工人的产量，前3级沿用初阶岗位，之后每2级再增加1个岗位。新增空岗会自动安排待安排村民。地图仅展示部分工人，未出镜的工人仍正常产出。" },
        { title: PATROL.building, body: `开村自带 ${PATROL.startLevel} 级。白天点「${PATROL.appoint}」，夜里淡紫儿会组队出门迎敌。前期每级多派一人，满 ${PATROL.squad.maxSize} 人后提升单人伤害。队长仍可做白天的工作，夜间不能同时驻塔。` },
        { title: "城门加固与修复", body: `加固提高城门耐久上限，并补上本次增加的耐久，原有损伤仍保留。修复针对受损城门，每次基础恢复上限的 ${Math.round(GROWTH.repairFraction * 100)}%，受村规影响，最多恢复到满。城门完好时无需修复。` },
        { title: "建塔、改建与升级", body: "五个固定塔位，开局已建箭楼和石塔，其余3个空位可自行建设。建成后自动安排成年人。改建花20木，保留等级和驻守者；升级提高伤害。建设在白天进行，夜间可以换人。" },
        { title: "越往后越需要建设", body: "住宅可扩建到100级，其余设施与防塔数值可以持续提升。外观在前50级逐步变化，50级后保持最高档。升级需木材和粮食，费用逐渐增加；要兼顾生产、仓储、防线和代际接班。" }
    ] },
    { title: "守夜", sections: [
        { title: "守住城门就是胜利", body: "有人驻守的塔会自动攻击射程内敌人。敌人到达城门会造成伤害并离场；清完本夜全部敌人且城门仍有耐久，就算守住一波。城门耐久归零则失败，这一夜不计入纪录，也不推进年龄。" },
        { title: "三类防塔各有所长", body: `${TOWERS.ARROW.name}：单体快攻，适合快速点杀。${TOWERS.STONE.name}：范围伤害，对护甲影响更小，适合成群和重甲敌人。${TOWERS.SLOW.name}：伤害较低，对目标附近敌人减速，让其他塔多攻击几次。天赋与专长会影响驻守效果，可自行换人搭配。` },
        { title: "五类小怪，各有特点", body: "灰牙劫掠者是基础来敌；赤帽疾行者移动快；铁鬃卫士护甲高；石背野猪厚血、撞门较重；苔角巫医会降低附近防塔攻速。战前列表显示本夜的种类、数量和特点，向上滑动可看全。颜色和配件只改变外观，不额外增加属性。" },
        { title: "每年一场首领战", body: `每 ${RULE.yearDays} 夜出现一位首领：裂岩食人魔会召唤援兵；黑铁督军护甲高；霜脊狼王速度快；熔牙巨兽血量厚、撞门重；古木祭司会扰乱塔的攻速。前五场依次登场，之后循环；夜数和词缀仍会影响强度。` },
        { title: "先准备资源，再确认守夜", body: "启动图上的进度条会显示准备情况，地图、建筑和村民齐备后进入村庄。点击开始守夜时准备战斗素材，完成后再确认出战。准备期间不扣资源、不推进时间。失败可点重试，已经下载的文件会留在缓存中。" },
        { title: "战技：白天装配，守夜施放", body: `守住第 3 波后，排行下方出现战技入口。大王之心和第一槽开局自带；${TACTIC_SLOTS.map((s, i) => `第${i + 2}槽守住${s.unlockWaves}波可用${s.wood}木＋${s.food}粮解锁`).join("，")}。白天选槽免费换战技，同一战技只能占一槽。各战技共享 ${TACTIC_NIGHT_USES[0]} 次施放机会，开齐三槽后增至 ${TACTIC_NIGHT_USES[2]} 次。` },
        { title: "战技：共享间隔与冷却", body: `同时只生效一种战技，结束后等 ${TACTIC_USE.recoveryTicks * RULE.step} 个战斗秒再用下一个。可在同一夜重复使用的战技从施放开始冷却 ${TACTIC_USE.cooldownTicks * RULE.step} 个战斗秒，暂停冻结计时。未解锁的战技可点问号看传闻。重新开村后，战技和槽位回到初始状态。` },
        { title: "大王之心：短时加速集火", body: `所有已驻人的塔攻速提高 ${Math.round((RULE.bellSpeedMultiplier - 1) * 100)}%，持续 ${RULE.bellTicks * RULE.step} 个战斗秒。塔上金色光圈与倒计时表示正在生效。等敌人进入射程、比较密集时再用，单次伤害不变。` },
        { tactic: SHIELD_TACTIC, title: "二楠之盾：守住最后一道门", body: `${tacticRequirement(SHIELD_TACTIC)}城门免疫触门伤害${tacticDefinition(SHIELD_TACTIC).ticks * RULE.step}个战斗秒。敌人到门仍退场，青蓝护罩和倒计时表示生效。` },
        { tactic: RAGE_TACTIC, title: "百毅靓之怒：强化每次攻击", body: `${tacticRequirement(RAGE_TACTIC)}全塔伤害提高50%，持续15个战斗秒。箭塔强化单体伤害，石塔强化范围伤害，寒塔只强化主目标伤害，减速不变。塔顶红白旋刃与倒计时表示正在生效。` },
        { tactic: SPLIT_TACTIC, title: "分裂术·超：三目标齐射", body: `${tacticRequirement(SPLIT_TACTIC)}全塔每次同时攻击射程内至多3个不同目标，持续${tacticDefinition(SPLIT_TACTIC).ticks * RULE.step}个战斗秒。攻速、射程和单发伤害不变，石塔同轮溅射不叠伤，寒塔保留减速。金色光圈与倒计时表示生效。` },
        { tactic: BLAST_TACTIC, title: "孟昭易·泻火：预判来路", body: `${tacticRequirement(BLAST_TACTIC)}点泻火，再点友谊路埋弹。${TIMED_BLAST.delaySeconds}个战斗秒后引爆。脚底在圈内或边线上时，怪物和首领都会被直接击败。每夜可用一次，埋下前再点泻火可取消。` },
        { tactic: MIND_LOCK_TACTIC, title: "宋磊·留诊：全场停步", body: `${tacticRequirement(MIND_LOCK_TACTIC)}全场怪物停步${tacticDefinition(MIND_LOCK_TACTIC).ticks * RULE.step}个战斗秒，首领和这段时间新入场的怪物也受影响。塔可照常攻击，首领仍会召唤或干扰防塔。每夜可用一次。` },
        { tactic: HAND_SPEED_TACTIC, title: "明波的手速：连点引爆", body: `${tacticRequirement(HAND_SPEED_TACTIC)}冻结战场，${HAND_SPEED.seconds}秒内点满${HAND_SPEED.burstTaps}次立即引爆，把在场敌人（含首领）的血量压至最大生命的${HAND_SPEED.burstRemainingPercent}%，已低于该值的维持原血量。次数不足时，倒计时结束后每次点击扣除小怪${HAND_SPEED.ordinaryPermille / 10}%、首领${HAND_SPEED.bossPermille / 10}%的最大生命。每夜可用一次，发动即消耗次数。` },
        { tactic: SUMMON_TACTIC, title: "智卓的召唤：分身冲锋", body: `${tacticRequirement(SUMMON_TACTIC)}${SUMMON_CHARGE.count}名分身在城门前集结，沿路冲锋，一人换一只小怪。每撞到首领一次，扣其最大生命的${SUMMON_CHARGE.bossHitPercent}%，对每只首领单次最多扣${SUMMON_CHARGE.bossMaxPercent}%。达到上限后，其余分身继续冲锋。每夜可用一次。` },
        { tactic: ZHOU_LOVE_TACTIC, title: "周博的爱 · 出手见分晓", body: `${tacticRequirement(ZHOU_LOVE_TACTIC)}按当晚在村的成年村民统计，老人和精英也计入。女多男少时击倒所有在场来敌，包括首领。男多或持平时，来敌各回复最大生命的${ZHOU_LOVE_HEAL * 100}%，最多回满。每夜可用一次，效果当场结算。` },
        { tactic: DRAGON_POISON_TACTIC, title: "龙龙主母 · 中毒会续时", body: `${tacticRequirement(DRAGON_POISON_TACTIC)}给发动时在场的敌人挂上毒标，基础持续${DRAGON_POISON.seconds}个战斗秒。每秒扣小怪${DRAGON_POISON.smallPermille / 10}%、首领${DRAGON_POISON.bossPermille / 10}%最大生命。每击杀一只中毒来敌，其余中毒目标延长1秒，累计最多延长${DRAGON_POISON.maxExtraSeconds}秒。每夜可用一次。` },
        { tactic: KING_MERCY_TACTIC, title: "大王的怜悯 · 献纳救村", body: `${tacticRequirement(KING_MERCY_TACTIC)}确认奉王后献出当前粮木各 ${KING_MERCY.offeringPercent}%，歼灭在场敌人（含首领），修满城门。库存缺任一种时无法施放。冷却为 ${KING_MERCY.baseCooldownWaves} 波加累计施放次数，从施放后的下一波开始计。卸下也会继续累计成功守夜的进度。` },
        { title: "倍速、暂停与换人", body: "可切换 1 倍、2 倍两档，默认 1 倍，2 倍推进更快。连点战技按现实时间计时，其余战技按战斗时间计时。切档不重置持续时间，暂停时不扣时间。15 战斗秒在两档分别约为 7.5、5 现实秒。打开面板临时暂停，关闭后继续；若你主动点过暂停，仍需点“继续守夜”。夜间调任不重置防塔攻击冷却或本夜技能次数。" },
        { title: "缺粮和缺人的后果", body: `口粮不足仍能开始守夜，但当夜防塔攻速降至 ${Math.round(RULE.hungerSpeed * 100)}%；大王之心和缺粮按倍率相乘。没有合格成年人驻守的塔不会攻击。请在出战预览检查资源与人数，这些是风险提醒，不会强制阻止你开始。` },
        { title: "季节与村规", body: `每季 ${RULE.seasonDays} 夜，每年 ${RULE.yearDays} 夜。春季有利耕作、秋季有利伐木，冬季口粮增加。清晨可选择持续一季的村规。守夜从第一年起固定采用最高 ${RULE.maxTier} 档，跨年自动延续，不再选择难度。村庄可以持续经营，没有预制的最后一关。` }
    ] }
];
