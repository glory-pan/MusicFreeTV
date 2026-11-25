import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import bootstrap from "./bootstrap/bootstrap";
import { removeLegacyBuiltinPlugins } from "@/core/pluginManager/cleanupLegacyBuiltin";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Dialogs from "@/components/dialogs";
import Panels from "@/components/panels";
import PageBackground from "@/components/base/pageBackground";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Debug from "@/components/debug";
import { PortalHost } from "@/components/base/portal";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import { BootstrapComponent } from "./bootstrap/BootstrapComponent";
import { ToastBaseComponent } from "@/components/base/toast";
import { StatusBar } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { routes } from "@/core/router/routes.tsx";
import ErrorBoundary from "@/components/errorBoundary";
import { TvProvider, TvScope } from "@/tv";
import { setTvNavigate } from "@/tv/navigateBridge";
import { tvFocus } from "@/tv/focusStore";
import { useNavigate } from "@/core/router";
import { TvQrOverlay } from "@/tv/qrOverlay";

/**
 * 字体颜色
 */

StatusBar.setBackgroundColor("transparent");
StatusBar.setTranslucent(true);

// bootstrap 里会 PluginManager.setup()，插件要等它跑完才能操作；
// 这里顺手把老版本内置的四个音乐源（网易云/酷狗/酷我/QQ音乐）卸掉
Promise.resolve(bootstrap())
    .then(() => removeLegacyBuiltinPlugins())
    .catch(() => {});
const Stack = createNativeStackNavigator<any>();

/** 把容器内的 navigate 交给 TvProvider（它在路由树外，不能自己 useNavigate） */
function TvNavigateBridge() {
    const navigate = useNavigate();
    React.useEffect(() => {
        setTvNavigate(navigate as any);
        return () => {
            setTvNavigate(null);
        };
    }, [navigate]);
    return null;
}

export default function Pages() {
    const theme = Theme.useTheme();

    return (
        <ErrorBoundary>
            <BootstrapComponent />
            <ReducedMotionConfig mode={ReduceMotion.Never} />
            <GestureHandlerRootView style={globalStyle.flex1}>
                <TvProvider>
                <SafeAreaProvider>
                    <NavigationContainer
                        theme={theme}
                        onStateChange={state => {
                            // 换页时旧页面（native-stack 会保留组件实例）的节点，
                            // 必须按路由隔离掉，否则插件页按下键会选中主页的歌条。
                            const routes = state?.routes ?? [];
                            const top = routes[state?.index ?? routes.length - 1];
                            tvFocus.onRouteChange(top?.name);
                        }}>
                        <TvNavigateBridge />
                        <PageBackground />
                        <Stack.Navigator
                            initialRouteName={routes[0].path}
                            screenOptions={{
                                headerShown: false,
                                animation: "slide_from_right",
                                animationDuration: 100,
                            }}>
                            {routes.map(route => (
                                <Stack.Screen
                                    key={route.path}
                                    name={route.path}>
                                    {props => (
                                        <TvScope>
                                            <route.component {...props} />
                                        </TvScope>
                                    )}
                                </Stack.Screen>
                            ))}
                        </Stack.Navigator>                        
                        <Panels />
                        <Dialogs />
                        <Debug />
                        <ToastBaseComponent />
                        <PortalHost />
                    </NavigationContainer>
                    <TvQrOverlay />
                </SafeAreaProvider>
                </TvProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
