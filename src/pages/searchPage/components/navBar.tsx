import AppBar from "@/components/base/appBar";
import Icon from "@/components/base/icon.tsx";
import IconButton from "@/components/base/iconButton";
import Input from "@/components/base/input";
import Button from "@/components/base/textButton.tsx";
import { iconSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import { TvFocusable } from "@/tv/components";
import QrGlyph from "@/components/base/qrGlyph";
import { showQrInput } from "@/tv/qrOverlay";
import { useTvKeys } from "@/tv/provider";
import { tvFocus } from "@/tv/focusStore";
import { useAtom, useSetAtom } from "jotai";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { addHistory } from "../common/historySearch";
import useSearch from "../hooks/useSearch";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "../store/atoms";

export default function NavBar() {
    const search = useSearch();
    const [query, setQuery] = useAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const colors = useColors();
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    const runSearch = async (text?: string) => {
        const value = (text ?? query).trim();
        if (value === "") {
            return;
        }
        setQuery(value);
        setSearchResultsState(initSearchResults);
        setPageStatus(prev =>
            prev === PageStatus.EDITING ? PageStatus.SEARCHING : prev,
        );
        await search(value, 1);
        await addHistory(value);
    };

    const onSearchSubmit = () => runSearch();

    const hintTextColor = Color(colors.text).alpha(0.6).toString();

    // 进搜索页第一下就把光环落在搜索框上（不弹键盘，按 OK 才进入输入）
    useEffect(() => {
        tvFocus.focusByName("search:input", true);
    }, []);

    // 遥控器从搜索框按右键，直接跳到"扫码"，再按右键到"搜索"
    useTvKeys((key, action) => {
        if (action !== "down") {
            return false;
        }
        if (key === "right") {
            const name = tvFocus.getFocusedNode()?.debugName ?? "";
            if (name === "" || name === "search:input") {
                if (tvFocus.focusByName("search:scan")) {
                    return true;
                }
            }
        }
        return false;
    });

    return (
        <AppBar containerStyle={style.appbar} contentStyle={style.appbar}>
            <View style={style.searchBarContainer}>
                <Icon
                    name="magnifying-glass"
                    color={hintTextColor}
                    size={iconSizeConst.small}
                    style={style.magnify}
                />
                <Input
                    autoFocus={false}
                    name="search:input"
                    focusOrder={-10}
                    style={[
                        style.searchBar,
                        {
                            color: colors.text,
                            backgroundColor: colors.pageBackground,
                        },
                    ]}
                    accessible
                    accessibilityLabel={t("searchPage.searchLabel.a11y")}
                    accessibilityHint={t("searchPage.searchPlaceHolder")}
                    onFocus={() => {
                        setPageStatus(PageStatus.EDITING);
                    }}
                    placeholderTextColor={hintTextColor}
                    placeholder={t("searchPage.searchPlaceHolder")}
                    onSubmitEditing={() => runSearch()}
                    onChangeText={_ => {
                        if (_ === "") {
                            setPageStatus(PageStatus.EDITING);
                        }
                        setQuery(_);
                    }}
                    value={query}
                />
                {query.length ? (
                    <IconButton
                        style={style.close}
                        sizeType="light"
                        onPress={() => {
                            setQuery("");
                            setPageStatus(PageStatus.EDITING);
                        }}
                        color={hintTextColor}
                        name="x-mark"
                    />
                ) : null}
            </View>
            <TvFocusable
                name="search:scan"
                style={style.scan}
                onPress={() =>
                    showQrInput({
                        mode: "text",
                        title: "手机扫码输入歌名 / 歌手",
                        onText: text => {
                            runSearch(text);
                        },
                    })
                }>
                <QrGlyph size={rpx(42)} color={colors.text} />
            </TvFocusable>
            <TvFocusable
                name="search:submit"
                style={style.button}
                onPress={onSearchSubmit}>
                <Text style={style.buttonText}>{t("common.search")}</Text>
            </TvFocusable>
        </AppBar>
    );
}

const style = StyleSheet.create({
    appbar: {
        paddingRight: 0,
    },
    scan: {
        paddingHorizontal: rpx(28),
        height: rpx(66),
        marginLeft: rpx(8),
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(127,140,160,0.18)",
    },
    scanText: {
        fontSize: rpx(30),
    },
    buttonText: {
        color: "#e6edf5",
        fontSize: rpx(30),
        fontWeight: "bold",
    },
    button: {
        backgroundColor: "rgba(127,140,160,0.18)",
        paddingHorizontal: rpx(34),
        height: rpx(66),
        marginLeft: rpx(10),
        borderRadius: rpx(12),
        justifyContent: "center",
        flexDirection: "row",
        alignItems: "center",
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    searchBar: {
        minWidth: rpx(375),
        flex: 1,
        paddingHorizontal: rpx(64),
        borderRadius: rpx(39),
        height: rpx(66),
        maxHeight: rpx(66),
        alignItems: "center",
    },
    magnify: {
        position: "absolute",
        left: rpx(16),
        zIndex: 100,
    },
    close: {
        position: "absolute",
        right: rpx(16),
    },
});
