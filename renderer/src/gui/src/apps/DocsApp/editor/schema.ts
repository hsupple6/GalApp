import {Schema, NodeSpec, MarkSpec, DOMOutputSpec} from "prosemirror-model"
// Add list support
import { orderedList, bulletList, listItem } from "prosemirror-schema-list"

const pDOM: DOMOutputSpec = ["p", 0], blockquoteDOM: DOMOutputSpec = ["blockquote", 0],
      hrDOM: DOMOutputSpec = ["hr"], preDOM: DOMOutputSpec = ["pre", ["code", 0]],
      brDOM: DOMOutputSpec = ["br"]

// Common attribute patterns
const commonAttrs = {
  revision_id: {default: null},
  change_status: {default: null}
}

const getCommonAttrs = (dom: HTMLElement) => ({
  change_status: dom.getAttribute("data-change-status"),
  revision_id: dom.getAttribute("data-revision-id")
})

const toCommonDOM = (attrs: any) => ({
  "data-change-status": attrs.change_status,
  "data-revision-id": attrs.revision_id
})

/// [Specs](#model.NodeSpec) for the nodes defined in this schema.
export const nodes = {
  /// NodeSpec The top level document node.
  doc: {
    content: "block+"
  } as NodeSpec,

  /// A plain paragraph textblock. Represented in the DOM
  /// as a `<p>` element.
  paragraph: {
    content: "inline*",
    group: "block",
    attrs: commonAttrs,
    parseDOM: [{tag: "p", getAttrs: getCommonAttrs}],
    toDOM(node) { 
      return ["p", toCommonDOM(node.attrs), 0];
    }
  } as NodeSpec,

  /// A blockquote (`<blockquote>`) wrapping one or more blocks.
  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    attrs: commonAttrs,
    parseDOM: [{tag: "blockquote", getAttrs: getCommonAttrs}],
    toDOM(node) { 
      return ["blockquote", toCommonDOM(node.attrs), 0];
    }
  } as NodeSpec,

  /// A horizontal rule (`<hr>`).
  horizontal_rule: {
    group: "block",
    attrs: commonAttrs,
    parseDOM: [{tag: "hr", getAttrs: getCommonAttrs}],
    toDOM(node) { 
      return ["hr", toCommonDOM(node.attrs), 0];
    }
  } as NodeSpec,

  /// A heading textblock, with a `level` attribute that
  /// should hold the number 1 to 6. Parsed and serialized as `<h1>` to
  /// `<h6>` elements.
  heading: {
    content: "inline*",
    group: "block",
    defining: true,
    attrs: {
      level: {default: 1, validate: "number"},
      ...commonAttrs
    },
    parseDOM: [
      {tag: "h1", getAttrs: (dom: HTMLElement) => ({level: 1, ...getCommonAttrs(dom)})},
      {tag: "h2", getAttrs: (dom: HTMLElement) => ({level: 2, ...getCommonAttrs(dom)})},
      {tag: "h3", getAttrs: (dom: HTMLElement) => ({level: 3, ...getCommonAttrs(dom)})},
      {tag: "h4", getAttrs: (dom: HTMLElement) => ({level: 4, ...getCommonAttrs(dom)})},
      {tag: "h5", getAttrs: (dom: HTMLElement) => ({level: 5, ...getCommonAttrs(dom)})},
      {tag: "h6", getAttrs: (dom: HTMLElement) => ({level: 6, ...getCommonAttrs(dom)})}
    ],
    toDOM(node) { 
      return ["h" + node.attrs.level, toCommonDOM(node.attrs), 0];
    }
  } as NodeSpec,

  /// A code listing. Disallows marks or non-text inline
  /// nodes by default. Represented as a `<pre>` element with a
  /// `<code>` element inside of it.
  code_block: {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    attrs: commonAttrs,
    parseDOM: [{tag: "pre", preserveWhitespace: "full", getAttrs: getCommonAttrs}],
    toDOM(node) { 
      return ["pre", toCommonDOM(node.attrs), ["code", 0]];
    }
  } as NodeSpec,

  // Add list support with custom attributes for change tracking
  ordered_list: {
    ...orderedList,
    content: "list_item+",
    group: "block",
    attrs: {
      ...orderedList.attrs,
      ...commonAttrs
    },
    parseDOM: [{
      tag: "ol", 
      getAttrs: (dom: HTMLElement) => ({
        order: dom.hasAttribute("start") ? +dom.getAttribute("start")! : 1,
        ...getCommonAttrs(dom)
      })
    }],
    toDOM(node) { 
      return node.attrs.order == 1 ? 
        ["ol", toCommonDOM(node.attrs), 0] : 
        ["ol", {start: node.attrs.order, ...toCommonDOM(node.attrs)}, 0];
    }
  } as NodeSpec,

  bullet_list: {
    ...bulletList,
    content: "list_item+",
    group: "block",
    attrs: commonAttrs,
    parseDOM: [{tag: "ul", getAttrs: getCommonAttrs}],
    toDOM(node) { 
      return ["ul", toCommonDOM(node.attrs), 0];
    }
  } as NodeSpec,

  list_item: {
    ...listItem,
    content: "paragraph block*",
    attrs: commonAttrs,
    parseDOM: [{tag: "li", getAttrs: getCommonAttrs}],
    toDOM(node) { 
      return ["li", toCommonDOM(node.attrs), 0];
    }
  } as NodeSpec,

  /// The text node.
  text: {
    group: "inline"
  } as NodeSpec,

  /// An inline image (`<img>`) node. Supports `src`,
  /// `alt`, and `href` attributes. The latter two default to the empty
  /// string.
  image: {
    inline: true,
    attrs: {
      src: {validate: "string"},
      alt: {default: null, validate: "string|null"},
      title: {default: null, validate: "string|null"}
    },
    group: "inline",
    draggable: true,
    parseDOM: [{tag: "img[src]", getAttrs(dom: HTMLElement) {
      return {
        src: dom.getAttribute("src"),
        title: dom.getAttribute("title"),
        alt: dom.getAttribute("alt")
      }
    }}],
    toDOM(node) { let {src, alt, title} = node.attrs; return ["img", {src, alt, title}] }
  } as NodeSpec,

  /// A hard line break, represented in the DOM as `<br>`.
  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{tag: "br"}],
    toDOM() { return brDOM }
  } as NodeSpec
}

