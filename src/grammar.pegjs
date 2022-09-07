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
attributes = as:(attribute __ ';' __)* ta:attribute (__ ';')? { // trailing semicolon does not work, no idea why
    return [...as.map((a : [any]) => a[0]), ta].reduce((acc : any, ent : { [key : string] : any[] }) => {
        for (var k in ent) {
            if (!acc[k]) {
                acc[k] = new Array();
            }
            acc[k].push(ent[k]);
        }
        return acc;
    }, {})
}

// PEG has no backtracking, need to figure out how to allow '}' in there
attribute = "css" __ ':' __ '{' val:$(!'}' .)* '}' { return { css: val }; }

styleKey = $ident
styleValue = $alnum+

ident = $(alpha alnum*)

// Char Classes
litChar = [^$] / "\\$"

alnum = alpha / num / '_'

alpha = lower / upper
upper = [A-Z]
lower = [a-z]

num = [-.] / digit
digit = [0-9]

// whitespace
__ = _* { return null; }
_ = ' ' / '\t' / '\r' / '\n' / '\v' / '\f' { return null; }