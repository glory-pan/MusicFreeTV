import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TvFocusable } from "@/tv/components";
import { tvFocus } from "@/tv/focusStore";
import { useTvKeys } from "@/tv/provider";
import { IEqBand, IEqState, tvEqualizer } from "@/tv/bridge";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";

const LEVEL_STEP = 150;

/** 系统均衡器预设名 → 中文 */
const EQ_PRESET_CN: Record<string, string> = {
    Normal: "标准",
    Classical: "古典",
    Dance: "舞曲",
    Flat: "平坦",
    Folk: "民谣",
    HeavyMetal: "重金属",
    HipHop: "嘻哈",
    Jazz: "爵士",
    Pop: "流行",
    Rock: "摇滚",
    RAndB: "节奏布鲁斯",
    Speech: "人声",
    Treble: "高音",
    Bass: "低音",
    Vocal: "演唱",
    Lounge: "休闲",
    Party: "派对",
    Electronic: "电子",
};

/**
 * 电视端均衡器（参照 walkman-tv）：系统级 AudioEffect.Equalizer。
 * 遥控器交互：方向键选中频段 → 左右键调节电平；OK 把该频段归零。
 */
export default function EqualizerBody({ compact }: { compact?: boolean }) {
    const colors = useColors();
    const [state, setState] = useState<IEqState | null>(null);
    const [bands, setBands] = useState<IEqBand[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [presetIndex, setPresetIndex] = useState<number | null>(null);

    const load = useCallback(async () => {
        const result = await tvEqualizer.getState();
        if (result) {
            setState(result);
            setBands(result.bands ?? []);
            setEnabled(result.enabled);
        } else {
            setState({
                supported: false,
                enabled: false,
                minLevel: 0,
                maxLevel: 0,
                bands: [],
                presets: [],
            });
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = useCallback(async () => {
        const next = !enabled;
        await tvEqualizer.setEnabled(next);
        setEnabled(next);
        if (next) {
            await load();
        }
    }, [enabled, load]);

    const applyPreset = useCallback(
        async (index: number) => {
            await tvEqualizer.setEnabled(true);
            await tvEqualizer.setPreset(index);
            setEnabled(true);
            setPresetIndex(index);
            const result = await tvEqualizer.getState();
            if (result) {
                setBands(result.bands ?? []);
            }
        },
        [],
    );

    const setLevel = useCallback(
        async (index: number, level: number) => {
            await tvEqualizer.setEnabled(true);
            await tvEqualizer.setBandLevel(index, level);
            setEnabled(true);
            setBands(prev =>
                prev.map(item =>
                    item.index === index ? { ...item, level } : item,
                ),
            );
        },
        [],
    );

    // 遥控器左右键调节当前聚焦频段
    useTvKeys((key, action) => {
        if (action !== "down") {
            return false;
        }
        if (key !== "left" && key !== "right") {
            return false;
        }
        const name = tvFocus.getFocusedNode()?.debugName ?? "";
        if (!name.startsWith("eq-band:")) {
            return false;
        }
        const index = Number(name.split(":")[1]);
        const band = bands.find(item => item.index === index);
        if (!band || !state) {
            return false;
        }
        const dir = key === "right" ? LEVEL_STEP : -LEVEL_STEP;
        const next = Math.min(
            state.maxLevel,
            Math.max(state.minLevel, band.level + dir),
        );
        setLevel(index, next);
        return true;
    });

    if (state && !state.supported) {
        return (
            <View style={styles.center}>
                <Text style={styles.tip}>
                    当前设备不支持系统均衡器（部分盒子未开放音频效果接口）。
                </Text>
            </View>
        );
    }

    const range = state ? state.maxLevel - state.minLevel : 1;

    return (
        <View style={styles.wrapper}>
            <View style={styles.topRow}>
                <TvFocusable
                    focusOrder={0}
                    style={[
                        styles.mainSwitch,
                        { backgroundColor: enabled ? colors.primary : colors.card },
                    ]}
                    onPress={toggle}>
                    <Text style={styles.mainSwitchText}>
                        {enabled ? "均衡器：已开启" : "均衡器：已关闭"}
                    </Text>
                </TvFocusable>
                <Text style={styles.hint}>左右键调电平 · OK 归零</Text>
            </View>

            <Text style={styles.sectionTitle}>预设音效</Text>
            <View style={styles.presetWrap}>
                {(state?.presets ?? []).map((preset, index) => (
                    <TvFocusable
                        key={preset.index}
                        focusOrder={index + 1}
                        style={[
                            styles.presetChip,
                            {
                                backgroundColor: colors.card,
                                borderColor:
                                    presetIndex === preset.index
                                        ? colors.primary
                                        : "transparent",
                            },
                        ]}
                        onPress={() => applyPreset(preset.index)}>
                        <Text style={styles.presetText}>
                            {EQ_PRESET_CN[preset.name] ?? preset.name}
                        </Text>
                    </TvFocusable>
                ))}
            </View>

            <Text style={styles.sectionTitle}>频段调节</Text>
            <View style={styles.bandWrap}>
                {bands.map((band, index) => {
                    const ratio =
                        state != null
                            ? (band.level - state.minLevel) / (range || 1)
                            : 0.5;
                    return (
                        <TvFocusable
                            key={band.index}
                            name={`eq-band:${band.index}`}
                            focusOrder={20 + index}
                            style={styles.bandCell}
                            onPress={() => setLevel(band.index, 0)}>
                            <Text style={styles.bandLabel}>
                                {band.center >= 1000
                                    ? `${(band.center / 1000).toFixed(1)}k`
                                    : `${band.center}`}
                            </Text>
                            <View style={styles.barTrack}>
                                <View
                                    style={[
                                        styles.barFill,
                                        {
                                            width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                                            backgroundColor: colors.primary,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.bandValue}>
                                {Math.round(band.level / 100) / 10}dB
                            </Text>
                        </TvFocusable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: "100%", paddingHorizontal: rpx(24), paddingVertical: rpx(4) },
    body: { width: "100%", paddingHorizontal: rpx(28), paddingVertical: rpx(6) },
    topRow: { flexDirection: "row", alignItems: "center", gap: rpx(20) },
    mainSwitch: {
        width: rpx(300),
        height: rpx(56),
        borderRadius: rpx(14),
        alignItems: "center",
        justifyContent: "center",
    },
    mainSwitchText: { fontSize: rpx(28), color: "#fff" },
    hint: { fontSize: rpx(20), color: "#8b98a9" },
    sectionTitle: {
        fontSize: rpx(24),
        color: "#9fb0c4",
        marginTop: rpx(12),
        marginBottom: rpx(8),
    },
    presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: rpx(10) },
    presetChip: {
        minWidth: rpx(140),
        height: rpx(50),
        borderRadius: rpx(12),
        borderWidth: rpx(2),
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(14),
    },
    presetText: { fontSize: rpx(22), color: "#e6edf5" },
    bandWrap: { flexDirection: "row", flexWrap: "wrap", gap: rpx(8) },
    bandCell: {
        width: "48%",
        height: rpx(52),
        flexDirection: "row",
        alignItems: "center",
        borderRadius: rpx(10),
        paddingHorizontal: rpx(8),
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    bandLabel: { width: rpx(70), fontSize: rpx(20), color: "#9fb0c4" },
    barTrack: {
        flex: 1,
        height: rpx(8),
        borderRadius: rpx(4),
        backgroundColor: "rgba(255,255,255,0.12)",
        marginHorizontal: rpx(8),
    },
    barFill: { height: rpx(8), borderRadius: rpx(4) },
    bandValue: { width: rpx(66), textAlign: "right", fontSize: rpx(20), color: "#e6edf5" },
    tip: { fontSize: rpx(20), color: "#8b98a9", marginTop: rpx(10) },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
