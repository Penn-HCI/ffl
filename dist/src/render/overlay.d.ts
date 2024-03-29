import { SelectorInfo } from '../../ffl';
export type LabelInfo = {
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
export type BackgroundInfo = {
    selectorInfo: SelectorInfo[];
    backgroundColor: any;
}[];
export declare function drawBackground(backgroundInfo: BackgroundInfo, root: HTMLElement, scopeKey: string): void;
export type BorderInfo = {
    selectorInfo: SelectorInfo[];
    border: any;
}[];
export declare function drawBorders(backgroundInfo: BorderInfo, root: HTMLElement, scopeKey: string): void;
//# sourceMappingURL=overlay.d.ts.map