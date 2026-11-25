import React, {useEffect, useState} from 'react';
import {TvFlatList as FlatList} from '@/tv/scroll';
import {StyleSheet, View} from 'react-native';
import rpx from '@/utils/rpx';
import {TvScrollView} from '@/tv/scroll';
import {TvFocusable} from '@/tv/components';
import {tvFocus} from '@/tv/focusStore';
import ThemeText from '@/components/base/themeText';
import * as DocumentPicker from 'expo-document-picker';
import Loading from '@/components/base/loading';

import PluginManager, {
    useSortedPlugins,
    usePlugins,
} from '@/core/pluginManager';
import {trace} from '@/utils/log';

import Toast from '@/utils/toast';
import axios from 'axios';
import {useNavigation} from '@react-navigation/native';
import Config from '@/core/appConfig';
import HorizontalSafeAreaView from '@/components/base/horizontalSafeAreaView.tsx';
import {showDialog} from '@/components/dialogs/useDialog';
import {showPanel} from '@/components/panels/usePanel';
import AppBar from '@/components/base/appBar';

import PluginItem from '../components/pluginItem';
import Icon, {IIconName} from '@/components/base/icon.tsx';
import {IInstallPluginResult} from '@/types/core/pluginManager';
import {useI18N} from '@/core/i18n';
import {showQrInput} from '@/tv/qrOverlay';

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
}

