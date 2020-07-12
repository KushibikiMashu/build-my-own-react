function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
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

function createDom(fiber) {
  const dom = fiber.type === "TEXT_ELEMENT" ? document.createTextNode("") : document.createElement(fiber.type)

  // attributes、text_elementを追加する
  const isProperty = key => key !== "children"
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach(name => {
        dom[name] = fiber.props[name]
      }
    )

  return dom
}

function render(element, container) {
  // set next unit of work
  nextUnitOfWork = {
    dom: container,
    props: {
      children: [element],
    }
  }
}

let nextUnitOfWork = null

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = perfomUnitOfWork(nextUnitOfWork)

    shouldYield = deadline.timeRemaining() < 1
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function perfomUnitOfWork(fiber) {
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }

  const elements = fiber.props.children
  let index = 0
  let prevSibling = null

  // childrenを全てfiberにする
  while (index < elements.length) {
    const element = elements[index]

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber, // fiberは親の情報も持っておく
      dom: null
    }

    // fiber treeに追加
    if (index === 0) {
      // fiberの子供
      fiber.child = newFiber
    } else {
      // indexが1以上なら、indexが0のfiberの兄弟
      // <b></b>のみが入る
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }

  // return next unit of work
  // 子供があれば、子供を返す
  // 子供がなく、兄弟があれば兄弟を返す
  // 子供も兄弟もなければ、親の兄弟、つまり叔父を返す
  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      // 兄弟要素、もしくは親の兄弟を抜き出す
      return nextFiber.sibling
    }
    // rootの時は、parentがないのでundefinedになり、loopを抜ける
    nextFiber = nextFiber.parent
  }
}

const Didact = {
  createElement,
  render,
}

/** @jsx Didact.createElement */
const element = (
  <div id="foo">
    <a>bar</a>
    <b/>
  </div>
)

const container = document.getElementById("root")
Didact.render(element, container)
