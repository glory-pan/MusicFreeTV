import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "./themeText";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { TvTouchableOpacity as TouchableOpacity } from "@/tv/components";
import Icon, { IIconName } from "@/components/base/icon.tsx";

interface IProps {
    icon: IIconName;
    onPress?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    children?: string;
    /** 遥控器焦点名字 */
    name?: string;
    focusOrder?: number;
    /** 显式方向链接：按名字指名该方向的目标节点（几何上够不着的布局用） */
    leftName?: string;
    rightName?: string;
    upName?: string;
    downName?: string;
}
export default function (props: IProps) {
    const {
        icon,
        children,
        onPress,
        containerStyle,
        name,
        focusOrder,
        leftName,
        rightName,
        upName,
        downName,
    } = props;
    const colors = useColors();

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            name={name}
            focusOrder={focusOrder}
            leftName={leftName}
            rightName={rightName}
            upName={upName}
            downName={downName}
            style={[style.container, containerStyle]}
            onPress={onPress}>
            <Icon name={icon} size={iconSizeConst.light} color={colors.text} />
            <ThemeText style={style.text} fontSize={"content"}>
                {children}
            </ThemeText>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(8),
    },
    text: {
        marginLeft: rpx(8),
    },
});
