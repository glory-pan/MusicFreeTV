import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import TvCardPanel from "../base/tvCardPanel";
import { TvFocusable } from "@/tv/components";
import { hidePanel, showPanel } from "../usePanel";

interface IPluginInstallPanelProps {
    /** 扫码上传本地插件（手机扫二维码选文件传上来） */
    onScanPlugin?: () => void;
    /** 扫码输入链接安装 */
    onScanLink?: () => void;
    /** 从本地（U 盘/文件）安装 */
    onFromLocal?: () => void;
    /** 从网络安装（手输/粘贴链接） */
    onFromNetwork?: () => void;
    onUpdateAll?: () => void;
    onUpdateSubscribe?: () => void;
    onSubscriptionSettings?: () => void;
    onSort?: () => void;
    onUninstallAll?: () => void;
}

type TileDef = {
    /** 焦点名，用来做显式方向链接 */
    name: string;
    label: string;
    tips?: string;
    onPress: () => void;
};

/**
 * 「安装插件」弹框（电视版）。
 *
 * 只保留 musicfree 插件体系，两栏：
 *
 *   ① musicfree音源上传 —— 扫码上传本地插件 / 扫码输入链接安装 / 从本地安装 / 从网络安装
 *   ② 插件维护           —— 更新全部、更新订阅、订阅设置、插件排序、卸载全部
 *
 * 两栏并排 + 每栏内部竖排，整卡高度控制在一屏内（不靠滚动，光环不会跑出可视区），
 * 左右键换栏、上下键换项，全部走显式方向链接，不依赖几何判定。
 */
export default function PluginInstallPanel(props: IPluginInstallPanelProps) {
    const {
        onScanPlugin,
        onScanLink,
        onFromLocal,
        onFromNetwork,
        onUpdateAll,
        onUpdateSubscribe,
        onSubscriptionSettings,
        onSort,
        onUninstallAll,
    } = props ?? {};

    const fileTiles: TileDef[] = [
        {
            name: "pi:f:0",
            label: "扫码上传本地插件",
            tips: "手机扫码选文件",
            onPress: () => onScanPlugin?.(),
        },
        {
            name: "pi:f:1",
            label: "扫码输入链接安装",
            tips: "手机扫码贴链接",
            onPress: () => onScanLink?.(),
        },
        {
            name: "pi:f:2",
            label: "从本地安装插件",
            tips: "U 盘 / 文件",
            onPress: () => onFromLocal?.(),
        },
        {
            name: "pi:f:3",
            label: "从网络安装插件",
            tips: "直接填链接",
            onPress: () => onFromNetwork?.(),
        },
    ];

    const maintTiles: TileDef[] = [
        {
            name: "pi:m:0",
            label: "更新全部插件",
            onPress: () => onUpdateAll?.(),
        },
        {
            name: "pi:m:1",
            label: "更新订阅",
            onPress: () => onUpdateSubscribe?.(),
        },
        {
            name: "pi:m:2",
            label: "订阅设置",
            onPress: () => onSubscriptionSettings?.(),
        },
        {
            name: "pi:m:3",
            label: "插件排序",
            onPress: () => onSort?.(),
        },
        {
            name: "pi:m:4",
            label: "卸载全部插件",
            onPress: () => onUninstallAll?.(),
        },
    ];

    const renderColumn = (
        title: string,
        accent: string,
        tiles: TileDef[],
        colIndex: number,
    ) => (
        <View
            style={[
                styles.column,
                colIndex === 0 ? styles.columnLeft : null,
            ]}>
            <View style={styles.columnHeader}>
                <View style={[styles.accent, { backgroundColor: accent }]} />
                <ThemeText
                    fontSize="description"
                    fontWeight="medium"
                    style={styles.columnTitle}>
                    {title}
                </ThemeText>
            </View>
            {tiles.map((tile, index) => {
                // 上下在本栏内串成一条链；第一项没有"上"，最后一项没有"下"，
                // 想横向换栏就按左右键 —— 全部用显式链接，慢设备上也不会判错方向
                const up = index > 0 ? tiles[index - 1].name : undefined;
                const down =
                    index < tiles.length - 1 ? tiles[index + 1].name : undefined;
                const left = colIndex === 0 ? undefined : "pi:f:0";
                const right = colIndex === 0 ? "pi:m:0" : undefined;
                return (
                    <TvFocusable
                        key={tile.name}
                        name={tile.name}
                        focusOrder={colIndex * 10 + index}
                        upName={up}
                        downName={down}
                        leftName={left}
                        rightName={right}
                        style={styles.tile}
                        onPress={() => {
                            // 先关卡片再执行动作：扫码浮层/新页面都要在最上层
                            hidePanel();
                            tile.onPress();
                        }}>
                        <ThemeText
                            fontSize="content"
                            fontWeight="medium"
                            style={styles.tileLabel}>
                            {tile.label}
                        </ThemeText>
                        {tile.tips ? (
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                style={styles.tileTips}>
                                {tile.tips}
                            </ThemeText>
                        ) : null}
                    </TvFocusable>
                );
            })}
        </View>
    );

    return (
        <TvCardPanel
            title="安装插件"
            rememberKey="pluginInstallPanel"
            firstFocusName="pi:f:0"
            returnFocusName="plugin:install"
            width={rpx(680)}>
            <View style={styles.row}>
                {renderColumn(
                    "musicfree音源上传",
                    "#5fd0ff",
                    fileTiles,
                    0,
                )}
                {renderColumn("插件维护", "#7f8fa6", maintTiles, 1)}
            </View>
        </TvCardPanel>
    );
}

const styles = StyleSheet.create({
    row: {
        width: "100%",
        flexDirection: "row",
        paddingTop: rpx(4),
        paddingBottom: rpx(6),
    },
    column: {
        flex: 1,
        paddingHorizontal: rpx(10),
        paddingTop: rpx(10),
        paddingBottom: rpx(12),
        borderRadius: rpx(14),
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: rpx(1),
        borderColor: "rgba(140,190,255,0.28)",
    },
    columnLeft: {
        marginRight: rpx(14),
    },
    columnHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: rpx(10),
    },
    accent: {
        width: rpx(6),
        height: rpx(24),
        borderRadius: rpx(3),
        marginRight: rpx(8),
    },
    columnTitle: {
        color: "#eaf6ff",
    },
    tile: {
        width: "100%",
        minHeight: rpx(56),
        borderRadius: rpx(10),
        marginBottom: rpx(8),
        paddingHorizontal: rpx(10),
        paddingVertical: rpx(6),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    tileLabel: {
        color: "#ffffff",
    },
    tileTips: {
        marginTop: rpx(2),
        fontSize: rpx(18),
    },
});
