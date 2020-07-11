const element = {
  type: "h1", // tagName
  props: {
    title: "foo",
    children: "Hello",
  },
}

const container = document.getElementById('root')

const node = document.createElement(element.type) // renderされる側
node["title"] = element.props.title

const text = document.createTextNode("")
text["nodeValue"] = element.props.children

node.appendChild(text)
container.appendChild(node)
