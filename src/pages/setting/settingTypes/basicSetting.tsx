import ColorBlock from "@/components/base/colorBlock";
import { TvFlatList as FlatList } from "@/tv/scroll";
import { TvSectionList as SectionList } from "@/tv/scroll";
import ListItem from "@/components/base/listItem";
import Paragraph from "@/components/base/paragraph";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { SortType } from "@/constants/commonConst.ts";
import pathConst from "@/constants/pathConst";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import LyricUtil, { NativeTextAlignment } from "@/native/lyricUtil";
import { AppConfigPropertyKey } from "@/types/core/config";
import { clearCache, getCacheSize, sizeFormatter } from "@/utils/fileUtils";
import { clearLog, getErrorLogContent } from "@/utils/log";
import { qualityKeys } from "@/utils/qualities";
import rpx from "@/utils/rpx";
import { LYRIC_TEXT_COLORS, LYRIC_BG_COLORS } from "./lyricColorPalette";
import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import Slider from "@react-native-community/slider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    StyleSheet,
    View,
} from "react-native";
import { TvTouchableOpacity as TouchableOpacity, TvFocusable } from "@/tv/components";
import { readdir } from "react-native-fs";

import { TvScrollView, TvScrollView as ScrollView } from "@/tv/scroll";
import { tvFocus } from "@/tv/focusStore";
import { useTvKeys } from "@/tv/provider";

function createSwitch(
    title: string,
    changeKey: AppConfigPropertyKey,
    value: boolean,
    callback?: (newValue: boolean) => void,
) {
    const onPress = () => {
        if (callback) {
            callback(!value);
        } else {
            Config.setConfig(changeKey, !value);
        }
    };
    return {
        title,
        onPress,
        right: <ThemeSwitch value={value} onValueChange={onPress} />,
    };
}

const createRadio = function (
    title: string,
    changeKey: AppConfigPropertyKey,
    candidates: Array<string | number>,
    value: string | number,
    valueMap?: Record<string | number, string | number>,
    onChange?: (value: string | number) => void,
) {
    const onPress = () => {
        showDialog("RadioDialog", {
            title,
            content: valueMap
                ? candidates.map(_ => ({
                    label: valueMap[_] as string,
                    value: _,
                }))
                : candidates,
            onOk(val) {
                Config.setConfig(changeKey, val);
                onChange?.(val);
            },
        });
    };
    return {
        title,
        right: (
            <ThemeText style={styles.centerText}>
                {valueMap ? valueMap[value] : value}
            </ThemeText>
        ),
        onPress,
    };
};

function useCacheSize() {
    const [cacheSize, setCacheSize] = useState({
        music: 0,
        lyric: 0,
        image: 0,
    });

    const refreshCacheSize = useCallback(async () => {
        const [musicCache, lyricCache, imageCache] = await Promise.all([
            getCacheSize("music"),
            getCacheSize("lyric"),
            getCacheSize("image"),
        ]);
        setCacheSize({
            music: musicCache,
            lyric: lyricCache,
            image: imageCache,
        });
    }, []);

    return [cacheSize, refreshCacheSize] as const;
}

