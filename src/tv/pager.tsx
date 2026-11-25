import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { tvFocus } from "./focusStore";
import { useTvKeys } from "./provider";

/**
 * 电视端分页：电视拿不到手指滚动，长列表靠滚动很容易出现
 * "光环走到第 5 行就跑到可视区外面"——看起来就是光环消失、后面的选项选不到。
 * 这里改成"只渲染当前这一页"，走到页尾按键翻页：
 * 元素永远都在可视区里，光环不可能跑出去，100 个颜色/100 首歌也能全部选到。
 */
export function usePager(total: number, pageSize: number) {
    const [page, setPage] = useState(0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pages - 1);
    const start = safePage * pageSize;
    const end = Math.min(start + pageSize, total);

    useEffect(() => {
        // 数据变少时把页码拉回合法范围
        if (page > pages - 1) {
            setPage(Math.max(0, pages - 1));
        }
    }, [pages, page]);

    const goNext = useCallback(() => {
        setPage(p => Math.min(p + 1, pages - 1));
    }, [pages]);
    const goPrev = useCallback(() => {
        setPage(p => Math.max(p - 1, 0));
    }, []);

    return { page: safePage, pages, start, end, total, goNext, goPrev };
}

/**
 * 接管上下键：只在"当前页最后一项再按下键"和"第一项再按上键"时翻页，
 * 其余按键交还给空间导航（页内上下移动照常）。
 */
export function usePagerKeys(
    prefix: string,
    pager: { start: number; end: number; total: number },
    goNext: () => void,
    goPrev: () => void,
) {
    const { start, end, total } = pager;
    useTvKeys(
        useCallback(
            (key, action) => {
                if (action !== "down") {
                    return false;
                }
                const focused = tvFocus.getFocusedNode();
                const name = focused?.debugName;
                if (!name || !name.startsWith(`${prefix}:`)) {
                    return false;
                }
                const index = Number(name.slice(prefix.length + 1));
                if (Number.isNaN(index)) {
                    return false;
                }
                if (key === "down" && index >= end - 1 && end < total) {
                    goNext();
                    tvFocus.focusByName(`${prefix}:${end}`, true);
                    return true;
                }
                if (key === "up" && index <= start && start > 0) {
                    goPrev();
                    tvFocus.focusByName(`${prefix}:${start - 1}`, true);
                    return true;
                }
                return false;
            },
            [prefix, start, end, total, goNext, goPrev],
        ),
    );
}

export function PagerHint(props: {
    page: number;
    pages: number;
    start: number;
    end: number;
    total: number;
}) {
    const { page, pages, start, end, total } = props;
    const text = useMemo(() => {
        if (pages <= 1) {
            return `共 ${total} 项`;
        }
        return `${start + 1}-${end} / ${total}　第 ${page + 1}/${pages} 页（上下键翻页）`;
    }, [page, pages, start, end, total]);

    return (
        <View style={styles.wrapper} pointerEvents="none">
            <Text style={styles.text}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingTop: rpx(8),
        paddingBottom: rpx(2),
        alignItems: "flex-end",
    },
    text: {
        fontSize: rpx(20),
        color: "#8fa3ba",
    },
});
