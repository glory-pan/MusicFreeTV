import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ThemeText from "@/components/base/themeText";
import { TvFocusable } from "@/tv/components";
import { PagerHint } from "@/tv/pager";

interface IMarkdownDialogProps {
    title: string;
    markdownContent: string;
    okText?: string;
}

/** 一页显示多少行文字 */
const PAGE_SIZE = 7;

/**
 * 插件说明 / 任意 Markdown 内容。
 *
 * 电视上原来这套是 marked + WebView 的大白卡：WebView 里没法用遥控器滚动，
 * 卡片下半截全是大片空白，只有"我知道了"有光环。现在改成：
 *  1. Markdown 抽成纯文本行（标题、列表、引用、代码块都降级成文字），不再用 WebView；
 *  2. 按页切分，遥控器按「上一页/下一页」翻页，翻页按钮也带光环。
 */
export default function MarkdownDialog(props: IMarkdownDialogProps) {
    const { title, markdownContent, okText } = props;

    const pages = useMemo(
        () => splitMarkdownIntoPages(markdownContent ?? "", PAGE_SIZE),
        [markdownContent],
    );

    const [pageIndex, setPageIndex] = useState(0);
    const totalPages = Math.max(1, pages.length);
    const safePage = Math.min(pageIndex, totalPages - 1);

    const hasPrev = safePage > 0;
    const hasNext = safePage < totalPages - 1;
    const goPrev = () => setPageIndex(p => Math.max(0, p - 1));
    const goNext = () => setPageIndex(p => Math.min(totalPages - 1, p + 1));

    return (
        <Dialog onDismiss={hideDialog} firstFocusName="md:close">
            <Dialog.Title withDivider>{title}</Dialog.Title>
            <Dialog.Content style={styles.dialogContent}>
                <View style={styles.body}>
                    {!(pages[safePage] ?? []).length ? (
                        <ThemeText fontColor="textSecondary">
                            没有内容
                        </ThemeText>
                    ) : (
                        (pages[safePage] ?? []).map((line, index) => (
                            <ThemeText
                                key={`mdline-${index}`}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                                style={[
                                    styles.lineText,
                                    line.level === 0
                                        ? styles.lineTitle
                                        : null,
                                ]}
                                fontColor={
                                    line.blank ? "textSecondary" : "text"
                                }>
                                {line.blank ? " " : line.text}
                            </ThemeText>
                        ))
                    )}

                    {totalPages > 1 ? (
                        <>
                            <PagerHint
                                page={safePage}
                                pages={totalPages}
                                start={safePage + 1}
                                end={safePage + 1}
                                total={totalPages}
                            />
                            <View style={styles.pagerRow}>
                                <TvFocusable
                                    name="md:prev"
                                    focusOrder={10}
                                    disabled={!hasPrev}
                                    rightName="md:next"
                                    downName="md:close"
                                    onPress={goPrev}
                                    style={[
                                        styles.btn,
                                        !hasPrev ? styles.btnDisabled : null,
                                    ]}>
                                    <ThemeText
                                        style={styles.btnText}
                                        fontColor={
                                            hasPrev ? "text" : "textSecondary"
                                        }>
                                        上一页
                                    </ThemeText>
                                </TvFocusable>
                                <TvFocusable
                                    name="md:next"
                                    focusOrder={11}
                                    disabled={!hasNext}
                                    leftName="md:prev"
                                    downName="md:close"
                                    onPress={goNext}
                                    style={[
                                        styles.btn,
                                        !hasNext ? styles.btnDisabled : null,
                                    ]}>
                                    <ThemeText
                                        style={styles.btnText}
                                        fontColor={
                                            hasNext ? "text" : "textSecondary"
                                        }>
                                        下一页
                                    </ThemeText>
                                </TvFocusable>
                            </View>
                        </>
                    ) : null}
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={
                    [
                        {
                            title: okText ?? "我知道了",
                            type: "primary",
                            onPress() {
                                hideDialog();
                            },
                        },
                    ] as any
                }
            />
        </Dialog>
    );
}

interface IMdLine {
    text: string;
    level: number;
    blank?: boolean;
}

/** 把 markdown 压成纯文本行：标题保留层级、去掉强调符号、链接只留文字 */
function splitMarkdownIntoPages(
    content: string,
    pageSize: number,
): IMdLine[][] {
    const rawLines = content.replace(/\r\n/g, "\n").split("\n");
    const lines: IMdLine[] = [];
    let inCode = false;

    rawLines.forEach(raw => {
        const text = raw.replace(/\t/g, "    ").trimEnd();
        const trimmed = text.trim();

        if (/^```/.test(trimmed)) {
            inCode = !inCode;
            return;
        }

        if (!trimmed) {
            if (lines.length && !lines[lines.length - 1].blank) {
                lines.push({ text: "", level: 1, blank: true });
            }
            return;
        }

        const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
        if (heading && !inCode) {
            lines.push({ text: cleanInline(heading[2]), level: 0 });
            return;
        }

        if (/^>\s?/.test(trimmed)) {
            lines.push({
                text: `｜ ${cleanInline(trimmed.replace(/^>\s?/, ""))}`,
                level: 1,
            });
            return;
        }

        if (/^(?:-{3,}|\*{3,})$/.test(trimmed)) {
            return;
        }

        const list = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(trimmed);
        if (list) {
            lines.push({ text: `· ${cleanInline(list[1])}`, level: 1 });
            return;
        }

        lines.push({ text: cleanInline(trimmed), level: 1 });
    });

    while (lines.length && lines[lines.length - 1].blank) {
        lines.pop();
    }

    if (!lines.length) {
        return [[]];
    }

    const pages: IMdLine[][] = [];
    for (let i = 0; i < lines.length; i += pageSize) {
        pages.push(lines.slice(i, i + pageSize));
    }
    return pages;
}

function cleanInline(text: string) {
    return text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1（$2）")
        .replace(/<[^>]+>/g, "")
        .replace(/[`*_]{1,3}/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

const styles = StyleSheet.create({
    dialogContent: {
        paddingVertical: 0,
        paddingHorizontal: rpx(8),
    },
    body: {
        width: "100%",
    },
    lineText: {
        fontSize: rpx(25),
        lineHeight: rpx(38),
        marginBottom: rpx(4),
    },
    lineTitle: {
        fontSize: rpx(29),
        marginTop: rpx(6),
        marginBottom: rpx(8),
    },
    pagerRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        marginTop: rpx(4),
        marginBottom: rpx(8),
    },
    btn: {
        minWidth: rpx(140),
        height: rpx(74),
        marginLeft: rpx(16),
        paddingHorizontal: rpx(22),
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(37),
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    btnDisabled: {
        opacity: 0.4,
    },
    btnText: {
        fontSize: rpx(28),
    },
});
