import React from "react";
import globalStyle from "@/constants/globalStyle";
import Operations from "./operations";
import Sheets from "./sheets";
import { TvScrollView as ScrollView } from "@/tv/scroll";

export default function HomeBody() {
    return (
        <ScrollView
            style={globalStyle.fwflex1}
            showsVerticalScrollIndicator={false}>
            <Operations />
            <Sheets />
        </ScrollView>
    );
}
