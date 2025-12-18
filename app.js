class ModelViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.gridHelper = null;
        this.axesHelper = null; // 新增：坐标轴辅助器成员变量
        this.isAutoRotating = false;
        this.autoRotateSpeed = 0.5;
        this.isGridVisible = true; // 跟踪网格显示状态
        
        this.init();
    }
    
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createLights();
        this.createGridHelper(); // 添加网格平面
        this.loadModel();
        this.setupEventListeners();
        this.animate();
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        // 改为浅色背景
        this.scene.background = new THREE.Color(0xf8f9fa);
        // 移除雾效或使用浅色雾效
        this.scene.fog = new THREE.Fog(0xf8f9fa, 20, 100);
    }
    
    createCamera() {
        const container = document.getElementById('canvas-container');
        const aspect = container.clientWidth / container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 5, 15);
        this.camera.lookAt(0, 0, 0);
    }
    
    createRenderer() {
        const canvas = document.getElementById('model-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(
            document.getElementById('canvas-container').clientWidth,
            document.getElementById('canvas-container').clientHeight
        );
        
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2; // 提高曝光以适应浅色背景
    }
    
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI;
        
        // 禁用浏览器默认手势
        this.controls.enablePan = true;
        this.controls.enableRotate = true;
        this.controls.enableZoom = true;
        
        // 防止双指缩放触发浏览器手势
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
    }
    
    createLights() {
        // 调整为更适合浅色背景的光照
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // 主方向光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        this.scene.add(directionalLight);
        
        // 补充光源
        const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight1.position.set(-5, 5, 5);
        this.scene.add(fillLight1);
        
        const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight2.position.set(0, -5, 5);
        this.scene.add(fillLight2);
        
        // 点光源增加细节
        const pointLight = new THREE.PointLight(0xffffff, 0.3);
        pointLight.position.set(0, 0, 10);
        this.scene.add(pointLight);
    }
    
    createGridHelper() {
        // 创建网格平面作为参考基准
        const gridSize = 50;
        const gridDivisions = 25;
        const gridColor = 0xcccccc;
        const gridColorCenter = 0x888888;
        
        // 创建网格辅助器
        this.gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColorCenter);
        // 先设置一个较低的位置，稍后根据模型调整
        this.gridHelper.position.y = -10;
        this.scene.add(this.gridHelper);
        
        // 添加坐标轴辅助器
        this.axesHelper = new THREE.AxesHelper(5); // 改为成员变量
        this.scene.add(this.axesHelper);
    }
    
    async loadModel() {
        try {
            const loader = new THREE.GLTFLoader();
            
            // 从本地文件加载GLB模型
            const modelPath = 'glbxz_com_glbxz_com.glb';
            
            loader.load(
                modelPath,
                (gltf) => {
                    this.model = gltf.scene;
                    
                    // 遍历整个场景，确保所有子对象都正确设置
                    this.model.traverse((child) => {
                        if (child.isMesh) {
                            // 确保材质正确设置
                            if (child.material) {
                                child.material.side = THREE.DoubleSide; // 双面渲染
                                child.material.transparent = true;
                                child.material.opacity = 1.0;
                                child.material.needsUpdate = true;
                            }
                            
                            // 启用投射和接收阴影
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // 强制更新几何体
                            if (child.geometry) {
                                child.geometry.computeVertexNormals();
                            }
                        }
                    });
                    
                    this.scene.add(this.model);
                    
                    // 计算模型边界框（在移动模型之前）
                    const box = new THREE.Box3().setFromObject(this.model);
                    const originalMinY = box.min.y; // 保存原始最低点
                    const originalCenter = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    
                    console.log('原始模型最低点Y:', originalMinY);
                    console.log('原始模型中心:', originalCenter);
                    console.log('模型尺寸:', size);
                    
                    // 将模型居中
                    this.model.position.x = -originalCenter.x;
                    this.model.position.y = -originalCenter.y;
                    this.model.position.z = -originalCenter.z;
                    
                    // 重新计算移动后的边界框
                    const newBox = new THREE.Box3().setFromObject(this.model);
                    const newMinY = newBox.min.y;
                    const newCenter = newBox.getCenter(new THREE.Vector3());
                    
                    console.log('移动后模型最低点Y:', newMinY);
                    console.log('移动后模型中心:', newCenter);
                    
                    // 将网格调整到模型底部
                    if (this.gridHelper) {
                        // 网格应该放在模型最低点下方
                        this.gridHelper.position.y = newMinY - 0.5; // 稍微低于模型底部
                        console.log('网格位置Y:', this.gridHelper.position.y);
                    }
                    
                    // 调整坐标轴辅助器位置，使其原点与模型底部重合
                    if (this.axesHelper) {
                        // 将坐标轴移动到模型底部位置
                        this.axesHelper.position.y = newMinY;
                        console.log('坐标轴位置Y:', this.axesHelper.position.y);
                    }
                    
                    // 根据模型大小调整相机
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const fov = this.camera.fov * (Math.PI / 180);
                    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                    
                    // 根据模型大小动态调整相机距离
                    if (maxDim > 10) {
                        cameraZ *= 2;
                    } else if (maxDim < 1) {
                        cameraZ *= 0.5;
                    } else {
                        cameraZ *= 1.5;
                    }
                    
                    this.camera.position.set(0, newCenter.y + 2, cameraZ);
                    this.controls.target.copy(newCenter);
                    this.controls.update();
                    
                    // 添加调试信息
                    console.log('模型加载完成，包含子对象数量:', this.model.children.length);
                    console.log('坐标轴已调整到模型底部位置');
                    
                    // 隐藏加载动画
                    document.getElementById('loading').style.display = 'none';
                    
                    console.log('3D模型加载成功！');
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total * 100).toFixed(2);
                    console.log(`加载进度: ${percent}%`);
                },
                (error) => {
                    console.error('加载模型时出错:', error);
                    document.getElementById('loading').innerHTML = 
                        '<p style="color: #ff6b6b;">加载模型失败: ' + error.message + '</p>';
                }
            );
            
        } catch (error) {
            console.error('加载模型时发生错误:', error);
            document.getElementById('loading').innerHTML = 
                '<p style="color: #ff6b6b;">加载错误: ' + error.message + '</p>';
        }
    }
    
    setupEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', () => this.onWindowResize());
        
        // 禁用浏览器默认手势行为
        this.disableBrowserGestures();
        
        // 重置视角按钮
        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetView();
        });
        
        // 自动旋转按钮
        document.getElementById('auto-rotate').addEventListener('click', () => {
            this.toggleAutoRotate();
        });
        
        // 网格切换按钮 - 新增按钮事件监听
        document.getElementById('toggle-grid').addEventListener('click', () => {
            this.toggleGrid();
        });
        
        // 缩放按钮
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.zoomIn();
        });
        
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.zoomOut();
        });
        
        // 键盘控制
        document.addEventListener('keydown', (event) => {
            switch(event.key) {
                case 'g':
                case 'G':
                    event.preventDefault();
                    this.toggleGrid();
                    break;
                case 'r':
                case 'R':
                    this.resetView();
                    break;
                case ' ':
                    event.preventDefault();
                    this.toggleAutoRotate();
                    break;
                case '+':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
            }
        });
    }
    
    disableBrowserGestures() {
        const canvas = this.renderer.domElement;
        
        // 阻止默认的触摸事件
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // 阻止右键菜单
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // 阻止鼠标滚轮默认行为
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // 阻止拖拽选择文本
        canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
        
        canvas.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
    }
    
    toggleGrid() {
        if (this.gridHelper) {
            this.isGridVisible = !this.isGridVisible;
            this.gridHelper.visible = this.isGridVisible;
            
            // 更新按钮文本
            const gridButton = document.getElementById('toggle-grid');
            if (this.isGridVisible) {
                gridButton.textContent = '隐藏网格';
            } else {
                gridButton.textContent = '显示网格';
            }
        }
    }
    
    onWindowResize() {
        const container = document.getElementById('canvas-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    resetView() {
        if (this.model) {
            const box = new THREE.Box3().setFromObject(this.model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
            
            this.camera.position.set(0, center.y + 2, cameraZ);
            this.controls.target.copy(center);
        }
        
        this.controls.reset();
        this.isAutoRotating = false;
        this.updateAutoRotateButton();
    }
    
    toggleAutoRotate() {
        this.isAutoRotating = !this.isAutoRotating;
        this.controls.autoRotate = this.isAutoRotating;
        this.controls.autoRotateSpeed = this.autoRotateSpeed;
        this.updateAutoRotateButton();
    }
    
    updateAutoRotateButton() {
        const button = document.getElementById('auto-rotate');
        if (this.isAutoRotating) {
            button.textContent = '停止旋转';
            button.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a52)';
        } else {
            button.textContent = '自动旋转';
            button.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
        }
    }
    
    zoomIn() {
        this.controls.dollyOut(0.2);
    }
    
    zoomOut() {
        this.controls.dollyIn(0.2);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// 页面加载完成后初始化查看器
document.addEventListener('DOMContentLoaded', () => {
    new ModelViewer();
});