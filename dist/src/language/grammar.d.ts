export type FFLSelector = {
    type: "literal" | "class";
    str: string;
    pseudoSelectors: {
        class: string;
        arg: string;
    }[];
};
export type FFLIntersectionSelector = FFLSelector | FFLSelector[];
export type FFLDisjointSelectorList = FFLIntersectionSelector[];
export type FFLProperties = {
    [key: string]: string | string[] | any;
};
export type FFLStyleBlock = {
    selectors: FFLDisjointSelectorList;
    properties: FFLProperties;
};
export type FFLStyleSheet = FFLStyleBlock[];
export interface IFilePosition {
    offset: number;
    line: number;
    column: number;
}
export interface IFileRange {
    start: IFilePosition;
    end: IFilePosition;
    source: string;
}
export interface ILiteralExpectation {
    type: "literal";
    text: string;
    ignoreCase: boolean;
}
export interface IClassParts extends Array<string | IClassParts> {
}
export interface IClassExpectation {
    type: "class";
    parts: IClassParts;
    inverted: boolean;
    ignoreCase: boolean;
}
export interface IAnyExpectation {
    type: "any";
}
export interface IEndExpectation {
    type: "end";
}
export interface IOtherExpectation {
    type: "other";
    description: string;
}
export type Expectation = ILiteralExpectation | IClassExpectation | IAnyExpectation | IEndExpectation | IOtherExpectation;
export declare class SyntaxError extends Error {
    static buildMessage(expected: Expectation[], found: string | null): string;
    message: string;
    expected: Expectation[];
    found: string | null;
    location: IFileRange;
    name: string;
    constructor(message: string, expected: Expectation[], found: string | null, location: IFileRange);
    format(sources: {
        grammarSource?: string;
        text: string;
    }[]): string;
}
export interface IParseOptions {
    filename?: string;
    startRule?: string;
    tracer?: any;
    [key: string]: any;
}
export type ParseFunction = (input: string, options?: IParseOptions) => any;
export declare const parse: ParseFunction;
//# sourceMappingURL=grammar.d.ts.map