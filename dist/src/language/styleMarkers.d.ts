import { TokenTree } from "./groupParser";
export declare const fflPrefix = "\\ffl@";
export declare const fflMarkerCmd = "\\fflMarker";
export declare type Command = "startInvoc" | "endInvoc" | "style" | "startStyle" | "endStyle";
export declare function fflMarker(cmd: Command, ...arg: string[]): string;
export declare function getFFLMarker(node: any): {
    command: Command;
    arg: any;
} | undefined;
export declare type IndexedInstance = [style: string, idx: number];
declare type InstanceCounts = {
    [style: string]: number;
};
export declare function markMatches(src: TokenTree[], matchers: {
    key: string;
    matcher: TokenTree[];
}[], wildcardSingle: string, wildcardAny: string, escapes: {
    [esc: string]: string;
}, instanceCounts?: InstanceCounts): any[];
export declare function markConstants(latex: TokenTree, count?: number): TokenTree;
export declare function markClasses(tokens: TokenTree, instanceCounts?: InstanceCounts): TokenTree;
export declare function flatten(tokens: TokenTree): string | string[];
export {};
//# sourceMappingURL=styleMarkers.d.ts.map