import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import TvCardPanel from "../base/tvCardPanel";
import { TvFocusable } from "@/tv/components";
import { hidePanel } from "../usePanel";
import Icon from "@/components/base/icon.tsx";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import { useI18N } from "@/core/i18n";

interface IProps {
    musicItem: IMusic.IMusicItem;
    onSubmit?: (offset: number) => void;
}

export default function SetLyricOffset(props: IProps) {
    const { musicItem, onSubmit } = props ?? {};
    const { t } = useI18N();
    const [offset, setOffset] = useState(
        getMediaExtraProperty(musicItem, "lyricOffset") ?? 0,
    );

    const titleStr =
        offset === 0
            ? t("panel.setLyricOffset.normal")
            : offset < 0
              ? t("panel.setLyricOffset.delay", { time: (-offset).toFixed(1) })
              : t("panel.setLyricOffset.advance", { time: offset.toFixed(1) });

    return (
        <TvCardPanel
            title={t("panel.setLyricOffset.title", { status: titleStr })}
            // 标题会跟着偏移量变（-0.2s/+0.2s），而 TvCardPanel 默认拿标题当"面板记忆键"，
            // 键一变就会重跑首焦点逻辑，光环被强行拽回第一个按钮 —— 
            // 实机现象就是"按一下 +0.2s，光环跳到 -0.2s"。这里固定成常量。
            rememberKey="setLyricOffset"
            firstFocusName="lrcOffset:minus"
            returnFocusName="tvplayer:toggle">
            <View style={styles.row}>
                <TvFocusable
                    name="lrcOffset:minus"
                    style={styles.btn}
                    onPress={() => setOffset(prev => prev - 0.2)}>
                    <Icon accessible={false} name="minus" size={rpx(34)} color="#fff" />
                    <ThemeText fontSize="description">-0.2s</ThemeText>
                </TvFocusable>
                <TvFocusable
                    name="lrcOffset:reset"
                    style={styles.btn}
                    onPress={() => setOffset(0)}>
                    <Icon
                        accessible={false}
                        name="arrow-uturn-left"
                        size={rpx(30)}
                        color="#fff"
                    />
                    <ThemeText fontSize="description">
                        {t("panel.setLyricOffset.reset")}
                    </ThemeText>
                </TvFocusable>
                <TvFocusable
                    name="lrcOffset:plus"
                    style={styles.btn}
                    onPress={() => setOffset(prev => prev + 0.2)}>
                    <Icon accessible={false} name="plus" size={rpx(34)} color="#fff" />
                    <ThemeText fontSize="description">+0.2s</ThemeText>
                </TvFocusable>
            </View>
            <View style={styles.row}>
                <TvFocusable
                    name="lrcOffset:cancel"
                    style={[styles.btn, styles.btnWide]}
                    onPress={hidePanel}>
                    <ThemeText fontSize="subTitle">
                        取消
                    </ThemeText>
                </TvFocusable>
                <TvFocusable
                    name="lrcOffset:ok"
                    style={[styles.btn, styles.btnWide, styles.btnPrimary]}
                    onPress={() => {
                        onSubmit?.(offset);
                        hidePanel();
                    }}>
                    <ThemeText fontSize="subTitle" fontWeight="bold">
                        确定
                    </ThemeText>
                </TvFocusable>
            </View>
        </TvCardPanel>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        marginTop: rpx(12),
    },
    btn: {
        width: rpx(126),
        height: rpx(84),
        borderRadius: rpx(14),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    btnWide: {
        width: rpx(190),
        height: rpx(66),
    },
    btnPrimary: {
        backgroundColor: "rgba(95,208,255,0.28)",
    },
});
