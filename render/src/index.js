
const options = {
    // 文本类型节点
    createText(text){
        return document.createTextNode(text)
    },
    setText(el, text){
        el.nodeValue = text
    },
    // 注释节点
    createComment(text){
        return document.createComment(text)
    },
    createElement(tag){
        return document.createElement(tag)
    },
    setElementText(el, text){
        el.textContent = text
    },
    insert(child, parent, anchor = null){
        parent.insertBefore(child, anchor)
    },
    patchProps(el, key, preValue, nextValue){
        if(/^on/.test(key)){
            const eventName = key.slice(2).toLowerCase()
            // _vei其实是vue event invoker的简写 就是一个缓存
            let invokers = el._vei || (el.vei = {})

            // 通过事件名称获取相对应的函数
            let invoker = invokers[key]

            if (nextValue){
                if (!invoker){
                    invoker = el._vei[key] = (e) => {
                        // 如果invoker.value是数组，那么遍历数组一次执行
                        if (e.timestamp < invoker.attached){
                            return
                        }
                        if (Array.isArray(invoker.value)){
                            invoker.value.forEach(fn => fn(e))
                        }else{
                            invoker.value(e)
                        }
                    }
                    invoker.value = nextValue
                    // 添加一个存储时间的属性
                    invoker.attached = performance.now()
                    el.addEventListener(eventName, invoker)
                }else{
                    // 如果invoker已存在，说明是更新，直接重新赋值
                    invoker.value = nextValue
                }

            }else{
                el.removeEventListener(eventName, invoker)
            }

        }else if (key === 'class'){
            el.className = nextValue || " "
        }else if (shouldSetAsProps(el, key, nextValue)){
            const type = typeof el[key]
            const value = vnode.props[key]

            if (type === 'boolean' && value === ''){
                el[key] = true
            }else{
                el[key] = nextValue
            }

        }else {
            el.setAttribute(key, nextValue)
        }
    }
}


function shouldSetAsProps(el, key, value){
    if (key === 'form' && el.tagName === 'INPUT'){
        return false
    }

    return key in el
}

