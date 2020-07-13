function createElement(type, props, ...children) {
  return {
    type, // HTMLタグかTEXT_ELEMENT
    props: {
      ...props,
      children: children.map(child =>
        typeof child == "object" ? child : createTextElement(child)
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

  updateDom(dom, {}, fiber.props)

  return dom
}

// eventのプロパティを判別する
const isEvent = key => key.startsWith('on')
const isProperty = key => key !== "children" && !isEvent(key)
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  // remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  // set new changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

// 全てのnodeをDOMに再帰的に追加する
function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) {
    return
  }

  // DOMをもつfiberが見つかるまで、
  // fiber treeを遡る
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  // fiberの親のDOMにnodeを追加する（自分のDOMを親のDOMにappendChildする）
  // ただし、関数コンポーネントのdomはnullである
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent)
  }

  // 子要素、兄弟要素を探索する
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if(fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    // DOMノードをもつ子が見つかるまでfiber treeを下る
    commitDeletion(fiber.child, domParent)
  }
}

function render(element, container) {
  // set next unit of work
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, // 以前のfiber
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)

    shouldYield = deadline.timeRemaining() < 1
  }

  // 全ての作業を終えたら（＝ nextUnitOfWorkがundefinedになったら）、
  // ファイバーツリーをDOMにコミットする
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if(isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
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

function updateFunctionComponent(fiber) {
  // fiber.typeは関数コンポーネント
  // fiber.type = ƒ App(props) {
  //   return Didact.createElement(
  //     "h1",
  //     null,
  //     "Hi ",
  //     props.name
  //   );
  // }
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function updateHostComponent(fiber) {
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  reconcileChildren(fiber, fiber.props.children)
}

// wipFiberは古いfiber。elementsは新しいもの。この関数でfiberとelementsを比較する
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  // childrenを全てfiberにする
  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null

    // compare oldFiber to element
    // HTMLタグの比較
    const sameType = oldFiber && element && element.type == oldFiber.type

    // keyを指定すると配列の要素がのindexが変更されたことを検出するパフォーマンスが上がる
    if (sameType) {
      // update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props, // propsだけを更新する
        dom: oldFiber.dom,
        parent: wipFiber, // fiberは親の情報も持っておく
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    if (element && !sameType) {
      // add the node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    if (oldFiber && !sameType) {
      // delete the oldFiber's node
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    // fiber treeに追加
    if (index === 0) {
      // fiberの子供
      wipFiber.child = newFiber
    } else if (element) {
      // indexが1以上なら、indexが0のfiberの兄弟
      // <b></b>のみが入る
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

const Didact = {
  createElement,
  render,
}


/** @jsx Didact.createElement */
function App(props) {
  return <h1>Hi {props.name}</h1>
}
// const element = <App name="foo" />
const element = <App name="foo" />
const container = document.getElementById("root")
Didact.render(element, container)

// const updateValue = e => {
//   rerender(e.target.value)
// }
//
// const rerender = value => {
//   /** @jsx Didact.createElement */
//   function App(props) {
//     return <h1>Hi {props.name}</h1>
//   }
//   const element = App()
//   Didact.render(element, container)
// }
//
// rerender("World")
