import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel } from "../usePanel";
import { PagerHint, usePager, usePagerKeys } from "@/tv/pager";

interface ICandidateItem {
    title?: string;
    value: any;
}

interface ISimpleSelectProps {
    height?: number;
    header?: string;
    candidates?: Array<ICandidateItem>;
    onPress?: (item: ICandidateItem) => void;
}

/** 一页放几项：电视上一屏刚好能完整显示，不靠滚动 */
const PAGE_SIZE = 5;

/**
 * 单选列表（插件安装方式、设置里的各种选择框都走这里）：
 * 电视端做成居中卡片 + 分页。项数超过一页时走到页尾再按下键翻页，
 * 每项永远都在可视区里 —— 不会再出现"光环走到第四个就不见了、后面选不到"。
 */
export default function SimpleSelect(props: ISimpleSelectProps) {
    const { header = "", candidates = [], onPress } = props ?? {};
    const pager = usePager(candidates.length, PAGE_SIZE);
    usePagerKeys("simpleSelect", pager, pager.goNext, pager.goPrev);

    return (
        <TvCardPanel
            title={header}
            rememberKey={`simpleSelect:${header}`}
            firstFocusName="simpleSelect:0"
            width={rpx(660)}>
            <View style={styles.body}>
                {candidates
                    .slice(pager.start, pager.end)
                    .map((it, offset) => {
                        const index = pager.start + offset;
                        return (
                            <ListItem
                                key={`simpleSelect-${index}`}
                                name={`simpleSelect:${index}`}
                                focusOrder={index}
                                heightType="small"
                                withHorizontalPadding
                                onPress={() => {
                                    onPress?.(it);
                                    hidePanel();
                                }}>
                                <ListItem.Content title={it.title ?? it.value} />
                            </ListItem>
                        );
                    })}
            </View>
            <PagerHint
                page={pager.page}
                pages={pager.pages}
                start={pager.start}
                end={pager.end}
                total={pager.total}
            />
        </TvCardPanel>
    );
}

const styles = StyleSheet.create({
    body: {
        width: "100%",
    },
});
