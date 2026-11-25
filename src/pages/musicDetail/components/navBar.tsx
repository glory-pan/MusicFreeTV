import React from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import Tag from "@/components/base/tag";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import Share from "react-native-share";
import { B64Asset } from "@/constants/assetsConst";
import IconButton from "@/components/base/iconButton";
import { useCurrentMusic } from "@/core/trackPlayer";

export default function NavBar() {
    const navigation = useNavigation();
    const musicItem = useCurrentMusic();
    // const {showShare} = useShare();

    return (
        <View style={styles.container}>
            <IconButton
                name="arrow-left"
                focusName="appbar:back"
                sizeType={"normal"}
                color="white"
                style={styles.button}
                onPress={() => {
                    navigation.goBack();
                }}
            />
            <View style={styles.headerContent}>
                <Text numberOfLines={1} style={styles.headerTitleText}>
                    {musicItem?.title ?? "--"}
                </Text>
                <View style={styles.headerDesc}>
                    <Text style={styles.headerArtistText} numberOfLines={1}>
                        {musicItem?.artist}
                    </Text>
                    {musicItem?.platform ? (
                        <Tag
                            tagName={musicItem.platform}
                            containerStyle={styles.tagBg}
                            style={styles.tagText}
                        />
                    ) : null}
                </View>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: vh(12.5),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    button: {
        marginHorizontal: rpx(24),
    },
    headerContent: {
        flex: 1,
        height: vh(12.5),
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitleText: {
        color: "white",
        fontWeight: fontWeightConst.semibold,
        fontSize: fontSizeConst.title,
        marginBottom: rpx(4),
        includeFontPadding: false,
    },
    headerDesc: {
        height: rpx(32),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(40),
    },
    headerArtistText: {
        color: "white",
        fontSize: fontSizeConst.subTitle,
        includeFontPadding: false,
    },
    tagBg: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    tagText: {
        color: "white",
    },
});
