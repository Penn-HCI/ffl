// Type definitions for source-map 0.7
// Project: https://github.com/mozilla/source-map
// Definitions by: Morten Houston Ludvigsen <https://github.com/MortenHoustonLudvigsen>,
//                 Ron Buckton <https://github.com/rbuckton>,
//                 John Vilk <https://github.com/jvilk>
// Definitions: https://github.com/mozilla/source-map
export type SourceMapUrl = string;

export interface StartOfSourceMap {
  file?: string;
  sourceRoot?: string;
  skipValidation?: boolean;
}

export interface RawSourceMap {
  version: number;
  sources: string[];
  names: string[];
  sourceRoot?: string;
  sourcesContent?: string[];
  mappings: string;
  file: string;
}

export interface RawIndexMap extends StartOfSourceMap {
  version: number;
  sections: RawSection[];
}

export interface RawSection {
  offset: Position;
  map: RawSourceMap;
}

export interface Position {
  line: number;
  column: number;
}

export interface NullablePosition {
  line: number | null;
  column: number | null;
  lastColumn: number | null;
}

export interface MappedPosition {
  source: string;
  line: number;
  column: number;
  name?: string;
}

export interface NullableMappedPosition {
  source: string | null;
  line: number | null;
  column: number | null;
  name: string | null;
}

export interface MappingItem {
  source: string;
  generatedLine: number;
  generatedColumn: number;
  lastGeneratedColumn: number | null;
  originalLine: number;
  originalColumn: number;
  name: string;
}

export interface Mapping {
  generated: Position;
  original: Position;
  source: string;
  name?: string;
}

export interface CodeWithSourceMap {
  code: string;
  map: SourceMapGenerator;
}

export class SourceMapGenerator {
  constructor(startOfSourceMap?: StartOfSourceMap);

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  addMapping(mapping: Mapping): void;

  /**
   * Set the source content for a source file.
   */
  setSourceContent(sourceFile: string, sourceContent: string): void;

  toString(): string;

  toJSON(): RawSourceMap;
}

export class SourceNode {
  children: SourceNode[];
  sourceContents: any;
  line: number;
  column: number;
  source: string;
  name: string;

  constructor();
  constructor(
    line: number | null,
    column: number | null,
    source: string | null,
    chunks?: Array<string | SourceNode> | SourceNode | string,
    name?: string
  );

  add(chunk: Array<string | SourceNode> | SourceNode | string): SourceNode;

  prepend(chunk: Array<string | SourceNode> | SourceNode | string): SourceNode;

  setSourceContent(sourceFile: string, sourceContent: string): void;

  walk(fn: (chunk: string, mapping: MappedPosition) => void): void;

  walkSourceContents(fn: (file: string, content: string) => void): void;

  join(sep: string): SourceNode;

  replaceRight(pattern: string, replacement: string): SourceNode;

  toString(): string;

  toStringWithSourceMap(startOfSourceMap?: StartOfSourceMap): CodeWithSourceMap;
}
