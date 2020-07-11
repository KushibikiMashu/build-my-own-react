function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children : children.map(child =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  }
}

// 文字列をオブジェクトにする
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    }
  }
}

const Didact = {
  createElement,
}

// @jsx Didact.createElement
const element = (
  <div id="foo">
    <a>bar</a>
    <b/>
  </div>

)
const container = document.getElementById("root")
ReactDOM.render(element, container)
