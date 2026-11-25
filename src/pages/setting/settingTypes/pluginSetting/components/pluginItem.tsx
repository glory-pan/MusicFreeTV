import React, {memo} from 'react';

import useColors from '@/hooks/useColors';
import pluginManager, {Plugin, usePluginEnabled} from '@/core/pluginManager';

import Toast from '@/utils/toast';
import Clipboard from '@react-native-clipboard/clipboard';
import {showDialog} from '@/components/dialogs/useDialog';
import {showPanel} from '@/components/panels/usePanel';
import rpx from '@/utils/rpx';
import {StyleSheet, View} from 'react-native';
import ThemeText from '@/components/base/themeText';
import {TvFocusable} from '@/tv/components';
import Icon, {IIconName} from '@/components/base/icon.tsx';
import {useI18N} from '@/core/i18n';
import useRerender from '@/hooks/useRerender';

/** 开态青（比焦点光环浅一档），关态灰 */
const SWITCH_ON_COLOR = '#a9e9ff';
const SWITCH_OFF_COLOR = 'rgba(255,255,255,0.26)';

/** 卡片左右外边距 / 内边距 / 格子间距，三个数要和 styles 里的保持一致 */
const CARD_MARGIN_H = 20;
const CARD_PAD_H = 20;
const GRID_GAP = 12;
/** 竖屏设计稿宽度 750rpx，扣掉上面这些就是可用宽度 */
const GRID_TOTAL = 750 - CARD_MARGIN_H * 2 - CARD_PAD_H * 2;

interface IPluginItemProps {
    plugin: Plugin;
    /** 列表序号，用于可供遥控器定位的名字 plugin:${index}:xxx */
    index?: number;
    /** 名字后面的小标识：musicfree 插件显示「musicfree」 */
    badge?: string;
    /** 覆盖"最后一行格子按下键"的目标（统一列表里要能跨到下一张卡） */
    downTargetName?: string;
    /** 覆盖"第一张卡开关按上键"的目标（卡片在浮层里时没有安装按钮可回） */
    upTargetName?: string | null;
    /**
     * 焦点名前缀，默认 plugin。
     * 放进浮层里时（如「内置音源」面板）必须换前缀，
     * 否则会和插件管理页上同序号的卡片重名，光环会跑到屏外的节点上。
     */
    namePrefix?: string;
}

interface IOption {
    title: string;
    icon: IIconName;
    onPress?: () => void;
    show?: boolean;
}

