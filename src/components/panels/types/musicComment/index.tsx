import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import PanelFullscreen from "@/components/panels/base/panelFullscreen.tsx";
import AppBar from "@/components/base/appBar.tsx";
import { hidePanel } from "@/components/panels/usePanel.ts";
import globalStyle from "@/constants/globalStyle.ts";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView.tsx";
import { TvScrollView } from "@/tv/scroll";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst.ts";
import ThemeText from "@/components/base/themeText.tsx";
import Comment from "@/components/panels/types/musicComment/comment.tsx";
import { TvFocusable } from "@/tv/components";
import { tvFocus } from "@/tv/focusStore";
import useComments from "@/components/panels/types/musicComment/useComments.ts";
import { RequestStateCode } from "@/constants/commonConst.ts";
import { useI18N } from "@/core/i18n";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";

interface IMusicCommentProps {
    musicItem: IMusic.IMusicItem;
}


export default function MusicComment(props: IMusicCommentProps) {
    const { musicItem } = props;

    const [reqState, comments, getMusicComments, total] = useComments(musicItem);
    const { t } = useI18N();


    // 面板一打开就把焦点落到第一条评论，保证方向键能一路往下翻
    React.useEffect(() => {
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (tvFocus.focusByName("comment:0") || tries > 20) {
                clearInterval(timer);
            }
        }, 200);
        return () => clearInterval(timer);
    }, [comments?.length]);

    const canLoadMore =
        reqState === RequestStateCode.IDLE || reqState === RequestStateCode.PARTLY_DONE;
    const isLoadingPage =
        reqState === RequestStateCode.PENDING_FIRST_PAGE ||
        reqState === RequestStateCode.PENDING_REST_PAGE;
    /** 走到最后几条时按 OK 就把下一批拉出来，不用再往下挪到页脚 */
    const loadMoreIfNearEnd = (index: number) => {
        if (!canLoadMore || isLoadingPage) {
            return;
        }
        if (index >= comments.length - 3) {
            getMusicComments();
        }
    };
    // 评论总数：插件给了就显示真实数字，没给就如实说“未知”，不要空着
    const totalText = total > 0 ? `共 ${total} 条评论` : "";

    const listBody = (
        <TvScrollView style={globalStyle.fwflex1}>
            {comments?.length ? (
                comments.map((item: any, index: number) => (
                    <TvFocusable
                        name={`comment:${index}`}
                        key={`comment-${index}`}
                        focusOrder={index}
                        style={styles.commentRow}
                        onPress={() => {
                            loadMoreIfNearEnd(index);
                        }}>
                        <Comment comment={item} index={index} />
                    </TvFocusable>
                ))
            ) : comments?.length === 0 ? (
                <ListEmpty state={reqState} onRetry={getMusicComments} />
            ) : null}
            {comments?.length ? (
                <TvFocusable
                    name="comment:loadMore"
                    style={{ height: rpx(90), alignItems: "center", justifyContent: "center" }}
                    onPress={() => {
                        if (canLoadMore) {
                            getMusicComments();
                        }
                    }}>
                    <ThemeText fontColor="textSecondary">
                        {canLoadMore
                            ? `已显示 ${comments.length} 条${
                                  totalText ? ` / ${totalText}` : ""
                              } · 按 OK 加载更多`
                            : `已显示全部 ${comments.length} 条${
                                  totalText ? ` / ${totalText}` : ""
                              }`}
                    </ThemeText>
                </TvFocusable>
            ) : null}
        </TvScrollView>
    );

    return (
        <PanelFullscreen>
            <VerticalSafeAreaView style={globalStyle.fwflex1}>
                <AppBar
                    withStatusBar
                    children={
                        total > 0
                            ? `${t("common.comment")} · 共 ${total} 条`
                            : t("common.comment")
                    }
                    onBackPress={hidePanel}
                />
                <View style={styles.musicItemContainer}>
                    <FastImage
                        style={styles.musicItemArtwork}
                        source={musicItem?.artwork}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                    <View style={styles.musicItemContent}>
                        <ThemeText fontSize="subTitle" numberOfLines={1}>
                            {musicItem.title}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            numberOfLines={1}
                            fontColor="textSecondary">
                            {musicItem.artist}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            numberOfLines={1}
                            fontColor="textSecondary">
                            {`${musicItem.platform || ""}${
                                totalText
                                    ? ` · ${totalText}`
                                    : comments?.length
                                      ? " · 评论总数未知"
                                      : ""
                            }${comments?.length ? ` · 已显示 ${comments.length} 条` : ""}`}
                        </ThemeText>
                    </View>
                </View>
                {listBody}
            </VerticalSafeAreaView>
        </PanelFullscreen>
    );
}

const styles = StyleSheet.create({
    musicItemContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: rpx(16),
        paddingHorizontal: rpx(24),
        height: rpx(120),
    },
    musicItemArtwork: {
        width: rpx(88),
        height: rpx(88),
        borderRadius: rpx(12),
    },
    commentRow: {
        width: "100%",
        height: rpx(150),
        marginVertical: rpx(6),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    musicItemContent: {
        flex: 1,
        gap: rpx(16),
    },
});
