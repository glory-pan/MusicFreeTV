import React, { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { TvScrollView } from "@/tv/scroll";
import rpx from "@/utils/rpx";
import { IPluginTopListResult } from "../store/atoms";
import { RequestStateCode } from "@/constants/commonConst";
import Loading from "@/components/base/loading";
import TopListItem from "@/components/mediaItem/topListItem";
import ThemeText from "@/components/base/themeText";
import ListEmpty from "@/components/base/listEmpty";
import { tvFocus } from "@/tv/focusStore";
import { useTvPageFirstFocus } from "@/tv/firstFocus";

interface IBoardPanelProps {
    hash: string;
    topListData: IPluginTopListResult;
}
/**
 * 榜单列表：原来是 TvSectionList（虚拟化），
 * 子项被复用/测量时机不可控，进页面要连按好几次下键光环才冒出来。
 * 现在改成 TvScrollView 平铺，每个榜单条目都是命名焦点节点（toplist:i），
 * 进页面直接把光环放到第一个榜单。
 */
function BoardPanel(props: IBoardPanelProps) {
    const { hash, topListData } = props ?? {};

    const sections = topListData?.data || [];
    const finished = topListData?.state === RequestStateCode.FINISHED;
    const firstKey =
        sections.length && (sections[0].data ?? []).length ? "toplist:0" : "";

    useEffect(() => {
        if (!finished || !firstKey) {
            return;
        }
        // 数据到了、条目注册了，直接把光环放到第一个榜单
        tvFocus.focusByName(firstKey, true);
        const timers = [300, 900, 1600].map(delay =>
            setTimeout(() => {
                const focused = tvFocus.getFocusedNode();
                if (!focused?.debugName?.startsWith("toplist:")) {
                    tvFocus.focusByName(firstKey, true) ||
                        tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(clearTimeout);
    }, [finished, firstKey]);

    // 进页面兜底：只要屏幕上没有可见光环，就点亮本页第一个元素
    useTvPageFirstFocus();

    if (!finished) {
        return <Loading />;
    }

    let seq = -1;
    return (
        <TvScrollView style={style.wrapper}>
            {sections.length ? (
                sections.map((section, sIndex) => (
                    <View key={`${sIndex}-${section.title}`} style={style.section}>
                        {section.title ? (
                            <View style={style.sectionHeader}>
                                <View style={style.sectionAccent} />
                                <ThemeText fontWeight="bold" fontSize="title">
                                    {section.title}
                                </ThemeText>
                            </View>
                        ) : null}
                        {(section.data ?? []).map(item => {
                            seq += 1;
                            const idx = seq;
                            return (
                                <TopListItem
                                    key={`${sIndex}-${idx}-${item.platform ?? ""}-${item.id ?? ""}`}
                                    topListItem={item}
                                    pluginHash={hash}
                                    name={`toplist:${idx}`}
                                    focusOrder={idx}
                                />
                            );
                        })}
                    </View>
                ))
            ) : (
                <ListEmpty state={topListData?.state} />
            )}
        </TvScrollView>
    );
}

export default memo(
    BoardPanel,
    (prev, curr) => prev.topListData === curr.topListData,
);

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    section: {
        width: "100%",
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(26),
        marginBottom: rpx(16),
        marginLeft: rpx(24),
    },
    sectionAccent: {
        width: rpx(6),
        height: rpx(28),
        borderRadius: rpx(3),
        marginRight: rpx(12),
        backgroundColor: "#5fd0ff",
    },
});
