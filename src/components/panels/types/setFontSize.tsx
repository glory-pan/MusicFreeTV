import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import TvCardPanel from "../base/tvCardPanel";
import { TvFocusable } from "@/tv/components";
import { hidePanel } from "../usePanel";
import { useI18N } from "@/core/i18n";

interface IProps {
    defaultSelect?: number;
    onSelectChange: (value: number) => void;
}

export default function SetFontSize(props: IProps) {
    const { defaultSelect, onSelectChange } = props ?? {};
    const i18n = useI18N();
    const [selected, setSelected] = useState(defaultSelect ?? 1);

    const options = [
        { value: 0, label: i18n.t("panel.setFontSize.small") },
        { value: 1, label: i18n.t("panel.setFontSize.standard") },
        { value: 2, label: i18n.t("panel.setFontSize.large") },
        { value: 3, label: i18n.t("panel.setFontSize.extraLarge") },
    ];

    return (
        <TvCardPanel            title={i18n.t("panel.setFontSize.title")}
            firstFocusName={`fontsize:${selected}`}
            returnFocusName="tvplayer:toggle">
            <View style={styles.row}>
                {options.map(option => {
                    const active = option.value === selected;
                    return (
                        <TvFocusable
                            key={`fontsize-${option.value}`}
                            name={`fontsize:${option.value}`}
                            style={[
                                styles.option,
                                active ? styles.optionActive : null,
                            ]}
                            onPress={() => {
                                setSelected(option.value);
                                onSelectChange?.(option.value);
                                hidePanel();
                            }}>
                            <ThemeText
                                fontSize="subTitle"
                                fontWeight={active ? "bold" : "regular"}>
                                {option.label}
                            </ThemeText>
                        </TvFocusable>
                    );
                })}
            </View>
            <ThemeText fontSize="description" style={styles.hint}>
                左右键选择，按 OK 立即生效
            </ThemeText>
        </TvCardPanel>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: rpx(10),
    },
    option: {
        width: rpx(96),
        height: rpx(88),
        borderRadius: rpx(14),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    optionActive: {
        backgroundColor: "rgba(95,208,255,0.28)",
    },
    hint: {
        marginTop: rpx(16),
        opacity: 0.7,
    },
});
