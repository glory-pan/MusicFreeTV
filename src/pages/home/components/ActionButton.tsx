import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { TvFocusable } from "@/tv/components";
import Icon, { IIconName } from "@/components/base/icon.tsx";

interface IActionButtonProps {
    iconName: IIconName;
    iconColor?: string;
    title: string;
    action?: () => void;
    style?: StyleProp<ViewStyle>;
    /** 焦点名字，供页面级按键拦截定位 */
    name?: string;
    focusOrder?: number;
}

export default function ActionButton(props: IActionButtonProps) {
    const { iconName, iconColor, title, action, style, name, focusOrder } =
        props;
    const colors = useColors();
    // rippleColor="rgba(0, 0, 0, .32)"
    return (
        <TvFocusable
            name={name}
            focusOrder={focusOrder}
            onPress={action}
            style={[
                styles.wrapper,
                {
                    backgroundColor: colors.card,
                },
                style,
            ]}>
            <Icon
                accessible={false}
                name={iconName}
                color={iconColor ?? colors.text}
                size={rpx(48)}
            />
            <ThemeText
                accessible={false}
                fontSize="subTitle"
                fontWeight="semibold"
                style={styles.text}>
                {title}
            </ThemeText>
        </TvFocusable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: rpx(140),
        height: rpx(144),
        borderRadius: rpx(12),
        flexGrow: 1,
        flexShrink: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        marginTop: rpx(12),
    },
});
