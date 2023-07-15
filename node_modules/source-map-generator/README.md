# Source Map

<!--
[![Build Status](https://travis-ci.org/mozilla/source-map.svg?branch=master)](https://travis-ci.org/mozilla/source-map)

[![Coverage Status](https://coveralls.io/repos/github/mozilla/source-map/badge.svg)](https://coveralls.io/github/mozilla/source-map)
-->

[![NPM](https://nodei.co/npm/source-map-generator.png?downloads=true&downloadRank=true)](https://www.npmjs.com/package/source-map-generator)

This is a library to generate the source map format
[described here][format].  It is a close fork of [source-map](https://github.com/mozilla/source-map), which also provides a source map consumer.

[format]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit

## Use with Node

    $ npm install source-map-generator

## Use on the Web

```html
<script src="https://unpkg.com/source-map-generator@0.8.0/dist/source-map.js"></script>
<script>
  const map = new SourceMapGenerator({
    file: "source-mapped.js"
  });
</script>
```
---

<!-- `npm run toc` to regenerate the Table of Contents -->

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Examples](#examples)
  - [Generating a source map](#generating-a-source-map)
    - [With SourceNode (high level API)](#with-sourcenode-high-level-api)
    - [With SourceMapGenerator (low level API)](#with-sourcemapgenerator-low-level-api)
- [API](#api)
  - [SourceMapGenerator](#sourcemapgenerator)
    - [new SourceMapGenerator([startOfSourceMap])](#new-sourcemapgeneratorstartofsourcemap)
    - [SourceMapGenerator.prototype.addMapping(mapping)](#sourcemapgeneratorprototypeaddmappingmapping)
    - [SourceMapGenerator.prototype.setSourceContent(sourceFile, sourceContent)](#sourcemapgeneratorprototypesetsourcecontentsourcefile-sourcecontent)
    - [SourceMapGenerator.prototype.toString()](#sourcemapgeneratorprototypetostring)
  - [SourceNode](#sourcenode)
    - [new SourceNode([line, column, source[, chunk[, name]]])](#new-sourcenodeline-column-source-chunk-name)
    - [SourceNode.prototype.add(chunk)](#sourcenodeprototypeaddchunk)
    - [SourceNode.prototype.prepend(chunk)](#sourcenodeprototypeprependchunk)
    - [SourceNode.prototype.setSourceContent(sourceFile, sourceContent)](#sourcenodeprototypesetsourcecontentsourcefile-sourcecontent)
    - [SourceNode.prototype.walk(fn)](#sourcenodeprototypewalkfn)
    - [SourceNode.prototype.walkSourceContents(fn)](#sourcenodeprototypewalksourcecontentsfn)
    - [SourceNode.prototype.join(sep)](#sourcenodeprototypejoinsep)
    - [SourceNode.prototype.replaceRight(pattern, replacement)](#sourcenodeprototypereplacerightpattern-replacement)
    - [SourceNode.prototype.toString()](#sourcenodeprototypetostring)
    - [SourceNode.prototype.toStringWithSourceMap([startOfSourceMap])](#sourcenodeprototypetostringwithsourcemapstartofsourcemap)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Examples

### Generating a source map

In depth guide:
[**Compiling to JavaScript, and Debugging with Source Maps**](https://hacks.mozilla.org/2013/05/compiling-to-javascript-and-debugging-with-source-maps/)

#### With SourceNode (high level API)

```js
function compile(ast) {
  switch (ast.type) {
    case "BinaryExpression":
      return new SourceNode(ast.location.line, ast.location.column, ast.location.source, [
        compile(ast.left),
        " + ",
        compile(ast.right)
      ]);
    case "Literal":
      return new SourceNode(ast.location.line, ast.location.column, ast.location.source, String(ast.value));
    // ...
    default:
      throw new Error("Bad AST");
  }
}

var ast = parse("40 + 2", "add.js");
console.log(
  compile(ast).toStringWithSourceMap({
    file: "add.js"
  })
);
// { code: '40 + 2',
//   map: [object SourceMapGenerator] }
```

#### With SourceMapGenerator (low level API)

```js
var map = new SourceMapGenerator({
  file: "source-mapped.js"
});

map.addMapping({
  generated: {
    line: 10,
    column: 35
  },
  source: "foo.js",
  original: {
    line: 33,
    column: 2
  },
  name: "christopher"
});

console.log(map.toString());
// '{"version":3,"file":"source-mapped.js","sources":["foo.js"],"names":["christopher"],"mappings":";;;;;;;;;mCAgCEA"}'
```

## API

Get a reference to the module:

```js
// Node.js
var sourceMap = require("source-map");

// Browser builds
var sourceMap = window.sourceMap;

// Inside Firefox
const sourceMap = require("devtools/toolkit/sourcemap/source-map.js");
```

### SourceMapGenerator

An instance of the SourceMapGenerator represents a source map which is being
built incrementally.

#### new SourceMapGenerator([startOfSourceMap])

You may pass an object with the following properties:

- `file`: The filename of the generated source that this source map is
  associated with.

- `sourceRoot`: A root for all relative URLs in this source map.

- `skipValidation`: Optional. When `true`, disables validation of mappings as
  they are added. This can improve performance but should be used with
  discretion, as a last resort. Even then, one should avoid using this flag when
  running tests, if possible.

```js
var generator = new sourceMap.SourceMapGenerator({
  file: "my-generated-javascript-file.js",
  sourceRoot: "http://example.com/app/js/"
});
```

#### SourceMapGenerator.prototype.addMapping(mapping)

Add a single mapping from original source line and column to the generated
source's line and column for this source map being created. The mapping object
should have the following properties:

- `generated`: An object with the generated line and column positions.

- `original`: An object with the original line and column positions.

- `source`: The original source file (relative to the sourceRoot).

- `name`: An optional original token name for this mapping.

```js
generator.addMapping({
  source: "module-one.scm",
  original: { line: 128, column: 0 },
  generated: { line: 3, column: 456 }
});
```

#### SourceMapGenerator.prototype.setSourceContent(sourceFile, sourceContent)

Set the source content for an original source file.

- `sourceFile` the URL of the original source file.

- `sourceContent` the content of the source file.

```js
generator.setSourceContent("module-one.scm", fs.readFileSync("path/to/module-one.scm"));
```

#### SourceMapGenerator.prototype.toString()

Renders the source map being generated to a string.

```js
generator.toString();
// '{"version":3,"sources":["module-one.scm"],"names":[],"mappings":"...snip...","file":"my-generated-javascript-file.js","sourceRoot":"http://example.com/app/js/"}'
```

### SourceNode

SourceNodes provide a way to abstract over interpolating and/or concatenating
snippets of generated JavaScript source code, while maintaining the line and
column information associated between those snippets and the original source
code. This is useful as the final intermediate representation a compiler might
use before outputting the generated JS and source map.

#### new SourceNode([line, column, source[, chunk[, name]]])

- `line`: The original line number associated with this source node, or null if
  it isn't associated with an original line. The line number is 1-based.

- `column`: The original column number associated with this source node, or null
  if it isn't associated with an original column. The column number
  is 0-based.

- `source`: The original source's filename; null if no filename is provided.

- `chunk`: Optional. Is immediately passed to `SourceNode.prototype.add`, see
  below.

- `name`: Optional. The original identifier.

```js
var node = new SourceNode(1, 2, "a.cpp", [
  new SourceNode(3, 4, "b.cpp", "extern int status;\n"),
  new SourceNode(5, 6, "c.cpp", "std::string* make_string(size_t n);\n"),
  new SourceNode(7, 8, "d.cpp", "int main(int argc, char** argv) {}\n")
]);
```

#### SourceNode.prototype.add(chunk)

Add a chunk of generated JS to this source node.

- `chunk`: A string snippet of generated JS code, another instance of
  `SourceNode`, or an array where each member is one of those things.

```js
node.add(" + ");
node.add(otherNode);
node.add([leftHandOperandNode, " + ", rightHandOperandNode]);
```

#### SourceNode.prototype.prepend(chunk)

Prepend a chunk of generated JS to this source node.

- `chunk`: A string snippet of generated JS code, another instance of
  `SourceNode`, or an array where each member is one of those things.

```js
node.prepend("/** Build Id: f783haef86324gf **/\n\n");
```

#### SourceNode.prototype.setSourceContent(sourceFile, sourceContent)

Set the source content for a source file. This will be added to the
`SourceMap` in the `sourcesContent` field.

- `sourceFile`: The filename of the source file

- `sourceContent`: The content of the source file

```js
node.setSourceContent("module-one.scm", fs.readFileSync("path/to/module-one.scm"));
```

#### SourceNode.prototype.walk(fn)

Walk over the tree of JS snippets in this node and its children. The walking
function is called once for each snippet of JS and is passed that snippet and
the its original associated source's line/column location.

- `fn`: The traversal function.

```js
var node = new SourceNode(1, 2, "a.js", [
  new SourceNode(3, 4, "b.js", "uno"),
  "dos",
  ["tres", new SourceNode(5, 6, "c.js", "quatro")]
]);

node.walk(function(code, loc) {
  console.log("WALK:", code, loc);
});
// WALK: uno { source: 'b.js', line: 3, column: 4, name: null }
// WALK: dos { source: 'a.js', line: 1, column: 2, name: null }
// WALK: tres { source: 'a.js', line: 1, column: 2, name: null }
// WALK: quatro { source: 'c.js', line: 5, column: 6, name: null }
```

#### SourceNode.prototype.walkSourceContents(fn)

Walk over the tree of SourceNodes. The walking function is called for each
source file content and is passed the filename and source content.

- `fn`: The traversal function.

```js
var a = new SourceNode(1, 2, "a.js", "generated from a");
a.setSourceContent("a.js", "original a");
var b = new SourceNode(1, 2, "b.js", "generated from b");
b.setSourceContent("b.js", "original b");
var c = new SourceNode(1, 2, "c.js", "generated from c");
c.setSourceContent("c.js", "original c");

var node = new SourceNode(null, null, null, [a, b, c]);
node.walkSourceContents(function(source, contents) {
  console.log("WALK:", source, ":", contents);
});
// WALK: a.js : original a
// WALK: b.js : original b
// WALK: c.js : original c
```

#### SourceNode.prototype.join(sep)

Like `Array.prototype.join` except for SourceNodes. Inserts the separator
between each of this source node's children.

- `sep`: The separator.

```js
var lhs = new SourceNode(1, 2, "a.rs", "my_copy");
var operand = new SourceNode(3, 4, "a.rs", "=");
var rhs = new SourceNode(5, 6, "a.rs", "orig.clone()");

var node = new SourceNode(null, null, null, [lhs, operand, rhs]);
var joinedNode = node.join(" ");
```

#### SourceNode.prototype.replaceRight(pattern, replacement)

Call `String.prototype.replace` on the very right-most source snippet. Useful
for trimming white space from the end of a source node, etc.

- `pattern`: The pattern to replace.

- `replacement`: The thing to replace the pattern with.

```js
// Trim trailing white space.
node.replaceRight(/\s*$/, "");
```

#### SourceNode.prototype.toString()

Return the string representation of this source node. Walks over the tree and
concatenates all the various snippets together to one string.

```js
var node = new SourceNode(1, 2, "a.js", [
  new SourceNode(3, 4, "b.js", "uno"),
  "dos",
  ["tres", new SourceNode(5, 6, "c.js", "quatro")]
]);

node.toString();
// 'unodostresquatro'
```

#### SourceNode.prototype.toStringWithSourceMap([startOfSourceMap])

Returns the string representation of this tree of source nodes, plus a
SourceMapGenerator which contains all the mappings between the generated and
original sources.

The arguments are the same as those to `new SourceMapGenerator`.

```js
var node = new SourceNode(1, 2, "a.js", [
  new SourceNode(3, 4, "b.js", "uno"),
  "dos",
  ["tres", new SourceNode(5, 6, "c.js", "quatro")]
]);

node.toStringWithSourceMap({ file: "my-output-file.js" });
// { code: 'unodostresquatro',
//   map: [object SourceMapGenerator] }
```

