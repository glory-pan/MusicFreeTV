import React from "react";
import components from "./components";
import { dialogInfoStore } from "./useDialog";
import { TvFocusLayer } from "@/tv/components";

export default function () {
    const dialogInfoState = dialogInfoStore.useValue();

    const Component = dialogInfoState.name
        ? components[dialogInfoState.name]
        : null;

    return Component ? (
        <TvFocusLayer>
            <Component {...(dialogInfoState.payload ?? {})} />
        </TvFocusLayer>
    ) : null;
}
