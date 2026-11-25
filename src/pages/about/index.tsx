import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import ThemeText from "@/components/base/themeText";
import LinkText from "@/components/base/linkText";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { TvScrollView } from "@/tv/scroll";
import { useTvKeys } from "@/tv/provider";
import rpx from "@/utils/rpx";
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

/** 开源地址：换用户名/仓库名只改这三行 */
const GITHUB_PROFILE = "https://github.com/musicfree-tv";
const PROJECT_REPO = "https://github.com/musicfree-tv/MusicFreeTV";
const UPSTREAM_REPO = "https://github.com/maotoumao/MusicFree";

const SCROLL_STEP = rpx(220);

function SectionTitle(props: { children: string }) {
    return (
        <View style={styles.sectionTitleRow}>
            <View style={styles.accentBar} />
            <ThemeText fontSize="title" fontWeight="bold">
                {props.children}
            </ThemeText>
        </View>
    );
}

export default function About() {
    const scrollRef = useRef<any>(null);
    const [offset, setOffset] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const [viewHeight, setViewHeight] = useState(0);
    const offsetRef = useRef(0);
    offsetRef.current = offset;

    function scrollBy(delta: number) {
        const max = Math.max(0, contentHeight - viewHeight);
        const next = Math.max(0, Math.min(max, offsetRef.current + delta));
        setOffset(next);
        try {
            scrollRef.current?.scrollTo?.({ y: next, animated: true });
        } catch {}
    }

    // 说明书式页面：遥控器上下键滚动，返回键退出
    useTvKeys((key, action) => {
        if (action !== "down") {
            return false;
        }
        if (key === "up") {
            scrollBy(-SCROLL_STEP);
            return true;
        }
        if (key === "down") {
            scrollBy(SCROLL_STEP);
            return true;
        }
        if (key === "left") {
            scrollBy(-SCROLL_STEP);
            return true;
        }
        if (key === "right") {
            scrollBy(SCROLL_STEP);
            return true;
        }
        return false;
    });

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>关于 MusicFree TV</AppBar>
            <TvScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                onContentSizeChange={(_w: number, h: number) =>
                    setContentHeight(h)
                }
                onLayout={(e: any) => setViewHeight(e.nativeEvent.layout.height)}>
                <ThemeText fontSize="appbar" fontWeight="bold">
                    MusicFree TV
                </ThemeText>
                <ThemeText fontColor="textSecondary" style={styles.subTitle}>
                    glory 重构电视版 · 遥控器深度适配 · v1.0.0
                </ThemeText>

                <SectionTitle>声明</SectionTitle>
                <ThemeText style={styles.body}>
                    本软件是基于开源项目{" "}
                    <ThemeText fontWeight="bold">MusicFree</ThemeText>（手机版，原作者{" "}
                    <ThemeText fontWeight="bold">猫头猫</ThemeText>）做的电视端改造版本，
                    遵循原项目的 AGPL 3.0 协议，
                    <ThemeText fontWeight="bold">
                        完全免费、代码开源、不含任何商业行为
                    </ThemeText>
                    。它不是官方发布的版本，也不代表原作者。
                </ThemeText>
                <ThemeText style={styles.body}>
                    软件本体<ThemeText fontWeight="bold">不包含任何音频、视频数据</ThemeText>
                    ，也没有内置音源：搜索、播放、歌单、MV
                    使用的全部内容，都来自使用者自行安装的插件。本软件不提供、不存储、不分发任何音视频作品，
                    请支持正版音乐。
                </ThemeText>
                <ThemeText style={styles.body}>
                    插件以及插件产生的数据与本软件无关，请自行甄别来源是否安全、使用是否合法；
                    因此产生的一切后果由使用者自行承担。
                </ThemeText>

                <SectionTitle>这个 TV 版是怎么来的</SectionTitle>
                <ThemeText style={styles.body}>
                    起因很朴素：手机版放到客厅的电视盒子上，用遥控器基本没法用 ——
                    列表滚不动、按钮点不到、MV 打不开。于是做了这版改造，目标是
                    <ThemeText fontWeight="bold">
                        让遥控器在电视上真正好用
                    </ThemeText>
                    ，而不是把手机界面放大摆在电视上。
                </ThemeText>
                <ThemeText style={styles.body}>
                    · 原生按键桥：方向键、OK、返回、播放暂停、上一首/下一首直接进 JS；
                </ThemeText>
                <ThemeText style={styles.body}>
                    · 一套空间焦点引擎：按位置算邻居，不再是死板的固定顺序，焦点光环跟着走；
                </ThemeText>
                <ThemeText style={styles.body}>
                    · 原生视频视图：TextureView + MediaPlayer 播 MV，支持拖动、倍速、切换；
                </ThemeText>
                <ThemeText style={styles.body}>
                    · 手机扫码输入：搜索、装插件、临时填视频链接，都不用电视上打字；
                </ThemeText>
                <ThemeText style={styles.body}>
                    · 首页、歌单、榜单、批量编辑等页面按大屏重排，去掉了手机端的手势和拖拽组件。
                </ThemeText>

                <SectionTitle>版本与安装</SectionTitle>
                <ThemeText style={styles.body}>
                    电视版版本号固定为{" "}
                    <ThemeText fontWeight="bold">1.0.0</ThemeText>
                    ，每次改造只往上加内部版本号（versionCode），签名始终一致，
                    所以新包可以直接覆盖安装，不用先卸载、歌单和插件都留着。
                </ThemeText>

                <SectionTitle>开源地址</SectionTitle>
                <ThemeText style={styles.body}>
                    我的 GitHub 主页：{" "}
                    <LinkText linkTo={GITHUB_PROFILE}>{GITHUB_PROFILE}</LinkText>
                </ThemeText>
                <ThemeText style={styles.body}>
                    本项目仓库：{" "}
                    <LinkText linkTo={PROJECT_REPO}>{PROJECT_REPO}</LinkText>
                </ThemeText>
                <ThemeText style={styles.body}>
                    原项目 MusicFree：{" "}
                    <LinkText linkTo={UPSTREAM_REPO}>{UPSTREAM_REPO}</LinkText>
                </ThemeText>
                <ThemeText style={styles.body}>
                    二次开发、二次分发请同样遵守 AGPL 3.0，并保留原项目出处；
                    修改后的软件造成的任何问题由改动者承担。
                </ThemeText>

                <ThemeText style={styles.body}>
                    用遥控器上下键翻页，返回键离开本页。
                </ThemeText>
                <ThemeText fontColor="textSecondary" style={styles.signature}>
                    by: glory
                </ThemeText>
            </TvScrollView>
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        paddingHorizontal: rpx(72),
    },
    scrollContent: {
        paddingTop: rpx(60),
        paddingBottom: rpx(120),
    },
    subTitle: {
        marginTop: rpx(16),
        marginBottom: rpx(24),
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(48),
        marginBottom: rpx(16),
    },
    accentBar: {
        width: rpx(8),
        height: rpx(44),
        borderRadius: rpx(4),
        backgroundColor: "#20b46a",
        marginRight: rpx(20),
    },
    body: {
        marginTop: rpx(20),
        lineHeight: rpx(52),
        fontSize: rpx(30),
    },
    signature: {
        marginTop: rpx(56),
    },
});
