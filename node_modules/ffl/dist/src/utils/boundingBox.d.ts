export type BoundingBoxProps = {
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
//# sourceMappingURL=boundingBox.d.ts.map