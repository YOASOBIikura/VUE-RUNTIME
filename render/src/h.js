import {ShapeFlages as ShapeFlags} from "./flags";

function isString(type) {
    return Object.prototype.toString.call(type) === '[object String]'
}

function isObject(type) {
    return Object.prototype.toString.call(type) === '[object Object]'
}

function isArray(type) {
    return Object.prototype.toString.call(type) === '[object Array]'
}

function isVNode(value){
    return value?.__v_isVnode
}

function createVNode(type, props, children) {
    const shapeFlag = isString(type)
        ? ShapeFlags.ELEMENT
        : 0

    const vnode = {
        __v_isVNode: true,
        type,
        props,
        children,
        component: null,
        el: null,
        key: props?.key
    }

    if (children){
        if (isArray(children)){
            vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN
        }else {
            vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
        }
    }

    return vnode
}

export function h(type, props, children){
    let l = arguments.length
    if (l === 2){
        if (isObject(props) && !isArray(props)){
            // 判断是不是虚拟节点
            if (isVNode(props)){
                return createVNode(type, null, [props])
            }
            return createVNode(type, props, null)
        }else {
            return createVNode(type, props, null)
        }
    }else {
        if (l > 3){
             children = Array.prototype.slice.call(arguments, 2)
        }else if (l === 3 && isVNode(children)){
            children = [children]
        }

        return createVNode(type, props, children)
    }
}



