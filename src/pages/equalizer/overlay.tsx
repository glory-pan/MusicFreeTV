import React from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { TvFocusable, TvFocusLayer } from "@/tv/components";
import EqualizerBody from "./body";
import rpx, { vh } from "@/utils/rpx";
import Icon from "@/components/base/icon";

interface IProps {
    visible: boolean;
    onClose: () => void;
}

/**
 * 播放页内嵌的均衡器浮层。
 * 只占**左半屏**（播放器那一侧），右侧歌词始终露出来，不再像之前那样一张
 * 82% 宽的大卡横跨全屏把歌词盖住。深色不透明 + 细边 + 分组标题，电视上更耐看。
 */
export default function EqualizerOverlay({ visible, onClose }: IProps) {
    React.useEffect(() => {
        if (!visible) {
            return;
        }
        // 浮层开着的时候，返回键只关浮层 —— 之前会直接退出播放页
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            onClose();
            return true;
        });
        return () => sub.remove();
    }, [visible, onClose]);

    if (!visible) {
        return null;
    }
    return (
        <View style={styles.mask} pointerEvents="box-none">
            <TvFocusLayer>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <View style={styles.accent} />
                            <Text style={styles.title}>均衡器</Text>
                        </View>
                        <TvFocusable
                            name="eq:close"
                            focusOrder={-10}
                            style={styles.close}
                            onPress={onClose}>
                            <Icon
                                accessible={false}
                                name="x-mark"
                                size={rpx(30)}
                                color="#dbe7f5"
                            />
                        </TvFocusable>
                    </View>
                    <EqualizerBody compact />
                </View>
            </TvFocusLayer>
        </View>
    );
}

const styles = StyleSheet.create({
    mask: {
        // 放到右侧（歌词那一栏）：左边旋转封面、进度条、功能按钮全都露着，
        // 用户调均衡器时还能看见封面在转
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "46%",
        minWidth: rpx(470),
        paddingLeft: rpx(6),
        paddingRight: rpx(20),
        zIndex: 60,
        justifyContent: "center",
    },
    card: {
        width: "100%",
        maxHeight: "88%",
        // 不再写死 vh(86)：内容多少就多高，底部不会再拖着一大片空白

        backgroundColor: "#091221",
        overflow: "hidden",
        borderWidth: rpx(2),
        borderColor: "rgba(120,170,255,0.35)",
        borderRadius: rpx(24),
        paddingHorizontal: rpx(24),
        paddingTop: rpx(20),
        paddingBottom: rpx(18),
        // 顶部一层浅蓝氛围，避免纯色大块死板
        shadowColor: "#3aa6ff",
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: 12,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: rpx(10),
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    accent: {
        width: rpx(6),
        height: rpx(34),
        borderRadius: rpx(3),
        backgroundColor: "#5fd0ff",
        marginRight: rpx(12),
    },
    title: {
        color: "#f2f7ff",
        fontSize: rpx(34),
        fontWeight: "bold",
        letterSpacing: rpx(1),
    },
    close: {
        width: rpx(60),
        height: rpx(60),
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
});