export default function BasicSetting() {
    const colors = useColors();
    const [activeSection, setActiveSection] = useState(0);

    const autoPlayWhenAppStart = useAppConfig("basic.autoPlayWhenAppStart");
    const useCelluarNetworkPlay = useAppConfig("basic.useCelluarNetworkPlay");
    const useCelluarNetworkDownload = useAppConfig("basic.useCelluarNetworkDownload");
    const maxDownload = useAppConfig("basic.maxDownload");
    const clickMusicInSearch = useAppConfig("basic.clickMusicInSearch");
    const clickMusicInAlbum = useAppConfig("basic.clickMusicInAlbum");
    const downloadPath = useAppConfig("basic.downloadPath");
    const notInterrupt = useAppConfig("basic.notInterrupt");
    const tempRemoteDuck = useAppConfig("basic.tempRemoteDuck");
    const tempRemoteDuckVolume = useAppConfig("basic.tempRemoteDuckVolume");
    const autoStopWhenError = useAppConfig("basic.autoStopWhenError");
    const maxCacheSize = useAppConfig("basic.maxCacheSize");
    const defaultPlayQuality = useAppConfig("basic.defaultPlayQuality");
    const playQualityOrder = useAppConfig("basic.playQualityOrder");
    const defaultDownloadQuality = useAppConfig("basic.defaultDownloadQuality");
    const downloadQualityOrder = useAppConfig("basic.downloadQualityOrder");
    const musicDetailDefault = useAppConfig("basic.musicDetailDefault");
    const musicDetailAwake = useAppConfig("basic.musicDetailAwake");
    const maxHistoryLen = useAppConfig("basic.maxHistoryLen");
    const autoUpdatePlugin = useAppConfig("basic.autoUpdatePlugin");
    const notCheckPluginVersion = useAppConfig("basic.notCheckPluginVersion");
    const lazyLoadPlugin = useAppConfig("basic.lazyLoadPlugin");
    const associateLyricType = useAppConfig("basic.associateLyricType");
    const showExitOnNotification = useAppConfig("basic.showExitOnNotification");
    const musicOrderInLocalSheet = useAppConfig("basic.musicOrderInLocalSheet");
    const tryChangeSourceWhenPlayFail = useAppConfig("basic.tryChangeSourceWhenPlayFail");

    const { t } = useI18N();

    const debugEnableErrorLog = useAppConfig("debug.errorLog");
    const debugEnableTraceLog = useAppConfig("debug.traceLog");
    const debugEnableDevLog = useAppConfig("debug.devLog");

    const navigate = useNavigate();

    const [cacheSize, refreshCacheSize] = useCacheSize();

    const sectionListRef = useRef<any>(null);
    // const titleListRef = useRef<any>(null);

    useEffect(() => {
        refreshCacheSize();
    }, []);

    const basicOptions = [
        {
            title: t("basicSettings.common"),
            data: [
                createRadio(
                    t("basicSettings.maxHistoryLength"),
                    "basic.maxHistoryLen",
                    [20, 50, 100, 200, 500],
                    maxHistoryLen ?? 50,
                ),
                createRadio(
                    t("basicSettings.musicDetailDefault"),
                    "basic.musicDetailDefault",
                    ["album", "lyric"],
                    musicDetailDefault ?? "album",
                    {
                        album: t("basicSettings.musicDetailDefault.album"),
                        lyric: t("basicSettings.musicDetailDefault.lyric"),
                    },
                ),
                createSwitch(
                    t("basicSettings.musicDetailAwake"),
                    "basic.musicDetailAwake",
                    musicDetailAwake ?? false,
                ),
                createRadio(
                    t("basicSettings.associateLyricType"),
                    "basic.associateLyricType",
                    ["input", "search"],
                    associateLyricType ?? "search",
                    {
                        input: t("basicSettings.associateLyricType.input"),
                        search: t("basicSettings.associateLyricType.search"),
                    },
                ),
                createSwitch(
                    t("basicSettings.showExitOnNotification"),
                    "basic.showExitOnNotification",
                    showExitOnNotification ?? false,
                ),
            ],
        },
        {
            title: t("basicSettings.sheetAndAlbum"),
            data: [
                createRadio(
                    t("basicSettings.clickMusicInSearch"),
                    "basic.clickMusicInSearch",
                    ["playMusic", "playMusicAndReplace"],
                    clickMusicInSearch ?? "playMusic",
                    {
                        playMusic: t("basicSettings.clickMusicInSearch.playMusic"),
                        playMusicAndReplace: t("basicSettings.clickMusicInSearch.playMusicAndReplace"),
                    },
                ),
                createRadio(
                    t("basicSettings.clickMusicInAlbum"),
                    "basic.clickMusicInAlbum",
                    ["playMusic", "playAlbum"],
                    clickMusicInAlbum ?? "playAlbum",
                    {
                        playMusic: t("basicSettings.clickMusicInAlbum.playMusic"),
                        playAlbum: t("basicSettings.clickMusicInAlbum.playAlbum"),
                    },
                ),
                createRadio(
                    t("basicSettings.musicDetailDefault"),
                    "basic.musicDetailDefault",
                    ["album", "lyric"],
                    musicDetailDefault ?? "album",
                    {
                        album: t("basicSettings.musicDetailDefault.album"),
                        lyric: t("basicSettings.musicDetailDefault.lyric"),
                    },
                ),
                createRadio(
                    t("basicSettings.musicOrderInLocalSheet"),
                    "basic.musicOrderInLocalSheet",
                    [
                        SortType.Title,
                        SortType.Artist,
                        SortType.Album,
                        SortType.Newest,
                        SortType.Oldest,
                    ],
                    musicOrderInLocalSheet ?? "end",
                    {
                        [SortType.Title]: t("basicSettings.musicOrderInLocalSheet.title"),
                        [SortType.Artist]: t("basicSettings.musicOrderInLocalSheet.artist"),
                        [SortType.Album]: t("basicSettings.musicOrderInLocalSheet.album"),
                        [SortType.Newest]: t("basicSettings.musicOrderInLocalSheet.newest"),
                        [SortType.Oldest]: t("basicSettings.musicOrderInLocalSheet.oldest"),
                    },
                ),
            ],
        },
        {
            title: t("basicSettings.plugin"),
            data: [
                createSwitch(
                    t("basicSettings.autoUpdatePlugin"),
                    "basic.autoUpdatePlugin",
                    autoUpdatePlugin ?? false,
                ),
                createSwitch(
                    t("basicSettings.notCheckPluginVersion"),
                    "basic.notCheckPluginVersion",
                    notCheckPluginVersion ?? false,
                ),
                createSwitch(
                    t("basicSettings.lazyLoadPlugin"),
                    "basic.lazyLoadPlugin",
                    lazyLoadPlugin ?? false,
                ),
            ],
        },
        {
            title: t("basicSettings.playback"),
            data: [
                createSwitch(
                    t("basicSettings.notInterrupt"),
                    "basic.notInterrupt",
                    notInterrupt ?? false,
                ),
                createSwitch(
                    t("basicSettings.autoPlayWhenAppStart"),
                    "basic.autoPlayWhenAppStart",
                    autoPlayWhenAppStart ?? false,
                ),
                createSwitch(
                    t("basicSettings.tryChangeSourceWhenPlayFail"),
                    "basic.tryChangeSourceWhenPlayFail",
                    tryChangeSourceWhenPlayFail ?? false,
                ),
                createSwitch(
                    t("basicSettings.autoStopWhenError"),
                    "basic.autoStopWhenError",
                    autoStopWhenError ?? false,
                ),
                createRadio(
                    t("basicSettings.tempRemoteDuck"),
                    "basic.tempRemoteDuck",
                    ["pause", "lowerVolume"],
                    tempRemoteDuck ?? "pause",
                    {
                        pause: t("basicSettings.tempRemoteDuck.pause"),
                        "lowerVolume": t("basicSettings.tempRemoteDuck.lowerVolume"),
                    }
                ),
                ...(tempRemoteDuck === "lowerVolume" ? [
                    createRadio(
                        t("basicSettings.tempRemoteDuck.volumeDecreaseLevel"),
                        "basic.tempRemoteDuckVolume",
                        [0.3, 0.5, 0.8],
                        tempRemoteDuckVolume ?? 0.5,
                        {
                            0.3: "30%",
                            0.5: "50%",
                            0.8: "80%",
                        }
                    ),
                ] : []),
                createRadio(
                    t("basicSettings.defaultPlayQuality"),
                    "basic.defaultPlayQuality",
                    qualityKeys,
                    defaultPlayQuality ?? "standard",
                    {
                        low: t("musicQuality.low"),
                        standard: t("musicQuality.standard"),
                        high: t("musicQuality.high"),
                        super: t("musicQuality.super"),
                    },
                ),
                createRadio(
                    t("basicSettings.playQualityOrder"),
                    "basic.playQualityOrder",
                    ["asc", "desc"],
                    playQualityOrder ?? "asc",
                    {
                        asc: t("basicSettings.playQualityOrder.asc"),
                        desc: t("basicSettings.playQualityOrder.desc"),
                    },
                ),
            ],
        },
        {
            title: t("basicSettings.download"),
            data: [
                {
                    title: t("basicSettings.downloadPath"),
                    right: (
                        <ThemeText
                            fontSize="subTitle"
                            style={styles.centerText}
                            numberOfLines={3}>
                            {downloadPath ??
                                pathConst.downloadMusicPath}
                        </ThemeText>
                    ),
                    onPress() {
                        navigate<"file-selector">(ROUTE_PATH.FILE_SELECTOR, {
                            fileType: "folder",
                            multi: false,
                            actionText: t("basicSettings.fileSelector.selectFolder"),
                            async onAction(selectedFiles) {
                                try {
                                    const targetDir = selectedFiles[0];
                                    await readdir(targetDir.path);
                                    Config.setConfig(
                                        "basic.downloadPath",
                                        targetDir.path,
                                    );
                                    return true;
                                } catch {
                                    Toast.warn(t("toast.folderNotExistOrNoPermission"));
                                    return false;
                                }
                            },
                        });
                    },
                },
                createRadio(
                    t("basicSettings.maxDownload"),
                    "basic.maxDownload",
                    [1, 3, 5, 7],
                    maxDownload ?? 3,
                ),
                createRadio(
                    t("basicSettings.defaultDownloadQuality"),
                    "basic.defaultDownloadQuality",
                    qualityKeys,
                    defaultDownloadQuality ?? "standard",
                    {
                        low: t("musicQuality.low"),
                        standard: t("musicQuality.standard"),
                        high: t("musicQuality.high"),
                        super: t("musicQuality.super"),
                    },
                ),
                createRadio(
                    t("basicSettings.downloadQualityOrder"),
                    "basic.downloadQualityOrder",
                    ["asc", "desc"],
                    downloadQualityOrder ?? "asc",
                    {
                        asc: t("basicSettings.downloadQualityOrder.asc"),
                        desc: t("basicSettings.downloadQualityOrder.desc"),
                    },
                ),
            ],
        },
        {
            title: t("basicSettings.network"),
            data: [
                createSwitch(
                    t("basicSettings.useCelluarNetworkPlay"),
                    "basic.useCelluarNetworkPlay",
                    useCelluarNetworkPlay ?? false,
                ),
                createSwitch(
                    t("basicSettings.useCelluarNetworkDownload"),
                    "basic.useCelluarNetworkDownload",
                    useCelluarNetworkDownload ?? false,
                ),
            ],
        },
        {
            title: t("basicSettings.lyric"),
            data: [],
            footer: <LyricSetting />,
        },
        {
            title: t("basicSettings.cache"),
            data: [
                {
                    title: t("basicSettings.cache.musicCacheLimit"),
                    right: (
                        <ThemeText style={styles.centerText}>
                            {maxCacheSize
                                ? sizeFormatter(maxCacheSize)
                                : "512M"}
                        </ThemeText>
                    ),
                    onPress() {
                        showPanel("SimpleInput", {
                            title: t("dialog.setCacheTitle"),
                            placeholder: t("dialog.setCachePlaceholder"),
                            onOk(text, closePanel) {
                                let val = parseInt(text);
                                if (val < 100) {
                                    val = 100;
                                } else if (val > 8192) {
                                    val = 8192;
                                }
                                if (val >= 100 && val <= 8192) {
                                    Config.setConfig(
                                        "basic.maxCacheSize",
                                        val * 1024 * 1024,
                                    );
                                    closePanel();
                                    Toast.success(t("toast.cacheSetSuccess"));
                                }
                            },
                        });
                    },
                },

                {
                    title: t("basicSettings.cache.clearMusicCache"),
                    right: (
                        <ThemeText style={styles.centerText}>
                            {sizeFormatter(cacheSize.music)}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("SimpleDialog", {
                            title: t("dialog.clearMusicCacheTitle"),
                            content: t("dialog.clearMusicCacheContent"),
                            async onOk() {
                                await clearCache("music");
                                Toast.success(t("toast.musicCacheCleared"));
                                refreshCacheSize();
                            },
                        });
                    },
                },
                {
                    title: t("basicSettings.cache.clearLyricCache"),
                    right: (
                        <ThemeText style={styles.centerText}>
                            {sizeFormatter(cacheSize.lyric)}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("SimpleDialog", {
                            title: t("dialog.clearLyricCacheTitle"),
                            content: t("dialog.clearLyricCacheContent"),
                            async onOk() {
                                await clearCache("lyric");
                                Toast.success(t("toast.lyricCacheCleared"));
                                refreshCacheSize();
                            },
                        });
                    },
                },
                {
                    title: t("basicSettings.cache.clearImageCache"),
                    right: (
                        <ThemeText style={styles.centerText}>
                            {sizeFormatter(cacheSize.image)}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("SimpleDialog", {
                            title: t("dialog.clearImageCacheTitle"),
                            content: t("dialog.clearImageCacheContent"),
                            async onOk() {
                                await clearCache("image");
                                Toast.success(t("toast.imageCacheCleared"));
                                refreshCacheSize();
                            },
                        });
                    },
                },
            ],
        },
        {
            title: t("basicSettings.developer"),
            data: [
                {
                    title: "glory重构TV版",
                    right: (
                        <ThemeText fontColor="textSecondary">
                            遥控器深度适配 · v1.0.0 ›
                        </ThemeText>
                    ),
                    onPress: () => {
                        navigate(ROUTE_PATH.ABOUT);
                    },
                },
                createSwitch(
                    t("basicSettings.developer.errorLog"),
                    "debug.errorLog",
                    debugEnableErrorLog ?? false,
                ),
                createSwitch(
                    t("basicSettings.developer.traceLog"),
                    "debug.traceLog",
                    debugEnableTraceLog ?? false,
                ),
                createSwitch(
                    t("basicSettings.developer.devLog"),
                    "debug.devLog",
                    debugEnableDevLog ?? false,
                ),
                {
                    title: t("basicSettings.developer.viewErrorLog"),
                    right: undefined,
                    async onPress() {
                        // 获取日志文件夹
                        const errorLogContent = await getErrorLogContent();
                        showDialog("SimpleDialog", {
                            title: t("dialog.errorLogTitle"),
                            content: (
                                <ScrollView>
                                    <Paragraph>
                                        {errorLogContent || t("dialog.errorLogNoRecord")}
                                    </Paragraph>
                                </ScrollView>
                            ),
                            cancelText: t("dialog.errorLogKnow"),
                            okText: t("dialog.errorLogCopy"),
                            onOk() {
                                Clipboard.setString(errorLogContent);
                                Toast.success(t("toast.copiedToClipboard"));
                            },
                        });
                    },
                },
                {
                    title: t("basicSettings.developer.clearLog"),
                    right: undefined,
                    async onPress() {
                        try {
                            await clearLog();
                            Toast.success(t("toast.logCleared"));
                        } catch { }
                    },
                },
            ],
        },
    ];

    const activeSectionRef = React.useRef(activeSection);
    activeSectionRef.current = activeSection;
    const lastItemRef = React.useRef(0);

    // 板块切换时记录的位置归零；首次进入把焦点落到第一个板块（不是"涂满即选中"）
    React.useEffect(() => {
        lastItemRef.current = 0;
    }, [activeSection]);

    React.useEffect(() => {
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tvFocus.focusByName("basic:nav:0") || tries > 12) {
                clearInterval(timer);
            }
        }, 200);
        return () => clearInterval(timer);
    }, []);

    useTvKeys((key, action) => {
        if (action !== "down") {
            return false;
        }
        const name = tvFocus.getFocusedNode()?.debugName ?? "";
        // 左栏板块列表：遥控上下按序号移动，同时切换右侧内容。
        // 不再交给空间导航去猜，避免焦点落到被滚动裁掉一半的卡片上。
        if ((key === "up" || key === "down") && name.startsWith("basic:nav:")) {
            const index = Number(name.split(":")[2]);
            if (!Number.isNaN(index)) {
                const next = index + (key === "down" ? 1 : -1);
                if (next >= 0 && next < basicOptions.length) {
                    setActiveSection(next);
                    tvFocus.focusByName(`basic:nav:${next}`);
                    return true;
                }
            }
            return false;
        }
        if (key === "right" && name.startsWith("basic:nav:")) {
            return tvFocus.focusByName(
                `basic:item:${lastItemRef.current}`,
            );
        }
        if (key === "left" && name.startsWith("basic:item:")) {
            const index = Number(name.split(":")[2]);
            if (!Number.isNaN(index)) {
                lastItemRef.current = index;
            }
            return tvFocus.focusByName(`basic:nav:${activeSectionRef.current}`);
        }
        return false;
    });

    return (
        <View style={styles.tvWrapper}>
            {/* 左：十个大板块，固定竖向列表，遥控上下直接走 */}
            <TvScrollView style={styles.tvNav}>
                {basicOptions.map((section, index) => (
                    <TvFocusable
                        key={section.title}
                        name={`basic:nav:${index}`}
                        focusOrder={index}
                        onPress={() => {
                            setActiveSection(index);
                        }}
                        style={[
                            styles.tvNavItem,
                            activeSection === index
                                ? styles.tvNavItemActive
                                : null,
                        ]}>
                        <ThemeText fontWeight="bold" fontSize="subTitle">
                            {section.title}
                        </ThemeText>
                    </TvFocusable>
                ))}
            </TvScrollView>

            {/* 右：当前板块的全部选项，平铺（不做虚拟化，避免测不到坐标） */}
            <TvScrollView style={styles.tvBody}>
                {(basicOptions[activeSection]?.data ?? []).map((item, index) => {
                    const Right = item.right;
                    return (
                        <TvFocusable
                            key={`${activeSection}-${index}-${item.title}`}
                            name={`basic:item:${index}`}
                            focusOrder={100 + index}
                            style={styles.tvCard}
                            onPress={item.onPress}>
                            <ThemeText fontSize="subTitle" style={styles.tvCardTitle}>
                                {item.title}
                            </ThemeText>
                            <View pointerEvents="none" style={styles.tvCardValue}>
                                {Right ?? (
                                    <ThemeText fontSize="subTitle">›</ThemeText>
                                )}
                            </View>
                        </TvFocusable>
                    );
                })}
                {(basicOptions[activeSection]?.footer as any) ?? null}
            </TvScrollView>
        </View>
    );
}


