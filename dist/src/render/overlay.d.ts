import { SelectorInfo } from '../ffl';
export declare type LabelInfo = {
    selectorInfo: SelectorInfo[];
    label: any;
    labelPosition?: "above" | "below" | "auto";
    labelMarker?: "line" | "extent";
    markerOffset?: {
        x?: number;
        y?: number;
    };
}[];
export declare function drawLabels(labels: LabelInfo, root: HTMLElement, scopeKey: string): void;
export declare type BackgroundInfo = {
    selectorInfo: SelectorInfo[];
    backgroundColor: any;
}[];
export declare function drawBackground(backgroundInfo: BackgroundInfo, root: HTMLElement, scopeKey: string): void;
//# sourceMappingURL=overlay.d.ts.map