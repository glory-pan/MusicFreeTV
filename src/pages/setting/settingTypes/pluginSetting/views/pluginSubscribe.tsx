import AppBar from "@/components/base/appBar";
import Empty from "@/components/base/empty";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import { TvFocusable } from "@/tv/components";
import { tvFocus } from "@/tv/focusStore";
import { TvScrollView } from "@/tv/scroll";
import rpx, { vh } from "@/utils/rpx";
import Toast from "@/utils/toast";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

interface ISubscribeItem {
    name: string;
    url: string;
}

/**
 * 订阅设置（电视版）。
 *
 * 手机版是一列 ListItem + 右下角 Fab，遥控器够不着也很难看。
 * 电视版改成：顶部一条「＋ 添加订阅」大按钮（进页面的第一焦点），下面是订阅列表；
 * 选中某一条按 OK = 打开编辑弹窗（改名 / 改链接 / 删除），方向全用显式链接。
 */
export default function PluginSubscribe() {
    const urls = useAppConfig("plugin.subscribeUrl") ?? "";
    const [subscribes, setSubscribes] = useState<Array<ISubscribeItem>>([]);

    const { t } = useI18N();

    useEffect(() => {
        try {
            const parsed = JSON.parse(urls);
            if (Array.isArray(parsed)) {
                setSubscribes(parsed);
            } else {
                throw new Error();
            }
        } catch {
            if (urls.length) {
                setSubscribes([
                    {
                        name: t("common.default"),
                        url: urls,
                    },
                ]);
            } else {
                setSubscribes([]);
            }
        }
    }, [urls]);

    // 进页面把光环落到「添加订阅」上，列表是异步读配置的，多试几次兜底
    useEffect(() => {
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tvFocus.focusByName("sub:add", true) || tries > 8) {
                clearInterval(timer);
            }
        }, 250);
        return () => clearInterval(timer);
    }, []);

    const onSubmit = (
        subscribeItem: ISubscribeItem,
        hideDialog: () => void,
        editingIndex?: number,
    ) => {
        if (
            subscribeItem.url.endsWith(".js") ||
            subscribeItem.url.endsWith(".json")
        ) {
            if (editingIndex !== undefined) {
                Config.setConfig(
                    "plugin.subscribeUrl",
                    JSON.stringify([
                        ...subscribes.slice(0, editingIndex),
                        subscribeItem,
                        ...subscribes.slice(editingIndex + 1),
                    ]),
                );
            } else {
                Config.setConfig(
                    "plugin.subscribeUrl",
                    JSON.stringify([...subscribes, subscribeItem]),
                );
            }
            hideDialog();
        } else {
            Toast.warn(t("toast.subscriptionHaveToEndWithJs"));
        }
    };

    return (
        <>
            <AppBar>{t("pluginSetting.menu.subscriptionSetting")}</AppBar>
            <View style={styles.page}>
                <View style={styles.header}>
                    <TvFocusable
                        name="sub:add"
                        focusOrder={-10}
                        downName={
                            subscribes.length ? "sub:row:0" : undefined
                        }
                        style={styles.addBtn}
                        onPress={() => {
                            showDialog("SubscribePluginDialog", { onSubmit });
                        }}>
                        <ThemeText
                            fontSize="content"
                            fontWeight="medium"
                            style={styles.addText}>
                            ＋ 添加订阅
                        </ThemeText>
                    </TvFocusable>
                    <View style={styles.headerText}>
                        <ThemeText fontSize="title" fontWeight="bold">
                            {t("pluginSetting.menu.subscriptionSetting")}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.hint}>
                            共 {subscribes.length} 条订阅源 · 选中后按 OK
                            可以改名、改链接或删除
                        </ThemeText>
                    </View>
                </View>

                {subscribes.length === 0 ? (
                    <View style={styles.empty}>
                        <Empty />
                    </View>
                ) : (
                    <TvScrollView style={styles.list}>
                        {subscribes.map((item, index) => (
                            <TvFocusable
                                key={`subrow-${index}-${item.url}`}
                                name={`sub:row:${index}`}
                                focusOrder={index}
                                upName={
                                    index > 0
                                        ? `sub:row:${index - 1}`
                                        : "sub:add"
                                }
                                downName={
                                    index < subscribes.length - 1
                                        ? `sub:row:${index + 1}`
                                        : undefined
                                }
                                style={styles.row}
                                onPress={() => {
                                    showDialog("SubscribePluginDialog", {
                                        subscribeItem: item,
                                        onSubmit,
                                        editingIndex: index,
                                        onDelete(
                                            editingIndex: number,
                                            hideDialog: () => void,
                                        ) {
                                            Config.setConfig(
                                                "plugin.subscribeUrl",
                                                JSON.stringify([
                                                    ...subscribes.slice(
                                                        0,
                                                        editingIndex,
                                                    ),
                                                    ...subscribes.slice(
                                                        editingIndex + 1,
                                                    ),
                                                ]),
                                            );
                                            hideDialog();
                                            Toast.success(
                                                t("toast.deleteSuccess"),
                                            );
                                        },
                                    });
                                }}>
                                <View style={styles.badge}>
                                    <ThemeText
                                        fontSize="description"
                                        style={styles.badgeText}>
                                        {index + 1}
                                    </ThemeText>
                                </View>
                                <View style={styles.rowBody}>
                                    <ThemeText
                                        fontSize="content"
                                        fontWeight="medium"
                                        numberOfLines={1}
                                        style={styles.rowName}>
                                        {item.name}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary"
                                        numberOfLines={1}
                                        style={styles.rowUrl}>
                                        {item.url}
                                    </ThemeText>
                                </View>
                                <ThemeText
                                    fontSize="description"
                                    style={styles.rowEdit}>
                                    编辑 ›
                                </ThemeText>
                            </TvFocusable>
                        ))}
                    </TvScrollView>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        paddingHorizontal: rpx(36),
        paddingBottom: rpx(24),
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: rpx(16),
    },
    addBtn: {
        width: rpx(260),
        height: rpx(72),
        borderRadius: rpx(36),
        alignItems: "center",
        justifyContent: "center",
        marginRight: rpx(24),
        backgroundColor: "rgba(95,208,255,0.20)",
        borderWidth: rpx(1),
        borderColor: "rgba(160,230,255,0.60)",
    },
    addText: {
        color: "#dff4ff",
    },
    headerText: {
        flex: 1,
    },
    hint: {
        marginTop: rpx(4),
    },
    list: {
        maxHeight: vh(68),
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        height: rpx(100),
        marginBottom: rpx(10),
        paddingHorizontal: rpx(16),
        borderRadius: rpx(14),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    badge: {
        width: rpx(40),
        height: rpx(40),
        borderRadius: rpx(20),
        alignItems: "center",
        justifyContent: "center",
        marginRight: rpx(14),
        backgroundColor: "rgba(255,255,255,0.14)",
    },
    badgeText: {
        color: "#ffffff",
    },
    rowBody: {
        flex: 1,
    },
    rowName: {
        color: "#ffffff",
    },
    rowUrl: {
        marginTop: rpx(4),
    },
    rowEdit: {
        color: "#9ad1ff",
        marginLeft: rpx(12),
    },
    empty: {
        marginTop: rpx(80),
    },
});