/** TV 滑杆：焦点在它身上时，遥控左右键调节数值（不需要鼠标拖动） */
function TvSliderRow(props: {
    title: string;
    initialValue: number;
    onChange?: (value: number) => void;
    onComplete?: (value: number) => void;
    fontSizeMode?: boolean;
}) {
    const { title, initialValue, onChange, onComplete } = props;
    const colors = useColors();
    const [value, setValue] = React.useState<number>(initialValue ?? 0);
    const valueRef = React.useRef<number>(initialValue ?? 0);
    const name = React.useMemo(() => `tvs:${title}`, [title]);
    const min = props.fontSizeMode ? 0.1 : 0;
    const max = props.fontSizeMode ? 1 : 1;
    const step = 0.05;

    React.useEffect(() => {
        valueRef.current = initialValue ?? 0;
        setValue(initialValue ?? 0);
    }, [initialValue]);

    useTvKeys((key: string, action: string) => {
        if (action !== "down") {
            return false;
        }
        if ((tvFocus.getFocusedNode()?.debugName ?? "") !== name) {
            return false;
        }
        if (key !== "left" && key !== "right") {
            return false;
        }
        const next = Math.min(
            max,
            Math.max(min, valueRef.current + (key === "left" ? -step : step)),
        );
        valueRef.current = next;
        setValue(next);
        onChange?.(next);
        onComplete?.(next);
        return true;
    });

    const percent = Math.round(
        ((value - min) / (max - min || 1)) * 100,
    );

    return (
        <TvFocusable
            name={name}
            focusOrder={200}
            style={styles.tvSlider}
            onPress={() => {
                const next = Math.min(max, Math.max(min, valueRef.current + step));
                valueRef.current = next;
                setValue(next);
                onChange?.(next);
                onComplete?.(next);
            }}>
            <ThemeText fontSize="subTitle">{title}</ThemeText>
            <View style={styles.tvSliderTrack}>
                <View
                    style={[
                        styles.tvSliderFill,
                        { width: `${percent}%`, backgroundColor: colors.primary },
                    ]}
                />
            </View>
            <ThemeText fontSize="description">{percent}%</ThemeText>
        </TvFocusable>
    );
}

