import React from "react";
import panels from "./types";
import { panelInfoStore } from "./usePanel";
import { TvFocusLayer } from "@/tv/components";

function Panels() {
    const panelInfoState = panelInfoStore.useValue();

    const Component = panelInfoState.name ? panels[panelInfoState.name] : null;

    return Component ? (
        <TvFocusLayer>
            <Component {...(panelInfoState.payload ?? {})} />
        </TvFocusLayer>
    ) : null;
}

export default React.memo(Panels, () => true);