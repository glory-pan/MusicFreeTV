import React from "react";
import { StyleSheet } from "react-native";
import settingTypes from "./settingTypes";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import { useParams } from "@/core/router";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";
import { tvFocus } from "@/tv/focusStore";

export default function Setting() {
    const { type } = useParams<"setting">();
    const settingItem = settingTypes[type];

    const { t } = useI18N();

    // 设置页里换 type（基础设置/插件/主题）不会重建 screen，也就不会触发
    // 页面挂载时的自愈逻辑；这里补一次：看不到光环就把本页第一个元素点亮。
    React.useEffect(() => {
        const timers = [150, 400, 800].map(delay =>
            setTimeout(() => {
                // 主题页：先把光环明确放到"跟随系统深色设置"整行上。
                // 只在光环还停在返回键/没有光环时才动手，避免打断用户操作
                if (type === "theme") {
                    const currentName =
                        tvFocus.getFocusedNode()?.debugName ?? "";
                    if (
                        !currentName ||
                        currentName === "appbar:back"
                    ) {
                        if (tvFocus.focusByNameForce("theme:follow")) {
                            return;
                        }
                    }
                }
                if (!tvFocus.hasVisibleFocus()) {
                    tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(t => clearTimeout(t));
    }, [type]);

    return (
        <SafeAreaView edges={["bottom", "top"]} style={style.wrapper}>
            <StatusBar />
            {settingItem.showNav === false ? null : (
                <AppBar>{t(settingItem.i18nKey as any)}</AppBar>
            )}

            {type === "plugin" ? (
                <settingItem.component />
            ) : (
                <HorizontalSafeAreaView style={style.wrapper}>
                    <settingItem.component />
                </HorizontalSafeAreaView>
            )}
        </SafeAreaView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    appbar: {
        shadowColor: "transparent",
        backgroundColor: "#2b333eaa",
    },
    header: {
        backgroundColor: "transparent",
        shadowColor: "transparent",
    },
});