function _PluginItem(props: IPluginItemProps) {
    const {
        plugin,
        index = 0,
        badge,
        downTargetName,
        upTargetName,
        namePrefix = 'plugin',
    } = props;
    const colors = useColors();
    const enabled = usePluginEnabled(plugin);
    const {t} = useI18N();
    const rerender = useRerender();

    const alternativePluginName =
        pluginManager.getAlternativePluginName(plugin);

    const options: IOption[] = [
        {
            title: t('pluginSetting.pluginItem.options.updatePlugin'),
            icon: 'arrow-path',
            async onPress() {
                try {
                    await pluginManager.updatePlugin(plugin);
                    Toast.success(t('toast.pluginUpdateSuccess'));
                } catch (e: any) {
                    Toast.warn(e?.message ?? t('toast.failToUpdatePlugin'));
                }
            },
            show: !!plugin.instance.srcUrl,
        },
        {
            title: t('pluginSetting.pluginItem.options.sharePlugin'),
            icon: 'share',
            async onPress() {
                try {
                    Clipboard.setString(plugin.instance.srcUrl!);
                    Toast.success(t('toast.copiedToClipboard'));
                } catch (e: any) {
                    Toast.warn(e?.message ?? t('toast.failToSharePlugin'));
                }
            },
            show: !!plugin.instance.srcUrl,
        },
        {
            title: t('pluginSetting.pluginItem.options.uninstallPlugin'),
            icon: 'trash-outline',
            show: true,
            onPress() {
                showDialog('SimpleDialog', {
                    title: t(
                        'pluginSetting.pluginItem.options.uninstallPlugin',
                    ),
                    content: t(
                        'pluginSetting.pluginItem.options.uninstallPluginContent',
                        {
                            name: plugin.name,
                        },
                    ),
                    async onOk() {
                        try {
                            await pluginManager.uninstallPlugin(plugin.hash);
                            Toast.success(t('toast.pluginUninstalled'));
                        } catch {
                            Toast.warn(t('toast.failToUpdatePlugin'));
                        }
                    },
                });
            },
        },
        {
            title: t('pluginSetting.pluginItem.options.alternativePlugin'),
            icon: 'strategy',
            show: true,
            onPress() {
                // 电视端：不再用手机式 RadioDialog（列表无焦点光环、遥控器点不动），
                // 改走带光环 + 分页的 SimpleSelect 居中卡片。
                const current =
                    (pluginManager.getAlternativePluginName(plugin) as any) ||
                    null;
                showPanel('SimpleSelect', {
                    header: t(
                        'pluginSetting.pluginItem.dialog.setAlternativePluginTitle',
                    ),
                    candidates: [
                        {
                            title: current
                                ? '不指定（跟随当前插件）'
                                : '✓ 不指定（跟随当前插件）',
                            value: '',
                        },
                        ...pluginManager
                            .getSortedPluginsWithAbility('getMediaSource')
                            .filter(it => it.name !== plugin.name)
                            .map(it => ({
                                title:
                                    it.name === current
                                        ? `✓ ${it.name}`
                                        : it.name,
                                value: it.name,
                            })),
                    ],
                    onPress(candidate: any) {
                        const value = candidate?.value || '';
                        if (!value || value === plugin.name) {
                            pluginManager.setAlternativePluginName(
                                plugin,
                                null as any,
                            );
                        } else {
                            pluginManager.setAlternativePluginName(
                                plugin,
                                value as any,
                            );
                        }
                        rerender();
                    },
                });
            },
        },
        {
            title: t('pluginSetting.pluginItem.options.importMusic'),
            icon: 'arrow-right-end-on-rectangle',
            onPress() {
                showPanel('SimpleInput', {
                    title: t('pluginSetting.pluginItem.options.importMusic'),
                    placeholder: t(
                        'pluginSetting.pluginItem.options.importMusicPlaceHolder',
                    ),
                    hints: plugin.instance.hints?.importMusicItem,
                    maxLength: 1000,
                    async onOk(text) {
                        const result = await plugin.methods.importMusicItem(
                            text,
                        );
                        if (result) {
                            showDialog('SimpleDialog', {
                                title: t(
                                    'pluginSetting.pluginItem.options.importDialogTitle',
                                ),
                                content: t(
                                    'pluginSetting.pluginItem.options.importMusicDialogContent',
                                    {
                                        name: result.title,
                                    },
                                ),
                                onOk() {
                                    showPanel('AddToMusicSheet', {
                                        musicItem: result,
                                        newSheetDefaultName: t(
                                            'pluginSetting.pluginItem.options.importMusicToSheetName',
                                            {
                                                name: plugin.name,
                                            },
                                        ),
                                    });
                                },
                            });
                        } else {
                            Toast.warn(t('toast.failToImportMusic'));
                        }
                    },
                });
            },
            show: !!plugin.supportedMethods.has('importMusicItem'),
        },
        {
            title: t('pluginSetting.pluginItem.options.importSheet'),
            icon: 'arrow-right-end-on-rectangle',
            onPress() {
                showPanel('SimpleInput', {
                    title: t('pluginSetting.pluginItem.options.importSheet'),
                    placeholder: t(
                        'pluginSetting.pluginItem.options.importSheetPlaceHolder',
                    ),
                    hints: plugin.instance.hints?.importMusicSheet,
                    maxLength: 1000,
                    async onOk(text, closePanel) {
                        Toast.success(t('toast.importing'));
                        closePanel();
                        const result = await plugin.methods.importMusicSheet(
                            text,
                        );
                        if (result && result.length > 0) {
                            showDialog('SimpleDialog', {
                                title: t(
                                    'pluginSetting.pluginItem.options.importDialogTitle',
                                ),
                                content: t(
                                    'pluginSetting.pluginItem.options.importSheetDialogContent',
                                    {
                                        count: result.length,
                                    },
                                ),
                                onOk() {
                                    showPanel('AddToMusicSheet', {
                                        musicItem: result,
                                    });
                                },
                            });
                        } else {
                            Toast.warn(t('toast.failToImportSheet'));
                        }
                    },
                });
            },
            show: !!plugin.supportedMethods.has('importMusicSheet'),
        },
        {
            title: t('pluginSetting.pluginItem.options.userVariables'),
            icon: 'code-bracket-square',
            onPress() {
                if (Array.isArray(plugin.instance.userVariables)) {
                    showPanel('SetUserVariables', {
                        async onOk(newValue, closePanel) {
                            pluginManager.setUserVariables(plugin, newValue);
                            Toast.success(t('toast.settingSuccess'));
                            closePanel();
                        },
                        variables: plugin.instance.userVariables,
                        initValues: pluginManager.getUserVariables(plugin),
                    });
                }
            },
            show: Array.isArray(plugin.instance.userVariables),
        },
        {
            // 插件说明以前是标题旁边那个「?」：它是个可聚焦节点，遥控器按「下」
            // 会先落到问号上（实机里光环就卡在 QQ 音乐的问号再也下不去）。
            // 现在问号不再是焦点，说明本身做成矩阵里的一个格子。
            title: '插件说明',
            icon: 'question-mark-circle',
            onPress() {
                showDialog('MarkdownDialog', {
                    title: plugin.name,
                    markdownContent: plugin.instance.description!,
                });
            },
            show: !!plugin.instance.description?.length,
        },
    ];

    const visibleOptions = options.filter(it => it.show !== false);
    const optionCount = visibleOptions.length;
    // 1~3 个铺满一行；更多就按 3 列换行（大屏上 3 列刚好是「一屏能数清」的密度）
    const cols = optionCount <= 3 ? Math.max(optionCount, 1) : 3;
    const tileWidth = rpx((GRID_TOTAL - GRID_GAP * (cols - 1)) / cols);

    const switchName = `${namePrefix}:${index}:switch`;
    const optName = (k: number) => `${namePrefix}:${index}:opt${k}`;

    return (
        <View style={styles.container}>
            <View style={styles.head}>
                <View style={styles.headText}>
                    <ThemeText
                        fontSize="title"
                        fontWeight="bold"
                        numberOfLines={1}
                        style={styles.name}>
                        {plugin.name}
                    </ThemeText>
                    {badge ? (
                        <ThemeText
                            fontSize="tag"
                            style={[
                                styles.badge,
                                badge === 'lx' ? styles.badgeLx : null,
                            ]}>
                            {badge}
                        </ThemeText>
                    ) : null}
                    <ThemeText
                        fontSize="tag"
                        fontColor="textSecondary"
                        numberOfLines={1}
                        style={styles.meta}>
                        {[
                            plugin.instance.version
                                ? `v${plugin.instance.version}`
                                : null,
                            plugin.instance.author ?? null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </ThemeText>
                </View>
                {
                    // 开关做成「文字 + 药丸」的一个焦点节点，放在卡片右上角。
                    // 它和下面的格子之间全部用显式方向链接打断点，
                    // 所以不管格子怎么换行，遥控器都不会卡住。
                    <TvFocusable
                        name={switchName}
                        focusOrder={100}
                        upName={
                            index === 0
                                ? upTargetName === null
                                    ? undefined
                                    : upTargetName ?? 'plugin:install'
                                : `${namePrefix}:${index - 1}:switch`
                        }
                        downName={optionCount ? optName(0) : undefined}
                        style={styles.switchWrap}
                        onPress={() => {
                            pluginManager.setPluginEnabled(plugin, !enabled);
                        }}>
                        {
                            // 开=白字「已开启」，关=黑字「已停用」并垫一块浅白底：
                            // 深色卡片上直接写黑字是看不见的，垫底之后"黑色"才显眼
                            <View
                                style={[
                                    styles.switchLabelWrap,
                                    enabled
                                        ? styles.labelOn
                                        : styles.labelOff,
                                ]}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontWeight="medium"
                                    color={enabled ? '#ffffff' : '#000000'}>
                                    {enabled ? '已开启' : '已停用'}
                                </ThemeText>
                            </View>
                        }
                        <View
                            style={[
                                styles.switchPill,
                                {
                                    backgroundColor: enabled
                                        ? SWITCH_ON_COLOR
                                        : SWITCH_OFF_COLOR,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.switchThumb,
                                    {left: enabled ? rpx(36) : rpx(3)},
                                ]}
                            />
                        </View>
                    </TvFocusable>
                }
            </View>
            {alternativePluginName ? (
                <ThemeText
                    fontSize="tag"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={styles.alternative}>
                    {t('pluginSetting.pluginItem.alternativePlugin', {
                        name: alternativePluginName,
                    })}
                </ThemeText>
            ) : null}
            <View style={styles.grid}>
                {visibleOptions.map((it, k) => {
                    const isLast = k === optionCount - 1;
                    return (
                        <TvFocusable
                            key={`opt-${k}`}
                            name={optName(k)}
                            focusOrder={k}
                            // 左右按 DOM 顺序成链（走到最后一个回到开关），
                            // 上下按行跳；表格换行导致的"错行"再也不会漏掉任何一格
                            leftName={k === 0 ? switchName : optName(k - 1)}
                            rightName={isLast ? switchName : optName(k + 1)}
                            upName={k < cols ? switchName : optName(k - cols)}
                            downName={
                                k + cols < optionCount
                                    ? optName(k + cols)
                                    : downTargetName ??
                                      `${namePrefix}:${index + 1}:opt0`
                            }
                            style={[
                                styles.tile,
                                {width: tileWidth},
                                enabled ? null : styles.tileDisabled,
                            ]}
                            onPress={it.onPress}>
                            <Icon
                                name={it.icon}
                                size={rpx(26)}
                                color={
                                    enabled
                                        ? colors.text
                                        : 'rgba(255,255,255,0.55)'
                                }
                            />
                            <ThemeText
                                fontSize="subTitle"
                                numberOfLines={1}
                                style={styles.tileText}
                                fontColor={enabled ? 'text' : 'textSecondary'}>
                                {it.title}
                            </ThemeText>
                        </TvFocusable>
                    );
                })}
            </View>
        </View>
    );
}

const PluginItem = memo(_PluginItem, (prev, curr) => {
    return prev.plugin === curr.plugin;
});
export default PluginItem;

const styles = StyleSheet.create({
    container: {
        borderRadius: rpx(16),
        borderWidth: rpx(1),
        // 卡片本身就是一块淡冰蓝玻璃，比页面底色高一层，靠它区分插件边界
        backgroundColor: 'rgba(214,240,255,0.10)',
        borderColor: 'rgba(150,220,255,0.22)',
        marginHorizontal: rpx(CARD_MARGIN_H),
        marginBottom: rpx(18),
        paddingHorizontal: rpx(CARD_PAD_H),
        paddingVertical: rpx(16),
    },
    head: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headText: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'baseline',
        minWidth: 0,
    },
    // 名字绝对不能被压缩：卡片放进「内置音源」浮层后（容器比插件页窄），
    // 原来 name 是 flexShrink:1，宽度直接被挤成 0，四个内置源全变成
    // 只有「musicfree」标识和版本号、没有名字的空卡片。
    name: {
        flexShrink: 0,
        maxWidth: rpx(280),
    },
    meta: {
        marginLeft: rpx(16),
        // 版本号 · 作者 这种长文本可以让位给名字，截断显示
        flexShrink: 1,
        minWidth: 0,
    },
    badge: {
        marginLeft: rpx(12),
        paddingHorizontal: rpx(10),
        paddingVertical: rpx(2),
        borderRadius: rpx(6),
        overflow: 'hidden',
        color: '#dff4ff',
        backgroundColor: 'rgba(95,208,255,0.30)',
    },
    badgeLx: {
        color: '#ffe2a8',
        backgroundColor: 'rgba(255,190,90,0.30)',
    },
    switchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: rpx(10),
        paddingVertical: rpx(6),
        borderRadius: rpx(24),
    },
    switchLabelWrap: {
        marginRight: rpx(12),
        paddingHorizontal: rpx(12),
        paddingVertical: rpx(4),
        borderRadius: rpx(8),
    },
    labelOn: {
        backgroundColor: 'rgba(40,140,200,0.55)',
    },
    labelOff: {
        backgroundColor: 'rgba(255,255,255,0.92)',
    },
    alternative: {
        marginTop: rpx(6),
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: rpx(GRID_GAP),
        marginTop: rpx(14),
    },
    tile: {
        height: rpx(58),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: rpx(12),
        borderRadius: rpx(12),
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: rpx(1),
        borderColor: 'rgba(160,225,255,0.16)',
    },
    tileDisabled: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.10)',
    },
    tileText: {
        marginLeft: rpx(8),
        flexShrink: 1,
    },
    switchPill: {
        width: rpx(70),
        height: rpx(36),
        borderRadius: rpx(36),
        justifyContent: 'center',
    },
    switchThumb: {
        position: 'absolute',
        width: rpx(30),
        height: rpx(30),
        borderRadius: rpx(15),
        backgroundColor: 'white',
    },
});