const styles = StyleSheet.create({
    tvRow: {
        width: "100%",
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(24),
    },
    tvSlider: {
        width: "100%",
        height: rpx(78),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(16),
        marginVertical: rpx(4),
        borderRadius: rpx(10),
    },
    tvSliderTrack: {
        flex: 1,
        height: rpx(10),
        marginHorizontal: rpx(16),
        borderRadius: rpx(5),
        backgroundColor: "rgba(255,255,255,0.22)",
        justifyContent: "center",
    },
    tvSliderFill: {
        height: rpx(10),
        borderRadius: rpx(5),
    },
    tvCard: {
        width: "96%",
        height: rpx(78),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(20),
        marginVertical: rpx(5),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    tvCardTitle: {
        flexShrink: 1,
    },
    tvCardValue: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: rpx(12),
    },
    tvCtl: {
        minWidth: rpx(96),
        minHeight: rpx(56),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: rpx(10),
        borderRadius: rpx(10),
    },
    tvWrapper: {
        flex: 1,
        width: "100%",
        flexDirection: "row",
        paddingBottom: rpx(24),
    },
    tvNav: {
        width: rpx(260),
        marginRight: rpx(20),
        paddingHorizontal: rpx(12),
    },
    tvNavItemActive: {
        borderLeftWidth: rpx(6),
        borderLeftColor: "#5fd0ff",
        backgroundColor: "rgba(95,208,255,0.16)",
    },
    tvNavItem: {
        height: rpx(64),
        borderRadius: rpx(8),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: rpx(8),
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    tvBody: {
        flex: 1,
    },
    wrapper: {
        width: "100%",
        paddingBottom: rpx(24),
        flex: 1,
    },
    centerText: {
        textAlignVertical: "center",
        maxWidth: rpx(400),
    },
    sectionHeader: {
        paddingHorizontal: rpx(24),
        height: rpx(72),
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(20),
    },
    headerContainer: {
        height: rpx(80),
    },
    headerContentContainer: {
        height: rpx(80),
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    headerItemStyle: {
        paddingHorizontal: rpx(36),
        height: rpx(80),
        justifyContent: "center",
        alignItems: "center",
    },
});

function LyricSetting() {
    /**
     * // Lyric
     *     "lyric.showStatusBarLyric": boolean;
     *     "lyric.topPercent": number;
     *     "lyric.leftPercent": number;
     *     "lyric.align": number;
     *     "lyric.color": string;
     *     "lyric.backgroundColor": string;
     *     "lyric.widthPercent": number;
     *     "lyric.fontSize": number;
     *     "lyric.detailFontSize": number;
     *     "lyric.autoSearchLyric": boolean;
     */
    const showStatusBarLyric = useAppConfig("lyric.showStatusBarLyric");
    const topPercent = useAppConfig("lyric.topPercent");
    const leftPercent = useAppConfig("lyric.leftPercent");
    const align = useAppConfig("lyric.align");
    const color = useAppConfig("lyric.color");
    const backgroundColor = useAppConfig("lyric.backgroundColor");
    const widthPercent = useAppConfig("lyric.widthPercent");
    const fontSize = useAppConfig("lyric.fontSize");
    const enableAutoSearchLyric = useAppConfig("lyric.autoSearchLyric");



    const colors = useColors();

    const { t } = useI18N();

    const autoSearchLyric = createSwitch(
        t("basicSettings.lyric.autoSearchLyric"),
        "lyric.autoSearchLyric",
        enableAutoSearchLyric ?? false,
    );

    const openStatusBarLyric = createSwitch(
        t("basicSettings.lyric.showStatusBarLyric"),
        "lyric.showStatusBarLyric",
        showStatusBarLyric ?? false,
        async newValue => {
            try {
                if (newValue) {
                    const hasPermission =
                        await LyricUtil.checkSystemAlertPermission();

                    if (hasPermission) {
                        const statusBarLyricConfig = {
                            topPercent: Config.getConfig("lyric.topPercent"),
                            leftPercent: Config.getConfig("lyric.leftPercent"),
                            align: Config.getConfig("lyric.align"),
                            color: Config.getConfig("lyric.color"),
                            backgroundColor: Config.getConfig("lyric.backgroundColor"),
                            widthPercent: Config.getConfig("lyric.widthPercent"),
                            fontSize: Config.getConfig("lyric.fontSize"),
                        };
                        LyricUtil.showStatusBarLyric(
                            "MusicFree",
                            statusBarLyricConfig ?? {}
                        );
                        Config.setConfig("lyric.showStatusBarLyric", true);
                    } else {
                        LyricUtil.requestSystemAlertPermission().finally(() => {
                            Toast.warn(t("toast.noFloatWindowPermission"));
                        });
                    }
                } else {
                    LyricUtil.hideStatusBarLyric();
                    Config.setConfig("lyric.showStatusBarLyric", false);
                }
            } catch { }
        },
    );

    const alignStatusBarLyric = createRadio(
        t("basicSettings.lyric.align"),
        "lyric.align",
        [
            NativeTextAlignment.LEFT,
            NativeTextAlignment.CENTER,
            NativeTextAlignment.RIGHT,
        ],
        align ?? NativeTextAlignment.CENTER,
        {
            [NativeTextAlignment.LEFT]: t("basicSettings.lyric.align.left"),
            [NativeTextAlignment.CENTER]: t("basicSettings.lyric.align.center"),
            [NativeTextAlignment.RIGHT]: t("basicSettings.lyric.align.right"),
        },
        newVal => {
            if (showStatusBarLyric) {
                LyricUtil.setStatusBarLyricAlign(newVal as any);
            }
        },
    );

    return (
        <View>
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={autoSearchLyric.onPress}>
                <ListItem.Content title={autoSearchLyric.title} />
                {autoSearchLyric.right}
            </ListItem>
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={openStatusBarLyric.onPress}>
                <ListItem.Content title={openStatusBarLyric.title} />
                {openStatusBarLyric.right}
            </ListItem>
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={alignStatusBarLyric.onPress}>
                <ListItem.Content title={alignStatusBarLyric.title} />
                {alignStatusBarLyric.right}
            </ListItem>
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={() => {
                    showPanel("SimpleSelect", {
                        header: "歌词文字颜色（共 100 色）",
                        candidates: LYRIC_TEXT_COLORS, 
                        onPress(item: any) {
                            const colorStr = item.value;
                            Config.setConfig("lyric.color", colorStr);
                            if (showStatusBarLyric) {
                                LyricUtil.setStatusBarColors(colorStr, null);
                            }
                        },
                    });
                }}>
                <ListItem.Content title={t("basicSettings.lyric.textColor")} />
                <ColorBlock color={color ?? "#FFE9D2FF"} />
            </ListItem>
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={() => {
                    showPanel("SimpleSelect", {
                        header: "歌词背景颜色（共 100 色）",
                        candidates: LYRIC_BG_COLORS, 
                        onPress(item: any) {
                            const colorStr = item.value;
                            Config.setConfig("lyric.backgroundColor", colorStr);
                            if (showStatusBarLyric) {
                                LyricUtil.setStatusBarColors(null, colorStr);
                            }
                        },
                    });
                }}>
                <ListItem.Content title={t("basicSettings.lyric.backgroundColor")} />
                <ColorBlock
                    color={backgroundColor ?? "#84888153"}
                />
            </ListItem>
        </View>
    );
}

const lyricStyles = StyleSheet.create({
    slider: {
        flex: 1,
        marginLeft: rpx(24),
    },
    sliderContainer: {
        height: rpx(96),
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
});
