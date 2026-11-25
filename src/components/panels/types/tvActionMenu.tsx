import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon";
import { TvFocusable } from "@/tv/components";
import TvCardPanel from "../base/tvCardPanel";
import { hidePanel } from "../usePanel";

interface ITvActionMenuItem {
    icon: IIconName;
    title: string;
    show?: boolean;
    onPress?: () => void;
}

interface ITvActionMenuProps {
    title?: string;
    items: ITvActionMenuItem[];
    /** 卡片关闭后把光环还给哪个按钮 */
    returnFocusName?: string;
}

/**
 * 电视端"页面更多操作"卡片。
 * 手机端 AppBar 右上角那枚竖三点在电视上又小又难瞄（光环套上去像个小方框），
 * 这里改成标题栏上一个带文字的「更多」按钮 + 这张一行一项的大卡片。
 */
export default function TvActionMenu(props: ITvActionMenuProps) {
    const { title = "更多", items = [], returnFocusName } = props ?? {};
    const list = items.filter(item => item.show !== false);

    return (
        <TvCardPanel
            title={title}
            firstFocusName="tvmenu:0"
            returnFocusName={returnFocusName}
            width={rpx(520)}>
            <View style={style.list}>
                {list.map((item, index) => (
                    <TvFocusable
                        key={`${item.title}-${index}`}
                        name={`tvmenu:${index}`}
                        focusOrder={index}
                        leftName={index === 0 ? undefined : `tvmenu:${index - 1}`}
                        rightName={
                            index === list.length - 1
                                ? undefined
                                : `tvmenu:${index + 1}`
                        }
                        style={style.row}
                        onPress={() => {
                            hidePanel();
                            setTimeout(() => {
                                item.onPress?.();
                            }, 30);
                        }}>
                        <Icon
                            accessible={false}
                            name={item.icon}
                            size={rpx(34)}
                            color="#dce9ff"
                        />
                        <ThemeText fontSize="subTitle" style={style.rowTitle}>
                            {item.title}
                        </ThemeText>
                        <Icon
                            accessible={false}
                            name="skip-right"
                            size={rpx(28)}
                            color="rgba(220,235,255,0.55)"
                        />
                    </TvFocusable>
                ))}
            </View>
        </TvCardPanel>
    );
}

const style = StyleSheet.create({
    list: {
        width: "100%",
        gap: rpx(12),
        paddingBottom: rpx(6),
    },
    row: {
        width: "100%",
        height: rpx(84),
        paddingHorizontal: rpx(22),
        borderRadius: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        gap: rpx(18),
        backgroundColor: "rgba(255,255,255,0.10)",
        borderWidth: rpx(1),
        borderColor: "rgba(150,200,255,0.18)",
    },
    rowTitle: {
        flex: 1,
    },
});
