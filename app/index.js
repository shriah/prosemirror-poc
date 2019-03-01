class MenuView {
  constructor(items, editorView) {
    this.items = items
    this.editorView = editorView

    this.dom = document.createElement("div")
    this.dom.className = "menubar"
    items.forEach(({dom}) => this.dom.appendChild(dom))
    this.update()

    this.dom.addEventListener("mousedown", e => {
      e.preventDefault()
      editorView.focus()
      items.forEach(({command, dom}) => {
        if (dom.contains(e.target))
          command(editorView.state, editorView.dispatch, editorView)
      })
    })
  }

  update() {
    this.items.forEach(({command, dom}) => {
      let active = command(this.editorView.state, null, this.editorView)
      dom.style.display = active ? "" : "none"
    })
  }

  destroy() { this.dom.remove() }
}

const {Plugin} = require("prosemirror-state")

function menuPlugin(items) {
  return new Plugin({
    view(editorView) {
      let menuView = new MenuView(items, editorView)
      editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom)
      return menuView
    }
  })
}

const {toggleMark, setBlockType, wrapIn} = require("prosemirror-commands")

// Helper function to create menu icons
function icon(text, name) {
  let span = document.createElement("span")
  span.className = "menuicon " + name
  span.title = name
  span.textContent = text
  return span
}



const {Schema} = require("prosemirror-model")

const  compute =  () => Math.random()*10000000000000000;
const {findWrapping} = require("prosemirror-transform")


let starSchema = new Schema({
  nodes: {
    text: {
      group: "inline",
    },
    star: {
      inline: true,
      group: "inline",
      attrs: { id : {
        compute: () => Math.random()*10000000000000000
      }},
      toDOM(node) { return ["star", {id : node.attrs.id},"🟊"] },
      parseDOM: [{tag: "star", getAttrs(dom) { return {id: dom.id} }}]
    },
    formula: {
      inline: true,
      group: "inline",
      content: "text*",
      toDOM() { return ["formula", 0] },
      parseDOM: [{tag: "formula"}]
    },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: { index : {
        default: 'new'
      }},
      toDOM(node) { return ["p",{index : node.attrs.index}, 0] },
      parseDOM: [{tag: "p", getAttrs(dom) { return {index: dom.attributes.index ? dom.attributes.index.value : 'new'} }}]
    },
    blockquote: {
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{tag: "blockquote"}],
      toDOM() { return ["blockquote", 0] }
    },
    heading: {
      attrs: {level: {default: 1}},
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [{tag: "h1", attrs: {level: 1}},
                 {tag: "h2", attrs: {level: 2}},
                 {tag: "h3", attrs: {level: 3}},
                 {tag: "h4", attrs: {level: 4}},
                 {tag: "h5", attrs: {level: 5}},
                 {tag: "h6", attrs: {level: 6}}],
      toDOM(node) { return ["h" + node.attrs.level, 0] }
    },
    doc: {
      content: "block+"
    }
  },
  marks: {
    shouting: {
      toDOM() { return ["shouting"] },
      parseDOM: [{tag: "shouting"}]
    },
    link: {
      attrs: {proforma: {}},
      toDOM(node) { return ["span", {proforma: node.attrs.proforma}] },
      parseDOM: [{tag: "span[proforma]", getAttrs(dom) { return {proforma: dom.attributes.proforma.value} }}],
      inclusive: false
    },
    comment: {
      attrs: {comment: {}},
      toDOM(node) { return ["span", {title: node.attrs.comment}] },
      parseDOM: [{tag: "span[title]", getAttrs(dom) { return {comment: dom.attributes.title.value} }}],
      inclusive: false
    }
  }
})

const {keymap} = require("prosemirror-keymap")

let starKeymap = keymap({
  "Mod-b": toggleMark(starSchema.marks.shouting),
  "Mod-q": toggleLink,
  "Mod-Space": insertStar,
  "Mod-k": toggleComment
})

function toggleLink(state, dispatch) {
  let {doc, selection} = state
  if (selection.empty) return false
  let attrs = null
  if (!doc.rangeHasMark(selection.from, selection.to, starSchema.marks.link)) {
    attrs = {proforma: prompt("Link to where?", "")}
    if (!attrs.proforma) return false
  }
  return toggleMark(starSchema.marks.link, attrs)(state, dispatch)
}
function toggleComment(state, dispatch) {
  let {doc, selection} = state
  if (selection.empty) return false
  let attrs = null
  if (!doc.rangeHasMark(selection.from, selection.to, starSchema.marks.comment)) {
    attrs = {comment: prompt("Add your comment:", "")}
    if (!attrs.comment) return false
  }
  return toggleMark(starSchema.marks.comment, attrs)(state, dispatch)
}
function insertStar(state, dispatch) {
  let type = starSchema.nodes.star
  let {$from} = state.selection
  if (!$from.parent.canReplaceWith($from.index(), $from.index(), type))
    return false
  dispatch(state.tr.replaceSelectionWith(type.create()))
  return true
}
const {schema} = require("prosemirror-schema-basic")
// Create an icon for a heading at the given level
function heading(level) {
  return {
    command: setBlockType(starSchema.nodes.heading, {level}),
    dom: icon("H" + level, "heading")
  }
}

let menu = menuPlugin([
  {command: toggleMark(schema.marks.strong), dom: icon("B", "strong")},
  {command: toggleMark(schema.marks.em), dom: icon("i", "em")},
  {command: setBlockType(starSchema.nodes.paragraph, compute()), dom: icon("p", "paragraph")},
  heading(1), heading(2), heading(3),
  {command: wrapIn(starSchema.nodes.blockquote), dom: icon(">", "blockquote")}
])



const {DOMParser} = require("prosemirror-model")
const {EditorState} = require("prosemirror-state")
const {EditorView} = require("prosemirror-view")
const {baseKeymap} = require("prosemirror-commands")
const {history, undo, redo} = require("prosemirror-history")

let histKeymap = keymap({"Mod-z": undo, "Mod-y": redo})

function start(place, content, schema, plugins = []) {
  let doc = DOMParser.fromSchema(schema).parse(content);
  let state = EditorState.create({
    doc,
    plugins: plugins.concat([histKeymap, keymap(baseKeymap), history(), menu])
  });

  function generatePDF(){
    let doc = DOMParser.fromSchema(schema).parse(document.querySelector("#star-editor"));
    fetch("http://localhost:3000/pdf1",{
      method: "POST",
      headers:{
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({"document":doc, state: JSON.parse(document.querySelector("#state").value)}),
    }) 
    .then(function(response) {
      return response.blob();
    })
    .then(blob => {
      //Create a Blob from the PDF Stream
          const file = new Blob(
            [blob], 
            {type: 'application/pdf'});
      //Build a URL from the file
          const fileURL = URL.createObjectURL(file);
      //Open the URL on new Window
          window.open(fileURL);
      })
      .catch(error => {
          console.log(error);
      });

  }
  document.querySelector("#button1").addEventListener("click",generatePDF,false);
  return new EditorView(place, {
    state
  })
}

function id(str) { return document.getElementById(str) }


//start(id("note-editor"), id("note-content"), noteSchema, [keymap({"Mod-Space": makeNoteGroup})])
start(id("star-editor"), id("star-content"), starSchema, [starKeymap])
