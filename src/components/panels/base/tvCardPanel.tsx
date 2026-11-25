import React, { useRef } from "react";
import { BackHandler, DeviceEventEmitter, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import { Pressable as RNPressable } from "react-native";
import { TvFocusable, TvFocusLayer } from "@/tv/components";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import { vh } from "@/utils/rpx";
import { tvFocus } from "@/tv/focusStore";
import { hidePanel, panelInfoStore } from "../usePanel";
import Icon from "@/components/base/icon";

interface ITvCardPanelProps {
    title: string;
    /** 卡片内第一个可聚焦元素的 name，用来做自动聚焦 */
    firstFocusName?: string;
    width?: number;
    /** 关闭后把光环还给页面上的这个元素（默认播放页的播放/暂停键） */
    returnFocusName?: string;
    /** 居中显示（输入框这类需要整屏居中的面板用）；默认是左下浮层卡片 */
    center?: boolean;
    /** 面板记忆的键：同一张卡重新打开时，光环回到上次选中的那一项 */
    rememberKey?: string;
    children?: any;
}

/**
 * 电视端浮层卡片：浮在**播放器那一侧**（屏幕左下），
 * 不再像手机端那样整屏抽屉把右侧歌词遮住。
 *
 * 注意：卡片必须是**独立焦点图层**，否则卡片里的按钮和播放页的按钮会混在一起，
 * 表现就是"没有光环、乱跳、按返回也关不掉"。所以这里自己做图层 + 返回键 + 关闭事件。
 */
export default function TvCardPanel(props: ITvCardPanelProps) {
    const { title, children, firstFocusName, width, returnFocusName } =
        props;
    const center = props.center;
    const rememberKey = props.rememberKey ?? (typeof title === "string" ? title : "panel");
    const myLayer = useRef<number>(0);
    React.useEffect(() => {
        tvFocus.setPanelKey(rememberKey);
        // 返回键 = 关闭卡片，并且不再往下传给页面（否则会直接退出播放页，看起来像卡死）
        const back = BackHandler.addEventListener("hardwareBackPress", () => {
            hidePanel();
            return true;
        });
        // 统一关闭通道：任何地方调用 hidePanel() 都能关掉这张卡
        const sub = DeviceEventEmitter.addListener(
            "hidePanel",
            (callback?: () => void) => {
                panelInfoStore.setValue({ name: null, payload: null });
                callback?.();
            },
        );
        return () => {
            back.remove();
            sub.remove();
            // 记下"关掉之前停在哪个选项"，下次打开这张卡直接回到它
            tvFocus.rememberPanelFocus();
            tvFocus.setPanelKey(null);
            tvFocus.closePanelSession();
            // 卡片关闭后把光环交还给它背后的页面：
            // 单个 focusFirstInActiveLayer 在页面节点还没测量完时会失败，
            // 这里做三级兜底，保证"关掉卡片后一定能看到光环"。
            const restore = () => {
                if (tvFocus.hasVisibleFocus()) {
                    // 引擎已经把光环送回打开这张卡的选项上了，别再抢
                    return true;
                }
                if (
                    returnFocusName &&
                    tvFocus.focusByName(returnFocusName)
                ) {
                    return true;
                }
                if (tvFocus.focusFirstInActiveLayer()) {
                    return true;
                }
                tvFocus.refocus();
                return false;
            };
            let tries = 0;
            const timer = setInterval(() => {
                tries += 1;
                if (restore() || tries > 8) {
                    clearInterval(timer);
                }
            }, 300);
        };
    }, []);

    React.useEffect(() => {
        // 首焦点：上次在这张卡里选中的项 > 指定元素 > 卡片里第一个可聚焦元素
        const rawMemo = tvFocus.getPanelMemo(rememberKey);
        // 上次是停在右上角的 × 上就没有参考价值，直接忽略
        const remembered =
            rawMemo && rawMemo !== "tvcard:close" ? rawMemo : undefined;
        const timers: any[] = [];
        const tryFocus = () => {
            if (remembered && tvFocus.focusByName(remembered)) {
                return true;
            }
            if (firstFocusName && tvFocus.focusByName(firstFocusName, true)) {
                return true;
            }
            // 按"本卡片自己的图层"硬兜底：这一步不依赖任何作用域判断，
            // 只要卡片里画得出来，光环就一定落得进去
            if (myLayer.current && tvFocus.focusFirstInLayer(myLayer.current)) {
                return true;
            }
            // 最后一招：直接在"最新建立的浮层"里按座位号找第一个按钮，
            // 不看作用域、不看路由 —— 这条路在真机上不会再扑空
            if (tvFocus.focusFirstInNewestFloat()) {
                return true;
            }
            return tvFocus.focusFirstInActiveLayer();
        };
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tryFocus() || tries > 10) {
                clearInterval(timer);
            }
        }, 160);
        timers.push(timer);
        return () => {
            timers.forEach(t => clearInterval(t));
        };
    }, [firstFocusName, rememberKey]);

    return (
        <TvFocusLayer
            onReady={layer => {
                myLayer.current = layer;
            }}>
            <View style={styles.overlay} pointerEvents="box-none">
                {/* 遮罩不注册焦点：否则首焦点落在整屏遮罩上，卡片里的按钮永远拿不到光环 */}
                <RNPressable onPress={hidePanel} style={styles.backdrop} />
                <View
                    style={[
                        styles.cardWrap,
                        center ? styles.cardWrapCenter : null,
                    ]}
                    pointerEvents="box-none">
                <View
                    style={[
                        styles.card,
                        width ? { width } : null,
                    ]}>
                    <View style={styles.header}>
                        <ThemeText fontSize="title" fontWeight="bold">
                            {title}
                        </ThemeText>
                        <TvFocusable
                            name="tvcard:close"
                            focusOrder={900}
                            style={styles.close}
                            onPress={hidePanel}>
                            <Icon
                                accessible={false}
                                name="x-mark"
                                size={rpx(30)}
                                color="#ffffff"
                            />
                        </TvFocusable>
                    </View>
                    <ScrollView style={styles.body}>{children}</ScrollView>
                </View>
                </View>
            </View>
        </TvFocusLayer>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        elevation: 100,
    },
    backdrop: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    cardWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    cardWrapCenter: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    card: {
        width: rpx(560),
        maxHeight: "88%",
        overflow: "hidden",
        borderRadius: rpx(20),
        paddingHorizontal: rpx(22),
        paddingVertical: rpx(18),
        backgroundColor: "#101a2b",
        borderWidth: rpx(2),
        borderColor: "rgba(120,170,255,0.55)",
    },
    cardCenter: {
        maxHeight: "88%",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: rpx(12),
    },
    close: {
        width: rpx(56),
        height: rpx(56),
        borderRadius: rpx(28),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    body: {
        width: "100%",
        maxHeight: vh(76),
        flexGrow: 0,
        flexShrink: 1,
    },
});
