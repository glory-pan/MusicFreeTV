import React, { useEffect } from "react";
import { StyleSheet, SwitchProps, View } from "react-native";
import { TvTouchableWithoutFeedback as TouchableWithoutFeedback } from "@/tv/components";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";

interface ISwitchProps extends SwitchProps {}

const fixedWidth = rpx(40);
/** 比焦点光环(#5fd0ff)更浅的青，避免光环和开态蓝糊成一片 */
const SWITCH_ON_COLOR = "#a9e9ff";

export default function ThemeSwitch(props: ISwitchProps) {
    const { value, onValueChange } = props;
    const colors = useColors();

    const sharedValue = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        sharedValue.value = value ? 1 : 0;
    }, [value]);

    const thumbStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: withTiming(
                        sharedValue.value * fixedWidth,
                        timingConfig.animationNormal,
                    ),
                },
            ],
        };
    });

    return (
        <TouchableWithoutFeedback
            onPress={() => {
                onValueChange?.(!value);
            }}>
            <View
                style={[
                    styles.container,
                    {
                        // 开态用比焦点光环更浅的青：光环套在开关上时对比明显
                        backgroundColor: value
                            ? SWITCH_ON_COLOR
                            : "rgba(255,255,255,0.28)"
                    },
                    props?.style,
                ]}>
                <Animated.View style={[styles.thumb, thumbStyle]} />
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        width: rpx(80),
        height: rpx(40),
        borderRadius: rpx(40),
        justifyContent: "center",
    },
    thumb: {
        width: rpx(34),
        height: rpx(34),
        borderRadius: rpx(17),
        backgroundColor: "white",
        left: rpx(3),
    },
});
