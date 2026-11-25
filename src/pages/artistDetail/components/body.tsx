import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { useAtomValue } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import { useParams } from "@/core/router";
import { TvFocusable } from "@/tv/components";
import { PagerHint, usePager, usePagerKeys } from "@/tv/pager";
import ThemeText from "@/components/base/themeText";
import MusicItem from "@/components/mediaItem/musicItem";
import AlbumItem from "@/components/mediaItem/albumItem";
import { queryResultAtom } from "../store/atoms";
import useQueryArtist from "../hooks/useQuery";

/** 一页放几行：电视一屏刚好显示完整（页签 + 4 行 + 页脚，不留滚动） */
const PAGE_SIZE = 4;

const TABS: { key: IArtist.ArtistMediaType; title: string }[] = [
    { key: "music", title: "单曲" },
    { key: "album", title: "专辑" },
];

/**
 * 作者（ArtistDetail）页的右半部分。
 *
 * 原来是 react-native-tab-view 的 TabView + TvTabBar + TvFlashList：
 * 电视上页签虽然能亮，但从页签往下按经常走不进列表、行也没有光环，遥控器操作不了。
 * 现在整块换成自己的实现：
 *  1. 页签是两个独立焦点节点，左右切换、下键直接进列表第一行；
 *  2. 列表改成一页 4 行的分页列表，每行都有焦点名，光环一定在可视区内；
 *  3. 走到这一页最后一行再往下：还有下一页就翻页，没了就拉取下一页数据。
 */
export default function Body() {
    const [tab, setTab] = useState<IArtist.ArtistMediaType>("music");

    return (
        <View style={styles.wrapper}>
            <View style={styles.tabs}>
                {TABS.map((it, index) => {
                    const active = it.key === tab;
                    return (
                        <TvFocusable
                            key={it.key}
                            name={`artist:tab:${it.key}`}
                            focusOrder={index}
                            rightName={
                                index === 0
                                    ? `artist:tab:${TABS[1].key}`
                                    : undefined
                            }
                            leftName={
                                index === 1
                                    ? `artist:tab:${TABS[0].key}`
                                    : undefined
                            }
                            downName={`artist:${it.key}:0`}
                            onPress={() => setTab(it.key)}
                            style={[
                                styles.tab,
                                active ? styles.tabActive : null,
                            ]}>
                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.tabLabel,
                                    active ? styles.tabLabelActive : null,
                                ]}>
                                {it.title}
                            </Text>
                        </TvFocusable>
                    );
                })}
            </View>

            <BodyContent tab={tab} />
        </View>
    );
}

function BodyContent(props: { tab: IArtist.ArtistMediaType }) {
    const { tab } = props;
    const { pluginHash, artistItem } = useParams<"artist-detail">();
    const queryResult = useAtomValue(queryResultAtom);
    const data = queryResult[tab];
    const queryArtist = useQueryArtist(pluginHash);

    const [queryState, setQueryState] = useState<RequestStateCode>(
        data?.state ?? RequestStateCode.IDLE,
    );

    useEffect(() => {
        setQueryState(data?.state ?? RequestStateCode.IDLE);
    }, [data]);

    useEffect(() => {
        // 切换页签时，这一栏还没查过就先查第一页
        if (!data?.data?.length) {
            queryArtist(artistItem, 1, tab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const list = data?.data ?? [];
    const pager = usePager(Math.max(1, list.length), PAGE_SIZE);
    usePagerKeys(`artist:${tab}`, pager, pager.goNext, pager.goPrev);

    const pageItems = list.slice(pager.start, pager.end);
    const loading =
        queryState === RequestStateCode.PENDING_FIRST_PAGE ||
        queryState === RequestStateCode.PENDING_REST_PAGE;
    const canLoadMore =
        queryState === RequestStateCode.PARTLY_DONE ||
        queryState === RequestStateCode.IDLE;

    const handleBottomKey = () => {
        if (pager.pages > 1 && pager.page < pager.pages - 1) {
            pager.goNext();
            return;
        }
        if (canLoadMore && !loading) {
            queryArtist(artistItem, undefined, tab);
        }
    };

    return (
        <View style={styles.listWrap}>
            {!list.length ? (
                <ThemeText style={styles.empty} fontColor="textSecondary">
                    {loading
                        ? "正在加载…"
                        : queryState === RequestStateCode.FINISHED
                        ? "暂无内容"
                        : "没有拿到内容，返回上一页重进试试"}
                </ThemeText>
            ) : (
                pageItems.map((item: any, offset) => {
                    const index = pager.start + offset;
                    const name = `artist:${tab}:${index}`;
                    return tab === "album" ? (
                        <AlbumItem
                            key={`${name}-${item?.id ?? index}`}
                            name={name}
                            focusOrder={offset}
                            albumItem={item}
                        />
                    ) : (
                        <MusicItem
                            key={`${name}-${item?.id ?? index}`}
                            name={name}
                            focusOrder={offset}
                            musicItem={item}
                        />
                    );
                })
            )}

            <View style={styles.footer}>
                {pager.pages > 1 ? (
                    <PagerHint
                        page={pager.page}
                        pages={pager.pages}
                        start={pager.start}
                        end={pager.end}
                        total={pager.total}
                    />
                ) : (
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary">
                        {loading
                            ? "正在加载更多…"
                            : canLoadMore
                            ? `共 ${list.length} 条 · 按下键加载更多`
                            : `共 ${list.length} 条`}
                    </ThemeText>
                )}
                {pager.pages > 1 ? (
                    <TvFocusable
                        name={`artist:${tab}:more`}
                        focusOrder={100}
                        onPress={handleBottomKey}
                        style={styles.moreBtn}>
                        <ThemeText style={styles.moreBtnText}>
                            {pager.page < pager.pages - 1
                                ? "下一页"
                                : canLoadMore
                                ? "加载更多"
                                : "到底了"}
                        </ThemeText>
                    </TvFocusable>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        zIndex: 100,
    },
    tabs: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(20),
        paddingTop: rpx(12),
        paddingBottom: rpx(8),
    },
    tab: {
        minWidth: rpx(150),
        height: rpx(70),
        marginRight: rpx(16),
        paddingHorizontal: rpx(24),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(35),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    tabActive: {
        backgroundColor: "rgba(40,140,200,0.55)",
    },
    tabLabel: {
        fontSize: rpx(28),
        color: "rgba(255,255,255,0.72)",
    },
    tabLabelActive: {
        color: "#ffffff",
        fontWeight: "bold",
    },
    listWrap: {
        flex: 1,
        paddingTop: rpx(6),
    },
    empty: {
        marginTop: rpx(60),
        textAlign: "center",
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(8),
    },
    moreBtn: {
        minWidth: rpx(160),
        height: rpx(70),
        paddingHorizontal: rpx(24),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(35),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    moreBtnText: {
        fontSize: rpx(26),
    },
});
