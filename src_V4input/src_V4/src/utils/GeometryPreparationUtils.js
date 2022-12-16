import { BufferAttribute } from 'three';
import { mergeBufferGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export function getGroupMaterialIndicesAttribute(geometry, materials, allMaterials) {

    const indexAttr = geometry.index;
    const posAttr = geometry.attributes.position;
    const vertCount = posAttr.count;
    const totalCount = indexAttr ? indexAttr.count : vertCount;
    let groups = geometry.groups;

    if (groups.length === 0) {

        groups = [{ count: totalCount, start: 0, materialIndex: 0 }];

    }

    else if (groups[groups.length - 1].count !== totalCount - groups[groups.length - 1].start) {

        groups.push({ count: totalCount - groups[groups.length - 1].start, start: groups[groups.length - 1].start, materialIndex: 0 });

    }

    const materialIndices = new Uint8Array(totalCount);
    let groupMaterialIndices = new Uint8Array(vertCount);
    let groupMaterialIndex = 0;
    let materialIndex = 0;

    for (let i = 0, l = groups.length; i < l; i++) {

        const group = groups[i];
        const groupMaterial = materials[group.materialIndex];

        if (groupMaterial) {

            groupMaterialIndex = allMaterials.indexOf(groupMaterial);

        }

        groupMaterialIndices.fill(groupMaterialIndex, group.start, group.start + group.count);

    }

    if (indexAttr) {

        for (let i = 0, l = indexAttr.count; i < l; i++) {

            materialIndices[i] = groupMaterialIndices[indexAttr.getX(i)];

        }

    }

    else {

        materialIndices.set(groupMaterialIndices);

    }

    return new BufferAttribute(materialIndices, 1);


}

export function trimToAttributes(geometry, attributes) {

    // trim any unneeded attributes
    if (attributes) {

        for (const key in geometry.attributes) {

            if (!attributes.includes(key)) {

                geometry.deleteAttribute(key);

            }

        }

    }

}

export function setCommonAttributes(geometry, options) {
    const { attributes = [], normalMapRequired = false } = options;

    if (!geometry.attributes.normal && (attributes && attributes.includes('normal'))) {

        geometry.computeVertexNormals();

    }

    if (!geometry.attributes.uv && (attributes && attributes.includes('uv'))) {

        const vertCount = geometry.attributes.position.count;
        geometry.setAttribute('uv', new BufferAttribute(new Float32Array(vertCount * 2), 2, false));

    }

    if (!geometry.attributes.tangent && (attributes && attributes.includes('tangent'))) {

        if (normalMapRequired) {

            // computeTangents requires an index buffer
            if (geometry.index === null) {

                geometry = mergeVertices(geometry);

            }

            geometry.computeTangents();

        } else {

            const vertCount = geometry.attributes.position.count;
            geometry.setAttribute('tangent', new BufferAttribute(new Float32Array(vertCount * 4), 4, false));

        }

    }

    if (!geometry.attributes.color && (attributes && attributes.includes('color'))) {

        const vertCount = geometry.attributes.position.count;
        const array = new Float32Array(vertCount * 4);
        array.fill(1.0);
        geometry.setAttribute('color', new BufferAttribute(array, 4));

    }

    if (!geometry.index) {

        // TODO: compute a typed array
        const indexCount = geometry.attributes.position.count;
        const array = new Array(indexCount);
        for (let i = 0; i < indexCount; i++) {

            array[i] = i;

        }

        geometry.setIndex(array);

    }

}

export function mergeMeshes(meshes, options = {}) {

    options = { attributes: null, cloneGeometry: true, ...options };

    const transformedGeometry = [];
    const materialSet = new Set();
    for (let i = 0, l = meshes.length; i < l; i++) {

        // save any materials
        const mesh = meshes[i];
        if (mesh.visible === false) continue;

        if (Array.isArray(mesh.material)) {

            mesh.material.forEach(m => materialSet.add(m));

        } else {

            materialSet.add(mesh.material);

        }

    }

    const materials = Array.from(materialSet);
    for (let i = 0, l = meshes.length; i < l; i++) {

        // ensure the matrix world is up to date
        const mesh = meshes[i];
        if (mesh.visible === false) continue;

        mesh.updateMatrixWorld();

        // apply the matrix world to the geometry
        const originalGeometry = meshes[i].geometry;
        const geometry = options.cloneGeometry ? originalGeometry.clone() : originalGeometry;
        geometry.applyMatrix4(mesh.matrixWorld);

        // ensure our geometry has common attributes
        setCommonAttributes(geometry, {
            attributes: options.attributes,
            normalMapRequired: ! !mesh.material.normalMap,
        });
        trimToAttributes(geometry, options.attributes);

        // create the material index attribute
        const materialIndexAttribute = getGroupMaterialIndicesAttribute(geometry, mesh.material, materials);
        geometry.setAttribute('materialIndex', materialIndexAttribute);

        transformedGeometry.push(geometry);

    }

    const textureSet = new Set();
    materials.forEach(material => {

        for (const key in material) {

            const value = material[key];
            if (value && value.isTexture) {

                textureSet.add(value);

            }

        }

    });

    const geometry = mergeBufferGeometries(transformedGeometry, false);
    const textures = Array.from(textureSet);
    return { geometry, materials, textures };

}