export declare function isServer(): boolean;
export declare function mapGroup(arr: any[], groupFn: (elem: any, idx?: number, arr?: any[]) => any, mapFn: (elem: any, idx?: number, arr?: any[]) => any): any;
export declare function isWhitespace(str: string): boolean;
export declare function merge(dest: {
    [key: string]: any;
}, src: {
    [key: string]: any;
}, merge_obj_other: (a: {
    [key: string]: any;
}, b: any) => any, merge_others: (a: any, b: any) => any): any;
declare type Visibility = {
    display: any;
    visibility: any;
    isConnected: boolean;
};
export declare function setVisible(node: HTMLElement, displayMode?: string): Visibility;
export declare function resetVisibility(node: HTMLElement, visibility: Visibility): void;
export declare type BoundingBoxProps = {
    top: number;
    bottom: number;
    left: number;
    right: number;
    relativeOrigin?: BoundingBox;
};
export declare class BoundingBox {
    top: number;
    bottom: number;
    left: number;
    right: number;
    relativeOrigin?: BoundingBox;
    constructor(props: BoundingBoxProps);
    get width(): number;
    get height(): number;
    get center(): {
        horizontal: number;
        vertical: number;
    };
    relativeTo(root: BoundingBox): BoundingBox;
    static of(...rects: BoundingBox[]): BoundingBox | undefined;
}
export declare function asKaTeXVirtualNode(element: HTMLElement): HTMLElement;
export declare function toKaTeXVirtualNode(html: string): {};
export declare function toHTMLElement(innerHTML: string): HTMLElement;
export {};
//# sourceMappingURL=utils.d.ts.map