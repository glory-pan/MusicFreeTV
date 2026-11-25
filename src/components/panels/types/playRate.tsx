import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import TvCardPanel from "../base/tvCardPanel";
import { TvFocusable } from "@/tv/components";
import { hidePanel } from "../usePanel";
import { PagerHint, usePager, usePagerKeys } from "@/tv/pager";

interface IPlayRateProps {
    /** 点击回调 */
    onRatePress: (rate: number) => void;
}

const rates = [50, 75, 100, 125, 150, 175, 200];
const RATE_LABEL: Record<number, string> = {
    50: "0.5x 慢放",
    75: "0.75x",
    100: "1.0x 正常",
    125: "1.25x",
    150: "1.5x",
    175: "1.75x",
    200: "2.0x 快进",
};

/** 每页 5 项：整页都在卡片可视区内，第 5 项再按下键就翻页 */
const PAGE_SIZE = 5;

export default function PlayRate(props: IPlayRateProps) {
    const { onRatePress } = props ?? {};
    const pager = usePager(rates.length, PAGE_SIZE);
    usePagerKeys("rate", pager, pager.goNext, pager.goPrev);

    return (
        <TvCardPanel
            title="倍速播放"
            width={rpx(600)}
            rememberKey="playRate"
            firstFocusName={`rate:${pager.start}`}>
            {rates.slice(pager.start, pager.end).map((rate, offset) => {
                const index = pager.start + offset;
                return (
                    <TvFocusable
                        key={rate}
                        name={`rate:${index}`}
                        focusOrder={index}
                        style={styles.item}
                        onPress={() => {
                            onRatePress(rate);
                            hidePanel();
                        }}>
                        <ThemeText fontSize="subTitle">
                            {RATE_LABEL[rate] ?? `${rate / 100}x`}
                        </ThemeText>
                        {rate === 100 ? (
                            <View style={styles.badge}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="primary">
                                    当前
                                </ThemeText>
                            </View>
                        ) : null}
                    </TvFocusable>
                );
            })}
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
    item: {
        width: "100%",
        minHeight: rpx(84),
        paddingHorizontal: rpx(20),
        marginBottom: rpx(10),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.06)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    badge: {
        paddingHorizontal: rpx(12),
        paddingVertical: rpx(2),
        borderRadius: rpx(8),
        backgroundColor: "rgba(169,233,255,0.14)",
    },
});
