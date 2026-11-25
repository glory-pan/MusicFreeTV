import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Tag from "@/components/base/tag";
import { useParams } from "@/core/router";
import Image from "@/components/base/image";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";

interface IHeaderProps {
    neverFold?: boolean;
}

/**
 * 作者信息卡（左侧固定一栏）。
 *
 * 原来这张卡是 rpx(750) 满屏宽 + 跟随列表滚动的折叠动画（高度 rpx(350) → 0），
 * 在电视上满屏宽的卡片会把右边的歌曲列表挤没，折叠动画遥控器也触发不了。
 * 现在固定成左边一栏竖排卡片：头像 / 名字 / 平台 / 粉丝数 / 简介，始终可见。
 */
export default function Header(_props: IHeaderProps) {
    const { artistItem } = useParams<"artist-detail">();
    const { t } = useI18N();

    const avatar = artistItem?.avatar?.startsWith("//")
        ? `https:${artistItem.avatar}`
        : artistItem?.avatar;

    return (
        <View style={styles.wrapper}>
            <Image
                emptySrc={ImgAsset.albumDefault}
                uri={avatar}
                style={styles.artist}
            />
            <View style={styles.titleRow}>
                <ThemeText
                    fontSize="title"
                    style={styles.titleText}
                    numberOfLines={2}
                    ellipsizeMode="tail">
                    {artistItem?.name ?? ""}
                </ThemeText>
            </View>
            {(artistItem as any)?.platform ? (
                <View style={styles.tagRow}>
                    <Tag tagName={(artistItem as any).platform} />
                </View>
            ) : null}
            {(artistItem as any)?.fans ? (
                <ThemeText
                    fontSize="subTitle"
                    fontColor="textSecondary"
                    style={styles.fans}>
                    {t("artistDetail.fansCount", {
                        count: (artistItem as any).fans,
                    })}
                </ThemeText>
            ) : null}
            <ThemeText
                style={styles.description}
                numberOfLines={9}
                ellipsizeMode="tail"
                fontColor="textSecondary"
                fontSize="description">
                {(artistItem as any)?.description ?? ""}
            </ThemeText>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: rpx(330),
        paddingTop: rpx(16),
        paddingHorizontal: rpx(20),
        paddingBottom: rpx(16),
        backgroundColor: "rgba(28, 28, 28, 0.14)",
    },
    artist: {
        width: rpx(160),
        height: rpx(160),
        borderRadius: rpx(18),
    },
    titleRow: {
        marginTop: rpx(16),
        flexDirection: "row",
        alignItems: "center",
    },
    titleText: {
        flexShrink: 1,
    },
    tagRow: {
        marginTop: rpx(10),
        flexDirection: "row",
        alignItems: "center",
    },
    fans: {
        marginTop: rpx(8),
    },
    description: {
        marginTop: rpx(14),
        lineHeight: rpx(34),
    },
});
