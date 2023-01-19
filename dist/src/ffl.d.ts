import { KatexOptions } from 'katex';
export declare const toSelectorStrings: (selectorGroups: any[], scopeKey: string) => string[];
export declare type SelectorInfo = {
    isGlobal: boolean;
    selectors: {
        class: string;
        pseudoSelectors: {
            class: string;
            arg: string;
        }[];
    }[];
};
export declare const INSTANCE_DATA_ATTR = "data-ffl-class-instances";
/**
 * labels are only supported when running on browser client
 * TODO: disable labels for inline?
 */
declare class ffl {
    static render(latex: string, ffl: string, baseNode: HTMLElement, options?: KatexOptions): void;
    static renderToString(latex: string, ffl: string, options?: KatexOptions): string;
    static parseFFL(ffl: string): any;
}
export default ffl;
//# sourceMappingURL=ffl.d.ts.map