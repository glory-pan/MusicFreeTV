import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";

import ThemeText from "@/components/base/themeText";
import QrGlyph from "@/components/base/qrGlyph";
import { TvTextInput as TextInput, TvFocusable } from "@/tv/components";
import { showQrInput } from "@/tv/qrOverlay";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel } from "../usePanel";
import { useI18N } from "@/core/i18n";
import { useTvKeys } from "@/tv/provider";
import { tvFocus } from "@/tv/focusStore";

interface ISimpleInputProps {
    title?: string;
    onOk: (text: string, closePanel: () => void) => void;
    hints?: string[];
    onCancel?: () => void;
    maxLength?: number;
    placeholder?: string;
    autoFocus?: boolean;
}

/**
 * 电视端输入面板：屏幕居中的卡片。
 * 顶栏的“取消/确认”文字按钮改成卡片底部等宽按钮，光环正好套在按钮框上；
 * “手机扫码输入”改成二维码图标按钮（扫码能力不变）。
 */
export default function SimpleInput(props: ISimpleInputProps) {
    const { t } = useI18N();
    const {
        onOk,
        onCancel,
        placeholder,
        maxLength = 80,
        hints,
        title,
    } = props;

    const [input, setInput] = useState("");
    const colors = useColors();

    // 输入框正下方就是二维码按钮：几何导航会被"取消/确认"那一行的大按钮吸走，
    // 这里显式把"下"定到二维码上，符合用户第一反应。
    useTvKeys((key, action) => {
        if (action !== "down" || key !== "down") {
            return false;
        }
        if (tvFocus.getFocusedNode()?.debugName === "simpleInput:input") {
            if (tvFocus.focusByName("simpleInput:qr")) {
                return true;
            }
            // 二维码节点还没注册好时，不要放行去落到"取消"上
            return tvFocus.focusByName("simpleInput:qr", true);
        }
        return false;
    });

    return (
        <TvCardPanel
            center
            width={rpx(760)}
            title={title || t("panel.simpleInput.inputLabel")}
            firstFocusName="simpleInput:input"
            returnFocusName="home:newSheet">
            <TextInput
                value={input}
                accessible
                autoFocus={false}
                name="simpleInput:input"
                accessibilityLabel={t("panel.simpleInput.inputLabel")}
                accessibilityHint={placeholder}
                onChangeText={_ => {
                    setInput(_);
                }}
                style={[
                    style.input,
                    {
                        color: colors.text,
                        backgroundColor: "rgba(255,255,255,0.10)",
                    },
                ]}
                placeholderTextColor={colors.textSecondary}
                placeholder={placeholder ?? ""}
                maxLength={maxLength}
            />

            <View style={style.qrRow}>
                <TvFocusable
                    name="simpleInput:qr"
                    focusOrder={1}
                    style={style.qrButton}
                    onPress={() => {
                        // 手机扫码把链接/文字回传到电视，直接填进输入框。
                        // 遥控器逐字输入几十位链接太痛苦，这是电视端的必需入口。
                        showQrInput({
                            mode: "text",
                            kind: /http|链接|地址|url|导入|歌单|单曲/i.test(
                                `${title ?? ""}${placeholder ?? ""}`,
                            )
                                ? "link"
                                : "text",
                            title: "手机扫码输入（填到输入框）",
                            onText: (text: string) => {
                                setInput(text.trim());
                            },
                        });
                    }}>
                    <QrGlyph size={rpx(46)} color="#ffffff" />
                </TvFocusable>
            </View>

            {hints?.length ? (
                <ScrollView style={style.hintsBox}>
                    {hints.map((_, index) => (
                        <ThemeText
                            key={`hint-index-${index}`}
                            style={style.hintLine}
                            fontSize="description"
                            fontColor="textSecondary"
                            numberOfLines={2}>
                            ￮ {_}
                        </ThemeText>
                    ))}
                </ScrollView>
            ) : null}

            <View style={style.actions}>
                <TvFocusable
                    name="simpleInput:cancel"
                    focusOrder={2}
                    style={style.actionButton}
                    onPress={() => {
                        onCancel?.();
                        hidePanel();
                    }}>
                    <ThemeText fontSize="subTitle" fontColor="text">
                        取消
                    </ThemeText>
                </TvFocusable>
                <TvFocusable
                    name="simpleInput:ok"
                    focusOrder={3}
                    style={style.actionButton}
                    onPress={() => {
                        onOk(input, hidePanel);
                    }}>
                    <ThemeText fontSize="subTitle" fontColor="text">
                        确认
                    </ThemeText>
                </TvFocusable>
            </View>
        </TvCardPanel>
    );
}

const style = StyleSheet.create({
    input: {
        width: "100%",
        height: rpx(96),
        borderRadius: rpx(12),
        paddingHorizontal: rpx(20),
        fontSize: rpx(30),
    },
    qrRow: {
        marginTop: rpx(18),
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    qrButton: {
        // 只留二维码图标：方形按钮，光环正好套住图标框
        width: rpx(84),
        height: rpx(84),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    qrText: {
        marginLeft: rpx(14),
        fontSize: rpx(26),
    },
    hintsBox: {
        marginTop: rpx(16),
        maxHeight: rpx(160),
    },
    hintLine: {
        marginBottom: rpx(8),
    },
    actions: {
        marginTop: rpx(40),
        flexDirection: "row",
        justifyContent: "space-between",
        gap: rpx(26),
    },
    actionButton: {
        flex: 1,
        height: rpx(80),
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
});
