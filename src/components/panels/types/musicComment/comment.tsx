import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import FastImage from "@/components/base/fastImage.tsx";
import ThemeText from "@/components/base/themeText.tsx";
import dayjs from "dayjs";
import Icon from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors.ts";

interface ICommentProps {
    comment: IMedia.IComment;
    /** 从 0 开始的序号，用来显示"第几条" */
    index?: number;
}

/**
 * 电视端评论行：左侧头像 + 序号，右侧昵称/时间一行、内容最多两行。
 * 固定行高，保证一屏能看 5~6 条，遥控器按下键能一条条往下翻。
 */
export default function Comment(props: ICommentProps) {
    const { comment, index } = props;
    const colors = useColors();

    return (
        <View style={styles.container}>
            {typeof index === "number" ? (
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={styles.order}>
                    {`#${index + 1}`}
                </ThemeText>
            ) : null}
            <FastImage source={comment.avatar} style={styles.avatar} />
            <View style={styles.main}>
                <View style={styles.topLine}>
                    <ThemeText
                        numberOfLines={1}
                        fontSize="subTitle"
                        style={styles.nickname}>
                        {comment.nickName}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {comment.createAt
                            ? dayjs(comment.createAt).format("YYYY-MM-DD")
                            : ""}
                        {comment.location ? ` ${comment.location}` : ""}
                    </ThemeText>
                </View>
                <ThemeText
                    fontSize="description"
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={styles.commentText}>
                    {comment.comment}
                </ThemeText>
            </View>
            {comment.like ? (
                <View style={styles.like}>
                    <Icon
                        name="hand-thumb-up"
                        size={rpx(26)}
                        color={colors.textSecondary}
                    />
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {comment.like}
                    </ThemeText>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(22),
    },
    order: {
        width: rpx(58),
        marginRight: rpx(6),
    },
    avatar: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(32),
        marginRight: rpx(18),
    },
    main: {
        flex: 1,
        justifyContent: "center",
    },
    topLine: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: rpx(6),
    },
    nickname: {
        maxWidth: "50%",
        marginRight: rpx(16),
    },
    commentText: {
        lineHeight: rpx(36),
    },
    like: {
        flexDirection: "row",
        columnGap: rpx(6),
        alignItems: "center",
        marginLeft: rpx(14),
    },
});
