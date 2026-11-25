import React from "react";
import { Appearance, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import ThemeSwitch from "@/components/base/switch";
import Config, { useAppConfig } from "@/core/appConfig";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";
import { TvFocusable } from "@/tv/components";

export default function Mode() {
    const { t } = useI18N();
    const mode = useAppConfig("theme.followSystem") ?? false;

    const setFollow = (next: boolean) => {
        if (next) {
            const colorScheme = Appearance.getColorScheme();
            if (colorScheme === "dark") {
                Theme.setTheme("p-dark");
            } else if (colorScheme === "light") {
                Theme.setTheme("p-light");
            }
        }
        Config.setConfig("theme.followSystem", next);
    };

    return (
        <View>
            <ThemeText
                fontSize="subTitle"
                fontWeight="bold"
                style={styles.header}>
                {t("themeSettings.displayStyle")}
            </ThemeText>
            <View style={styles.sectionWrapper}>
                {/* 电视端把整行做成一个可聚焦项：按 OK 直接切换开关。
                    之前只有 ThemeSwitch 这个自绘控件，它不注册焦点，
                    所以光标进页面时只能落到左上角返回箭头，
                    按下键又直接跨过这一行落到下面的浅色/深色卡片上。 */}
                <TvFocusable
                    name="theme:follow"
                    focusOrder={0}
                    style={styles.itemRow}
                    onPress={() => setFollow(!mode)}>
                    <ThemeText>
                        {t("themeSettings.followSystemTheme")}
                    </ThemeText>
                    <ThemeSwitch value={mode} onValueChange={() => {}} />
                </TvFocusable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingLeft: rpx(24),
        marginTop: rpx(36),
    },
    sectionWrapper: {
        marginTop: rpx(24),
    },
    itemRow: {
        width: "100%",
        minHeight: rpx(96),
        paddingHorizontal: rpx(30),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
});
