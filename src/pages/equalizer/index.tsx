import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { StyleSheet } from "react-native";
import EqualizerBody from "./body";

export default function Equalizer() {
    return (
        <SafeAreaView style={pageStyles.wrapper}>
            <StatusBar />
            <AppBar>均衡器</AppBar>
            <HorizontalSafeAreaView style={pageStyles.wrapper}>
                <EqualizerBody />
            </HorizontalSafeAreaView>
        </SafeAreaView>
    );
}

const pageStyles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
});
