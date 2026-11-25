import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import rpx from "@/utils/rpx";
import React from "react";
import { StyleSheet } from "react-native";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import ActionButton from "../ActionButton";
import { tvFocus } from "@/tv/focusStore";
import { useTvKeys } from "@/tv/provider";

/**
 * 电视端常驻左侧导航栏。
 * 手机端这里是「抽屉菜单 + 手势滑出」，遥控器没有滑动交互，
 * 因此改为常驻、上下方向键可穿行的导航列。
 */
export default function Operations() {
    const navigate = useNavigate();
    const { t } = useI18N();
    const scrollRef = React.useRef<any>(null);

    const actionButtons = [
        {
            iconName: "magnifying-glass",
            title: "搜索",
            action() {
                navigate(ROUTE_PATH.SEARCH_PAGE);
            },
        },
        {
            iconName: "fire",
            title: t("home.recommendSheet"),
            action() {
                navigate(ROUTE_PATH.RECOMMEND_SHEETS);
            },
        },
        {
            iconName: "trophy",
            title: t("home.topList"),
            action() {
                navigate(ROUTE_PATH.TOP_LIST);
            },
        },
        {
            iconName: "clock-outline",
            title: t("home.playHistory"),
            action() {
                navigate(ROUTE_PATH.HISTORY);
            },
        },
        {
            iconName: "folder-music-outline",
            title: t("home.localMusic"),
            action() {
                navigate(ROUTE_PATH.LOCAL);
            },
        },
        {
            iconName: "cog-8-tooth",
            title: "设置",
            action() {
                navigate(ROUTE_PATH.SETTING, { type: "basic" });
            },
        },
        {
            iconName: "javascript",
            title: "插件",
            action() {
                navigate(ROUTE_PATH.SETTING, { type: "plugin" });
            },
        },
        {
            iconName: "play-circle",
            title: "正在播放",
            action() {
                navigate(ROUTE_PATH.MUSIC_DETAIL);
            },
        },
        {
            iconName: "t-shirt-outline",
            title: "主题",
            action() {
                navigate(ROUTE_PATH.SETTING, { type: "theme" });
            },
        },
    ] as const;

    // 左栏是"遥控上下穿行"的主导航：显式按序号移动，避免空间导航
    // 在被滚动裁掉一半的卡片上打转（用户反馈"按上走不到上面的板块"）。
    useTvKeys((key, action) => {
        if (action !== "down") {
            return false;
        }
        if (key !== "up" && key !== "down") {
            return false;
        }
        const name = tvFocus.getFocusedNode()?.debugName ?? "";
        if (!name.startsWith("home:nav:")) {
            return false;
        }
        const index = Number(name.split(":")[2]);
        if (Number.isNaN(index)) {
            return false;
        }
        const next = index + (key === "down" ? 1 : -1);
        if (next >= 0 && next < actionButtons.length) {
            // 自己把目标项滚进视口再聚焦：不依赖焦点引擎的几何测量，
            // 避免"返回主页后按上键，焦点去了屏幕外，光环看不见也上不去"。
            const itemHeight = rpx(150) + rpx(18);
            try {
                scrollRef.current?.scrollTo?.({
                    y: Math.max(0, (next - 1) * itemHeight),
                    animated: true,
                });
            } catch {
                // ignore
            }
            tvFocus.focusByName(`home:nav:${next}`);
            return true;
        }
        // 走到头就把按键还给空间导航：最上面能回到顶部搜索框，
        // 最下面能落到底部播放条。
        return false;
    });

    return (
        <ScrollView style={styles.container} ref={scrollRef}>
            {actionButtons.map((action, index) => (
                <ActionButton
                    name={`home:nav:${index}`}
                    focusOrder={index}
                    style={styles.actionButtonStyle}
                    key={action.title}
                    {...action}
                />
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: rpx(250),
        flexGrow: 0,
        flexShrink: 0,
        paddingHorizontal: rpx(24),
        marginVertical: rpx(24),
    },
    actionButtonStyle: {
        width: "100%",
        height: rpx(150),
        borderRadius: rpx(18),
        marginBottom: rpx(18),
    },
});
