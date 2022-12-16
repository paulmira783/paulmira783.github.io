import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/rgbeloader';
import * as dat from 'lil-gui'

import './global'

import Interface from './interface';

import './style.css'

import {
    PathTracingSceneGenerator,
    PathTracingRenderer,
    PhysicalPathTracingMaterial,
    MaterialReducer, BlurredEnvMapGenerator, PhysicalSpotLight, ShapedAreaLight, IESLoader
} from 'three-gpu-pathtracer';
import { DynamicPathTracingSceneGenerator } from './DynamicPathTracingSceneGenerator';
import { PathTracingSceneWorker } from 'three-gpu-pathtracer/src/workers/PathTracingSceneWorker.js';
import { WebGLUtils } from 'three/src/renderers/webgl/WebGLUtils';



var canvasResolution = 10



let delaySamples = 0;

const envMaps = {
    'Royal Esplanade': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/royal_esplanade_1k.hdr',
    'Moonless Golf': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/moonless_golf_1k.hdr',
    'Overpass': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/pedestrian_overpass_1k.hdr',
    'Venice Sunset': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/venice_sunset_1k.hdr',
    'Small Studio': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/studio_small_05_1k.hdr',
    'Pfalzer Forest': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/phalzer_forest_01_1k.hdr',
    'Leadenhall Market': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/leadenhall_market_1k.hdr',
    'Kloppenheim': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/kloppenheim_05_1k.hdr',
    'Hilly Terrain': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/hilly_terrain_01_1k.hdr',
    'Circus Arena': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/circus_arena_1k.hdr',
    'Chinese Garden': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/chinese_garden_1k.hdr',
    'Autoshop': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/autoshop_01_1k.hdr',
};

const params = {

    multipleImportanceSampling: true,
    acesToneMapping: true,
    resolutionScale: 1 / window.devicePixelRatio,
    tilesX: 2,
    tilesY: 2,
    samplesPerFrame: 1,


    envMap: envMaps['Royal Esplanade'],
    gradientTop: '#bfd8ff',
    gradientBottom: '#ffffff',

    environmentIntensity: 0.01,
    environmentBlur: 0.0,
    environmentRotation: 0,

    cameraProjection: 'Perspective',

    backgroundType: 'Gradient',
    bgGradientTop: '#111111',
    bgGradientBottom: '#000000',
    backgroundAlpha: 1.0,
    checkerboardTransparency: true,

    enable: true,
    bounces: 3,
    transparentTraversals: 20,
    filterGlossyFactor: 0.5,
    pause: false,

    floorColor: '#080808',
    floorOpacity: 1.0,
    floorRoughness: 0.1,
    floorMetalness: 0.0

};



class WebGL {
    constructor() {
        this.gui = new dat.GUI();
        this.animate = this.animate.bind(this);
        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000)
        this.renderer = new THREE.WebGLRenderer(
            {
                antialias: true,
                alpha: false,
            }
        )

