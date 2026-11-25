/**
 * 搜索结果面板 一级页
 */
import TvTabBar from "@/tv/tvTabBar";
import React, { memo, useState } from "react";
import { Text } from "react-native";
import rpx, { vw } from "@/utils/rpx";
import { SceneMap, TabBar, TabView } from "react-native-tab-view";
import ResultSubPanel from "./resultSubPanel";
import results from "./results";
import { fontWeightConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";

const routes = results;

const getRouterScene = (
    routes: Array<{ key: ICommon.SupportMediaType; title: string }>,
) => {
    const scene: Record<string, () => JSX.Element> = {};
    routes.forEach(r => {
        scene[r.key] = () => <ResultSubPanel tab={r.key} />;
    });
    return SceneMap(scene);
};

const renderScene = getRouterScene(routes);

function ResultPanel() {
    const [index, setIndex] = useState(0);
    const colors = useColors();
    const { t } = useI18N();

    return (
        <TabView
            lazy
            navigationState={{
                index,
                routes,
            }}
            renderTabBar={props => <TvTabBar {...props} />}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: vw(100) }}
        />
    );
}

export default memo(ResultPanel);
