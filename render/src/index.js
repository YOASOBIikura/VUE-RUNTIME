
const options = {
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
        if (key === 'class'){
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
        createElement,
        setElementText,
        insert,
        patchProps,
    } = options

    function render(vnode, container) {
        if (vnode){
            patch(container._vnode, vnode, container)
        }else {
            if (container._vnode){
                container.innerHTML = ''
            }
        }
        container._vnode = vnode
    }
    
    function patch(oldVnode, newVnode, container) {
        // 如果旧节点不存在，就以为着是挂载，调用mountElement函数完成挂载
        if (!oldVnode){
            mountElement(newVnode, container)
        }else {

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