        // this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        // this.renderer.outputEncoding = THREE.sRGBEncoding
        // this.renderer.setClearColor(0xff0000, 0);
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.object = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshPhysicalMaterial()
        )
        this.params = { color: 0x202020, url: 'objects/dove/dove_vf.obj' }
        this.canvasTextures = []
        this.children = []
        this.raycaster = new THREE.Raycaster()
        this.mouse = {}
        this.interface = null
        this.isDown = false
        this.intersects = []
        this.lastIntersected = null
        this.autoSpin = false
        this.placingImage = false
        this.placingText = false
        this.textToPlace = null
        this.imageToPlace = null
        this.ptRenderer = null
        this.fsQuad = null
        this.sceneInfo = null
        this.generator = null
        this.dirLight = null
        this.envMapGenerator
        this.thirdGroup = new THREE.Group()
        this.secondGroup = new THREE.Group()
        this.speedX = 0
        this.speedY = 0

    }
    init() {
        this.initScene()
        return this
    }
    initScene() {
        this.mouse = { x: 0, y: 0 }
        this.camera.position.z = 50
        // this.scene.background = new THREE.Color('#202020')
        this.controls.enableDamping = false
        this.controls.dampingFactor = 0.1
        if (window.innerWidth >= 1000) {
            this.controls.enableRotate = false

        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.renderer.domElement.id = 'three'
        var container = document.getElementsByClassName('container')[0]
        container.appendChild(this.renderer.domElement);
        this.renderer.autoClear = false

        this.ptRenderer = new PathTracingRenderer(this.renderer);
        this.ptRenderer.setSize(window.innerWidth, window.innerHeight);
        this.ptRenderer.alpha = true;
        // set camera
        this.ptRenderer.camera = this.camera;
        this.ptRenderer.material = new PhysicalPathTracingMaterial();
        this.ptRenderer.tiles.set(params.tiles, params.tiles);
        // this.ptRenderer.material.setDefine('FEATURE_GRADIENT_BG', 1);
        this.ptRenderer.material.setDefine('TRANSPARENT_TRAVERSALS', params.transparentTraversals);
        this.ptRenderer.material.setDefine('FEATURE_MIS', Number(params.multipleImportanceSampling));
        // this.ptRenderer.material.bgGradientTop.set(params.bgGradientTop);
        // this.ptRenderer.material.bgGradientBottom.set(params.bgGradientBottom);
        this.samplesEl = document.getElementById('samples');


        this.envMapGenerator = new BlurredEnvMapGenerator(this.renderer);

        window.addEventListener('mousemove', (event) => {
            this.onMouseMove(event)
        })
        // touch move
        this.renderer.domElement.addEventListener('touchmove', (event) => {
            this.onTouchMove(event)
        })
        // touch start
        window.addEventListener('touchstart', (event) => {
            this.onTouchStart(event)
        })
        // touch end
        window.addEventListener('touchend', (event) => {
            this.onTouchEnd(event)
        })
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            this.onMouseDown(event)
        })
        window.addEventListener('mouseup', (event) => {
            this.onMouseUp(event)
        })
        // Resize
        window.addEventListener('resize', (e) => {
            this.onResize()
        })

        this.addLights()
        this.initGUI()
        this.animate()
        
        // document.getElementById("gui").children[1].children[1].style.display="none"
        // document.getElementById("gui").children[1].children[3].style.display="none"
        // document.getElementById("gui").children[1].children[4].style.display="none"
        // document.getElementById("gui").children[1].children[5].style.display="none"
        // document.getElementById("gui").children[1].children[6].style.display="none"


    }
    initGUI() {
        this.gui.domElement.id = 'gui'
        var container = document.getElementsByClassName('container')[0]
        container.appendChild(this.gui.domElement);
        const globalFolder = this.gui.addFolder('Global')
        const objectFolder = this.gui.addFolder('Object')
        this.materialFolder = this.gui.addFolder('Material')
        this.scene.background = new THREE.Color('#202020')
        globalFolder.addColor(this.params, 'color').onChange(() => {
            this.onBackgroundColorChange()
        }).name('Background Color')

        this.gui.add(this, 'autoSpin').name('Auto Spin')


        objectFolder.add(this.params, 'url').name('OBJ URL:').onFinishChange(() => {
            this.loadOBJ(this.params.url)
        })
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        input.addEventListener('change', (e) => {   

            console.log(e.target.files);
            const files = Array.from(e.target.files)

            const objFile = files.filter(file => file.name.includes('.obj'))[0]
            const mtlFile = files.filter(file => file.name.includes('.mtl'))[0]

            console.log(mtlFile, objFile);


            this.loadOBJ(URL.createObjectURL(objFile), URL.createObjectURL(mtlFile))
        })
        
            var obj = {
                'Load OBJ': () => {
                    input.click()
                }

            }
            objectFolder.add(obj, 'Load OBJ').name('Load OBJ & MTL')

        this.loadOBJ(this.params.url)

        this.gui.add(this.controls, 'enableZoom').name('Enable Zoom');

        const objLoad = {
            'Load Session': () => {
                this.loadSession()
            }
        }
        globalFolder.add(objLoad, 'Load Session').name('Load Session');

            const objSave = {
                'Save Session': () => {
                    this.saveSession()
                }
            }
            globalFolder.add(objSave, 'Save Session').name('Save Session');

            this.gui.add(params, 'resolutionScale').min(0.1).max(2).step(0.1).name('Resolution Scale').onChange(() => {
                this.onResize()
            }
            )


    }
    saveSession() {
        var object = {}
        // for (var i = 0 ; i < gl.object.children.length ; i++) {
        //     object[i] = {
        //         geometry: gl.object.children[i].geometry.toJSON(),
        //     }
            
        //     var material = gl.object.children[i].material
        //     if (Array.isArray(material)) {
        //         object[i].material = []
        //         for (var j = 0 ; j < material.length ; j++) {
        //             object[i].material.push(material[j].toJSON())
        //         }
        //     } else {
        //         object[i].material = material.toJSON()
        //     }
        //     console.log(object);
        // }

        object = gl.object.toJSON()

        var imagesObject = {}
        for (var i = 0 ; i < this.interface.images.length; i++) {
            imagesObject[i] = {}
            console.log(this.interface.images[i]);
            for (var j = 0 ; j < this.interface.images[i].length; j++) {
                var imageObjCopy = Object.assign({}, this.interface.images[i][j])
                // to data URL
                imageObjCopy.image =    imageObjCopy.image.src
                imagesObject[i][j] = JSON.stringify(imageObjCopy)
            }

        }

        var textObject = {}

        for (var i = 0 ; i < this.interface.texts.length; i++) {
            textObject[i] = {}

            for (var j = 0 ; j < this.interface.texts[i].length; j++) {
                var textObjCopy = Object.assign({}, this.interface.texts[i][j])
                textObject[i][j] = JSON.stringify(textObjCopy)
            }

        }

        var imagesAndText = 'text:' + JSON.stringify(textObject) + 'images:' + JSON.stringify(imagesObject)

        var string = JSON.stringify(object) + 'canvases:' + imagesAndText

        console.log(imagesObject);

        // download JSON
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(string);
        var dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "session.json");
        dlAnchorElem.click();

    }
    loadSession() {
        var input = document.createElement('input')
        input.type = 'file'
        input.addEventListener('change', (e) => {
            var file = e.target.files[0]
            const reader = new FileReader()
            reader.onload = (event) => {
                const firstPart = event.target.result.split('canvases:')[0]
                var imagesAndText = event.target.result.split('canvases:')[1]
                const jsonLoader = new THREE.ObjectLoader();
                jsonLoader.parse(
                    // from blob to string,
                    JSON.parse(firstPart),
                    // onLoad callback
                    // Here the loaded data is assumed to be an object
                    ( obj ) => {
                        // Add the loaded object to the scene
                       this.loadObject(obj, imagesAndText )
                    }
                );
            }
            reader.readAsText(file)
           
        })
        input.click()
        
    }
    addLights() {
        const lightsFolder = this.gui.addFolder('Lights')

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1, 0);
        this.dirLight.position.set(0, 200, -43);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.bias = -0.03;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        // near and far very far
        var side = 1000
        this.dirLight.shadow.camera.top = side;
        this.dirLight.shadow.camera.bottom = -side;
        this.dirLight.shadow.camera.left = side;
        this.dirLight.shadow.camera.right = -side;

        this.thirdGroup.add(this.dirLight.target)

        // add intensity to global folder
        lightsFolder.add(this.dirLight, 'intensity', 0, 2, 0.01).name('Light Intensity')
        lightsFolder.add(this.dirLight.position, 'x', -100, 100, 1).name('Light X')
        lightsFolder.add(this.dirLight.position, 'y', -100, 200, 1).name('Light Y')
        lightsFolder.add(this.dirLight.position, 'z', -100, 100, 1).name('Light Z')

        // add light target to gui
        const targetFolder = lightsFolder.addFolder('Light Target')
        targetFolder.add(this.dirLight.target.position, 'x', -100, 100, 1).name('Target X')
        targetFolder.add(this.dirLight.target.position, 'y', -100, 100, 1).name('Target Y')
        targetFolder.add(this.dirLight.target.position, 'z', -100, 100, 1).name('Target Z')




        //set bias to -0.001
        this.thirdGroup.add(this.dirLight);


        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.thirdGroup.add(ambientLight);

        // add ambient light to gui
        lightsFolder.add(ambientLight, 'intensity', 0, 2, 0.01).name('Ambient Light Intensity')
    }
    loadObject(object, imagesAndText) {
        var imagesString = imagesAndText.split('images:')[1]
        var textString = imagesAndText.split('images:')[0].split('text:')[1]

        var imagesObject = JSON.parse(imagesString)
        var textObject = JSON.parse(textString)

        var texts = [], images = []

        var _this = this
        _this.children = []
        _this.materialFolder.destroy()
        _this.materialFolder = _this.gui.addFolder('Material')
        if (_this.object.parent) {
            // _this.object.parent.parent.removeFromParent()
      
            console.log(_this.thirdGroup.children.length);

        }
        _this.object = object
        var canvases = {
            text: [],
            image: []
        }
        for (var i = 0; i < _this.object.children.length; i++) {

            texts.push([])
            images.push([])
            var child = _this.object.children[i]
            _this.children.push(child)
            if (child.isMesh) {
                // to non indexed
                var currentImageObject = imagesObject[i]
                var currentTextObject = textObject[i]

                for (var k = 0 ; k < Object.entries(currentImageObject).length; k++) {
                    var imageObj = JSON.parse(Object.entries(currentImageObject)[k][1])
                    var image = new Image()
                    image.src = imageObj.image
                    image.name = i
                    image.onload = function() {
                        imageObj.image = image
                        _this.interface.images[image.name].push(imageObj)
                        // draw on canvas
                        _this.interface.ctx = _this.interface.canvases.image[image.name].getContext('2d')
                        _this.interface.draw(_this.interface.canvases.image[image.name].getContext('2d'), image.name)
                    }
                    }
                    for (var k = 0 ; k < Object.entries(currentTextObject).length; k++) {
                        var textObj = JSON.parse(Object.entries(currentTextObject)[k][1])
                        texts[i].push(textObj)
                        // draw on canvas
                        // _this.interface.ctx = _this.interface.canvases.text[textObj.name].getContext('2d')
                        // _this.interface.draw(_this.interface.canvases.text[textObj.name].getContext('2d'), textObj.name)
                    }
                var canvasTxt, canvasTxt2
                for (var j = 0; j < 2; j++) {
                    var canvas = document.createElement('canvas')

                    canvas.width = 180 * canvasResolution
                    canvas.height = 180 * canvasResolution
                    // change to 0
                    canvas.id = i.toString()
                    canvas.className = 'drawCanvas'
                    canvas.style.transformOrigin = 'left top'
                    canvas.style.transform = 'scale(' + 1 / canvasResolution + ')'
                    if (j == 0) {
                        canvases.image.push(canvas)
                        canvasTxt2 = new THREE.CanvasTexture(canvas)

                    } else {
                        canvases.text.push(canvas)
                        canvasTxt = new THREE.CanvasTexture(canvas)

                    }
                }

                canvasTxt.needsUpdate = true
                applyMapSettings(canvasTxt)

                canvasTxt2.needsUpdate = true
                applyMapSettings(canvasTxt2)
                _this.canvasTextures.push(canvasTxt, canvasTxt2)

                let geometry = child.geometry;

                geometry.clearGroups();

                geometry.addGroup(0, Infinity, 0); // z index 0
                geometry.addGroup(0, Infinity, 1); // z index 1
                geometry.addGroup(0, Infinity, 2); // z index 2
                geometry.addGroup(0, Infinity, 3); // z index 2
                var currentMat = child.material[0]
                const childStandardMaterial = new THREE.MeshPhysicalMaterial({
                    transparent: currentMat.transparent,
                    // alphaTest: 0.5,
                    emissive: currentMat.emissive,
                    emissiveIntensity: currentMat.emissiveIntensity,
                    normalMap: currentMat.normalMap,
                    normalScale: currentMat.normalScale,
                    specularColor: 0xffffff, specularIntensity: 1, color: currentMat.color, map: currentMat.map, roughness: 1 - currentMat.shininess / 100, reflectivity: currentMat.reflectivity, opacity: currentMat.opacity,
                    color: currentMat.color,
                    metalness: currentMat.metalness,   
                    roughness: currentMat.roughness,
                    envMap: currentMat.envMap,
                    envMapIntensity: currentMat.envMapIntensity,
                    ior: currentMat.ior,
                    reflectivity: currentMat.reflectivity,
                    
                    clearcoat: currentMat.clearcoat,
                    clearcoatRoughness: currentMat.clearcoatRoughness,
                    transmission: currentMat.transmission,
                    
                })


                var clonePhysical = new THREE.MeshPhysicalMaterial().copy(childStandardMaterial)
                clonePhysical.map = null
                clonePhysical.alphaTest = 0.5
                const childMapMaterial = new THREE.MeshPhysicalMaterial().copy(clonePhysical)
                childMapMaterial.alphaTest = 0.5
                // childMapMaterial.transparent = true
                childMapMaterial.opacity = 0

                const canvasMaterial = new THREE.MeshPhysicalMaterial().copy(clonePhysical)
                const canvasMaterial2 = new THREE.MeshPhysicalMaterial().copy(clonePhysical)
                // canvasMaterial.map = child.material[2].map
                // canvasMaterial2.map = child.material[3].map
                canvasMaterial.color = new THREE.Color(0xffffff)
                canvasMaterial2.color = new THREE.Color(0xffffff)
                _this.colorMaterial = new THREE.MeshPhysicalMaterial().copy(clonePhysical)


                child.material = [childStandardMaterial, childMapMaterial, canvasMaterial2, canvasMaterial,]

                const currentFolder = _this.materialFolder.addFolder(child.name)
                const changedChild = _this.object.children.find(child => child.name == currentFolder.$title.textContent)


                currentFolder.add(child.material[0], 'metalness', 0, 1, 0.01).name('Metalness').onChange(function () {
                    changedChild.material[1].metalness = changedChild.material[0].metalness
                    changedChild.material[2].metalness = changedChild.material[0].metalness
                    changedChild.material[3].metalness = changedChild.material[0].metalness
                })

                // add transparency toggle
                currentFolder.add(child.material[1], 'transparent').name('Transparent').onChange(function (e) {
                    changedChild.material[0].transparent = e
                    changedChild.material[2].transparent = e
                    changedChild.material[3].transparent = e

                    if (e == true) {
                        //alphatest  0
                        changedChild.material[1].alphaTest = 0
                        changedChild.material[0].alphaTest = 0

                        changedChild.material[2].alphaTest = 0
                        changedChild.material[3].alphaTest = 0

                    } else {
                        changedChild.material[1].alphaTest = 0.5
                        changedChild.material[0].alphaTest = 0.5
                        changedChild.material[2].alphaTest = 0.5
                        changedChild.material[3].alphaTest = 0.5
                    }
                    // needs update
                    changedChild.material[0].needsUpdate = true
                    changedChild.material[1].needsUpdate = true
                    changedChild.material[2].needsUpdate = true
                    changedChild.material[3].needsUpdate = true
                })


                currentFolder.add(child.material[0], 'roughness', 0, 1, 0.01).name('Roughness').onChange(function () {

                    changedChild.material[1].roughness = changedChild.material[0].roughness
                    changedChild.material[2].roughness = changedChild.material[0].roughness
                    changedChild.material[3].roughness = changedChild.material[0].roughness

                })
                currentFolder.add(child.material[0], 'opacity', 0, 1, 0.01).name('Opacity').onChange(function () {

                    if (changedChild.material[1].map != undefined || changedChild.material[1].opacity != 0) {
                        changedChild.material[1].opacity = changedChild.material[0].opacity
                    }

                    // changedChild.material[2].opacity = changedChild.material[0].opacity
                    // changedChild.material[3].opacity = changedChild.material[0].opacity

                })
                currentFolder.add(child.material[0], 'reflectivity', 0, 1, 0.01).name('Reflectivity').onChange(function () {


                    changedChild.material[1].reflectivity = changedChild.material[0].reflectivity
                    changedChild.material[2].reflectivity = changedChild.material[0].reflectivity
                    changedChild.material[3].reflectivity = changedChild.material[0].reflectivity

                })
                currentFolder.add(child.material[0], 'ior', 1.0, 2.333, 0.01).name('Refraction').onChange(function () {

                    changedChild.material[1].ior = changedChild.material[0].ior
                    changedChild.material[2].ior = changedChild.material[0].ior
                    changedChild.material[3].ior = changedChild.material[0].ior

                })

                currentFolder.add(child.material[0], 'transmission', 0.0, 1.0, 0.01).name('Transmission').onChange(function () {
                    changedChild.material[1].transmission = changedChild.material[0].transmission
                    // changedChild.material[2].transmission = changedChild.material[0].transmission
                    // changedChild.material[3].transmission = changedChild.material[0].transmission

                })

                currentFolder.add(child.material[0], 'thickness', 0, 10, 0.01).name('Thickness').onChange(function () {
                    changedChild.material[1].thickness = changedChild.material[0].thickness
                    changedChild.material[2].thickness = changedChild.material[0].thickness
                    changedChild.material[3].thickness = changedChild.material[0].thickness

                })


                currentFolder.add(child.material[0], 'clearcoat', 0, 1, 0.01).name('ClearCoat').onChange(function () {
                    changedChild.material[1].clearcoat = changedChild.material[0].clearcoat
                    changedChild.material[2].clearcoat = changedChild.material[0].clearcoat
                    changedChild.material[3].clearcoat = changedChild.material[0].clearcoat

                })

                currentFolder.add(child.material[0], 'clearcoatRoughness', 0, 1, 0.01).name('ClearCoat Roughness').onChange(function () {
                    changedChild.material[1].clearcoatRoughness = changedChild.material[0].clearcoatRoughness
                    changedChild.material[2].clearcoatRoughness = changedChild.material[0].clearcoatRoughness
                    changedChild.material[3].clearcoatRoughness = changedChild.material[0].clearcoatRoughness

                })



                const obj = {
                    url: 'objects/dove/texture5.jpg',
                    normalMap: 'objects/sofa2/sofa2.png',
                    metalnessMap: 'objects/sofa2/sofa2.png',
                    roughnessMap: 'objects/sofa2/sofa2.png',
                    specularMap: 'objects/sofa2/sofa2.png',
                    environmentMap: 'img/grid.jpg',
                    aoMap: 'img/grid.jpg',

                }
                currentFolder.add(obj, 'url').name('MATERIAL URL:').onFinishChange(function () {
                    const map = new THREE.TextureLoader().load(obj.url)
                    applyMapSettings(map)
                    changedChild.material[1].map = map
                    changedChild.material[1].needsUpdate = true
                    changedChild.material[1].opacity = 1
                    _this.resetRenderer()
                })
                currentFolder.add(obj, 'normalMap').name('Normal URL:').onFinishChange(function () {
                    const map = new THREE.TextureLoader().load(obj.normalMap)
                    applyMapSettings(map)
                    changedChild.material[1].normalMap = map
                    changedChild.material[1].normalScale = new THREE.Vector2(1.0, 1.0)
                    changedChild.material[1].needsUpdate = true
                })
                currentFolder.add(obj, 'metalnessMap').name('Metalness URL:').onFinishChange(function () {
                    const map = new THREE.TextureLoader().load(obj.metalnessMap)
                    applyMapSettings(map)
                    changedChild.material[1].metalnessMap = map
                    changedChild.material[1].needsUpdate = true
                })
                currentFolder.add(obj, 'roughnessMap').name('Roughness URL:').onFinishChange(function () {
                    const map = new THREE.TextureLoader().load(obj.roughnessMap)
                    applyMapSettings(map)
                    changedChild.material[1].roughnessMap = map
                    changedChild.material[1].needsUpdate = true
                })
                currentFolder.add(obj, 'specularMap').name('Specular URL:').onFinishChange(function () {
                    const map = new THREE.TextureLoader().load(obj.specularMap)
                    applyMapSettings(map)
                    changedChild.material[1].specularColorMap = map

                    changedChild.material[1].needsUpdate = true

                    changedChild.material[2].specularColorMap = map
                    changedChild.material[2].needsUpdate = true

                    changedChild.material[3].specularColorMap = map
                    changedChild.material[3].needsUpdate = true



                })

                currentFolder.add(obj, 'environmentMap').name('Environment URL:').onFinishChange(function () {
                    new THREE.TextureLoader().load(obj.environmentMap, (map) => {
                        // _this.scene.background = map
                        applyMapSettings(map)
                        map.mapping = THREE.EquirectangularReflectionMapping
                        var pmrem = new THREE.PMREMGenerator(_this.renderer)
                        pmrem.compileEquirectangularShader()
                        console.log(map);
                        var envMap = pmrem.fromEquirectangular(map).texture
                        changedChild.material[1].envMap = envMap
                        changedChild.material[1].needsUpdate = true
                        changedChild.material[0].envMap = envMap
                        changedChild.material[0].needsUpdate = true
                        changedChild.material[2].envMap = envMap
                        changedChild.material[2].needsUpdate = true
                        changedChild.material[3].envMap = envMap
                        changedChild.material[3].needsUpdate = true

                    })

                })

                // add envmapintensity
                currentFolder.add(changedChild.material[0], 'envMapIntensity', 0, 10, 0.01).name('EnvMap Intensity').onChange(function () {
                    changedChild.material[1].envMapIntensity = changedChild.material[0].envMapIntensity
                    changedChild.material[2].envMapIntensity = changedChild.material[0].envMapIntensity
                    changedChild.material[3].envMapIntensity = changedChild.material[0].envMapIntensity

                })


                currentFolder.add(obj, 'aoMap').name('AO URL:').onFinishChange(function () {
                    const map = new THREE.TextureLoader().load(obj.aoMap)
                    applyMapSettings(map)
                    changedChild.geometry.attributes.uv2 = changedChild.geometry.attributes.uv

                    for (var k = 0; k < changedChild.material.length; k++) {
                        console.log(changedChild.material[k], map);
                        changedChild.material[k].aoMap = map
                        changedChild.material[k].aoMapIntensity = 1
                        changedChild.material[k].needsUpdate = true

                    }
                    console.log(changedChild.geometry.attributes);

                })



                currentFolder.add(child.material[0], 'specularIntensity', 0, 1, 0.01).name('Specular Intensity').onChange(function () {
                    changedChild.material[1].specularIntensity = changedChild.material[0].specularIntensity
                    changedChild.material[2].specularIntensity = changedChild.material[0].specularIntensity
                    changedChild.material[3].specularIntensity = changedChild.material[0].specularIntensity

                })
                currentFolder.addColor(child.material[0], 'specularColor').name('Specular Color').onChange(function () {
                    changedChild.material[1].specularColor = changedChild.material[0].specularColor
                    changedChild.material[2].specularColor = changedChild.material[0].specularColor
                    changedChild.material[3].specularColor = changedChild.material[0].specularColor

                })

                currentFolder.close()

                child.castShadow = true
                child.receiveShadow = true
                console.log(child.material);
            }


        }

        var centerGroup = new THREE.Group()
        if (window.innerWidth < 1000) {
            // move object 1/3 screen up on y
        }
        var box3 = new THREE.Box3().setFromObject(_this.object)
        var center = new THREE.Vector3()
        box3.getCenter(center)
        _this.object.lookAt(_this.camera.position)

        // _this.scene.add(object)
        centerGroup.add(_this.object)
        centerGroup.position.x = -center.x
        centerGroup.position.y = -center.y
        centerGroup.position.z = -center.z
        // set camera z as far as needed
        _this.camera.position.z = box3.getSize(new THREE.Vector3()).length() * 2
        this.secondGroup.children[0].removeFromParent()
        this.secondGroup.add(centerGroup)

        // _this.thirdGroup.add(this.secondGroup)
        console.log(_this.thirdGroup.children);

        // _this.scene.add(_this.thirdGroup)
        _this.interface = new Interface({
            children: _this.object.children,
            gl: _this,
            canvases: canvases
        }).create(texts,images)
        // mtlLoader.setPath('objects/Tests/Test-2/')
        // mtlLoader.load('scene.mtl', (materials) => {
        //     loader.setMaterials(materials)
        //     loader.setPath('objects/Tests/Test-2/')
        //     loader.load('scene.obj', (object) => {
        //         object.traverse((child) => {
        //             if (child.isMesh) {
        //                 // console.log(child.material);
        //                 child.material = materials.materials[child.material.name]
        //             }
        //         })
        //         // console.log(object);
        //         object.position.z = 3333.8
        //         object.position.x = -666
        //         object.position.y = -280
        //         object.scale.set(130, 130, 130)
        //         _this.gui.add(object.position, 'x', -5100, 5100, 0.01).name('X')
        //         _this.gui.add(object.position, 'y', -555, 555, 0.01).name('Y')
        //         _this.gui.add(object.position, 'z', -5010, 5010, 0.01).name('Z')
        //         centerGroup.add(object)
        //     })
        // })

        // create plane behind
        // new THREE.TextureLoader().load('objects/Tests/Test-11/Autumn.png', async function (img) {
        //     var background = img
        //     var aspectRatio = background.image.width / background.image.height
        //     var planeGeometry = new THREE.PlaneGeometry(800 * aspectRatio, 800, 100, 100)

        //     applyMapSettings(background)
        //     var planeMaterial = new THREE.MeshBasicMaterial({
        //         side: THREE.DoubleSide,
        //         map: background,
        //         transparent: false


        //     })
        //     var plane = new THREE.Mesh(planeGeometry, planeMaterial)
        //     plane.position.z = -200
        //     plane.position.y = 50
        //     plane.position.x = 30
        //     // plane.rotation.x = Math.PI / 2
        //     plane.receiveShadow = true
        //     plane.castShadow = false

        //     _this.thirdGroup.add(plane)


        //     const shadowMaterial = new THREE.ShadowMaterial({
        //         side: THREE.DoubleSide,
        //         opacity: 0.5,
        //     })
        //     shadowMaterial.name = 'shadow'
        //     const ground = new THREE.Mesh(planeGeometry, shadowMaterial)
        //     ground.position.y = -143
        //     ground.receiveShadow = true
        //     ground.castShadow = true
        //     _this.gui.add(ground.position, 'x', -5100, 5100, 0.01).name('X')
        //     _this.gui.add(ground.position, 'y', -555, 555, 0.01).name('Y')
        //     _this.gui.add(ground.position, 'z', -5010, 5010, 0.01).name('Z')
        //     ground.rotateX(Math.PI / 2)
        //     _this.thirdGroup.add(ground)

        //     _this.gui.add(_this.controls, 'enableRotate')




        //     _this.scene.updateMatrixWorld();

        //     // _this.startRealRender()
        //     const render_button = document.getElementById('render-button')
        //     // render_button.addEventListener('click', () => {
        //     //     console.log('clicked once');
        //     //     _this.startRealRender()
        //     // }
        //     // )


        // })
    }
    async loadOBJ(url, mtlUrl, objekt) {
        var isObject = objekt ?? false
        console.log(name);
        var _this = this
        this.camera.position.x = 0
        this.camera.position.y = 0


        if (this.interface) {
            //delete canvases
            this.interface.canvases.image.forEach(canvas => {
                canvas.parentElement.remove()
            })
            this.interface.canvases.text.forEach(canvas => {
                canvas.parentElement.remove()
            })
            this.interface.colorPickers.forEach(colorPicker => {
                colorPicker.remove()
            })

            this.interface.canvases.image = []
            this.interface.canvases.text = []
            this.interface.images = []
            this.interface.texts = []
            this.interface.canvases = { text: [], image: [] }
            this.interface = null

        }
        var loader = new OBJLoader();
        var mtlLoader = new MTLLoader();
        const path =  url;
        if (mtlUrl == undefined) {
            mtlLoader.setPath(path.split('/').slice(0, -1).join('/') + '/');

        }

        mtlLoader.load(mtlUrl != undefined ? mtlUrl : (path.split('/')[path.split('/').length - 1].split('.')[0] + '.mtl'), (mats) => {

            mats.preload();

            loader.setMaterials(mats);
            loader.load(url, async function (object) {
                _this.children = []
                _this.materialFolder.destroy()
                _this.materialFolder = _this.gui.addFolder('Material')
                if (_this.object.parent) {
                    console.log(_this.object.parent.parent);
                    _this.object.parent.parent.removeFromParent()
                }
                _this.object = object
                var canvases = {
                    text: [],
                    image: []
                }
                for (var i = 0; i < _this.object.children.length; i++) {
                    var child = _this.object.children[i]
                    _this.children.push(child)
                    if (child.isMesh) {
                        // to non indexed

                        var canvasTxt, canvasTxt2
                        for (var j = 0; j < 2; j++) {
                            var canvas = document.createElement('canvas')

                            canvas.width = 1
                            canvas.height = 1
                            // change to 0
                            canvas.id = i.toString()
                            canvas.className = 'drawCanvas'
                            canvas.style.transformOrigin = 'left top'
                            canvas.style.transform = 'scale(' + 1 / canvasResolution + ')'
                            if (j == 0) {
                                canvases.image.push(canvas)
                                canvasTxt2 = new THREE.CanvasTexture(canvas)

                            } else {
                                canvases.text.push(canvas)
                                canvasTxt = new THREE.CanvasTexture(canvas)

                            }
                        }

                        canvasTxt.needsUpdate = true
                        applyMapSettings(canvasTxt)

                        canvasTxt2.needsUpdate = true
                        applyMapSettings(canvasTxt2)
                        _this.canvasTextures.push(canvasTxt, canvasTxt2)

                        let geometry = child.geometry;

                        geometry.clearGroups();

                        geometry.addGroup(0, Infinity, 0); // z index 0
                        geometry.addGroup(0, Infinity, 1); // z index 1
                        geometry.addGroup(0, Infinity, 2); // z index 2
                        geometry.addGroup(0, Infinity, 3); // z index 2


                        var currentMat = (mats.materials[child.material.name]) 
                        const childStandardMaterial = new THREE.MeshPhysicalMaterial({
                            transparent: false,
                            // alphaTest: 0.5,
                            emissive: currentMat.emissive,
                            emissiveIntensity: currentMat.emissiveIntensity,
                            normalMap: currentMat.normalMap,
                            normalScale: currentMat.normalScale,
                            specularColor: 0xffffff, specularIntensity: 1, color: currentMat.color, map: currentMat.map, roughness: 1 - currentMat.shininess / 100, reflectivity: currentMat.reflectivity, opacity: currentMat.opacity,
                            color: 0xffffff,
                        })


                        var clonePhysical = new THREE.MeshPhysicalMaterial().copy(childStandardMaterial)
                        clonePhysical.map = null
                        clonePhysical.alphaTest = 0.5
                        const childMapMaterial = new THREE.MeshPhysicalMaterial().copy(clonePhysical)
                        childMapMaterial.alphaTest = 0.5
                        // childMapMaterial.transparent = true
                        childMapMaterial.opacity = 0

                        const canvasMaterial = new THREE.MeshPhysicalMaterial().copy(clonePhysical)
                        const canvasMaterial2 = new THREE.MeshPhysicalMaterial().copy(clonePhysical)
                        canvasMaterial.color = new THREE.Color(0xffffff)
                        canvasMaterial2.color = new THREE.Color(0xffffff)
                        _this.colorMaterial = new THREE.MeshPhysicalMaterial().copy(clonePhysical)


                        child.material = [childStandardMaterial, childMapMaterial, canvasMaterial2, canvasMaterial,]

                        const currentFolder = _this.materialFolder.addFolder(child.name)
                        const changedChild = _this.object.children.find(child => child.name == currentFolder.$title.textContent)


                        currentFolder.add(child.material[0], 'metalness', 0, 1, 0.01).name('Metalness').onChange(function () {
                            changedChild.material[1].metalness = changedChild.material[0].metalness
                            changedChild.material[2].metalness = changedChild.material[0].metalness
                            changedChild.material[3].metalness = changedChild.material[0].metalness
                        })

                        // add transparency toggle
                        currentFolder.add(child.material[1], 'transparent').name('Transparent').onChange(function (e) {
                            changedChild.material[0].transparent = e
                            changedChild.material[2].transparent = e
                            changedChild.material[3].transparent = e

                            if (e == true) {
                                //alphatest  0
                                changedChild.material[1].alphaTest = 0
                                changedChild.material[0].alphaTest = 0

                                changedChild.material[2].alphaTest = 0
                                changedChild.material[3].alphaTest = 0

                            } else {
                                changedChild.material[1].alphaTest = 0.5
                                changedChild.material[0].alphaTest = 0.5
                                changedChild.material[2].alphaTest = 0.5
                                changedChild.material[3].alphaTest = 0.5
                            }
                            // needs update
                            changedChild.material[0].needsUpdate = true
                            changedChild.material[1].needsUpdate = true
                            changedChild.material[2].needsUpdate = true
                            changedChild.material[3].needsUpdate = true
                        })


                        currentFolder.add(child.material[0], 'roughness', 0, 1, 0.01).name('Roughness').onChange(function () {

                            changedChild.material[1].roughness = changedChild.material[0].roughness
                            changedChild.material[2].roughness = changedChild.material[0].roughness
                            changedChild.material[3].roughness = changedChild.material[0].roughness

                        })
                        currentFolder.add(child.material[0], 'opacity', 0, 1, 0.01).name('Opacity').onChange(function () {

                            if (changedChild.material[1].map != undefined || changedChild.material[1].opacity != 0) {
                                changedChild.material[1].opacity = changedChild.material[0].opacity
                            }

                            // changedChild.material[2].opacity = changedChild.material[0].opacity
                            // changedChild.material[3].opacity = changedChild.material[0].opacity

                        })
                        currentFolder.add(child.material[0], 'reflectivity', 0, 1, 0.01).name('Reflectivity').onChange(function () {


                            changedChild.material[1].reflectivity = changedChild.material[0].reflectivity
                            changedChild.material[2].reflectivity = changedChild.material[0].reflectivity
                            changedChild.material[3].reflectivity = changedChild.material[0].reflectivity

                        })
                        currentFolder.add(child.material[0], 'ior', 1.0, 2.333, 0.01).name('Refraction').onChange(function () {

                            changedChild.material[1].ior = changedChild.material[0].ior
                            changedChild.material[2].ior = changedChild.material[0].ior
                            changedChild.material[3].ior = changedChild.material[0].ior

                        })

                        currentFolder.add(child.material[0], 'transmission', 0.0, 1.0, 0.01).name('Transmission').onChange(function () {
                            changedChild.material[1].transmission = changedChild.material[0].transmission
                            // changedChild.material[2].transmission = changedChild.material[0].transmission
                            // changedChild.material[3].transmission = changedChild.material[0].transmission

                        })

                        currentFolder.add(child.material[0], 'thickness', 0, 10, 0.01).name('Thickness').onChange(function () {
                            changedChild.material[1].thickness = changedChild.material[0].thickness
                            changedChild.material[2].thickness = changedChild.material[0].thickness
                            changedChild.material[3].thickness = changedChild.material[0].thickness

                        })


                        currentFolder.add(child.material[0], 'clearcoat', 0, 1, 0.01).name('ClearCoat').onChange(function () {
                            changedChild.material[1].clearcoat = changedChild.material[0].clearcoat
                            changedChild.material[2].clearcoat = changedChild.material[0].clearcoat
                            changedChild.material[3].clearcoat = changedChild.material[0].clearcoat

                        })

                        currentFolder.add(child.material[0], 'clearcoatRoughness', 0, 1, 0.01).name('ClearCoat Roughness').onChange(function () {
                            changedChild.material[1].clearcoatRoughness = changedChild.material[0].clearcoatRoughness
                            changedChild.material[2].clearcoatRoughness = changedChild.material[0].clearcoatRoughness
                            changedChild.material[3].clearcoatRoughness = changedChild.material[0].clearcoatRoughness

                        })



                        const obj = {
                            url: 'objects/dove/texture5.jpg',
                            normalMap: 'objects/sofa2/sofa2.png',
                            metalnessMap: 'objects/sofa2/sofa2.png',
                            roughnessMap: 'objects/sofa2/sofa2.png',
                            specularMap: 'objects/sofa2/sofa2.png',
                            environmentMap: 'img/grid.jpg',
                            aoMap: 'img/grid.jpg',

                        }
                        currentFolder.add(obj, 'url').name('MATERIAL URL:').onFinishChange(function () {
                            const map = new THREE.TextureLoader().load(obj.url)
                            applyMapSettings(map)
                            changedChild.material[1].map = map
                            changedChild.material[1].needsUpdate = true
                            changedChild.material[1].opacity = 1
                            _this.resetRenderer()
                        })
                        currentFolder.add(obj, 'normalMap').name('Normal URL:').onFinishChange(function () {
                            const map = new THREE.TextureLoader().load(obj.normalMap)
                            applyMapSettings(map)
                            changedChild.material[1].normalMap = map
                            changedChild.material[1].normalScale = new THREE.Vector2(1.0, 1.0)
                            changedChild.material[1].needsUpdate = true
                        })
                        currentFolder.add(obj, 'metalnessMap').name('Metalness URL:').onFinishChange(function () {
                            const map = new THREE.TextureLoader().load(obj.metalnessMap)
                            applyMapSettings(map)
                            changedChild.material[1].metalnessMap = map
                            changedChild.material[1].needsUpdate = true
                        })
                        currentFolder.add(obj, 'roughnessMap').name('Roughness URL:').onFinishChange(function () {
                            const map = new THREE.TextureLoader().load(obj.roughnessMap)
                            applyMapSettings(map)
                            changedChild.material[1].roughnessMap = map
                            changedChild.material[1].needsUpdate = true
                        })
                        currentFolder.add(obj, 'specularMap').name('Specular URL:').onFinishChange(function () {
                            const map = new THREE.TextureLoader().load(obj.specularMap)
                            applyMapSettings(map)
                            changedChild.material[1].specularColorMap = map

                            changedChild.material[1].needsUpdate = true

                            changedChild.material[2].specularColorMap = map
                            changedChild.material[2].needsUpdate = true

                            changedChild.material[3].specularColorMap = map
                            changedChild.material[3].needsUpdate = true



                        })

                        currentFolder.add(obj, 'environmentMap').name('Environment URL:').onFinishChange(function () {
                            new THREE.TextureLoader().load(obj.environmentMap, (map) => {
                                // _this.scene.background = map
                                applyMapSettings(map)
                                map.mapping = THREE.EquirectangularReflectionMapping
                                var pmrem = new THREE.PMREMGenerator(_this.renderer)
                                pmrem.compileEquirectangularShader()
                                console.log(map);
                                var envMap = pmrem.fromEquirectangular(map).texture
                                changedChild.material[1].envMap = envMap
                                changedChild.material[1].needsUpdate = true
                                changedChild.material[0].envMap = envMap
                                changedChild.material[0].needsUpdate = true
                                changedChild.material[2].envMap = envMap
                                changedChild.material[2].needsUpdate = true
                                changedChild.material[3].envMap = envMap
                                changedChild.material[3].needsUpdate = true

                            })

                        })

                        // add envmapintensity
                        currentFolder.add(changedChild.material[0], 'envMapIntensity', 0, 10, 0.01).name('EnvMap Intensity').onChange(function () {
                            changedChild.material[1].envMapIntensity = changedChild.material[0].envMapIntensity
                            changedChild.material[2].envMapIntensity = changedChild.material[0].envMapIntensity
                            changedChild.material[3].envMapIntensity = changedChild.material[0].envMapIntensity

                        })


                        currentFolder.add(obj, 'aoMap').name('AO URL:').onFinishChange(function () {
                            const map = new THREE.TextureLoader().load(obj.aoMap)
                            applyMapSettings(map)
                            changedChild.geometry.attributes.uv2 = changedChild.geometry.attributes.uv

                            for (var k = 0; k < changedChild.material.length; k++) {
                                console.log(changedChild.material[k], map);
                                changedChild.material[k].aoMap = map
                                changedChild.material[k].aoMapIntensity = 1
                                changedChild.material[k].needsUpdate = true

                            }
                            console.log(changedChild.geometry.attributes);

                        })



                        currentFolder.add(child.material[0], 'specularIntensity', 0, 1, 0.01).name('Specular Intensity').onChange(function () {
                            changedChild.material[1].specularIntensity = changedChild.material[0].specularIntensity
                            changedChild.material[2].specularIntensity = changedChild.material[0].specularIntensity
                            changedChild.material[3].specularIntensity = changedChild.material[0].specularIntensity

                        })
                        currentFolder.addColor(child.material[0], 'specularColor').name('Specular Color').onChange(function () {
                            changedChild.material[1].specularColor = changedChild.material[0].specularColor
                            changedChild.material[2].specularColor = changedChild.material[0].specularColor
                            changedChild.material[3].specularColor = changedChild.material[0].specularColor

                        })

                        currentFolder.close()

                        canvasMaterial.map = canvasTxt
                        canvasMaterial2.map = canvasTxt2
                        child.castShadow = true
                        child.receiveShadow = true

                    }


                }

                var centerGroup = new THREE.Group()
                if (window.innerWidth < 1000) {
                    // move object 1/3 screen up on y
                }
                var box3 = new THREE.Box3().setFromObject(_this.object)
                var center = new THREE.Vector3()
                box3.getCenter(center)
                _this.object.lookAt(_this.camera.position)

                // _this.scene.add(object)
                centerGroup.add(_this.object)
                centerGroup.position.x = -center.x
                centerGroup.position.y = -center.y
                centerGroup.position.z = -center.z
                // set camera z as far as needed
                _this.camera.position.z = box3.getSize(new THREE.Vector3()).length() * 2
                _this.secondGroup.add(centerGroup)
                _this.thirdGroup.add(_this.secondGroup)
                _this.thirdGroup.name = 'thirdGroup'
                console.log(_this.thirdGroup.children);

                _this.scene.add(_this.thirdGroup)
                _this.interface = new Interface({
                    children: _this.object.children,
                    gl: _this,
                    canvases: canvases
                }).create()
                // mtlLoader.setPath('objects/Tests/Test-2/')
                // mtlLoader.load('scene.mtl', (materials) => {
                //     loader.setMaterials(materials)
                //     loader.setPath('objects/Tests/Test-2/')
                //     loader.load('scene.obj', (object) => {
                //         object.traverse((child) => {
                //             if (child.isMesh) {
                //                 // console.log(child.material);
                //                 child.material = materials.materials[child.material.name]
                //             }
                //         })
                //         // console.log(object);
                //         object.position.z = 3333.8
                //         object.position.x = -666
                //         object.position.y = -280
                //         object.scale.set(130, 130, 130)
                //         _this.gui.add(object.position, 'x', -5100, 5100, 0.01).name('X')
                //         _this.gui.add(object.position, 'y', -555, 555, 0.01).name('Y')
                //         _this.gui.add(object.position, 'z', -5010, 5010, 0.01).name('Z')
                //         centerGroup.add(object)
                //     })
                // })

                // create plane behind
                new THREE.TextureLoader().load('objects/Tests/Test-11/Autumn.png', async function (img) {
                    var background = img
                    var aspectRatio = background.image.width / background.image.height
                    var planeGeometry = new THREE.PlaneGeometry(800 * aspectRatio, 800, 100, 100)

                    applyMapSettings(background)
                    var planeMaterial = new THREE.MeshBasicMaterial({
                        side: THREE.DoubleSide,
                        map: background,
                        transparent: false


                    })
                    var plane = new THREE.Mesh(planeGeometry, planeMaterial)
                    plane.position.z = -200
                    plane.position.y = 50
                    plane.position.x = 30
                    // plane.rotation.x = Math.PI / 2
                    plane.receiveShadow = true
                    plane.castShadow = false

                    _this.thirdGroup.add(plane)


                    const shadowMaterial = new THREE.ShadowMaterial({
                        side: THREE.DoubleSide,
                        opacity: 0.5,
                    })
                    shadowMaterial.name = 'shadow'
                    const ground = new THREE.Mesh(planeGeometry, shadowMaterial)
                    ground.position.y = -143
                    ground.receiveShadow = true
                    ground.castShadow = true
                    _this.gui.add(ground.position, 'x', -5100, 5100, 0.01).name('X')
                    _this.gui.add(ground.position, 'y', -555, 555, 0.01).name('Y')
                    _this.gui.add(ground.position, 'z', -5010, 5010, 0.01).name('Z')
                    ground.rotateX(Math.PI / 2)
                    _this.thirdGroup.add(ground)

                    _this.gui.add(_this.controls, 'enableRotate')




                    _this.scene.updateMatrixWorld();

                    // _this.startRealRender()
                    const render_button = document.getElementById('render-button')
                    render_button.addEventListener('click', () => {
                        _this.startRealRender()
                    }
                    )


                })

            })

        })
    }




    async startRealRender() {
        console.log('starting real rendar');

        const iesProfileURLs = [
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/0646706b3d2d9658994fc4ad80681dec.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/06b4cfdc8805709e767b5e2e904be8ad.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/007cfb11e343e2f42e3b476be4ab684e.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/01dac7d6c646814dcda6780e7b7b4566.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/108b32f07d6d38a7a6528a6d307440df.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/1aec5958092c236d005093ca27ebe378.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/02a7562c650498ebb301153dbbf59207.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/1a936937a49c63374e6d4fbed9252b29.ies',
            'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/ies/00c6ce79e1d2cdf3a1fb491aaaa47ae0.ies',
        ];


        // ies textures
        const iesPromises = iesProfileURLs.map(url => {

            return new IESLoader().loadAsync(url);

        });



        var _this = this

        // // duplicate object
        // var objectCopy = new THREE.Object3D()
        // _this.object.parent.add(objectCopy)

        // _this.object.traverse((child) => {
        //     if (child.isMesh) {
        //         var geometry = child.geometry.clone()
    
        //         var mesh = new THREE.Mesh(geometry, child.material)
        //         objectCopy.add(mesh)
        //         geometry.scale(1.11,1.11,1.11)
        //         geometry.center()
        //     }
        // })


console.log(this.object.children.length);

        // clear groups for all children
        // for (var i = 0; i < objectCopy.children.length; i++) {
        //     var materialArray = objectCopy.children[i].material
        //     console.log(materialArray);
        //     objectCopy.children[i].material = new THREE.MeshPhysicalMaterial({
        //     }).copy(materialArray[0])
            
        //     objectCopy.children[i].material.color = new THREE.Color('red')
        //     objectCopy.children[i].material.transparent = false
        //     //objectCopy.children[i].material.transmission = 1
        //     //objectCopy.children[i].material.map = destinationTexture
        //     objectCopy.children[i].material.needsUpdate = true
        //     objectCopy.children[i].needsUpdate = true


        //     objectCopy.children[i].geometry.clearGroups()
        // }

        for (let i = 0; i < this.object.children.length; i++) {
            // here!
            var materialArray = this.object.children[i].material
            console.log(materialArray);
            // const destinationTexture = new THREE.Texture()
            // destinationTexture.image = new Image()
            // destinationTexture.image.width = 1800
            // destinationTexture.image.height = 1800
            // add code to renderer.copyTextureToTexture


            // new THREE.TextureLoader().load('objects/Tests/Test-11/Autumn.png', (destinationTexture) => {
            const destinationCanvas = document.createElement('canvas')
       
            destinationCanvas.width = 180 * canvasResolution
            destinationCanvas.height = 180 * canvasResolution

            const destinationContext = destinationCanvas.getContext('2d')
            const destinationTexture = new THREE.CanvasTexture(destinationCanvas)

            destinationTexture.generateMipmaps = false
            destinationTexture.encoding = THREE.sRGBEncoding


            for (var j = 0; j < materialArray.length; j++) {

                const currentMaterial = materialArray[j]
                if (currentMaterial.map && currentMaterial.map.image.width > 0) {
                    // add to destination canvas
                    destinationContext.drawImage(currentMaterial.map.image, 0, 0)
                } else if (j == 0) {
                    // draw the color
                    destinationContext.fillStyle = currentMaterial.color.getStyle()
                    destinationContext.fillRect(0, 0, destinationCanvas.width, destinationCanvas.height)

                }
            }

            this.object.children[i].material = new THREE.MeshPhysicalMaterial({
            }).copy(materialArray[0])
            this.object.children[i].material.color = new THREE.Color('white')
            this.object.children[i].material.transparent = true
            // this.object.children[i].material.transmission = 1
            this.object.children[i].material.map = destinationTexture
            this.object.children[i].material.needsUpdate = true
            this.object.children[i].needsUpdate = true


            this.object.children[i].geometry.clearGroups()

        }


        _this.renderer.outputEncoding = THREE.sRGBEncoding;
        _this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // initialize the path tracing material and renderer

        _this.ptRenderer.material.setDefine('FEATURE_GRADIENT_BG', 1);
        _this.ptRenderer.tiles.set(params.tilesX, params.tilesY);
        _this.updateCamera()
        _this.updateEnvMap()
        // init quad for rendering to the canvas
        _this.fsQuad = new FullScreenQuad(new THREE.MeshBasicMaterial({
            map: _this.ptRenderer.target.texture,

            blending: THREE.CustomBlending,
            premultipliedAlpha: _this.renderer.getContextAttributes().premultipliedAlpha,
        }));
        console.log('once');

        const light = new THREE.AmbientLight(0xffffff, 1);
        light.position.set(0, 0, 1);
        // _this.thirdGroup.add(light);

        // add pointLight
        const pointLight = new THREE.PointLight(0xffffff, 1, 1000);
        pointLight.position.set(0, 0, 1);
        pointLight.castShadow = true;
        pointLight.shadow.mapSize.width = 1024;
        _this.thirdGroup.add(pointLight);

        const areaLight1 = new PhysicalSpotLight(0xffffff);
        areaLight1.position.set(

            this.dirLight.position.x,
            this.dirLight.position.y,
            this.dirLight.position.z
        );
        var lightsFolder = _this.gui.folders[0];
        lightsFolder.destroy()
        lightsFolder = _this.gui.addFolder('Lights');

        // clear lights folder
        // lightsFolder.children.forEach(controller => {

        //     // remove from gui
        //     lightsFolder.remove();
        // });


        // add intensity to global folder
        lightsFolder.add(areaLight1, 'intensity', 0, 50, 0.01).name('Light Intensity')
        lightsFolder.add(areaLight1.position, 'x', -100, 100, 1).name('Light X')
        lightsFolder.add(areaLight1.position, 'y', -100, 200, 1).name('Light Y')
        lightsFolder.add(areaLight1.position, 'z', -100, 100, 1).name('Light Z')

        // add light target to gui
        const targetFolder = lightsFolder.addFolder('Light Target')
        targetFolder.add(areaLight1.target.position, 'x', -100, 100, 1).name('Target X')
        targetFolder.add(areaLight1.target.position, 'y', -100, 100, 1).name('Target Y')
        targetFolder.add(areaLight1.target.position, 'z', -100, 100, 1).name('Target Z')
        areaLight1.angle = Math.PI / 2;
        areaLight1.decay = 0;
        areaLight1.penumbra = 1.0;
        areaLight1.distance = 0.0;
        areaLight1.intensity = 50.0;
        areaLight1.radius = 0.5;

        areaLight1.shadow.mapSize.width = 512;
        areaLight1.shadow.mapSize.height = 512;
        areaLight1.shadow.camera.near = 0.1;
        areaLight1.shadow.camera.far = 10.0;
        areaLight1.shadow.focus = 1.0;
        areaLight1.castShadow = true;
        _this.thirdGroup.add(areaLight1);

        const targetObject = areaLight1.target;
        targetObject.position.x = 0;
        targetObject.position.y = this.object.position.y + 2;
        targetObject.position.z = 0.05;
        targetObject.updateMatrixWorld();
        areaLight1.updateMatrixWorld();
        this.thirdGroup.add(targetObject);


        var spotLightHelper = new THREE.SpotLightHelper(areaLight1);
        this.thirdGroup.add(spotLightHelper);
        // const reducer = new MaterialReducer()
        // reducer.process(_this.thirdGroup)

        // initialize the scene and update the material properties with the bvh, materials, etc
        this.generator = new DynamicPathTracingSceneGenerator(_this.thirdGroup);
        const result = this.generator.generate(_this.thirdGroup);
        const { bvh, materials, textures } = result;

        Promise.all(iesPromises).then(iesProfiles => {


            _this.sceneInfo = result


            var lights = [areaLight1]
            // _this.sceneInfo.lights = lights
            _this.scene.add(_this.sceneInfo.objects[0])

            const ptMaterial = _this.ptRenderer.material;
            var geometry = bvh.geometry

            // update bvh and geometry attribute textures
            ptMaterial.bvh.updateFrom(bvh);
            ptMaterial.normalAttribute.updateFrom(geometry.attributes.normal);
            ptMaterial.tangentAttribute.updateFrom(geometry.attributes.tangent);
            ptMaterial.uvAttribute.updateFrom(geometry.attributes.uv);
            console.log(geometry.attributes.materialIndex);
            // update materials and texture arrays
            ptMaterial.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
            ptMaterial.textures.setTextures(_this.renderer, 2048, 2048, textures);
            ptMaterial.materials.updateFrom(materials, textures);
            // set lights
            ptMaterial.iesProfiles.updateFrom(_this.renderer, iesProfiles);
            ptMaterial.lights.updateFrom(lights, iesProfiles);
            ptMaterial.lightCount = lights.length
            // const texture = await new RGBELoader().loadAsync(params.envMap);
            // _this.ptRenderer.material.envMapInfo.updateFrom(textures);
            this.updateEnvMap()
            // this.generator.dispose();
            // _this.ptRenderer.alpha = false
            // console.log(_this.ptRenderer);
            _this.renderer.domElement.style.visibility = 'visible';
            if (params.checkerboardTransparency) {

                document.body.classList.add('checkerboard');

            }
            _this.ptRenderer.reset();

        })
        // var canvasTexture = new THREE.CanvasTexture(canvases[0])
        // _this.canvasTextures[1] = canvasTexture
        // _this.object.children[0].material[3].map = canvasTexture
        // _this.object.children[0].material[3].needsUpdate = true

    }
    updateCamera() {
        var activeCamera = this.camera

        // controls.object = activeCamera;
        this.ptRenderer.camera = activeCamera;


        this.resetRenderer();
    }
    updateEnvMap() {

        new RGBELoader()
            .load(params.envMap, texture => {

                if (this.scene.environmentMap) {

                    this.scene.environment.dispose();

                }
                const blurredEnvMap = this.envMapGenerator.generate(texture, params.environmentBlur);
                this.ptRenderer.material.envMapInfo.updateFrom(blurredEnvMap);

                this.scene.environment = blurredEnvMap;
                if (params.backgroundType !== 'Gradient') {

                    this.scene.background = blurredEnvMap;

                }

                this.ptRenderer.reset();

            });
    }
    async resetRenderer() {
        if (this.generator) {
            this.generator.reset()
            const result = this.generator.generate(this.thirdGroup);
            this.sceneInfo = result;

            const { bvh, textures, materials } = result;
            const geometry = bvh.geometry;
            const material = this.ptRenderer.material;

            material.bvh.updateFrom(bvh);
            material.normalAttribute.updateFrom(geometry.attributes.normal);
            material.tangentAttribute.updateFrom(geometry.attributes.tangent);
            material.uvAttribute.updateFrom(geometry.attributes.uv);
            material.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
            material.textures.setTextures(this.renderer, 2048, 2048, textures);
            material.materials.updateFrom(materials, textures);
            // update lights
            material.lights.updateFrom(this.sceneInfo.lights, this.sceneInfo.iesProfiles);

            this.ptRenderer.reset();
        }


        if (params.tilesX * params.tilesY !== 1.0) {

            delaySamples = 1;

        }

        this.ptRenderer.reset();

    }

    updateMaterialColor(e, index) {
        this.object.children[index].material[0].color = new THREE.Color(e)
    }
    onBackgroundColorChange() {
        this.scene.background.set(this.params.color)
    }
    onMouseMove(e) {
        var deltaX = (e.clientX / window.innerWidth) * 2 - 1 - this.mouse.x
        var deltaY = -(e.clientY / window.innerHeight) * 2 + 1 - this.mouse.y

        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        if (this.isDown && this.fsQuad == null) {
            this.speedX +=  deltaY * 0.1
            this.speedY +=  deltaX * 0.3
        }
       
    }
    rotateScene(deltaX, deltaY, object) {
        // rotate on all axes

        this.ptRenderer.reset();
        // this.resetRenderer()
        // this.interface.updateCanvasWidth()

        var deltaRotationQuaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(-this.speedX * 111),
                THREE.MathUtils.degToRad(this.speedY * 111),
                0,
                'XYZ'
            ));
        object.quaternion.multiplyQuaternions(deltaRotationQuaternion, object.quaternion);
        // object.rotation.y += deltaX * 3
        // object.rotation.x += deltaY * 3



    }
    rotateSceneMobile(deltaX, deltaY, object) {
        // object.rotation.y += deltaX * 3
        // object.rotation.x -= deltaY * 3

        var deltaRotationQuaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(-deltaY * 111),
                THREE.MathUtils.degToRad(deltaX * 111),
                0,
                'XYZ'
            ));
        object.quaternion.multiplyQuaternions(deltaRotationQuaternion, object.quaternion);

    }

    onTouchMove(e) {

        // get delta for mobile
        var deltaX = (e.touches[0].clientX / window.innerWidth) * 2 - 1 - this.mouse.x
        var deltaY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1 - this.mouse.y

        this.mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;

        if (this.interface.isDragging == false && !this.hoveringInterface) {
            this.rotateSceneMobile(deltaX, deltaY, this.object.parent.parent)
            this.speedX +=  deltaY * 0.1
            this.speedY +=  deltaX * 0.3

        }
        if (this.intersects.length > 0) {
            if (this.interface.isDragging) {
                if (this.interface.hitTexture != -1) {
                    this.interface.dragTexture(this.intersects)
                }
                if (this.interface.hitText != -1) {

                    this.interface.dragText(this.intersects)

                }
            }


        } else {
            this.interface.isDragging = false
        }
    }
    onTouchEnd(e) {
        this.isDown = false
        this.interface.isDragging = false
        this.interface.hitTexture = -1
        this.interface.hitText = -1
        this.controls.enableRotate = false
    }

    onTouchStart(e) {

        this.mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
        this.onTouchMove(e)
        this.checkIntersections()
        this.isDown = true

        if (this.intersects.length > 0) {
            if (!this.placingText) {
            }

            // this.controls.enableRotate = false
            var uvs = this.intersects[0].uv

            var index = this.interface.children.indexOf(this.interface.children.find(child => child.name == this.intersects[0].object.name))

            this.canvas = this.interface.canvases.image[index]
            var canvasText = this.interface.canvases.text[index]
            var textCtx = canvasText.getContext('2d')
            this.ctx = this.canvas.getContext('2d')
            var _this = this

            if (this.placingImage) {

                this.interface.addImageMobile(this.imageToPlace, this.placeOnIndex)
            } else if (this.placingText) {
                this.interface.addTextMobile(this.textToPlace, this.placeOnIndex)
            } else {

                for (var i = 0; i < this.interface.texts[index].length; i++) {
                    var text = this.interface.texts[index][i];
                    var measuredTextSize = textCtx.measureText(text.text)

                    const region = {
                        x: text.x - measuredTextSize.width / 2,
                        y: text.y - measuredTextSize.actualBoundingBoxAscent / 2,
                        width: measuredTextSize.width,
                        height: measuredTextSize.actualBoundingBoxAscent,
                    }

                    console.log(canvasText.width);

                    if (isInText(region, uvs.x * canvasText.width, canvasText.height - uvs.y * canvasText.height, text, textCtx)) {

                        this.interface.hit = i
                        this.interface.hitText = i
                        this.interface.isDragging = true
                        console.log('drag');

                    }
                }
                for (var i = 0; i < this.interface.images[index].length; i++) {
                    var image = this.interface.images[index][i]

                    const region = {
                        x: image.x,
                        y: image.y,
                        width: image.width,
                        height: image.height
                    }

                    if (isInImage(region, uvs.x * this.canvas.width, this.canvas.height - uvs.y * this.canvas.height, image, this.ctx)) {
                        this.interface.hitTexture = i
                        this.interface.hit = i
                        this.interface.isDragging = true

                    }

                }
            }




        }

    }


    onResize() {
        const scale = params.resolutionScale;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = window.devicePixelRatio;
    
       this.ptRenderer.setSize( w * scale * dpr, h * scale * dpr );
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio( window.devicePixelRatio * scale );
    }
    onMouseDown(e) {
        this.isDown = true
        if (this.intersects.length > 0 && this.hit == -1 && !this.placingText && !this.placingImage) {
            this.interface.selectElement(this.intersects)
        } else {
            this.hit = -1
        }

    }
    onMouseUp(e) {
        this.resetRenderer()
        this.isDown = false
    }

    checkIntersections() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.intersects = this.raycaster.intersectObjects(this.children);
        if (this.intersects.length > 0) {
            if (this.lastIntersected && this.lastIntersected.object != this.intersects[0].object && this.interface.isDragging) {
                this.interface.isDragging = false
            }
            this.lastIntersected = this.intersects[0]
        }
    }
    animate() {
        
            if (this.speedX > 0) {
                this.speedX -= Math.abs(this.speedX) *0.1
            } else if (this.speedX < 0) {
                this.speedX += Math.abs(this.speedX) *0.1
            }
            if (this.speedY > 0) {
                this.speedY -= Math.abs(this.speedY) *0.1
            } else if (this.speedY < 0) {
                this.speedY += Math.abs(this.speedY) *0.1
            }

            if (this.object.parent && this.fsQuad == null) {
            this.rotateScene(0,0, this.object.parent.parent)

            }
        requestAnimationFrame(this.animate);

        if (this.autoSpin) {
            this.object.parent.parent.rotation.y += 0.005
        }
        for (var i = 0; i < this.canvasTextures.length; i++) {
            this.canvasTextures[i].needsUpdate = true
        }
        this.checkIntersections()
        this.controls.update()

        this.ptRenderer.material.bgGradientTop.set(params.bgGradientTop);
        this.ptRenderer.material.bgGradientBottom.set(params.bgGradientBottom);
        if (this.ptRenderer && this.ptRenderer.samples < 1.0 || !params.enable) {

            this.renderer.render(this.scene, this.camera);


        }
        if (this.ptRenderer && this.sceneInfo != null && params.enable && delaySamples === 0) {

            const samples = Math.floor(this.ptRenderer.samples);
            this.samplesEl.innerText = `samples: ${samples}`;
            this.ptRenderer.material.materials.updateFrom(this.sceneInfo.materials, this.sceneInfo.textures);
            this.ptRenderer.material.filterGlossyFactor = params.filterGlossyFactor;
            this.ptRenderer.material.environmentIntensity = params.environmentIntensity;
            this.ptRenderer.material.bounces = params.bounces;
            // this.ptRenderer.material.textures.setTextures(this.renderer, 2048, 2048, this.sceneInfo.textures)

            // lights
            // this.ptRenderer.material.lights.updateFrom(this.sceneInfo.lights);
            this.ptRenderer.material.physicalCamera.updateFrom(this.camera);

            this.camera.updateMatrixWorld();



            if (!params.pause || this.ptRenderer.samples < 1) {

                for (let i = 0, l = params.samplesPerFrame; i < l; i++) {
                    this.ptRenderer.update();

                }

            }
            // this.fsQuad.material.map = this.ptRenderer.target.texture;

            this.renderer.autoClear = false;
            this.fsQuad.render(this.renderer);
            this.renderer.autoClear = true;

        } else if (delaySamples > 0) {

            delaySamples--;

        }
        if (this.ptRenderer) {
            this.samplesEl.innerText = `Samples: ${Math.floor(this.ptRenderer.samples)}`;

        }
        this.camera.updateMatrixWorld();


    }
}


/**
 * Utils
 */

const applyMapSettings = (map) => {
    map.flipY = true
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.repeat.set(1, 1)
    map.minFilter = THREE.LinearFilter
    map.magFilter = THREE.LinearFilter
}




const selectMaterial = (elem, oldIndex, newIndex) => {
    elem.style.color = 'red'

    var materialDivs = document.getElementsByClassName('material')
    for (var i = 0; i < materialDivs.length; i++) {
        if (materialDivs[i] != elem) {
            materialDivs[i].style.color = 'white'
        }
    }

    var wasOnImage = false
    var wasOntext = false
    if (gl.interface.imageEditors[oldIndex].style.display == 'block') {

        gl.interface.toggleImageEditor(oldIndex)
        wasOnImage = true
    }
    if (gl.interface.textEditors[oldIndex].style.display == 'block') {
        gl.interface.toggleTextEditor(oldIndex)
        wasOntext = true

    }

    if (wasOnImage) {
        gl.interface.toggleImageEditor(newIndex)

    }
    if (wasOntext) {

        gl.interface.toggleTextEditor(newIndex)
    }

}

var gl = new WebGL().init()


		


