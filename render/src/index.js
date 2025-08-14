
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

    function pathChildrenV2(oldVnode, newVnode, container){
        // 如果新子节点是文本类型
        if (typeof newVnode.children == 'string'){

            // 如果旧子节点是一组子节点，循环卸载
            if (Array.isArray(oldVnode.children)){
                oldVnode.children.forEach(child => unmount(child))
            }

            // 更新文本内容
            setElementText(container, newVnode.children)
        }else if (Array.isArray(newVnode.children)){

            if (Array.isArray(oldVnode.children)){
                patchKeyedChildren(oldVnode, newVnode, container)
            }else {
                setElementText(container, '')
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

    // 双端Diff算法
    function patchKeyedChildren(oldVnode, newVnode, container){
        const oldChildren = oldVnode.children
        const newChildren = newVnode.children
        // 确定4个索引值
        let oldStartIdx = 0 // 旧子节点的起始索引
        let newStartIdx = 0 // 新子节点的起始索引
        let oldEndIdx = oldChildren.length - 1 // 旧子节点的结束索引
        let newEndIdx = newChildren.length - 1 // 新子节点的结束索引

        // 4个索引指向的Vnode节点
        let oldStartVnode = oldChildren[oldStartIdx]
        let oldEndVnode = oldChildren[oldEndIdx]
        let newStartVnode = newChildren[newStartIdx]
        let newEndVnode = newChildren[newEndIdx]

        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx){
            // 增加两个判断分支，如果头部或者尾部节点为undefined
            // 说明该节点已经被处理过了，直接跳过即可
            if(!oldStartVnode){
                oldStartVnode = oldChildren[++oldStartIdx]
            } else if (!oldEndVnode){
                oldEndVnode = oldChildren[--oldEndIdx]
            } else if (oldStartVnode.key === newStartVnode.key){
                // 头一样的时候
                patch(oldStartVnode, newStartVnode, container)

                // 更新索引的同时在更新头部的Vnode
                oldStartVnode = oldChildren[++oldStartIdx]
                newStartVnode = newChildren[++newStartIdx]
            }else if (oldEndVnode.key === newEndVnode.key){
                // 尾一样的时候
                patch(oldEndVnode, newEndVnode, container)

                // 更新索引的同时在更新尾部的Vnode
                oldEndVnode = oldChildren[--oldEndIdx]
                newEndVnode = newChildren[--newEndIdx]
            }else if (oldStartVnode.key === newEndVnode.key){
                // 旧头与新尾一样的时候
                // 先更新节点
                patch(oldStartVnode, newEndVnode, container)
                // 移动节点
                insert(oldStartVnode.el, container, oldEndVnode.el.nextSibling)
                // 更新索引
                newEndVnode = newChildren[--newEndIdx]
                oldStartVnode = oldChildren[++oldStartIdx]

            }else if (oldEndVnode.key === newStartVnode.key){
                // 旧尾与新头一样
                // 先更新节点
                patch(oldEndVnode, newStartVnode, container)
                // 移动节点
                insert(oldEndVnode.el, container, oldStartVnode.el.nextSibling)
                // 更新索引
                newStartVnode = newChildren[++newStartIdx]
                oldEndVnode = oldChildren[--oldEndIdx]
            }else {
                // 乱序的时候 遍历旧节点,寻找新字节头部newStartVnode有相同的Key值的节点
                const idxInOld = oldChildren.findIndex(node => node.key === newStartVnode.key)
                if (idxInOld >= 0){
                    const vnodeToMove = oldChildren[idxInOld]
                    // 移动前还是先要进行更新
                    patch(vnodeToMove, newStartVnode, container)
                    // 将找的节点移动到头部节点oldStartVnode.el之前
                    insert(vnodeToMove.el, container, oldStartVnode.el)
                    // 真实DOM已经移动到了别处，idxInOld对应的节点设置为undefined
                    oldChildren[idxInOld] = undefined
                    // 更新完成之后，newStartIdx应该移动到下一个位置
                    newStartVnode = newChildren[++newStartIdx]
                }else {
                    // 将newStartVnode添加到头部,使用当前头部节点oldStartVnode.el作为锚点
                    patch(null, newStartVnode, container, oldStartVnode.el)
                }
                newStartVnode = newChildren[++newStartIdx]
            }
        }

        // 循环结束，需要检查索引值的情况
        if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx){
            // 如果满足条件，说明有新的节点被遗漏，需要直接挂载
            for (let i = newStartIdx; i <= newEndIdx; i++){
                patch(null, newChildren[i], container, oldStartVnode.el)
            }
        }

        if (newStartIdx > newEndIdx && oldStartIdx <= oldEndIdx){
            // 如果满足条件，说明有旧的节点被遗漏，需要卸载
            for (let i = oldStartIdx; i <= oldEndIdx; i++){
                unmount(oldChildren[i])
            }
        }
    }

    // 快速Diff算法
    function patchKeyedChildren(oldVNode, newVNode, container){
        const oldChildren = oldVNode.children
        const newChildren = newVNode.children

        // 处理相同的前置节点，索引j指向新旧两组子节点的开头
        let j = 0
        let oldVN = oldChildren[j]
        let newVN = newChildren[j]
        // while遍历向后循环，直到晕倒拥有不同的Key值的节点为止
        while (oldVN.key === newVN.key){
            // 调用patch函数进行更新
            patch(oldVN, newVN, container)
            // 更新索引j，递增+1
            j++
            oldVN = oldChildren[j]
            newVN = newChildren[j]
        }

        // 更新相同的后置节点
        let oldEnd = oldChildren.length - 1
        let newEnd = newChildren.length - 1
        oldVN = oldChildren[oldEnd]
        newVN = newChildren[newEnd]

        // while遍历向前循环，直到遇到不同的Key值的节点为止
        while (oldVN.key === newVN.key){
            patch(oldVN, newVN, container)

            // 递减索引
            oldEnd--
            newEnd--
            oldVN = oldChildren[oldEnd]
            newVN = newChildren[newEnd]
        }

        // 满足下面的条件，说明j和newEnd之间的节点需要作为新节点进行插入
        if (j > oldEnd && j <= newEnd){

            // 插入锚点索引
            const anchorIndex = newEnd + 1

            // 锚点元素，如果锚点索引 >= 新子节点的长度 说明不需要插入, 直接挂载到尾部即可
            const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null

            // while循环，如果有多个，逐个挂载
            while (j <= newEnd){
                patch(null, newChildren[j++], container, anchor)
            }
        }else if (j > newEnd && j <= oldEnd){
            while (j <= oldEnd){
                unmount(oldChildren[j++])
            }
        }else{
            // 新子节点中剩余未处理节点的数量
            const count = newEnd - j + 1
            const source = new Array(count)
            source.fill(-1)
            let moved = false
            let pos = 0
            // 更新过的节点的数量
            let patched = 0
            // 新旧节点的起始索引
            const oldStart = j
            const newStart = j

            // 构建索引表
            const keyIndex = {}
            // 索引表中填入键值
            for (let i = newStart; i <= newEnd; i++){
                keyIndex[newChildren[i].key] = i
            }

            // 遍历旧节点中未处理的键值
            for (let i = oldStart; i <= oldEnd; i++){
                oldVN = oldChildren[i]

                // 如果更新节点的数量 <= 需要更新的节点数则需要进行更新
                if (patched <= count){
                    // 通过索引表快速找到新子节点中具有相同的key值的节点位置
                    const k = keyIndex[oldVN.key]

                    if(typeof k !== 'undefined'){
                        newVN = newChildren[k]
                        patch(oldVN, newVN, container)
                        // 更新了节点就自增
                        patched++
                        // 填充source数组
                        source[k - newStart] = i
                        if (k < pos){
                            moved = true
                        }else {
                            pos = k
                        }
                    }else {
                        // 没有找到 卸载旧节点
                        unmount(oldVN)
                    }
                }else {
                    unmount(oldVN)
                }

            }

            if (moved){
                // 创建一个新数组，将source数组中的元素进行排序
                const seq = LIS(source)
                // s 指向最长递增子序列的最后一个元素
                let s = seq.length - 1
                // i 指向新的一组子节点的最后一个元素
                let i = count - 1

                // for 循环i递减
                for (; i >= 0; i--){
                    // 当新节点的值等于-1时，说明是全新的节点，直接挂载
                    if (source[i] === -1){
                        // 该节点在新子节点中的真实位置索引
                        const pos = i + newStart
                        const newVN = newChildren[pos]
                        // 改节点的一下节点的位置索引
                        const nextPos = pos + 1

                        // 锚点
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                        patch(null, newVN, container, anchor)
                    } else if (source[i] !== seq[s]){
                        // 如果节点索引i不等于seq[s]的值，说明该节点需要移动
                        // 该节点在新的一组子节点中真实位置索引
                        const pos = i + newStart
                        const newVN = newChildren[pos]
                        // 该节点的下一个节点位置索引
                        const nextPos = pos + 1
                        // 锚点
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                        // 移动
                        insert(newVN.el, container, anchor)
                    }else {
                        // 当i===seq[s]，说明该节点不需要移动
                        // 只需要让s指向下一个位置
                        s--
                    }
                }
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

function LIS(nums){
    if (nums.length === 0) return []

    // 先取得第一项
    const results = [[nums[0]]]

    for (let i = 1; i < nums.length; i++){
        const n = nums[i]
        _update(n)
    }

    function _update(n){
        for (let i = results.length - 1; i >= 0; i--){
            const line = results[i]
            const tail = line[line.length - 1]

            if (n > tail){
                results[i+1] = [...line, n]
                return
            }
        }
        // 循环结束之后还不能进行拼接，将第一项改为当前的n
        results[0] = [n]
    }
    // 返回数组最后一项
    return results[results.length - 1]
}




