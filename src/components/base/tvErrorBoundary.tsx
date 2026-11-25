import React from "react";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import rpx from "@/utils/rpx";

interface IProps {
    children?: any;
    title?: string;
}

/**
 * 电视端兜底：任何页面渲染报错都只影响该页面，不会让整个 App 闪退。
 */
export default class TvErrorBoundary extends React.Component<
    IProps,
    { error?: any; stack?: string }
> {
    constructor(props: IProps) {
        super(props);
        this.state = {};
    }

    static getDerivedStateFromError(error: any) {
        return { error };
    }

    componentDidCatch(error: any, info: any) {
        console.log("[TvErrorBoundary]", this.props?.title ?? "", error, info);
        const stack = String(info?.componentStack ?? "")
            .split("\n")
            .filter(line => line.trim())
            .slice(1, 4)
            .join("\n");
        this.setState({ stack });
    }

    render() {
        if (this.state.error) {
            return (
                <View style={styles.wrapper}>
                    <ThemeText fontSize="title" fontWeight="bold">
                        {this.props?.title ?? "页面"}渲染出错
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.message}>
                        {String(this.state.error?.message ?? this.state.error)}
                    </ThemeText>
                    {this.state.stack ? (
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.message}>
                            {this.state.stack}
                        </ThemeText>
                    ) : null}
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.message}>
                        按返回键可退出该页面；把这条信息反馈给开发者即可定位。
                    </ThemeText>
                </View>
            );
        }
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(60),
    },
    message: {
        marginTop: rpx(16),
        textAlign: "center",
    },
});