function createRender(options) {

    const {
        createText,
        setText,
        createComment,
        createElement,
        setElementText,
        insert,
        patchProps,
    } = options

    function unmount(vnode) {
        if (vnode.tyoe === Symbol('fragment')){
            vnode.children.forEach(child => unmount(child))
            return
        }
        const parent = vnode.el.parentNode
        if (parent){
            parent.removeChild(vnode.el)
        }
    }

    function render(vnode, container) {
        if (vnode){
            patch(container._vnode, vnode, container)
        }else {
            if (container._vnode){
                unmount(container._vnode)
            }
        }
        container._vnode = vnode
    }

    function patchChildren (oldVnode, newVnode, container){
        // 如果新子节点是文本类型
        if (typeof newVnode.children == 'string'){

            // 如果旧子节点是一组子节点，循环卸载
            if (Array.isArray(oldVnode.children)){
                oldVnode.children.forEach(child => unmount(child))
            }

            // 更新文本内容
            setElementText(container, newVnode.children)
        }else if (Array.isArray(newVnode.children)){ // 如果是数组

            if (Array.isArray(oldVnode.children)){

                const oldChildren = oldVnode.children
                const newChildren = newVnode.children

                // 是否找到对应的旧节点 通过boolean开关控制
                let find = false
                let lastIndex = 0 // 存储寻找过程中遇到的最大索引值
                // 循环遍历新的children
                for (let i = 0; i < newChildren.length; i++){
                    const n = newChildren[i]
                    for (let j = 0; j < oldChildren.length; j++) {
                        const o = oldChildren[j]
                        if (n.key === o.key){
                            // 找到了对应的旧节点
                            find = true
                            patch(o, n, container)
                            if (j < lastIndex){
                                // 获取新子节点的前一个节点
                                const prevNode = newChildren[i - 1]
                                if (prevNode){
                                    // 需要获取子节点的真实DOM元素的下一个节点
                                    // 注意这里是旧子节点对应的DOM引用
                                    const anchor = prevNode.el.nextSibling
                                    // 移动节点
                                    insert(n.el, container, anchor)
                                }
                            }else {
                                lastIndex = j
                            }
                            break
                        }
                    }
                    // 如果没找到，就挂载新节点
                    if (!find){
                        // 获取当前newVNode的前一个节点
                        const prevNode = newChildren[i - 1]
                        let anchor = null
                        if (prevNode){
                            anchor = prevNode.el.nextSibling
                        }else {
                            // 如果没有前一个节点，使用它的下一个相邻兄弟元素作为锚点
                            anchor = container.firstChild
                        }
                        // 挂载新节点
                        // 注意之前path函数没有第四个参数，需要改造一下
                        patch(null, n, container, anchor)
                    }
                }

                // 循环卸载多余的旧节点
                for (let i = 0; i < oldChildren.length; i++){
                    const oldVNode = oldChildren[i]
                    // 用旧节点去新节点中寻找是否具有相同key值的节点
                    const has = newChildren.find(newVNode => newVNode.key === oldVNode.key)
                    // 如果没有找到相同节点的key，那么就是删除节点
                    if (!has){
                        unmount(oldVNode)
                    }
                }
            }else {
                setElementText(container, '')

                // 循环挂载新的节点
                newVnode.children.forEach(child => {
                    patch(null, child, container)
                })
            }

        }else { // 如果没有子节点
            if (Array.isArray(oldVnode.children)){
                oldVnode.children.forEach(child => unmount(child))
            }else if (typeof oldVnode.children === 'string'){
                setElementText(container, '')
            }
        }
    }

    function patchElement(oldVnode, newVnode){
        const el = newVnode.el = oldVnode.el
        const oldProps = oldVnode.props
        const newProps = newVnode.props

        // 更新props
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]){
                patchProps(el, key, oldProps[key], newProps[key])
            }
        }

        // 如果旧节点中的属性，新节点中没有，将属性设置为null
        for (const key in oldProps) {
            if (!(key in newProps)){
                patchProps(el, key, oldProps[key], null)
            }
        }

        // 子节点更新
        patchChildren(oldVnode, newVnode, el)
    }

    function patch(oldVnode, newVnode, container, anchor = null) {
        // 如果新旧节点不一样，则卸载旧的挂载新的
        if (oldVnode && oldVnode.type !== newVnode.type){
            unmount(oldVnode)
            oldVnode = null
        }

        const { type } = newVnode

        if (typeof type === 'string'){
            // 如果旧节点不存在，就以为着是挂载，调用mountElement函数完成挂载
            if (!oldVnode){
                mountElement(newVnode, container, anchor)
            }else {
                patchElement(oldVnode, newVnode)
            }
        }else if(type === Symbol('text')){
            if (!oldVnode){
                const el = (newVnode.el = createText(newVnode.children))
                insert(el, container)
            }else {
                const el = (newVnode.el = oldVnode.el)
                if (newVnode.children !== oldVnode.children){
                    setText(el, newVnode.children)
                }
            }
        }else if(type === Symbol('comment')){
            if (!oldVnode){
                const el = (newVnode.el = createComment(newVnode.children))
                insert(el, container)
            }else {
                const el = (newVnode.el = oldVnode.el)
                if (newVnode.children !== oldVnode.children){
                    setText(el, newVnode.children)
                }
            }
        }else if (type === Symbol('fragment')){
            if (!oldVnode){
                newVnode.children.forEach(child => patch(null, child, container))
            }else {
                patchChildren(oldVnode, newVnode, container)
            }
        } else if (typeof type === 'object'){
            console.log('组件处理')
        }else {
            console.log('未知类型')
        }


    }
    
    function mountElement(vnode, container, anchor = null) {
        // 创建元素
        const el = createElement(vnode.type)

        if (vnode.props){
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key])
            }
        }

        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children)
        } else if (Array.isArray(vnode.children)) {
            vnode.children.forEach(child => patch(null, child, el))
        }



        insert(el, container, anchor)
    }

    return {
        render
    }

}




