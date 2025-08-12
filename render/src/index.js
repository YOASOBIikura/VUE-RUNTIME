
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

    function patchChildren(oldVnode, newVnode, container){
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
                oldVnode.children.forEach(child => unmount(child))

                // 循环挂载新的节点
                newVnode.children.forEach(child => {
                    patch(null, child, container)
                })
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

    function patch(oldVnode, newVnode, container) {
        // 如果新旧节点不一样，则卸载旧的挂载新的
        if (oldVnode && oldVnode.type !== newVnode.type){
            unmount(oldVnode)
            oldVnode = null
        }

        const { type } = newVnode

        if (typeof type === 'string'){
            // 如果旧节点不存在，就以为着是挂载，调用mountElement函数完成挂载
            if (!oldVnode){
                mountElement(newVnode, container)
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
    
    function mountElement(vnode, container) {
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



        insert(el, container)
    }

    return {
        render
    }

}




