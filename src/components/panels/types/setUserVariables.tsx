import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";

import ThemeText from "@/components/base/themeText";
import { TvFocusable } from "@/tv/components";
import { showQrInput } from "@/tv/qrOverlay";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel } from "../usePanel";
import { PagerHint, usePager, usePagerKeys } from "@/tv/pager";

interface IUserVariablesProps {
    title?: string;
    onOk: (values: Record<string, string>, closePanel: () => void) => void;
    variables: IPlugin.IUserVariable[];
    initValues?: Record<string, string>;
    onCancel?: () => void;
}

/** 一页放几项：电视上一屏刚好显示完整，不靠滚动 */
const PAGE_SIZE = 4;

/**
 * 用户变量（musicfree 插件可能带，比如 Cookie、密钥这类值）：
 * 原来是手机式顶部抽屉（PanelBase），在电视上是一整块浅色板、文字被裁、没有光环。
 * 现在改成和别的弹框一致的居中卡片：标题栏 + 带光环的变量行 + 带光环的保存/取消，
 * 项数多时分页，遥控器上下左右都能走。
 */
export default function SetUserVariables(props: IUserVariablesProps) {
    const { onOk, onCancel, variables = [], initValues = {}, title } = props;

    const resultRef = useRef<Record<string, string>>({ ...initValues });
    // 遥控器上没法直接敲键盘，改值后靠这个计数触发重渲染把新值显示出来
    const [_tick, setTick] = useState(0);

    const total = Math.max(1, variables.length);
    const pager = usePager(total, PAGE_SIZE);
    usePagerKeys("uservar", pager, pager.goNext, pager.goPrev);

    const pageVars = variables.slice(pager.start, pager.end);
    const firstRowName =
        variables.length ? `uservar:${pager.start}` : "uservar:save";
    const lastRowName =
        variables.length ? `uservar:${pager.end - 1}` : "uservar:save";

    const openInput = useCallback((it: IPlugin.IUserVariable) => {
        // 这类值通常很长（Cookie、密钥），电视上逐字敲不现实，一律手机扫码回填
        showQrInput({
            mode: "text",
            title: `${it.name ?? it.key}（手机扫码输入）`,
            onText: (text: string) => {
                resultRef.current[it.key] = text.trim();
                setTick(v => v + 1);
            },
        });
    }, []);

    return (
        <TvCardPanel
            title={title ?? "设置用户变量"}
            rememberKey="setUserVariables"
            firstFocusName={firstRowName}
            width={rpx(700)}>
            <View style={styles.body}>
                {variables.length ? (
                    <>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.tip}>
                            按 OK 键后用手机扫码填写（cookie、密钥这类值在电视上不好敲）
                        </ThemeText>
                        {pageVars.map((it, offset) => {
                            const index = pager.start + offset;
                            const value = resultRef.current[it.key];
                            return (
                                <TvFocusable
                                    key={it.key}
                                    name={`uservar:${index}`}
                                    focusOrder={offset}
                                    upName={
                                        offset === 0
                                            ? undefined
                                            : `uservar:${index - 1}`
                                    }
                                    downName={
                                        offset === pageVars.length - 1
                                            ? "uservar:save"
                                            : `uservar:${index + 1}`
                                    }
                                    onPress={() => openInput(it)}
                                    style={styles.varRow}>
                                    <View style={styles.varLeft}>
                                        <ThemeText
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            style={styles.varName}>
                                            {it.name ?? it.key}
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary"
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            style={styles.varHint}>
                                            {it.hint ?? it.key}
                                        </ThemeText>
                                    </View>
                                    <ThemeText
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        fontColor={
                                            value ? "text" : "textSecondary"
                                        }
                                        style={styles.varValue}>
                                        {value
                                            ? `已填写 · ${
                                                  String(value).length
                                              } 字符`
                                            : "未填写 · 按 OK 填写"}
                                    </ThemeText>
                                </TvFocusable>
                            );
                        })}
                    </>
                ) : (
                    <ThemeText
                        style={styles.empty}
                        fontColor="textSecondary">
                        这个插件没有需要设置的变量
                    </ThemeText>
                )}

                <View style={styles.footer}>
                    <TvFocusable
                        name="uservar:save"
                        focusOrder={100}
                        leftName="uservar:cancel"
                        upName={lastRowName}
                        downName={lastRowName}
                        onPress={() => onOk(resultRef.current, hidePanel)}
                        style={styles.btn}>
                        <ThemeText style={styles.btnText}>保存</ThemeText>
                    </TvFocusable>
                    <TvFocusable
                        name="uservar:cancel"
                        focusOrder={101}
                        rightName="uservar:save"
                        upName={lastRowName}
                        downName={lastRowName}
                        onPress={() => {
                            onCancel?.();
                            hidePanel();
                        }}
                        style={styles.btn}>
                        <ThemeText
                            style={styles.btnText}
                            fontColor="textSecondary">
                            取消
                        </ThemeText>
                    </TvFocusable>
                </View>

                {pager.pages > 1 ? (
                    <PagerHint
                        page={pager.page}
                        pages={pager.pages}
                        start={pager.start}
                        end={pager.end}
                        total={pager.total}
                    />
                ) : null}
            </View>
        </TvCardPanel>
    );
}

const styles = StyleSheet.create({
    body: {
        width: "100%",
    },
    tip: {
        marginBottom: rpx(16),
    },
    varRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: rpx(112),
        marginBottom: rpx(14),
        paddingHorizontal: rpx(20),
        borderRadius: rpx(14),
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    varLeft: {
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: "45%",
    },
    varName: {
        fontSize: rpx(30),
    },
    varHint: {
        marginTop: rpx(6),
    },
    varValue: {
        maxWidth: "50%",
        textAlign: "right",
        fontSize: rpx(26),
    },
    empty: {
        marginVertical: vh(4),
        textAlign: "center",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        marginTop: rpx(16),
    },
    btn: {
        minWidth: rpx(150),
        height: rpx(84),
        marginLeft: rpx(18),
        paddingHorizontal: rpx(28),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(42),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    btnText: {
        fontSize: rpx(30),
    },
});
