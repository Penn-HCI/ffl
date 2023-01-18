{{
import { merge } from "../utils/common";
import sanitizeHtml from 'sanitize-html';

export type FFLSelector = {
    type : "literal" | "class",
    str : string
}

export type FFLIntersectionSelector = FFLSelector | FFLSelector[]

export type FFLDisjointSelectorList = FFLIntersectionSelector[]

export type FFLProperties = {
    [key:string] : string | string[] | any
}

export type FFLStyleBlock = {
    selectors : FFLDisjointSelectorList,
    properties : FFLProperties
}

export type FFLStyleSheet = FFLStyleBlock[];

}}

blocks = __ bs:(block __)* { return bs.map((b : any[]) => b[0]); }

block = s:selectorsList __ '{' __ attrs:properties __ '}' {
    return {
        selectors: s,
        properties: attrs
    }
}

selectorsList = ds:(descendantGroup __ ',' __)* td:descendantGroup {
    return  [...ds.map((attr : [any]) => attr[0]), td]
}


/// Selectors
descendantGroup = global:$('*'?) __ ds:descendantGroup_ {
    ds.unshift(global)
    return ds;
}

descendantGroup_ = s:selector { return [s] }
    / "intersect" ("ion")? '(' __ ss:(selector __ ',' __)+ sse:selector ')' __ {
        return [...ss.map((s : any) => s[0]), sse];
    } // >=1

selector = @(clazz / literal)

literal = '$' expr:$litChar+ '$' { return { type : "literal", str: expr }; }

clazz = '.' ident:$ident { return  { type : "class", str: ident }; }

/// Style Block
properties = ha:attribute ta:(';' __ @attribute)* ';'?{
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

attribute = fflAttribute / cssAttribute

fflAttribute = labelProp // / labelPosition / labelMarker / labelMarkerOffsetX / labelMarkerOffsetY

labelProp = 'label' __ ':' __ v:labelValue __ { return { label: v }; }
labelValue = "html(" __ v:qString __ ")" { 
    return { renderType: "html", value: sanitizeHtml(v,{
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
        allowedAttributes: { 
            img: [ 'src', 'srcset', 'alt', 'title', 'width', 'height', 'loading' ],
            '*': ["style"]
        },
    }) 
}; }
    // / "md(" _ v:qString _ ")" { return { renderType: "markdown", value: v }; }
    / v:styleValue { return { renderType: "plain", value: v }; }

// labelPosition = 'label-position' __ ':' __ v:styleValue __ { return { ['label-position']: v }; }
// labelMarker = 'label-marker' __ ':' __ v:styleValue __ { return { ['label-marker']: v }; }
// labelMarkerOffsetX = 'label-marker-offset-x' __ ':' __ v:styleValue __ { return { ['label-marker-offset-x']: v }; }
// labelMarkerOffsetY = 'label-marker-offset-y' __ ':' __ v:styleValue __ { return { ['label-marker-offset-y']: v }; }

qString = doubleQuoteString / singleQuoteString
doubleQuoteString = '"' s:$('\\"' / (!'"' .))* '"' { return s.replaceAll('\\"', '"') }
// TODO: should single quote ignore escapes?
singleQuoteString = '\'' s:$('\\\'' / (!'\'' .))* '\'' { return s.replaceAll('\\\'', '\'') }

// CSS attribute syntax is not specified here.
// Any parsing issue should be fixed as they come up
cssAttribute = k:styleKey __ ':' __ v:styleValue __ { return { [k.trim()]: v.trim() }; }

styleKey = $('--'? ident)
styleValue = qString / $("\\;" / [^;}])+

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