const emDOM: DOMOutputSpec = ["em", 0], strongDOM: DOMOutputSpec = ["strong", 0], codeDOM: DOMOutputSpec = ["code", 0]

/// [Specs](#model.MarkSpec) for the marks in the schema.
export const marks = {
  /// A link. Has `href` and `title` attributes. `title`
  /// defaults to the empty string. Rendered and parsed as an `<a>`
  /// element.
  link: {
    attrs: {
      href: {validate: "string"},
      title: {default: null, validate: "string|null"}
    },
    inclusive: false,
    parseDOM: [{tag: "a[href]", getAttrs(dom: HTMLElement) {
      return {href: dom.getAttribute("href"), title: dom.getAttribute("title")}
    }}],
    toDOM(node) { let {href, title} = node.attrs; return ["a", {href, title}, 0] }
  } as MarkSpec,

  /// An emphasis mark. Rendered as an `<em>` element. Has parse rules
  /// that also match `<i>` and `font-style: italic`.
  em: {
    parseDOM: [
      {tag: "i"}, {tag: "em"},
      {style: "font-style=italic"},
      {style: "font-style=normal", clearMark: m => m.type.name == "em"}
    ],
    toDOM() { return emDOM }
  } as MarkSpec,

  /// A strong mark. Rendered as `<strong>`, parse rules also match
  /// `<b>` and `font-weight: bold`.
  strong: {
    parseDOM: [
      {tag: "strong"},
      // This works around a Google Docs misbehavior where
      // pasted content will be inexplicably wrapped in `<b>`
      // tags with a font-weight normal.
      {tag: "b", getAttrs: (node: HTMLElement) => node.style.fontWeight != "normal" && null},
      {style: "font-weight=400", clearMark: m => m.type.name == "strong"},
      {style: "font-weight", getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null},
    ],
    toDOM() { return strongDOM }
  } as MarkSpec,

  /// Code font mark. Represented as a `<code>` element.
  code: {
    code: true,
    parseDOM: [{tag: "code"}],
    toDOM() { return codeDOM }
  } as MarkSpec
}

/// This schema roughly corresponds to the document schema used by
/// [CommonMark](http://commonmark.org/), minus the list elements,
/// which are defined in the [`prosemirror-schema-list`](#schema-list)
/// module.
///
/// To reuse elements from this schema, extend or read from its
/// `spec.nodes` and `spec.marks` [properties](#model.Schema.spec).
export const schema = new Schema({nodes, marks})