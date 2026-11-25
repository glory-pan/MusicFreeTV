import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { tvFocus } from "@/tv/focusStore";
import { TvFocusable } from "@/tv/components";
import { TvScrollView } from "@/tv/scroll";
import rpx, { vh } from "@/utils/rpx";
import Toast from "@/utils/toast";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

/**
 * 插件排序（电视版）。
 *
 * 原来是手机逻辑：长按拖拽 —— 遥控器根本做不出来。
 * 现在换成电视上通用的"先选一行，再用按钮挪位置"：
 *
 *   左栏：插件清单（上下键选，「已选中」那一行有琥珀色底）
 *   右栏：上移 / 下移 / 保存 / 返回
 *
 * 方向全部用显式链接（右栏按钮按「左」直接回到你刚选中的那一行），
 * 不依赖慢设备上的几何判定。
 */
export default function PluginSort() {
    const plugins = useSortedPlugins();
    const { t } = useI18N();
    const navigator = useNavigation<any>();

    const initial = useMemo(() => [...plugins], [plugins]);
    const [order, setOrder] = useState(initial);
    const [selected, setSelected] = useState(0);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        setOrder([...plugins]);
        setSelected(0);
    }, [plugins]);

    // 进页面先把光环落在第一行；插件列表是异步加载的，这里多试几次
    useEffect(() => {
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tvFocus.focusByName("sort:row:0", true) || tries > 8) {
                clearInterval(timer);
            }
        }, 250);
        return () => clearInterval(timer);
    }, []);

    const move = (dir: -1 | 1) => {
        const to = selected + dir;
        if (to < 0 || to >= order.length) {
            Toast.warn("已经到头了");
            return;
        }
        const next = [...order];
        const tmp = next[selected];
        next[selected] = next[to];
        next[to] = tmp;
        setOrder(next);
        setSelected(to);
        setDirty(true);
    };

    const save = () => {
        PluginManager.setPluginOrder(order);
        setDirty(false);
        Toast.success(t("toast.saveSuccess"));
    };

    return (
        <>
            <AppBar onBackPress={() => navigator.goBack?.()}>
                {t("pluginSetting.menu.sort")}
            </AppBar>
            <View style={styles.page}>
                <View style={styles.leftCard}>
                    <View style={styles.leftHeader}>
                        <ThemeText fontSize="title" fontWeight="bold">
                            {t("pluginSetting.menu.sort")}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.hint}>
                            上下键选一行 → 按 OK 跳到右栏 → 「上移/下移」挪位置 →
                            保存
                        </ThemeText>
                    </View>
                    <TvScrollView style={styles.list}>
                        {order.map((plugin, index) => {
                            const isSel = index === selected;
                            return (
                                <TvFocusable
                                    key={`sortrow-${index}-${plugin.name}`}
                                    name={`sort:row:${index}`}
                                    focusOrder={index}
                                    upName={
                                        index > 0
                                            ? `sort:row:${index - 1}`
                                            : undefined
                                    }
                                    downName={
                                        index < order.length - 1
                                            ? `sort:row:${index + 1}`
                                            : undefined
                                    }
                                    rightName="sort:act:up"
                                    style={[
                                        styles.row,
                                        isSel ? styles.rowSelected : null,
                                    ]}
                                    onPress={() => {
                                        setSelected(index);
                                        tvFocus.focusByName(
                                            "sort:act:up",
                                            true,
                                        );
                                    }}>
                                    <View
                                        style={[
                                            styles.badge,
                                            isSel ? styles.badgeSel : null,
                                        ]}>
                                        <ThemeText
                                            fontSize="description"
                                            style={styles.badgeText}>
                                            {index + 1}
                                        </ThemeText>
                                    </View>
                                    <View style={styles.rowBody}>
                                        <ThemeText
                                            fontSize="content"
                                            numberOfLines={1}
                                            style={styles.rowName}>
                                            {plugin.name}
                                        </ThemeText>
                                        {isSel ? (
                                            <ThemeText
                                                fontSize="description"
                                                style={styles.selTip}>
                                                已选中 · 去右栏调整位置
                                            </ThemeText>
                                        ) : null}
                                    </View>
                                </TvFocusable>
                            );
                        })}
                        {order.length === 0 ? (
                            <ThemeText
                                fontSize="content"
                                fontColor="textSecondary"
                                style={styles.empty}>
                                还没有安装插件
                            </ThemeText>
                        ) : null}
                    </TvScrollView>
                </View>

                <View style={styles.rightCard}>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.rightHint}>
                        {order.length ? selected + 1 : 0} / {order.length}
                    </ThemeText>
                    {[
                        {
                            name: "sort:act:up",
                            label: "上移 ▲",
                            onPress: () => move(-1),
                            primary: false,
                        },
                        {
                            name: "sort:act:down",
                            label: "下移 ▼",
                            onPress: () => move(1),
                            primary: false,
                        },
                        {
                            name: "sort:act:save",
                            label: "保存",
                            onPress: save,
                            primary: true,
                        },
                        {
                            name: "sort:act:back",
                            label: "返回",
                            onPress: () => navigator.goBack?.(),
                            primary: false,
                        },
                    ].map((btn, index, arr) => (
                        <TvFocusable
                            key={btn.name}
                            name={btn.name}
                            focusOrder={100 + index}
                            upName={
                                index > 0 ? arr[index - 1].name : undefined
                            }
                            downName={
                                index < arr.length - 1
                                    ? arr[index + 1].name
                                    : undefined
                            }
                            leftName={
                                order.length
                                    ? `sort:row:${Math.min(
                                          selected,
                                          order.length - 1,
                                      )}`
                                    : undefined
                            }
                            style={[
                                styles.actBtn,
                                btn.primary ? styles.actBtnPrimary : null,
                            ]}
                            onPress={btn.onPress}>
                            <ThemeText
                                fontSize="content"
                                fontWeight="medium"
                                style={styles.actText}>
                                {btn.label}
                            </ThemeText>
                        </TvFocusable>
                    ))}
                    {dirty ? (
                        <ThemeText
                            fontSize="description"
                            style={styles.dirtyTip}>
                            有改动未保存
                        </ThemeText>
                    ) : null}
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: rpx(36),
        paddingBottom: rpx(24),
    },
    leftCard: {
        flex: 1,
        marginRight: rpx(24),
        paddingHorizontal: rpx(16),
        paddingTop: rpx(12),
        paddingBottom: rpx(8),
        borderRadius: rpx(18),
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: rpx(1),
        borderColor: "rgba(140,190,255,0.22)",
    },
    leftHeader: {
        marginBottom: rpx(10),
        paddingHorizontal: rpx(6),
    },
    hint: {
        marginTop: rpx(4),
    },
    list: {
        maxHeight: vh(72),
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        height: rpx(88),
        marginBottom: rpx(8),
        paddingHorizontal: rpx(14),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    rowSelected: {
        backgroundColor: "rgba(255,196,90,0.20)",
        borderWidth: rpx(2),
        borderColor: "rgba(255,206,120,0.85)",
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
    badgeSel: {
        backgroundColor: "rgba(255,196,90,0.55)",
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
    selTip: {
        marginTop: rpx(2),
        color: "#ffd88a",
    },
    empty: {
        paddingVertical: rpx(40),
        textAlign: "center",
    },
    rightCard: {
        width: rpx(280),
        paddingHorizontal: rpx(14),
        paddingTop: rpx(12),
        paddingBottom: rpx(14),
        borderRadius: rpx(18),
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: rpx(1),
        borderColor: "rgba(140,190,255,0.22)",
    },
    rightHint: {
        marginBottom: rpx(8),
        textAlign: "center",
    },
    actBtn: {
        height: rpx(72),
        marginBottom: rpx(10),
        borderRadius: rpx(36),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
        borderWidth: rpx(1),
        borderColor: "rgba(160,210,255,0.35)",
    },
    actBtnPrimary: {
        backgroundColor: "rgba(95,208,255,0.20)",
        borderColor: "rgba(160,230,255,0.60)",
    },
    actText: {
        color: "#eaf6ff",
    },
    dirtyTip: {
        marginTop: rpx(6),
        textAlign: "center",
        color: "#ffd88a",
    },
});
