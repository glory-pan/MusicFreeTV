import React from "react";
import { ColorKey, colorMap, iconSizeConst } from "@/constants/uiConst";
import { TvFocusable } from "@/tv/components";
import { StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";
import { SvgProps } from "react-native-svg";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import rpx from "@/utils/rpx";

interface IIconButtonProps extends SvgProps {
    name: IIconName;
    style?: SvgProps["style"];
    sizeType?: keyof typeof iconSizeConst;
    fontColor?: ColorKey;
    color?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
    /** 遥控器焦点名（name 是图标名，不能混用） */
    focusName?: string;
    /** 焦点顺序：返回键这类"页面边缘"控件排在最后，别抢首焦点 */
    focusOrder?: number;
}
export function IconButtonWithGesture(props: IIconButtonProps) {
    const {
        name,
        sizeType: size = "normal",
        fontColor = "normal",
        onPress,
        style,
        accessibilityLabel,
        focusName,
        focusOrder,
    } = props;
    const colors = useColors();
    const textSize = iconSizeConst[size];
    const color = colors[colorMap[fontColor]];
    // 返回键这类图标如果让它撑满整行高度，焦点环就会变成一条又高又窄的"药丸"。
    // TV 上统一收成一个 76rpx 的方形热区，环方方正正地贴在箭头上。
    const isBack = !!focusName && /back/i.test(focusName);
    return (
        <TvFocusable
            name={focusName}
            focusOrder={focusOrder}
            onPress={onPress}>
            {isBack ? (
                <View style={styles.backBox}>
                    <Icon
                        name={name}
                        color={color}
                        size={textSize}
                        style={styles.backIcon}
                    />
                </View>
            ) : (
            <Icon
                accessible
                accessibilityLabel={accessibilityLabel}
                name={name}
                color={color}
                style={[{ minWidth: textSize }, styles.textCenter, style]}
                size={textSize}
            />
            )}
        </TvFocusable>
    );
}

export default function IconButton(props: IIconButtonProps) {
    const { sizeType = "normal", fontColor = "normal", style, color } = props;
    const colors = useColors();
    const size = iconSizeConst[sizeType];

    return (
        <Icon
            {...props}
            color={color ?? colors[colorMap[fontColor]]}
            style={[{ minWidth: size }, styles.textCenter, style]}
            size={size}
        />
    );
}

const styles = StyleSheet.create({
    backBox: {
        width: rpx(76),
        height: rpx(76),
        borderRadius: rpx(16),
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        height: undefined,
        minWidth: 0,
    },
    textCenter: {
        height: "100%",
        textAlignVertical: "center",
    },
});
