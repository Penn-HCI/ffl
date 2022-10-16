{{
    import { merge } from "./utils";
}}

blocks = __ bs:(block __)* { return bs.map((b : [any]) => b[0]); }

block = s:selectorsList __ '{' __ attrs:attributes __ '}' {
    return {
        selectors: s,
        attributes: attrs
    }
}

selectorsList = ds:(descendantGroup __ ',' __)* td:descendantGroup {
    return  [...ds.map((attr : [any]) => attr[0]), td]
}

/// Selectors
descendantGroup = ss:(selector __)+ {
    return ss.map((s : any) => s[0]);
} // >=1

selector = @(clazz / literal)

literal = '$' expr:$litChar+ '$' { return { type : "literal", str: expr }; }

clazz = '.' ident:$ident { return  { type : "class", str: ident }; }

/// Style Block
attributes = ha:attribute ta:(';' __ @attribute)* ';'?{
    return [ha, ...ta].reduce((acc : any, ent : { [key : string] : any[] }) => {
        return merge(acc, ent,
            (a: { [key: string]: any }, b: any) => { throw 'value should always be strings'; },
            (arr1: any, arr2: any) => {
                arr1 ??= [];
                if (!Array.isArray(arr1)) arr1 = [arr1];
                return arr1.concat(arr2);
            }
        );
    }, {})
}

// PEG has no backtracking, need to figure out how to allow '}' in there
attribute = k:styleKey __ ':' __ v:styleValue __ { return { [k.trim()]: v.trim() }; }
// should we specify syntax for special attributes here?
// e.g. currently `label` does not allow ";" or "}" because of how generic values are parsed

styleKey = $('--'? ident)
styleValue = $("\\;" / (!(';' / '}') .))+

ident = $(alpha alnum*)

// Char Classes
litChar = $("\\$" / (!'$' .))

alnum = alpha / num / '_'

alpha = lower / upper
upper = [A-Z]
lower = [a-z]

num = [-.] / digit
digit = [0-9]

// whitespace
__ = _* { return null; }
_ = ' ' / '\t' / '\r' / '\n' / '\v' / '\f' { return null; }