export default function PluginList() {
    const plugins = useSortedPlugins();
    const allPlugins = usePlugins();

    /** 插件管理页就是所有已安装的 musicfree 插件（不再有内置源要过滤） */
    const userPlugins = plugins ?? [];
    const totalCount = userPlugins.length;
    /** 右上角「安装插件」按下键要去的地方 */
    const firstItemFocus = userPlugins.length ? 'plugin:0:opt0' : undefined;

    // 进页面就把光环放到第一个插件卡片上：
    // 之前是等空间导航自己找，用户得连按三四次下键光环才出现，体验很差。
    useEffect(() => {
        // 无条件把首焦点放到右上角「+ 安装插件」。
        // 之前这里有个"插件列表为空就直接返回"，结果空列表进页面一个光环都没有，
        // 按下键还会落到上一页残留的节点上（用户实机就是这么跳到播放页的）。
        tvFocus.focusByName('plugin:install', true);
    }, []);
    const {t} = useI18N();

    const [loading, setLoading] = useState(false);

    const navigator = useNavigation<any>();

    // 右上角 ⋯ 已按用户要求彻底移除：所有菜单项都并入页面底部的「＋ 安装插件」
    const menuOptions: IOption[] = [];

    async function onInstallFromLocalClick() {
        try {
            const results = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: true,
                type: ['application/javascript', 'text/javascript'],
            });
            if (results.canceled) {
                // 用户取消
                return;
            }
            setLoading(true);

            await Promise.all(
                results.assets.map(async it => {
                    await PluginManager.installPluginFromLocalFile(it.uri, {
                        notCheckVersion: Config.getConfig(
                            'basic.notCheckPluginVersion',
                        ),
                        useExpoFs: true,
                    });
                }),
            );
            // 初步过滤

            Toast.success(t('toast.installPluginSuccess'));
        } catch (e: any) {
            trace('插件安装失败', e?.message);
            Toast.warn(
                t('toast.installPluginFail', {
                    reason: e?.message ?? '',
                }),
            );
        }
        setLoading(false);
    }

    async function onInstallFromNetworkClick() {
        showPanel('SimpleInput', {
            title: t('pluginSetting.menu.installPlugin'),
            placeholder: t('pluginSetting.menu.installPluginDialogPlaceholder'),
            maxLength: 200,
            async onOk(text, closePanel) {
                setLoading(true);
                closePanel();

                const result = await installPluginFromUrl(text.trim());

                // 检查是否全部安装成功
                const successResults: IInstallPluginResult[] = [];
                const failResults: IInstallPluginResult[] = [];
                for (let i = 0; i < result.length; ++i) {
                    if (result[i].success) {
                        successResults.push(result[i]);
                    } else {
                        failResults.push(result[i]);
                    }
                }

                if (!failResults.length) {
                    Toast.success(t('toast.installPluginSuccess'));
                } else {
                    Toast.warn(
                        successResults.length
                            ? t('toast.partialPluginInstallFailed')
                            : t('toast.allPluginInstallFailed'),
                        {
                            type: 'warn',
                            actionText: t('common.view'),
                            onActionClick: () => {
                                showDialog('SimpleDialog', {
                                    title: t(
                                        'pluginSetting.menu.pluginInstallFailedDialogTitle',
                                    ),
                                    content: t(
                                        'pluginSetting.pluginInstallFailedDialogContent',
                                        {
                                            detail: failResults
                                                .map(
                                                    it =>
                                                        (it.pluginUrl ?? '') +
                                                        '\n' +
                                                        t(
                                                            'pluginSetting.failReason',
                                                            {
                                                                reason:
                                                                    it.message ??
                                                                    '',
                                                            },
                                                        ),
                                                )
                                                .join('\n-----\n'),
                                        },
                                    ),
                                });
                            },
                        },
                    );
                }

                setLoading(false);
            },
        });
    }

    async function onSubscribeClick() {
        const urls = Config.getConfig('plugin.subscribeUrl');
        if (!urls) {
            Toast.warn(t('toast.noSubscription'));
        }
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            const urlItems = JSON.parse(urls!);
            if (Array.isArray(urlItems)) {
                for (let i = 0; i < urlItems.length; ++i) {
                    const result = await installPluginFromUrl(urlItems[i].url);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            } else {
                throw new Error();
            }

            if (!failResults.length) {
                Toast.success(t('toast.installPluginSuccess'));
            } else {
                Toast.warn(
                    successResults.length
                        ? t('toast.partialPluginInstallFailed')
                        : t('toast.allPluginInstallFailed'),
                    {
                        type: 'warn',
                        actionText: t('common.view'),
                        onActionClick: () => {
                            showDialog('SimpleDialog', {
                                title: t(
                                    'pluginSetting.menu.pluginInstallFailedDialogTitle',
                                ),
                                content: t(
                                    'pluginSetting.pluginInstallFailedDialogContent',
                                    {
                                        detail: failResults
                                            .map(
                                                it =>
                                                    (it.pluginUrl ?? '') +
                                                    '\n' +
                                                    t(
                                                        'pluginSetting.failReason',
                                                        {
                                                            reason:
                                                                it.message ??
                                                                '',
                                                        },
                                                    ),
                                            )
                                            .join('\n-----\n'),
                                    },
                                ),
                            });
                        },
                    },
                );
            }
        } catch {
            if (urls?.length) {
                const result = await installPluginFromUrl(urls);
                if (result[0]) {
                    if (result[0].success) {
                        Toast.success(t('toast.installPluginSuccess'));
                    } else {
                        Toast.warn(
                            t('toast.partialPluginInstallFailedWithReason', {
                                reason: result[0].message ?? '',
                            }),
                        );
                    }
                } else {
                    Toast.warn(t('toast.subscriptionInvalid'));
                }
            }
        }
        setLoading(false);
    }

    async function onUpdateAllClick() {
        const plugins = PluginManager.getEnabledPlugins();
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            for (let i = 0; i < plugins.length; ++i) {
                const srcUrl = plugins[i].instance.srcUrl;
                if (srcUrl) {
                    const result = await installPluginFromUrl(srcUrl);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            }

            if (!failResults.length) {
                Toast.success(t('toast.updatePluginSuccess'));
            } else {
                Toast.warn(
                    successResults.length
                        ? t('toast.partialPluginUpdateFailed')
                        : t('toast.allPluginUpdateFailed'),
                    {
                        type: 'warn',
                        actionText: t('common.view'),
                        onActionClick: () => {
                            showDialog('SimpleDialog', {
                                title: t(
                                    'pluginSetting.menu.pluginUpdateFailedDialogTitle',
                                ),
                                content: t(
                                    'pluginSetting.pluginUpdateFailedDialogContent',
                                    {
                                        detail: failResults
                                            .map(
                                                it =>
                                                    (it.pluginUrl ?? '') +
                                                    '\n' +
                                                    t(
                                                        'pluginSetting.failReason',
                                                        {
                                                            reason:
                                                                it.message ??
                                                                '',
                                                        },
                                                    ),
                                            )
                                            .join('\n-----\n'),
                                    },
                                ),
                            });
                        },
                    },
                );
            }
        } catch (e: any) {
            Toast.warn(
                t('toast.unknownError', {
                    reason: e?.message ?? e,
                }),
            );
        }
        setLoading(false);
    }

    return (
        <>
            <AppBar menu={menuOptions}>{t('sidebar.pluginManagement')}</AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                <>
                    {loading ? (
                        <Loading />
                    ) : totalCount === 0 ? (
                        <View style={style.tips}>
                            <ThemeText
                                fontSize="content"
                                fontColor="textSecondary">
                                还没有安装插件。
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                style={style.tipsLine}>
                                点右上角「＋ 安装插件」：扫码上传、扫码贴链接、从本地或网络安装 musicfree 插件，装完都会出现在这一页。
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                style={style.tipsLine}>
                                也可以用右上角「＋ 安装插件」里的扫码方式把 musicfree 插件文件/链接从手机传过来。
                            </ThemeText>
                        </View>
                    ) : (
                        <TvScrollView
                            style={style.list}
                            contentContainerStyle={style.listContent}>
                            {/* musicfree 插件：带 musicfree 标识 */}
                            {userPlugins.map((plugin, index) => (
                                <PluginItem
                                    key={plugin.hash}
                                    plugin={plugin}
                                    index={index}
                                    badge="musicfree"
                                />
                            ))}
                        </TvScrollView>
                    )}

                    <TvFocusable
                        name="plugin:install"
                        focusOrder={-20}
                        // 按"下"直接进第一个插件的操作按钮。
                        // 以前这里是纯几何导航：安装按钮正下方就是各卡片的开关，
                        // 于是下键永远先落到开关上，用户觉得很不合理。
                        downName={firstItemFocus}
                        style={style.installButton}
                        onPress={() => {
                            // 安装弹框两栏：musicfree音源上传（四路导入 + 内置音源）/ 插件维护
                            showPanel('PluginInstallPanel', {
                                onScanPlugin: () =>
                                    showQrInput({
                                        mode: 'plugin',
                                        title: '手机扫码上传插件文件',
                                        onPlugin: async (plugin: any) => {
                                            try {
                                                const rawResult =
                                                    plugin?.type === 'url'
                                                        ? await installPluginFromUrl(
                                                              String(
                                                                  plugin.value ??
                                                                      '',
                                                              ),
                                                          )
                                                        : await PluginManager.installPluginFromLocalFile(
                                                              String(
                                                                  plugin?.value ??
                                                                      '',
                                                              ),
                                                          );
                                                const result: any =
                                                    Array.isArray(rawResult)
                                                        ? rawResult[0]
                                                        : rawResult;
                                                if (result?.success) {
                                                    Toast.success(
                                                        `${
                                                            result.pluginName ??
                                                            '插件'
                                                        } 安装成功`,
                                                    );
                                                } else {
                                                    Toast.warn(
                                                        result?.message ??
                                                            '插件安装失败',
                                                    );
                                                }
                                            } catch (e: any) {
                                                Toast.warn(
                                                    e?.message ??
                                                        '插件安装失败',
                                                );
                                            }
                                        },
                                    }),
                                onScanLink: () =>
                                    showQrInput({
                                        mode: 'text',
                                        kind: 'link',
                                        title: '手机扫码输入插件链接',
                                        onText: async (text: string) => {
                                            try {
                                                await installPluginFromUrl(
                                                    text.trim(),
                                                );
                                                Toast.success(
                                                    `插件安装成功（当前共 ${allPlugins.length} 个）`,
                                                );
                                            } catch (e: any) {
                                                Toast.warn(
                                                    e?.message ??
                                                        '插件安装失败',
                                                );
                                            }
                                        },
                                    }),
                                onFromLocal: onInstallFromLocalClick,
                                onFromNetwork: onInstallFromNetworkClick,
                                onUpdateAll: onUpdateAllClick,
                                onUpdateSubscribe: onSubscribeClick,
                                onSubscriptionSettings: () =>
                                    navigator.navigate(
                                        '/pluginsetting/subscribe',
                                    ),
                                onSort: () =>
                                    navigator.navigate(
                                        '/pluginsetting/sort',
                                    ),
                                onUninstallAll: () =>
                                    showDialog('SimpleDialog', {
                                        title: t(
                                            'pluginSetting.menu.uninstallAll',
                                        ),
                                        content: t(
                                            'pluginSetting.menu.uninstallAllContent',
                                        ),
                                        async onOk() {
                                            setLoading(true);
                                            await PluginManager.uninstallAllPlugins();
                                            setLoading(false);
                                        },
                                    }),
                            });
                        }}>
                        <Icon name="plus" size={rpx(24)} color="#dff4ff" />
                        <ThemeText
                            fontSize="content"
                            fontWeight="medium"
                            style={style.installText}>
                            安装插件
                        </ThemeText>
                    </TvFocusable>
                </>
            </HorizontalSafeAreaView>
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: '100%',
        flex: 1,
    },
    list: {
        flex: 1,
        // 给右上角的固定「安装插件」按钮留出位置，别压住第一张卡片
        paddingTop: rpx(84),
    },
    listContent: {
        // 末尾留白：不然最后一个插件（QQ 音乐）那一排「卸载插件/音源重定向/用户变量」
        // 永远滚不出屏幕下边缘，光环也就到不了（实机视频里就卡在卡片标题的问号）
        paddingBottom: rpx(200),
    },
    installButton: {
        // 固定在右上角：不管装了 20 个还是 50 个插件，
        // 从第一个插件按一下"上"就能到，不用一路走完整个列表
        position: 'absolute',
        top: rpx(4),
        right: rpx(25),
        width: rpx(272),
        height: rpx(62),
        zIndex: 20,
        elevation: 20,
        borderRadius: rpx(31),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(95,208,255,0.20)',
        borderWidth: rpx(1),
        borderColor: 'rgba(160,230,255,0.55)',
    },
    installText: {
        marginLeft: rpx(8),
        color: '#dff4ff',
    },
    tips: {
        flex: 1,
        paddingHorizontal: rpx(60),
        paddingTop: rpx(120),
    },
    tipsLine: {
        marginTop: rpx(14),
    },
    blank: {
        height: rpx(200),
    },
});

async function installPluginFromUrl(
    text: string,
): Promise<IInstallPluginResult[]> {
    try {
        let urls: string[] = [];
        const inputUrl = text.trim();
        if (text.endsWith('.json')) {
            const jsonFile = (
                await axios.get(inputUrl, {
                    headers: {
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache',
                        Expires: '0',
                    },
                })
            ).data;
            /**
             * {
             *     plugins: [{
             *          version: xxx,
             *          url: xxx
             *      }]
             * }
             */
            urls = (jsonFile?.plugins ?? []).map((_: any) => _.url);
        } else {
            urls = [inputUrl];
        }
        return await Promise.all(
            urls.map(url =>
                PluginManager.installPluginFromUrl(url, {
                    notCheckVersion: Config.getConfig(
                        'basic.notCheckPluginVersion',
                    ),
                }),
            ),
        );
    } catch (e: any) {
        return [{success: false, message: e?.message, pluginUrl: text}];
    }
}
