import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { TvTouchableOpacity as TouchableOpacity } from "@/tv/components";
import rpx from "@/utils/rpx";
import Image from "./image";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "./themeText";

interface IImageBtnProps {
    uri?: string;
    title?: string;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    /** 遥控器焦点名字，便于 focusByName 定位 */
    name?: string;
    focusOrder?: number;
}
export default function ImageBtn(props: IImageBtnProps) {
    const { onPress, uri, title, style: _style, name, focusOrder } =
        props ?? {};
    return (
        <TouchableOpacity
            activeOpacity={0.5}
            name={name}
            focusOrder={focusOrder}
            onPress={onPress}
            style={[style.wrapper, _style]}>
            <Image
                style={style.image}
                uri={uri}
                emptySrc={ImgAsset.albumDefault}
            />
            <ThemeText
                fontSize="subTitle"
                numberOfLines={2}
                ellipsizeMode="tail">
                {title ?? ""}
            </ThemeText>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: rpx(210),
        height: rpx(290),
        flexGrow: 0,
        flexShrink: 0,
    },
    image: {
        width: rpx(210),
        height: rpx(210),
        borderRadius: rpx(12),
        marginBottom: rpx(16),
    },
});
