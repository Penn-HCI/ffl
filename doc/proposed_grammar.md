### Selector ::= `$`LiteralSelector`$` | `.`LabelSelector
(*`$` is closed/matched to avoid curly brace block ambiguities.*)
##### Challenges
###### Selector Composition <sub>Future/Nice-to-Have</sub>
*`$`LiteralSelector`$.`LabelSelector* and *`.`LabelSelector`/$`LiteralSelector`$`* definitely have different intuitive meanings.
#### LiteralSelector <sub>Immediate Concern</sub>
Subset of LaTeX Math syntax with wildcard support. We might not want to include inline styles for simplicity of implementation.
##### Challenges
###### Wildcard Scoping <sub>Immediate Concern</sub>
`\frac{*}{5}` (or even `\frac*{5}`) should not match `\frac{3}{4}+\frac{4}{5}`. So we need a mix of string matching and tree matching, how should we define the rules.
###### Styling Overlapping Matches
Given `x+y+z`, we should be able to match both `x+y` and `y+z`. Styling strategy here is tightly coupled with parsing strategy by KaTaX.

##### Possible Syntax
  | KaTeX               | FFL Selector   |
  | ------------------- | -------------- |
  | `...\frac{x}{2}...` | `$\frac{*}{2}` |

  where `*` is a wildcard instead of literal `*`, alternatively we could use something like `$\frac{\any}{2}$` or `$\frac{\*}{2}$` to avoid conflict.

#### LabelSelector <sub>Future/Nice-to-Have</sub>
label or custom class
##### Possible Syntax
| KaTeX                                                 | FFL Selector |
| ----------------------------------------------------- | ------------ |
| `...\begin{ffl}[label=target]\frac{x}{2}\end{ffl}...` | `.target`    |
| `...\label{target}{\frac{x}{2}}...`                   | `.target`    | \\ |

  This could create difficulty in parsing second argument when it is not enclosed in braces, which if not handled would be inconsistent with LaTeX syntax.

### StyleBlock ::= `{` (StyleKey `:` StyleValue `,`)* (StyleKey `:` StyleValue)? `}`

| StyleKey       | StyleValue                                      | *Comment*                        |
| -------------- | ----------------------------------------------- | -------------------------------- |
| `latex-before` | *LaTeX Math String*                             | injected before selected segment |
| `latex-after`  | *LaTeX Math String*                             | injected after selected segment  |
| `color`        | *LaTeX Color*                                   | `\color` wrapper                 |
| `label`        | *LaTeX Text String* (*+ Some Style Specifier*?) | overbrace/underbrace             |
| `katex-css`    | *CSS Style Block*                               | injected to KaTeX rendered HTML  |

Should we limit styling to only CSS or LaTeX? Seems confusing to have both, but adding features like labeling seems very cumbersome through CSS.

#### Benefits of Transpiling to Plain LaTeX
- Preprocessing/desugaring should not be difficult since KaTeX has hooks for custom macros, while attaching the correct CSS to appropriate DOM nodes could prove problematic. Current implementation does it by parsing a literal match between the tree generated from LaTeX string and that of the selector string, which is not easily feasible with wildcards.
- We can output transpiled plain LaTeX which could be pasted to a regular LaTeX document in non-web contexts without us implementing a LaTeX package.
