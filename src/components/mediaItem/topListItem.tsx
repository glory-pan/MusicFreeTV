import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { TvFocusable } from "@/tv/components";
import Image from "../base/image";
import ThemeText from "../base/themeText";
import Icon from "../base/icon";

interface ITopListResultsProps {
    pluginHash: string;
    topListItem: IMusic.IMusicSheetItemBase;
    name?: string;
    focusOrder?: number;
}

/**
 * 榜单条目（电视版）。
 *
 * 原来是手机式 ListItem：左边一张图、右边一大堆描述文字挤在一起，
 * 电视上又长又乱、字还小。现在做成"横条卡片"：图标 + 标题 + 一行说明 + 右侧箭头，
 * 整条是一个命名焦点节点，光环边界清楚，一眼就能看出"这是一张能按的卡"。
 */
export default function TopListItem(props: ITopListResultsProps) {
    const { pluginHash, topListItem, name, focusOrder } = props;
    const navigate = useNavigate();

    return (
        <TvFocusable
            name={name}
            focusOrder={focusOrder}
            style={styles.card}
            onPress={() => {
                navigate(ROUTE_PATH.TOP_LIST_DETAIL, {
                    pluginHash,
                    topList: topListItem,
                });
            }}>
            <Image
                style={styles.cover}
                uri={topListItem?.coverImg}
                emptySrc={ImgAsset.albumDefault}
            />
            <View style={styles.textWrap}>
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}
                    style={styles.title}>
                    {topListItem.title ?? ""}
                </ThemeText>
                {topListItem.description ? (
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={styles.desc}>
                        {topListItem.description}
                    </ThemeText>
                ) : null}
            </View>
            <Icon
                accessible={false}
                name="skip-right"
                size={rpx(34)}
                color="#8fa3ba"
            />
        </TvFocusable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: rpx(24),
        marginBottom: rpx(12),
        paddingVertical: rpx(14),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(16),
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: rpx(1),
        borderColor: "rgba(140,190,255,0.16)",
    },
    cover: {
        width: rpx(72),
        height: rpx(72),
        borderRadius: rpx(14),
        marginRight: rpx(18),
    },
    textWrap: {
        flex: 1,
    },
    title: {
        marginBottom: rpx(6),
    },
    desc: {
        lineHeight: rpx(26),
    },
});
