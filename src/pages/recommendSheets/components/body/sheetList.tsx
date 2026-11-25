import React, { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import useRecommendSheets from "../../hooks/useRecommendSheets";
import SheetItem from "@/components/mediaItem/sheetItem";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import ThemeText from "@/components/base/themeText";
import { TvFocusable } from "@/tv/components";
import { usePager, usePagerKeys, PagerHint } from "@/tv/pager";
import { tvFocus } from "@/tv/focusStore";

interface ISheetListProps {
    tag: ICommon.IUnique;
    pluginHash: string;
}

/** 一页 6 张（一排）：电视一屏正好放满，绝不让光环跑到屏幕外 */
const COLUMNS = 6;
const ROWS = 1;
const PAGE_SIZE = COLUMNS * ROWS;

/**
 * 推荐歌单列表（电视版）。
 *
 * 从"无限长的网格 + 手指滚动"改成**分页网格**：一页 4 列 × 2 行，
 * 走到页尾或按页脚「下一页」翻页；每个封面卡都是命名焦点节点（sheet:i），
 * 进页面光环直接落在第一张卡上，遥控器四向都可到达。
 */
function SheetList(props: ISheetListProps) {
    const { tag, pluginHash } = props ?? {};

    const [query, sheets, status] = useRecommendSheets(pluginHash, tag);
    const pager = usePager((sheets ?? []).length, PAGE_SIZE);
    usePagerKeys("sheet", pager, pager.goNext, pager.goPrev);

    const firstIndex = pager.start;

    useEffect(() => {
        if (!sheets?.length) {
            return;
        }
        // defer：网格节点一注册光环就落上去，不靠定时器碰运气
        tvFocus.focusByName(`sheet:${firstIndex}`, true);
        // 从歌单详情返回时，网格可能刚重新渲染完、卡片还没测量出坐标，
        // 这时下键会落到"标题"上。这里只要发现光环不在网格里就再补一次。
        const timers = [260, 700, 1400].map(delay =>
            setTimeout(() => {
                const focused = tvFocus.getFocusedNode();
                if (!focused?.debugName?.startsWith("sheet:")) {
                    tvFocus.focusByName(`sheet:${firstIndex}`, true) ||
                        tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheets?.length]);

    const pageItems = (sheets ?? []).slice(pager.start, pager.end);

    return (
        <ScrollView style={style.wrapper}>
            {pageItems.length ? (
                <View style={style.grid}>
                    {pageItems.map((item: IMusic.IMusicSheetItemBase, offset) => {
                        const index = pager.start + offset;
                        return (
                            <View
                                key={`${index}-${item.platform}-${item.id}`}
                                style={[
                                    style.cell,
                                    { width: `${100 / COLUMNS}%` },
                                ]}>
                                <SheetItem
                                    sheetInfo={item}
                                    pluginHash={pluginHash}
                                    name={`sheet:${index}`}
                                    focusOrder={offset}
                                />
                            </View>
                        );
                    })}
                </View>
            ) : (
                <ListEmpty state={status} onRetry={query} />
            )}

            {(sheets ?? []).length ? (
                <View style={style.footer}>
                    <PagerHint
                        page={pager.page}
                        pages={pager.pages}
                        start={pager.start}
                        end={pager.end}
                        total={pager.total}
                    />
                    {pager.pages > 1 ? (
                        <View style={style.pagerRow}>
                            <TvFocusable
                                name="sheet:prev"
                                focusOrder={200}
                                onPress={pager.goPrev}
                                style={[
                                    style.pagerBtn,
                                    pager.page === 0
                                        ? style.pagerBtnDisabled
                                        : null,
                                ]}>
                                <ThemeText fontSize="subTitle">上一页</ThemeText>
                            </TvFocusable>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="textSecondary"
                                style={style.pagerText}>
                                {`${pager.page + 1} / ${pager.pages}`}
                            </ThemeText>
                            <TvFocusable
                                name="sheet:next"
                                focusOrder={201}
                                onPress={pager.goNext}
                                style={[
                                    style.pagerBtn,
                                    pager.page >= pager.pages - 1
                                        ? style.pagerBtnDisabled
                                        : null,
                                ]}>
                                <ThemeText fontSize="subTitle">下一页</ThemeText>
                            </TvFocusable>
                        </View>
                    ) : null}
                    <ListFooter state={status} onRetry={query} />
                </View>
            ) : null}
        </ScrollView>
    );
}

export default memo(
    SheetList,
    (prev, curr) =>
        prev.tag.id === curr.tag.id && prev.pluginHash === curr.pluginHash,
);

const style = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
        paddingHorizontal: rpx(20),
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingTop: rpx(16),
    },
    cell: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(8),
        paddingBottom: rpx(20),
    },
    footer: {
        width: "100%",
        paddingBottom: rpx(10),
    },
    pagerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: rpx(6),
    },
    pagerBtn: {
        minWidth: rpx(120),
        height: rpx(56),
        borderRadius: rpx(28),
        paddingHorizontal: rpx(20),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
        marginLeft: rpx(14),
    },
    pagerBtnDisabled: {
        opacity: 0.4,
    },
    pagerText: {
        marginLeft: rpx(14),
    },
});
