import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TvScrollView as ScrollView } from "@/tv/scroll";
import rpx, { vh } from "@/utils/rpx";
import Loading from "@/components/base/loading";
import useSearch from "../hooks/useSearch";
import {
    addHistory,
    getHistory,
    removeAllHistory,
    removeHistory,
} from "../common/historySearch";
import { useSetAtom } from "jotai";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "../store/atoms";
import ThemeText from "@/components/base/themeText";
import { TvFocusable } from "@/tv/components";
import Empty from "@/components/base/empty";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import Icon from "@/components/base/icon";

/**
 * 搜索历史：电视端改成一行一条的列表（原来用 Chip 流式排列，
 * 那些 Chip 内部不是焦点节点，遥控器根本定位不到，只能看到不能选）。
 */
export default function () {
    const [history, setHistory] = useState<string[] | null>(null);
    const search = useSearch();

    const setQuery = useSetAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    useEffect(() => {
        getHistory().then(setHistory);
    }, []);

    return (
        <View style={style.wrapper}>
            {history === null ? (
                <Loading />
            ) : (
                <>
                    <View style={style.header}>
                        <ThemeText fontSize="title" fontWeight="semibold">
                            {t("searchPage.history")}
                        </ThemeText>
                        {history.length ? (
                            <TvFocusable
                                name="search:clearHistory"
                                style={style.clearButton}
                                onPress={() => {
                                    showDialog("SimpleDialog", {
                                        title: t("common.clear"),
                                        content: "确认清空全部搜索历史吗？",
                                        okText: "确认清空",
                                        cancelText: t("common.cancel"),
                                        onOk: async () => {
                                            await removeAllHistory();
                                            getHistory().then(setHistory);
                                        },
                                    });
                                }}>
                                <ThemeText fontSize="subTitle">
                                    {t("common.clear")}
                                </ThemeText>
                            </TvFocusable>
                        ) : null}
                    </View>
                    {history.length ? (
                        <ScrollView style={style.historyContent}>
                            {history.map((item, index) => (
                                <View
                                    key={`search-history-${item}`}
                                    style={style.historyRowWrap}>
                                <TvFocusable
                                    name={`search:history:${index}`}
                                    focusOrder={index}
                                    style={style.historyRow}
                                    onPress={() => {
                                        setSearchResultsState(
                                            initSearchResults,
                                        );
                                        setPageStatus(PageStatus.SEARCHING);
                                        search(item, 1);
                                        addHistory(item);
                                        setQuery(item);
                                    }}>
                                    <Icon
                                        accessible={false}
                                        name="clock-outline"
                                        size={rpx(28)}
                                        color="rgba(255,255,255,0.62)"
                                    />
                                    <Text
                                        numberOfLines={1}
                                        style={style.historyText}>
                                        {item}
                                    </Text>
                                </TvFocusable>
                                <TvFocusable
                                    name={`search:historyDel:${index}`}
                                    focusOrder={100 + index}
                                    style={style.deleteButton}
                                    onPress={async () => {
                                        await removeHistory(item);
                                        getHistory().then(setHistory);
                                    }}>
                                    <Icon
                                        accessible={false}
                                        name="x-mark"
                                        size={rpx(24)}
                                        color="rgba(255,255,255,0.75)"
                                    />
                                </TvFocusable>
                                </View>
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={style.emptyWrap}>
                            <Empty />
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        maxWidth: "100%",
        flexDirection: "column",
        paddingHorizontal: rpx(40),
        paddingTop: rpx(16),
        flex: 1,
    },
    header: {
        width: "100%",
        flexDirection: "row",
        paddingVertical: rpx(20),
        justifyContent: "space-between",
        alignItems: "center",
    },
    clearButton: {
        width: rpx(150),
        height: rpx(66),
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    historyContent: {
        width: "100%",
        flex: 1,
    },
    historyRowWrap: {
        width: "100%",
        height: vh(7.6),
        marginBottom: rpx(14),
        flexDirection: "row",
        alignItems: "center",
    },
    historyRow: {
        flex: 1,
        height: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(26),
        marginBottom: rpx(14),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    deleteButton: {
        width: rpx(88),
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.06)",
        marginLeft: rpx(12),
    },
    historyText: {
        marginLeft: rpx(20),
        flexShrink: 1,
        color: "#e6edf5",
        fontSize: rpx(28),
    },
    emptyWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
