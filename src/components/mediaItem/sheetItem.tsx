import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { TvFocusable } from "@/tv/components";
import Image from "../base/image";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "../base/themeText";

interface ISheetItemProps {
    pluginHash: string;
    sheetInfo: IMusic.IMusicSheetItemBase;
    name?: string;
    focusOrder?: number;
}

/**
 * 歌单封面卡（电视版）。
 *
 * 原来只是一张封面 + 一行标题，卡片本身没有底色/边框，几张封面挨在一起时
 * 光环和卡片糊成一片。现在做成"卡片"：深色底 + 圆角 + 封面 + 两行标题，
 * 整张卡就是一个命名焦点节点，遥控器落上去边界清清楚楚。
 */
export default function SheetItem(props: ISheetItemProps) {
    const { sheetInfo, pluginHash, name, focusOrder } = props ?? {};
    const navigate = useNavigate();

    return (
        <TvFocusable
            name={name}
            focusOrder={focusOrder}
            onPress={() => {
                navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                    pluginHash,
                    sheetInfo,
                });
            }}
            style={styles.card}>
            <Image
                style={styles.cover}
                uri={sheetInfo?.artwork ?? sheetInfo?.coverImg}
                emptySrc={ImgAsset.albumDefault}
            />
            <View style={styles.titleWrap}>
                <ThemeText
                    fontSize="subTitle"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={styles.title}>
                    {sheetInfo?.title ?? ""}
                </ThemeText>
            </View>
        </TvFocusable>
    );
}

const styles = StyleSheet.create({
    card: {
        width: "100%",
        padding: rpx(12),
        borderRadius: rpx(18),
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: rpx(1),
        borderColor: "rgba(140,190,255,0.18)",
    },
    cover: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: rpx(12),
    },
    titleWrap: {
        marginTop: rpx(10),
        minHeight: rpx(56),
        justifyContent: "center",
    },
    title: {
        lineHeight: rpx(30),
    },
});
