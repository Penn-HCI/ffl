export namespace languages {
    export namespace markup {
        namespace tag { }
        namespace doctype { }
    }
    import html = markup;
    export { html };
    import mathml = markup;
    export { mathml };
    import svg = markup;
    export { svg };
    export const xml: any;
    import ssml = xml;
    export { ssml };
    import atom = xml;
    export { atom };
    import rss = xml;
    export { rss };
    export const clike: {
        comment: {
            pattern: RegExp;
            lookbehind: boolean;
            greedy: boolean;
        }[];
        string: {
            pattern: RegExp;
            greedy: boolean;
        };
        "class-name": {
            pattern: RegExp;
            lookbehind: boolean;
            inside: {
                punctuation: RegExp;
            };
        };
        keyword: RegExp;
        boolean: RegExp;
        function: RegExp;
        number: RegExp;
        operator: RegExp;
        punctuation: RegExp;
    };
    export const javascript: any;
    import js = javascript;
    export { js };
}
//# sourceMappingURL=prism.d.ts.map