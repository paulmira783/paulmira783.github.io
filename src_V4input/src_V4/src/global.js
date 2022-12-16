export const isInImage = (region, x, y, image, ctx) => {
    // rotate region according to image rotation and scale and minwidth and height and check if point is inside it using context.isPointInPath
    ctx.save()

    ctx.translate(region.x + region.width / 2, region.y + region.height / 2)
    ctx.rotate(image.rotation * Math.PI / 50)
    ctx.translate(-region.x - region.width / 2, -region.y - region.height / 2)

    ctx.beginPath()
    ctx.rect(region.x, region.y, region.width, region.height)
    var isInPath = ctx.isPointInPath(x, y)
    ctx.restore()
    return isInPath
}

export const isInText = (region, x, y, text, ctx) => {
    // rotate region according to text rotation and check if point is inside it using context.isPointInPath
    ctx.save()
    ctx.translate(region.x + region.width / 2, region.y + region.height / 2)
    ctx.rotate(text.rotation * Math.PI / 50)
    ctx.translate(-region.x - region.width / 2, -region.y - region.height / 2)
    ctx.beginPath()
    ctx.rect(region.x, region.y, region.width, region.height)
    var isInPath = ctx.isPointInPath(x, y)
    ctx.restore()
    return isInPath
}

