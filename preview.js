window.addEventListener('offline', function() {
  // 显示离线提示
  const offlineNotice = document.createElement('div');
  offlineNotice.className = 'offline-notice';
  offlineNotice.textContent = 'You are currently offline, but the screenshot function can still be used normally';
  document.body.appendChild(offlineNotice);
});

window.addEventListener('online', function() {
  // 移除离线提示
  const offlineNotice = document.querySelector('.offline-notice');
  if (offlineNotice) {
    offlineNotice.remove();
  }
});

// 全局变量
let screenshotDataUrl = '';
let sourceTabId = null;
let currentTool = null;
let isEditMode = false;
let canvas = null;
let ctx = null;
let originalImage = new Image();
let scale = 1.0; // 缩放比例
let isDragging = false;
let lastX = 0;
let lastY = 0;
let translateX = 0; // 添加平移X坐标变量
let translateY = 0; // 添加平移Y坐标变量
let offsetX = 0;
let offsetY = 0;
let arrowWidth = 5; // 默认箭头粗细
let mosaicSize = 10; // 默认马赛克大小
let mosaicRadius = 20; // 默认马赛克半径
let isSaving = false; // 保存状态标志
// 添加选择区域截图相关变量
let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionRect = null;
let isDrawing = false; // 添加绘图状态变量
let lastMouseEvent = null; // 添加最后鼠标事件变量
let currentLanguage = 'en'; // 默认语言

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 初始化语言
  initLanguage();
  
  // 获取DOM元素
  const screenshotImg = document.getElementById('screenshotImg');
  const loadingContainer = document.getElementById('loadingContainer');
  const noScreenshotContainer = document.getElementById('noScreenshotContainer');
  canvas = document.getElementById('editCanvas');
  ctx = canvas.getContext('2d');
  
  // 初始化编辑工具
  initEditTools();
  
  // 初始化按钮事件
  initButtonEvents();
  
  // 初始化缩放功能
  initZoomFeatures();
  
  // 从URL参数获取截图数据
  const urlParams = new URLSearchParams(window.location.search);
  const dataId = urlParams.get('id');
  
  if (dataId) {
    // 通过消息请求获取截图数据
    chrome.runtime.sendMessage({
      action: "getScreenshotData",
      dataId: dataId
    }, function(response) {
      if (response && response.dataUrl) {
        // 显示截图
        screenshotDataUrl = response.dataUrl;
        sourceTabId = response.sourceTabId;
        
        // 设置图片源
        screenshotImg.onload = function() {
          // 准备编辑画布
          prepareCanvas(screenshotImg);
          // 隐藏加载状态，显示图片
          loadingContainer.style.display = 'none';
          screenshotImg.style.display = 'block';
        };
        screenshotImg.src = screenshotDataUrl;
      } else {
        // 显示无截图状态
        loadingContainer.style.display = 'none';
        noScreenshotContainer.style.display = 'flex';
        showNotification(getTranslation("notification.loadFailed"), "error");
      }
    });
  } else {
    // 尝试从旧方式获取数据（兼容性考虑）
    chrome.storage.local.get('tempScreenshot', function(data) {
      if (data.tempScreenshot) {
        // 显示截图
        screenshotDataUrl = data.tempScreenshot.dataUrl;
        sourceTabId = data.tempScreenshot.sourceTabId;
        
        // 设置图片源
        screenshotImg.onload = function() {
          // 准备编辑画布
          prepareCanvas(screenshotImg);
          // 隐藏加载状态，显示图片
          loadingContainer.style.display = 'none';
          screenshotImg.style.display = 'block';
        };
        screenshotImg.src = screenshotDataUrl;
        
        // 使用完数据后清除
        chrome.storage.local.remove('tempScreenshot');
      } else {
        // 显示无截图状态
        loadingContainer.style.display = 'none';
        noScreenshotContainer.style.display = 'flex';
      }
    });
  }
  
  // 监听来自background.js的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "showPreview") {
      // 显示截图
      screenshotDataUrl = request.dataUrl;
      sourceTabId = request.sourceTabId;
      
      // 设置图片源
      screenshotImg.onload = function() {
        // 准备编辑画布
        prepareCanvas(screenshotImg);
        // 隐藏加载状态，显示图片
        loadingContainer.style.display = 'none';
        screenshotImg.style.display = 'block';
      };
      screenshotImg.src = screenshotDataUrl;
    } else if (request.action === "saveComplete") {
      // 保存完成后处理
      isSaving = false;
      
      // 显示保存成功提示
      if (request.success) {
        showNotification(request.saveAs ? getTranslation("notification.saveAsSuccess") : getTranslation("notification.saveSuccess"), "success");
      } else {
        showNotification(getTranslation("notification.saveFailed"), "error");
      }
    }
    return true; // 保持消息通道开放
  });
  
  // 更新编辑控制按钮样式
  updateEditControlsStyles();
  
  // 检测iframe
  detectIframes();
});

// 初始化语言
function initLanguage() {
  // 获取浏览器语言
  const browserLang = navigator.language;
  
  // 检查是否有保存的语言设置
  chrome.storage.local.get('language', function(data) {
    if (data.language) {
      currentLanguage = data.language;
    } else {
      // 如果没有保存的设置，使用浏览器语言或默认为英语
      currentLanguage = languages[browserLang] ? browserLang : 'en';
    }
    
    // 设置语言选择器的值
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
      languageSelector.value = currentLanguage;
      
      // 添加语言切换事件
      languageSelector.addEventListener('change', function() {
        currentLanguage = this.value;
        // 保存语言设置
        chrome.storage.local.set({ 'language': currentLanguage });
        // 更新页面文本
        updatePageLanguage();
      });
    }
    
    // 初始化页面文本
    updatePageLanguage();
  });
}

// 更新页面语言
function updatePageLanguage() {
  // 更新所有带有 data-i18n 属性的元素
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = getTranslation(key);
  });
  
  // 更新所有带有 data-i18n-title 属性的元素的 title 属性
  const titleElements = document.querySelectorAll('[data-i18n-title]');
  titleElements.forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.title = getTranslation(key);
  });
  
  // 更新页面标题
  document.title = `${getTranslation("preview")} - ${getTranslation("appName")}`;
}

// 获取翻译
function getTranslation(key) {
  // 确保当前语言存在，否则使用英语
  const lang = languages[currentLanguage] ? currentLanguage : 'en';
  
  // 分割键以访问嵌套对象
  const keys = key.split('.');
  let translation = languages[lang];
  
  // 遍历键路径
  for (const k of keys) {
    if (translation && translation[k] !== undefined) {
      translation = translation[k];
    } else {
      // 如果找不到翻译，返回英文版本或键本身
      let englishTranslation = languages['en'];
      for (const ek of keys) {
        if (englishTranslation && englishTranslation[ek] !== undefined) {
          englishTranslation = englishTranslation[ek];
        } else {
          return key; // 如果英文版本也没有，返回键本身
        }
      }
      return englishTranslation;
    }
  }
  
  return translation;
}

// 显示通知
function showNotification(message, type = "info") {
  // 检查是否已存在通知元素
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    document.body.appendChild(notification);
    
    // 添加通知样式
    const style = document.createElement('style');
    style.textContent = `
      #notification {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) translateY(-20px);
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 80%;
        text-align: center;
        word-wrap: break-word;
        white-space: pre-wrap;
        line-height: 1.5;
      }
      #notification.show {
        opacity: 1;
        transform: translate(-50%, -50%) translateY(0);
      }
      #notification.info {
        background: linear-gradient(to right, #3498db, #2980b9);
      }
      #notification.success {
        background: linear-gradient(to right, #2ecc71, #27ae60);
      }
      #notification.warning {
        background: linear-gradient(to right, #f39c12, #e67e22);
      }
      #notification.error {
        background: linear-gradient(to right, #e74c3c, #c0392b);
      }
    `;
    document.head.appendChild(style);
  }
  
  // 设置通知内容和类型
  notification.textContent = message;
  notification.className = type;
  
  // 显示通知
  setTimeout(() => notification.classList.add('show'), 10);
  
  // 自动隐藏通知
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// 修改 initZoomFeatures 函数，添加选择区域相关样式
function initZoomFeatures() {
  const previewContainer = document.querySelector('.preview-container');
  const screenshotImg = document.getElementById('screenshotImg');
  const canvasContainer = document.querySelector('.canvas-container');
  
  // 创建图片容器，用于控制图片位置
  const imgContainer = document.createElement('div');
  imgContainer.className = 'img-container';
  
  // 将原始图片移动到新容器中
  screenshotImg.parentNode.insertBefore(imgContainer, screenshotImg);
  imgContainer.appendChild(screenshotImg);
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .img-container {
      position: relative;
      overflow: hidden;
      margin: 20px 0;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      max-width: 90%;
      max-height: 60vh;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: grab;
      box-sizing: border-box;
    }
    
    .img-container:active {
      cursor: grabbing;
    }
    
    .screenshot-preview {
      display: block;
      max-width: 100%;
      max-height: 100%;
      border: none;
      box-shadow: none;
      transition: transform 0.1s ease;
      will-change: transform;
      transform-origin: 0 0; /* 从左上角开始变换 */
    }
    
    .canvas-container {
      position: relative;
      overflow: hidden;
      margin: 20px 0;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      max-width: 90%;
      max-height: 60vh;
      display: none;
      justify-content: center;
      align-items: center;
      cursor: grab;
      box-sizing: border-box;
    }
    
    .canvas-container:active {
      cursor: grabbing;
    }
    
    .canvas-container.drawing {
      cursor: crosshair;
    }
    
    .canvas-container.mosaic {
      cursor: none; /* 隐藏默认鼠标，使用自定义指示器 */
    }
    
    .canvas-container.cropping {
      cursor: crosshair;
    }
    
    #editCanvas {
      display: block;
      max-width: 100%;
      max-height: 100%;
      border: none;
      box-shadow: none;
      transition: transform 0.1s ease;
      will-change: transform;
      transform-origin: 0 0; /* 从左上角开始变换 */
    }
    
    .mosaic-indicator {
      position: absolute;
      border: 2px solid white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 100;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      display: none;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.2);
    }
    
    /* 平滑滚动 */
    .preview-container {
      scroll-behavior: smooth;
      overscroll-behavior: none;
    }
    
    /* 工具栏容器 */
    .tools-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 15px;
      border-radius: 8px;
      width: 90%;
      max-width: 1000px;
    }
    
    /* 编辑工具区域 */
    .edit-tools {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }
    
    /* 缩放控件 */
    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-left: 15px;
      border-left: 0px solid rgba(255, 255, 255, 0.2);
    }
    
    .zoom-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all 0.2s;
    }
    
    .zoom-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
    
    .zoom-btn:active {
      transform: translateY(0);
    }
    
    #zoomReset {
      width: auto;
      border-radius: 15px;
      padding: 0 10px;
    }
    
    #zoomLevel {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      min-width: 50px;
      text-align: center;
    }
    
    .save-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      backdrop-filter: blur(0px);
    }
    
    .save-overlay.show {
      opacity: 1;
      visibility: visible;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(3px);
    }
    
    .save-content {
      background: rgba(255, 255, 255, 0.1);
      padding: 30px;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .save-overlay.show .save-content {
      transform: translateY(0);
      opacity: 1;
    }
    
    .save-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }
    
    .save-text {
      color: white;
      font-size: 16px;
      margin-top: 10px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* 长按提示样式 */
    .canvas-container.drawing.long-press,
    .canvas-container.mosaic.long-press {
      cursor: grabbing !important;
    }
    
    /* 确保马赛克模式下鼠标隐藏 */
    .canvas-container.mosaic:not(.long-press) {
      cursor: none !important;
    }
    
    /* 拖动模式样式 */
    .canvas-container.dragging {
      cursor: grab;
    }
    
    .canvas-container.dragging:active {
      cursor: grabbing;
    }
    
    /* 选择区域样式 */
    .selection-rect {
      position: absolute;
      border: 2px dashed white;
      background-color: rgba(255, 255, 255, 0.1);
      pointer-events: none;
      box-sizing: border-box;
      z-index: 1000;
    }
    
    /* 工具按钮样式 */
    #btnDrag, #btnCrop {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      margin-right: 5px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    #btnDrag:hover, #btnCrop:hover {
      background-color: rgba(255, 255, 255, 0.3);
    }
    
    #btnDrag.active, #btnCrop.active {
      background-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }
    
    /* 设置信息样式 */
    .setting-info {
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    
    .setting-info p {
      margin: 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }
    
    /* 工具按钮样式 */
    .tool-btn {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      margin-right: 5px;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    
    .tool-btn:hover {
      background-color: rgba(255, 255, 255, 0.3);
    }
    
    .tool-btn.active {
      background-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }
    
    .tool-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
    
    /* 编辑模式控制按钮 */
    .edit-mode-controls {
      display: none;
      gap: 10px;
      padding: 10px 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      margin-top: 10px;
      margin-bottom: 10px;
      z-index: 100;
      align-self: center;
    }
    
    .edit-active .edit-mode-controls {
      display: flex !important;
    }
    
    #btnApplyEdit, #btnCancelEdit {
      padding: 8px 15px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    #btnApplyEdit {
      background: linear-gradient(to right, #12c2e9, #c471ed);
      color: white;
    }
    
    #btnCancelEdit {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }
    
    #btnApplyEdit:hover, #btnCancelEdit:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    /* 工具设置区域 */
    .tool-settings {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      display: none;
    }
    
    .edit-active .tool-settings {
      display: block;
    }
    
    /* 设置组样式 */
    .setting-group {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .setting-group:last-child {
      margin-bottom: 0;
    }
    
    .setting-label {
      width: 100px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }
    
    .setting-control {
      display: flex;
      align-items: center;
      flex: 1;
    }
    
    .setting-value {
      margin-left: 10px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      min-width: 40px;
    }
    
    /* 裁剪操作按钮 */
    .crop-actions {
      margin-top: 10px;
      display: flex;
      gap: 10px;
    }
    
    #btnApplyCrop, #btnCancelCrop {
      padding: 8px 15px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    #btnApplyCrop {
      background: linear-gradient(to right, #12c2e9, #c471ed);
      color: white;
    }
    
    #btnCancelCrop {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }
    
    #btnApplyCrop:hover, #btnCancelCrop:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    /* 响应式调整 */
    @media (max-width: 768px) {
      .tools-container {
        flex-direction: column;
        align-items: stretch;
      }
      
      .zoom-controls {
        border-left: none;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        padding-left: 0;
        padding-top: 10px;
        margin-top: 10px;
        justify-content: center;
      }
      
      .edit-mode-controls {
        border-left: none;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        padding-left: 0;
        padding-top: 10px;
        margin-top: 10px;
        margin-left: 0;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
  
  // 创建马赛克指示器
  const mosaicIndicator = document.createElement('div');
  mosaicIndicator.className = 'mosaic-indicator';
  document.body.appendChild(mosaicIndicator);
  
  // 创建保存遮罩
  const saveOverlay = document.createElement('div');
  saveOverlay.className = 'save-overlay';
  saveOverlay.innerHTML = `
    <div class="save-content">
      <div class="save-spinner"></div>
      <div class="save-text">Saving...</div>
    </div>
  `;
  document.body.appendChild(saveOverlay);
  
  // 添加鼠标滚轮事件监听器
  imgContainer.addEventListener('wheel', function(e) {
    e.preventDefault();
    
    // 确定缩放方向
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    
    // 限制缩放范围
    const newScale = Math.max(0.2, Math.min(5.0, scale + delta));
    
    // 如果缩放比例没有变化，则不执行后续操作
    if (newScale === scale) return;
    
    // 获取鼠标相对于图片的位置
    const rect = screenshotImg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算鼠标位置相对于图片中心的偏移比例
    const offsetX = (mouseX / rect.width - 0.5) * 2;
    const offsetY = (mouseY / rect.height - 0.5) * 2;
    
    // 更新缩放比例
    scale = newScale;
    
    // 应用缩放，并根据鼠标位置调整平移
    applyTransform(screenshotImg, scale, translateX - offsetX * delta * 200, translateY - offsetY * delta * 200);
    
    // 显示当前缩放比例
    showZoomLevel();
  });
  
  canvasContainer.addEventListener('wheel', function(e) {
    if (isDrawing || isSelecting) return; // 绘制或选择过程中不允许缩放
    
    e.preventDefault();
    
    // 确定缩放方向
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    
    // 限制缩放范围
    const newScale = Math.max(0.2, Math.min(5.0, scale + delta));
    
    // 如果缩放比例没有变化，则不执行后续操作
    if (newScale === scale) return;
    
    // 获取鼠标相对于画布的位置
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算鼠标位置相对于画布中心的偏移比例
    const offsetX = (mouseX / rect.width - 0.5) * 2;
    const offsetY = (mouseY / rect.height - 0.5) * 2;
    
    // 更新缩放比例
    scale = newScale;
    
    // 应用缩放，并根据鼠标位置调整平移
    applyTransform(canvas, scale, translateX - offsetX * delta * 200, translateY - offsetY * delta * 200);
    
    // 显示当前缩放比例
    showZoomLevel();
  });
  
  // 添加拖动功能
  imgContainer.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return; // 只响应左键
    
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    imgContainer.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  canvasContainer.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return; // 只响应左键
    
    if (currentTool && !isDrawing && !isSelecting) {
      // 如果选择了工具但还没开始绘制或选择，则开始操作
      handleMouseDown(e);
    } else if (!currentTool) {
      // 如果没有选择工具，则进入拖动模式
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvasContainer.style.cursor = 'grabbing';
    }
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    // 更新马赛克指示器位置
    if (currentTool === 'btnMosaic' && isEditMode) {
      const indicator = document.querySelector('.mosaic-indicator');
      if (!indicator) return;
      
      // 获取画布容器的位置和大小
      const canvasContainer = document.querySelector('.canvas-container');
      const containerRect = canvasContainer.getBoundingClientRect();
      
      // 检查鼠标是否在画布容器内
      if (
        e.clientX >= containerRect.left && 
        e.clientX <= containerRect.right && 
        e.clientY >= containerRect.top && 
        e.clientY <= containerRect.bottom
      ) {
        // 鼠标在画布内，显示指示器
        indicator.style.display = 'block';
        indicator.style.left = `${e.clientX}px`;
        indicator.style.top = `${e.clientY}px`;
        indicator.style.width = `${mosaicRadius * 2 / scale}px`;
        indicator.style.height = `${mosaicRadius * 2 / scale}px`;
      } else {
        // 鼠标不在画布内，隐藏指示器
        indicator.style.display = 'none';
      }
    }
    
    if (isDrawing || isSelecting) {
      handleMouseMove(e);
      return;
    }
    
    if (!isDragging) return;
    
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    
    lastX = e.clientX;
    lastY = e.clientY;
    
    // 更新平移值
    translateX += dx / scale;
    translateY += dy / scale;
    
    // 应用变换
    if (isEditMode) {
      applyTransform(canvas, scale, translateX, translateY);
    } else {
      applyTransform(screenshotImg, scale, translateX, translateY);
    }
  });
  
  document.addEventListener('mouseup', function(e) {
    if (isDragging) {
      isDragging = false;
      document.querySelector('.img-container').style.cursor = 'grab';
      document.querySelector('.canvas-container').style.cursor = currentTool ? 'crosshair' : 'grab';
    }
    
    if (isDrawing || isSelecting) {
      handleMouseUp(e);
    }
  });
  
  document.addEventListener('mouseleave', function() {
    isDragging = false;
    document.querySelector('.mosaic-indicator').style.display = 'none';
  });
  
  // 创建工具栏容器
  const toolsContainer = document.createElement('div');
  toolsContainer.className = 'tools-container';
  
  // 移动现有的编辑工具到新容器
  const editTools = document.querySelector('.edit-tools');
  if (editTools) {
    toolsContainer.appendChild(editTools);
  }
  
  // 创建缩放控件
  const zoomControls = document.createElement('div');
  zoomControls.className = 'zoom-controls';
  zoomControls.innerHTML = `
    <button id="zoomIn" class="zoom-btn">+</button>
    <span id="zoomLevel">100%</span>
    <button id="zoomOut" class="zoom-btn">-</button>
    <button id="zoomReset" class="zoom-btn">Reset</button>
  `;
  
  // 将缩放控件添加到工具栏
  toolsContainer.appendChild(zoomControls);
  
  // 将工具栏添加到预览容器
  previewContainer.insertBefore(toolsContainer, previewContainer.firstChild);
  
  // 创建编辑模式控制按钮容器
  const editModeControls = document.querySelector('.edit-mode-controls');
  if (editModeControls) {
    // 将编辑模式控制按钮移到工具栏下方而不是内部
    previewContainer.insertBefore(editModeControls, toolsContainer.nextSibling);
    
    // 更新样式，使其在工具栏下方显示
    editModeControls.style.marginTop = '10px';
    editModeControls.style.alignSelf = 'center';
    editModeControls.style.display = 'none'; // 初始隐藏
  }
  
  // 添加缩放按钮事件
  document.getElementById('zoomIn').addEventListener('click', function() {
    changeZoom(0.1);
  });
  
  document.getElementById('zoomOut').addEventListener('click', function() {
    changeZoom(-0.1);
  });
  
  document.getElementById('zoomReset').addEventListener('click', function() {
    resetZoom();
  });
}

// 应用变换
function applyTransform(element, scale, translateX, translateY) {
  // 使用 matrix 变换以确保精确控制
  const transform = `matrix(${scale}, 0, 0, ${scale}, ${translateX * scale}, ${translateY * scale})`;
  element.style.transform = transform;
  
  // 记录变换信息
  console.log(`应用变换到 ${element.id || element.className}:`, {
    scale,
    translateX,
    translateY,
    transform
  });
}

// 更改缩放比例
function changeZoom(delta) {
  const newScale = Math.max(0.2, Math.min(5.0, scale + delta));
  if (newScale === scale) return;
  
  // 计算缩放比例变化
  const scaleFactor = newScale / scale;
  
  // 更新缩放比例
  scale = newScale;
  
  // 根据当前模式选择目标元素
  const target = isEditMode ? canvas : document.getElementById('screenshotImg');
  
  // 应用新的缩放，保持当前平移
  applyTransform(target, scale, translateX, translateY);
  
  // 更新缩放级别显示
  showZoomLevel();
}

// 重置缩放
function resetZoom() {
  scale = 1.0;
  translateX = 0; // 重置平移X坐标
  translateY = 0; // 重置平移Y坐标
  
  const target = isEditMode ? canvas : document.getElementById('screenshotImg');
  
  // 重置所有变换
  applyTransform(target, scale, translateX, translateY);
  
  showZoomLevel();
}

// 显示当前缩放比例
function showZoomLevel() {
  const zoomLevelElement = document.getElementById('zoomLevel');
  if (zoomLevelElement) {
    zoomLevelElement.textContent = `${Math.round(scale * 100)}%`;
  }
}

// 初始化编辑工具，添加拖动模式按钮
function initEditTools() {
  // 简化工具栏，保留箭头和马赛克工具，添加拖动工具和选择区域工具
  const toolButtons = document.querySelectorAll('#btnArrow, #btnMosaic');
  const colorPicker = document.getElementById('colorPicker');
  
  // 隐藏其他工具按钮
  document.querySelectorAll('#btnRect, #btnText').forEach(btn => {
    btn.style.display = 'none';
  });
  
  // 创建拖动模式按钮
  const editTools = document.querySelector('.edit-tools');
  const dragButton = document.createElement('button');
  dragButton.id = 'btnDrag';
  dragButton.className = 'tool-btn';
  dragButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3"></path><path d="M9 5l3-3 3 3"></path><path d="M15 19l3 3 3-3"></path><path d="M19 9l3 3-3 3"></path><path d="M2 12h20"></path><path d="M12 2v20"></path></svg>';
  dragButton.title = 'Drag Mode';
  
  // 创建选择区域按钮
  const cropButton = document.querySelector('#btnCrop');
  if (!cropButton) {
    const newCropButton = document.createElement('button');
    newCropButton.id = 'btnCrop';
    newCropButton.className = 'tool-btn';
    newCropButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"></path><path d="M18 22V8a2 2 0 0 0-2-2H2"></path></svg>';
    newCropButton.title = 'Select Area';
    editTools.appendChild(newCropButton);
  } else {
    cropButton.style.display = 'inline-flex';
    cropButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"></path><path d="M18 22V8a2 2 0 0 0-2-2H2"></path></svg>';
    cropButton.title = 'Select Area';
  }
  
  // 将拖动按钮添加到工具栏
  editTools.insertBefore(dragButton, editTools.firstChild);
  
  // 添加图标到现有按钮
  const arrowButton = document.querySelector('#btnArrow');
  if (arrowButton) {
    arrowButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
    arrowButton.title = 'Arrow Tool';
  }
  
  const mosaicButton = document.querySelector('#btnMosaic');
  if (mosaicButton) {
    mosaicButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="4" height="4"></rect><rect x="9" y="3" width="4" height="4"></rect><rect x="15" y="3" width="4" height="4"></rect><rect x="3" y="9" width="4" height="4"></rect><rect x="9" y="9" width="4" height="4"></rect><rect x="15" y="9" width="4" height="4"></rect><rect x="3" y="15" width="4" height="4"></rect><rect x="9" y="15" width="4" height="4"></rect><rect x="15" y="15" width="4" height="4"></rect></svg>';
    mosaicButton.title = 'Mosaic Tool';
  }
  
  // 添加工具设置区域
  const toolSettings = document.createElement('div');
  toolSettings.className = 'tool-settings';
  toolSettings.innerHTML = `
    <div id="arrowSettings" style="display: none;">
      <div class="setting-group">
        <label class="setting-label">Arrow Width</label>
        <div class="setting-control">
          <input type="range" id="arrowWidth" min="2" max="15" value="${arrowWidth}">
          <span class="setting-value" id="arrowWidthValue">${arrowWidth}px</span>
        </div>
      </div>
    </div>
    
    <div id="mosaicSettings" style="display: none;">
      <div class="setting-group">
        <label class="setting-label">Mosaic Size</label>
        <div class="setting-control">
          <input type="range" id="mosaicSize" min="3" max="30" value="${mosaicSize}">
          <span class="setting-value" id="mosaicSizeValue">${mosaicSize}px</span>
        </div>
      </div>
      <div class="setting-group">
        <label class="setting-label">Mosaic Radius</label>
        <div class="setting-control">
          <input type="range" id="mosaicRadius" min="10" max="50" value="${mosaicRadius}">
          <span class="setting-value" id="mosaicRadiusValue">${mosaicRadius}px</span>
        </div>
      </div>
    </div>
    
    <div id="dragSettings" style="display: none;">
      <div class="setting-info">
        <p data-i18n="edit.dragMode">${getTranslation("edit.dragMode")}</p>
      </div>
    </div>
    
    <div id="cropSettings" style="display: none;">
      <div class="setting-info">
        <p data-i18n="edit.selectArea">${getTranslation("edit.selectArea")}</p>
      </div>
      <div class="crop-actions" style="margin-top: 10px; display: flex; gap: 10px;">
        <button id="btnApplyCrop" class="btn btn-primary" style="display: none;" data-i18n="edit.applySelection">${getTranslation("edit.applySelection")}</button>
        <button id="btnCancelCrop" class="btn btn-secondary" style="display: none;" data-i18n="edit.cancelSelection">${getTranslation("edit.cancelSelection")}</button>
      </div>
    </div>
  `;
  editTools.appendChild(toolSettings);
  
  // 为所有工具按钮添加点击事件
  const allToolButtons = document.querySelectorAll('#btnDrag, #btnArrow, #btnMosaic, #btnCrop');
  
  allToolButtons.forEach(button => {
    button.addEventListener('click', function() {
      // 移除其他按钮的active类
      allToolButtons.forEach(btn => btn.classList.remove('active'));
      
      // 如果点击的是当前工具，则取消选择
      if (currentTool === this.id) {
        currentTool = null;
        document.querySelector('.edit-tools').classList.remove('edit-active');
        
        // 隐藏所有工具设置
        document.querySelectorAll('.tool-settings > div').forEach(div => {
          div.style.display = 'none';
        });
        
        // 如果有选择区域，清除它
        clearSelectionRect();
        
        return;
      }
      
      // 为当前按钮添加active类
      this.classList.add('active');
      currentTool = this.id;
      document.querySelector('.edit-tools').classList.add('edit-active');
      
      // 显示对应的工具设置
      document.querySelectorAll('.tool-settings > div').forEach(div => {
        div.style.display = 'none';
      });
      
      if (this.id === 'btnArrow') {
        document.getElementById('arrowSettings').style.display = 'block';
      } else if (this.id === 'btnMosaic') {
        document.getElementById('mosaicSettings').style.display = 'block';
      } else if (this.id === 'btnDrag') {
        document.getElementById('dragSettings').style.display = 'block';
      } else if (this.id === 'btnCrop') {
        document.getElementById('cropSettings').style.display = 'block';
        // 清除之前的选择区域
        clearSelectionRect();
      }
      
      // 激活编辑模式
      activateEditMode();
    });
  });
  
  // 箭头粗细设置
  const arrowWidthSlider = document.getElementById('arrowWidth');
  const arrowWidthValue = document.getElementById('arrowWidthValue');
  
  if (arrowWidthSlider && arrowWidthValue) {
    arrowWidthSlider.addEventListener('input', function() {
      arrowWidth = parseInt(this.value);
      arrowWidthValue.textContent = `${arrowWidth}px`;
      
      // 如果当前正在绘制箭头，更新预览
      if (isDrawing && currentTool === 'btnArrow') {
        handleMouseMove(lastMouseEvent);
      }
    });
  }
  
  // 马赛克大小设置
  const mosaicSizeSlider = document.getElementById('mosaicSize');
  const mosaicSizeValue = document.getElementById('mosaicSizeValue');
  
  if (mosaicSizeSlider && mosaicSizeValue) {
    mosaicSizeSlider.addEventListener('input', function() {
      mosaicSize = parseInt(this.value);
      mosaicSizeValue.textContent = `${mosaicSize}px`;
    });
  }
  
  // 马赛克范围设置
  const mosaicRadiusSlider = document.getElementById('mosaicRadius');
  const mosaicRadiusValue = document.getElementById('mosaicRadiusValue');
  
  if (mosaicRadiusSlider && mosaicRadiusValue) {
    mosaicRadiusSlider.addEventListener('input', function() {
      mosaicRadius = parseInt(this.value);
      mosaicRadiusValue.textContent = `${mosaicRadius}px`;
      
      // 实时更新指示器大小
      const indicator = document.querySelector('.mosaic-indicator');
      if (indicator) {
        indicator.style.width = `${mosaicRadius * 2 / scale}px`;
        indicator.style.height = `${mosaicRadius * 2 / scale}px`;
      }
    });
  }
  
  // 颜色选择器事件
  if (colorPicker) {
    colorPicker.addEventListener('change', function() {
      // 更新当前绘图颜色
      ctx.strokeStyle = this.value;
      ctx.fillStyle = this.value;
    });
  }
  
  // 添加选择区域的应用和取消按钮事件
  const btnApplyCrop = document.getElementById('btnApplyCrop');
  const btnCancelCrop = document.getElementById('btnCancelCrop');
  
  if (btnApplyCrop) {
    btnApplyCrop.addEventListener('click', function() {
      applyCrop();
    });
  }
  
  if (btnCancelCrop) {
    btnCancelCrop.addEventListener('click', function() {
      cancelCrop();
    });
  }
  
  // 确保工具设置区域不会覆盖编辑控制按钮
  toolSettings.style.position = 'relative';
  toolSettings.style.zIndex = '50'; // 低于编辑控制按钮的z-index
}

// 初始化按钮事件
function initButtonEvents() {
  // 直接保存按钮
  document.getElementById('btnSave').addEventListener('click', function() {
    saveScreenshot(false);
  });
  
  // 另存为按钮
  document.getElementById('btnSaveAs').addEventListener('click', function() {
    saveScreenshot(true);
  });
  
  // 取消按钮
  document.getElementById('btnDiscard').addEventListener('click', function() {
    // 直接关闭预览页面
    window.close();
  });
  
  // 应用编辑按钮
  document.getElementById('btnApplyEdit').addEventListener('click', function() {
    applyEdits();
  });
  
  // 取消编辑按钮
  document.getElementById('btnCancelEdit').addEventListener('click', function() {
    cancelEdits();
  });
}

// 准备画布
function prepareCanvas(img) {
  console.log('准备画布，图片尺寸:', img.naturalWidth, 'x', img.naturalHeight);
  
  // 设置画布大小与图片一致
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  // 绘制原始图像到画布
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  // 保存原始图像以便取消编辑
  originalImage = new Image();
  originalImage.onload = function() {
    console.log('原始图像已加载，尺寸:', this.width, 'x', this.height);
  };
  originalImage.src = img.src;
  
  // 设置默认绘图样式
  ctx.lineWidth = arrowWidth;
  ctx.strokeStyle = document.getElementById('colorPicker').value;
  ctx.fillStyle = document.getElementById('colorPicker').value;
  
  // 确保画布样式与图片一致
  canvas.style.width = img.style.width || 'auto';
  canvas.style.height = img.style.height || 'auto';
  canvas.style.maxWidth = img.style.maxWidth || '100%';
  canvas.style.maxHeight = img.style.maxHeight || '100%';
  
  console.log('画布已准备，尺寸:', canvas.width, 'x', canvas.height);
}

// 完全重写选择区域相关函数
function updateSelectionRect(startX, startY, endX, endY) {
  // 移除之前的选择区域
  clearSelectionRect();
  
  // 创建新的选择区域
  const canvasContainer = document.querySelector('.canvas-container');
  selectionRect = document.createElement('div');
  selectionRect.className = 'selection-rect';
  
  // 计算选择区域的位置和大小
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  // 设置选择区域的样式
  selectionRect.style.position = 'absolute';
  selectionRect.style.left = `${left}px`;
  selectionRect.style.top = `${top}px`;
  selectionRect.style.width = `${width}px`;
  selectionRect.style.height = `${height}px`;
  
  // 添加选择区域到画布容器
  canvasContainer.appendChild(selectionRect);
  
  // 显示应用和取消按钮
  const btnApplyCrop = document.getElementById('btnApplyCrop');
  const btnCancelCrop = document.getElementById('btnCancelCrop');
  
  if (btnApplyCrop) btnApplyCrop.style.display = 'inline-block';
  if (btnCancelCrop) btnCancelCrop.style.display = 'inline-block';
}

function finalizeSelectionRect(startX, startY, endX, endY) {
  // 如果选择区域太小，则忽略
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  if (width < 10 || height < 10) {
    clearSelectionRect();
    return;
  }
  
  // 更新选择区域
  updateSelectionRect(startX, startY, endX, endY);
}

function clearSelectionRect() {
  // 移除之前的选择区域
  if (selectionRect) {
    selectionRect.remove();
    selectionRect = null;
  }
  
  // 隐藏应用和取消按钮
  const btnApplyCrop = document.getElementById('btnApplyCrop');
  const btnCancelCrop = document.getElementById('btnCancelCrop');
  
  if (btnApplyCrop) btnApplyCrop.style.display = 'none';
  if (btnCancelCrop) btnCancelCrop.style.display = 'none';
}

// 完全重写 applyCrop 函数，使用 HTML2Canvas 直接截取可视区域
function applyCrop() {
  if (!selectionRect) return;
  
  // 获取选择区域的位置和大小
  const rectStyle = window.getComputedStyle(selectionRect);
  const left = parseInt(rectStyle.left);
  const top = parseInt(rectStyle.top);
  const width = parseInt(rectStyle.width);
  const height = parseInt(rectStyle.height);
  
  // 如果选择区域太小，则忽略
  if (width < 10 || height < 10) {
    clearSelectionRect();
    showNotification(getTranslation("notification.selectionTooSmall"), "warning");
    return;
  }
  
  // 获取画布容器和画布的位置
  const canvasContainer = document.querySelector('.canvas-container');
  const canvasRect = canvas.getBoundingClientRect();
  
  // 计算选择区域相对于画布的位置，考虑滚动和变换
  const relativeLeft = left - canvasContainer.scrollLeft;
  const relativeTop = top - canvasContainer.scrollTop;
  
  // 获取当前变换矩阵
  const transform = window.getComputedStyle(canvas).transform;
  let matrix;
  try {
    matrix = new DOMMatrix(transform);
  } catch (e) {
    console.error('无法解析变换矩阵:', e);
    matrix = new DOMMatrix();
  }
  
  // 计算选择区域在画布上的实际像素位置，考虑缩放
  const displayToCanvasRatioX = canvas.width / (canvasRect.width * matrix.a);
  const displayToCanvasRatioY = canvas.height / (canvasRect.height * matrix.d);
  
  const cropX = relativeLeft * displayToCanvasRatioX;
  const cropY = relativeTop * displayToCanvasRatioY;
  const cropWidth = width * displayToCanvasRatioX;
  const cropHeight = height * displayToCanvasRatioY;
  
  console.log('裁剪区域:', {
    显示区域: { left, top, width, height },
    画布区域: { cropX, cropY, cropWidth, cropHeight },
    比例: { displayToCanvasRatioX, displayToCanvasRatioY }
  });
  
  // 创建临时画布
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropWidth;
  tempCanvas.height = cropHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  // 将选择区域绘制到临时画布
  tempCtx.drawImage(
    canvas,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );
  
  // 调整原始画布大小
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  
  // 将临时画布内容绘制到原始画布
  ctx.drawImage(tempCanvas, 0, 0);
    
    // 更新原始图像
    originalImage = new Image();
    originalImage.src = canvas.toDataURL('image/png');
  
  // 更新截图数据URL
  screenshotDataUrl = canvas.toDataURL('image/png');
  
  // 清除选择区域
  clearSelectionRect();
  
  // 重置变换
  scale = 1.0;
  translateX = 0;
  translateY = 0;
  applyTransform(canvas, scale, translateX, translateY);
  
  // 显示成功提示
  showNotification(getTranslation("notification.areaCaptured"), "success");
}

function cancelCrop() {
  // 清除选择区域
  clearSelectionRect();
}

// 激活编辑模式
function activateEditMode() {
  isEditMode = true;
  
  // 获取当前图片容器的滚动位置和尺寸
  const imgContainer = document.querySelector('.img-container');
  const scrollLeft = imgContainer.scrollLeft;
  const scrollTop = imgContainer.scrollTop;
  
  // 获取图片的当前尺寸、位置和变换
  const screenshotImg = document.getElementById('screenshotImg');
  const imgRect = screenshotImg.getBoundingClientRect();
  const imgTransform = window.getComputedStyle(screenshotImg).transform;
  const imgComputedStyle = window.getComputedStyle(screenshotImg);
  
  console.log('激活编辑模式，当前图片变换:', imgTransform);
  console.log('图片位置和尺寸:', {
    left: imgRect.left,
    top: imgRect.top,
    width: imgRect.width,
    height: imgRect.height
  });
  
  // 记录当前图片容器的样式
  const imgContainerStyle = window.getComputedStyle(imgContainer);
  
  // 隐藏原始图片容器
  imgContainer.style.display = 'none';
  
  // 显示画布容器并设置样式
  const canvasContainer = document.querySelector('.canvas-container');
  
  // 复制图片容器的所有关键样式到画布容器
  canvasContainer.style.width = imgContainerStyle.width;
  canvasContainer.style.height = imgContainerStyle.height;
  canvasContainer.style.maxWidth = imgContainerStyle.maxWidth;
  canvasContainer.style.maxHeight = imgContainerStyle.maxHeight;
  canvasContainer.style.margin = imgContainerStyle.margin;
  canvasContainer.style.padding = imgContainerStyle.padding;
  canvasContainer.style.overflow = imgContainerStyle.overflow;
  canvasContainer.style.display = 'flex';
  canvasContainer.style.justifyContent = 'center';
  canvasContainer.style.alignItems = 'center';
  
  // 设置画布容器的滚动位置与图片容器一致
  canvasContainer.scrollLeft = scrollLeft;
  canvasContainer.scrollTop = scrollTop;
  
  // 确保画布尺寸与图片一致
  canvas.style.width = imgComputedStyle.width;
  canvas.style.height = imgComputedStyle.height;
  canvas.style.maxWidth = imgComputedStyle.maxWidth;
  canvas.style.maxHeight = imgComputedStyle.maxHeight;
  canvas.style.objectFit = imgComputedStyle.objectFit;
  
  // 确保画布应用相同的变换
  canvas.style.transform = imgTransform;
  
  // 记录当前变换状态，用于后续操作
  try {
    const matrix = new DOMMatrix(imgTransform);
    if (matrix.isIdentity) {
      // 如果是单位矩阵，使用默认值
      scale = 1.0;
      translateX = 0;
      translateY = 0;
    } else {
      // 从变换矩阵中提取缩放和平移值
      scale = matrix.a;
      translateX = matrix.e / scale;
      translateY = matrix.f / scale;
    }
    
    console.log('从变换矩阵提取状态:', {scale, translateX, translateY});
  } catch (e) {
    console.error('无法解析变换矩阵:', e, '使用默认值');
    scale = 1.0;
    translateX = 0;
    translateY = 0;
  }
  
  // 确保画布的像素尺寸与图片一致
  ensureCanvasSize();
  
  // 根据当前工具设置画布事件
  setupCanvasEvents();
  
  // 根据当前工具设置鼠标样式和类
  canvasContainer.classList.remove('drawing', 'mosaic', 'dragging', 'cropping');
  
  if (currentTool === 'btnArrow') {
    canvasContainer.classList.add('drawing');
    canvasContainer.style.cursor = 'crosshair';
  } else if (currentTool === 'btnMosaic') {
    canvasContainer.classList.add('mosaic');
    initMosaicIndicator();
  } else if (currentTool === 'btnDrag') {
    canvasContainer.classList.add('dragging');
    canvasContainer.style.cursor = 'grab';
  } else if (currentTool === 'btnCrop') {
    canvasContainer.classList.add('cropping');
    canvasContainer.style.cursor = 'crosshair';
  }
  
  console.log('编辑模式已激活，画布尺寸:', canvas.width, 'x', canvas.height);
  console.log('画布样式:', {
    width: canvas.style.width,
    height: canvas.style.height,
    transform: canvas.style.transform
  });
  
  // 确保编辑模式控制按钮可见
  const editModeControls = document.querySelector('.edit-mode-controls');
  if (editModeControls) {
    editModeControls.style.display = 'flex';
  }
}

// 设置画布事件
function setupCanvasEvents() {
  // 移除现有事件监听器
  canvas.removeEventListener('mousedown', handleMouseDown, true);
  canvas.removeEventListener('mousemove', handleMouseMove, true);
  canvas.removeEventListener('mouseup', handleMouseUp, true);
  document.removeEventListener('mouseup', handleGlobalMouseUp, true);
  
  // 添加新的事件监听器，使用捕获阶段
  canvas.addEventListener('mousedown', handleMouseDown, true);
  canvas.addEventListener('mousemove', handleMouseMove, true);
  canvas.addEventListener('mouseup', handleMouseUp, true);
  
  // 添加全局mouseup事件监听，确保即使鼠标移出画布也能捕获事件
  document.addEventListener('mouseup', handleGlobalMouseUp, true);
  
  // 添加指针事件作为备份，解决触摸设备和某些特殊网站的兼容性问题
  canvas.addEventListener('pointerdown', handlePointerDown, true);
  canvas.addEventListener('pointermove', handlePointerMove, true);
  canvas.addEventListener('pointerup', handlePointerUp, true);
  canvas.addEventListener('pointercancel', handlePointerUp, true);
  document.addEventListener('pointerup', handleGlobalPointerUp, true);
}

// 全局mouseup事件处理函数
function handleGlobalMouseUp(e) {
  console.log('全局mouseup事件触发');
  
  // 如果正在绘制，处理结束操作
  if (isDrawing) {
    handleMouseUp(e);
  }
  
  // 如果正在选择区域，结束选择
  if (isSelecting) {
    handleSelectionEnd(e);
  }
  
  // 如果正在拖动，结束拖动
  if (isDragging) {
    isDragging = false;
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
      canvasContainer.style.cursor = currentTool === 'btnDrag' ? 'grab' : 'default';
    }
  }
}

// 添加指针事件处理函数
function handlePointerDown(e) {
  // 防止触发多个事件处理
  if (e.pointerType === 'mouse') return;
  
  console.log('pointerdown事件触发', e.pointerType);
  // 模拟mousedown事件
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: e.clientX,
    clientY: e.clientY,
    button: 0,
    bubbles: true,
    cancelable: true
  });
  handleMouseDown(mouseEvent);
}

function handlePointerMove(e) {
  // 防止触发多个事件处理
  if (e.pointerType === 'mouse') return;
  
  // 模拟mousemove事件
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: e.clientX,
    clientY: e.clientY,
    bubbles: true,
    cancelable: true
  });
  
  if (isSelecting) {
    handleSelectionMove(mouseEvent);
  } else if (isDrawing || isDragging) {
    handleMouseMove(mouseEvent);
  }
}

function handlePointerUp(e) {
  // 防止触发多个事件处理
  if (e.pointerType === 'mouse') return;
  
  console.log('pointerup事件触发', e.pointerType);
  // 模拟mouseup事件
  const mouseEvent = new MouseEvent('mouseup', {
    clientX: e.clientX,
    clientY: e.clientY,
    button: 0,
    bubbles: true,
    cancelable: true
  });
  
  handleGlobalMouseUp(mouseEvent);
}

function handleGlobalPointerUp(e) {
  // 防止触发多个事件处理
  if (e.pointerType === 'mouse') return;
  
  console.log('全局pointerup事件触发', e.pointerType);
  handlePointerUp(e);
}

// 修改选择区域处理函数，增加事件处理的可靠性
function handleSelectionMove(e) {
  if (!isSelecting) return;
  
  // 获取画布容器和画布的位置
  const canvasContainer = document.querySelector('.canvas-container');
  const rect = canvas.getBoundingClientRect();
  
  // 计算鼠标在画布上的实际位置，考虑滚动
  const mouseX = e.clientX - rect.left + canvasContainer.scrollLeft;
  const mouseY = e.clientY - rect.top + canvasContainer.scrollTop;
  
  // 更新选择区域
  updateSelectionRect(selectionStartX, selectionStartY, mouseX, mouseY);
  
  // 防止默认行为和事件冒泡
  e.preventDefault();
  e.stopPropagation();
}

// 修改选择区域结束处理函数
function handleSelectionEnd(e) {
  if (!isSelecting) return;
  
  console.log('选择区域结束');
  isSelecting = false;
  
  // 获取画布容器和画布的位置
  const canvasContainer = document.querySelector('.canvas-container');
  const rect = canvas.getBoundingClientRect();
  
  // 计算鼠标在画布上的实际位置，考虑滚动
  const mouseX = e.clientX - rect.left + canvasContainer.scrollLeft;
  const mouseY = e.clientY - rect.top + canvasContainer.scrollTop;
  
  // 完成选择区域
  finalizeSelectionRect(selectionStartX, selectionStartY, mouseX, mouseY);
  
  // 防止默认行为和事件冒泡
  e.preventDefault();
  e.stopPropagation();
}

// 修改 handleMouseDown 函数，增强选择区域功能
function handleMouseDown(e) {
  // 记录鼠标事件
  lastMouseEvent = e;
  
  // 如果是拖动模式，直接进入拖动状态
  if (currentTool === 'btnDrag') {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    document.querySelector('.canvas-container').style.cursor = 'grabbing';
    
    // 捕获鼠标，确保即使鼠标移出窗口也能接收事件
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      console.log('不支持指针捕获', err);
    }
    
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  
  // 如果是选择区域模式
  if (currentTool === 'btnCrop') {
    isSelecting = true;
    
    // 获取画布容器和画布的位置
    const canvasContainer = document.querySelector('.canvas-container');
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的实际位置，考虑滚动
    const mouseX = e.clientX - rect.left + canvasContainer.scrollLeft;
    const mouseY = e.clientY - rect.top + canvasContainer.scrollTop;
    
    // 设置选择起始点
    selectionStartX = mouseX;
    selectionStartY = mouseY;
    
    // 清除之前的选择区域
    clearSelectionRect();
    
    // 创建一个初始的选择区域，确保用户能看到选择已开始
    updateSelectionRect(selectionStartX, selectionStartY, selectionStartX + 1, selectionStartY + 1);
    
    // 尝试捕获鼠标
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      console.log('不支持指针捕获', err);
    }
    
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  
  // 如果是拖动模式，不启动绘图
  if (isDragging) return;
  
  isDrawing = true;
  
  // 获取画布容器和画布的位置
  const canvasContainer = document.querySelector('.canvas-container');
  const rect = canvas.getBoundingClientRect();
  
  // 获取当前变换矩阵
  const transform = window.getComputedStyle(canvas).transform;
  let matrix;
  try {
    matrix = new DOMMatrix(transform);
  } catch (e) {
    console.error('无法解析变换矩阵:', e);
    matrix = new DOMMatrix();
  }
  
  // 计算鼠标在画布上的实际位置
  // 首先获取鼠标相对于画布元素的位置
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  console.log('鼠标相对位置:', {mouseX, mouseY});
  console.log('画布尺寸:', {width: canvas.width, height: canvas.height});
  console.log('画布显示尺寸:', {width: rect.width, height: rect.height});
  console.log('变换矩阵:', matrix);
  console.log('容器滚动位置:', {scrollLeft: canvasContainer.scrollLeft, scrollTop: canvasContainer.scrollTop});
  
  // 计算缩放比例 - 画布实际尺寸与显示尺寸的比例
  const displayToCanvasRatioX = canvas.width / rect.width;
  const displayToCanvasRatioY = canvas.height / rect.height;
  
  // 应用变换矩阵的逆变换获取原始坐标
  let transformedX, transformedY;
  
  if (matrix.isIdentity) {
    // 如果是单位矩阵，只需考虑缩放比例
    transformedX = mouseX * displayToCanvasRatioX;
    transformedY = mouseY * displayToCanvasRatioY;
  } else {
    // 创建一个点，表示鼠标在画布元素上的位置
    const point = new DOMPoint(mouseX, mouseY);
    
    // 应用逆变换获取原始坐标
    const invertedMatrix = matrix.inverse();
    const transformedPoint = point.matrixTransform(invertedMatrix);
    
    // 再应用缩放比例
    transformedX = transformedPoint.x * displayToCanvasRatioX;
    transformedY = transformedPoint.y * displayToCanvasRatioY;
  }
  
  // 设置起始点
  startX = transformedX;
  startY = transformedY;
  
  console.log('转换后的坐标:', {startX, startY});
  
  // 马赛克工具特殊处理
  if (currentTool === 'btnMosaic') {
    applyMosaic(startX, startY);
  }
  
  e.preventDefault();
}

// 修改 handleMouseMove 函数，移除选择区域处理逻辑
function handleMouseMove(e) {
  lastMouseEvent = e;
  
  if (isDragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    
    lastX = e.clientX;
    lastY = e.clientY;
    
    // 获取当前变换矩阵
    const transform = window.getComputedStyle(canvas).transform;
    const matrix = new DOMMatrix(transform);
    
    // 更新平移值，考虑当前缩放
    translateX += dx / matrix.a;
    translateY += dy / matrix.d;
    
    // 应用变换
    applyTransform(canvas, scale, translateX, translateY);
    return;
  }
  
  if (!isDrawing) return;
  
  // 获取画布容器和画布的位置
  const canvasContainer = document.querySelector('.canvas-container');
  const rect = canvas.getBoundingClientRect();
  
  // 获取当前变换矩阵
  const transform = window.getComputedStyle(canvas).transform;
  let matrix;
  try {
    matrix = new DOMMatrix(transform);
  } catch (e) {
    console.error('无法解析变换矩阵:', e);
    matrix = new DOMMatrix();
  }
  
  // 计算鼠标在画布上的实际位置
  // 首先获取鼠标相对于画布元素的位置
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // 计算缩放比例 - 画布实际尺寸与显示尺寸的比例
  const displayToCanvasRatioX = canvas.width / rect.width;
  const displayToCanvasRatioY = canvas.height / rect.height;
  
  // 应用变换矩阵的逆变换获取原始坐标
  let transformedX, transformedY;
  
  if (matrix.isIdentity) {
    // 如果是单位矩阵，只需考虑缩放比例
    transformedX = mouseX * displayToCanvasRatioX;
    transformedY = mouseY * displayToCanvasRatioY;
  } else {
    // 创建一个点，表示鼠标在画布元素上的位置
    const point = new DOMPoint(mouseX, mouseY);
    
    // 应用逆变换获取原始坐标
    const invertedMatrix = matrix.inverse();
    const transformedPoint = point.matrixTransform(invertedMatrix);
    
    // 再应用缩放比例
    transformedX = transformedPoint.x * displayToCanvasRatioX;
    transformedY = transformedPoint.y * displayToCanvasRatioY;
  }
  
  // 根据当前工具绘制
  switch (currentTool) {
    case 'btnArrow':
      // 清除之前的绘制内容
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      drawArrow(startX, startY, transformedX, transformedY);
      break;
    case 'btnMosaic':
      applyMosaic(transformedX, transformedY);
      break;
  }
}

// 修改 handleMouseUp 函数，移除选择区域处理逻辑
function handleMouseUp(e) {
  // 如果是拖动模式
  if (currentTool === 'btnDrag' && isDragging) {
    isDragging = false;
    document.querySelector('.canvas-container').style.cursor = 'grab';
    return;
  }
  
  if (isDrawing && currentTool === 'btnArrow') {
    // 箭头工具完成绘制后，更新原始图像
    originalImage = new Image();
    originalImage.src = canvas.toDataURL('image/png');
  }
  
  isDrawing = false;
}

// 绘制箭头
function drawArrow(fromX, fromY, toX, toY) {
  const headLength = arrowWidth * 3; // 箭头头部长度与线宽成比例
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  // 设置线宽和颜色
  ctx.lineWidth = arrowWidth;
  ctx.strokeStyle = document.getElementById('colorPicker').value;
  ctx.fillStyle = document.getElementById('colorPicker').value;
  
  // 绘制线
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  
  // 绘制箭头头部
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI/6), toY - headLength * Math.sin(angle - Math.PI/6));
  ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI/6), toY - headLength * Math.sin(angle + Math.PI/6));
  ctx.closePath();
  ctx.fill();
}

// 优化马赛克效果应用函数
function applyMosaic(x, y) {
  const size = mosaicSize; // 使用设置的马赛克块大小
  const radius = mosaicRadius; // 使用设置的马赛克效果半径
  
  // 获取影响区域
  const startX = Math.max(0, Math.floor(x - radius));
  const startY = Math.max(0, Math.floor(y - radius));
  const endX = Math.min(canvas.width, Math.floor(x + radius));
  const endY = Math.min(canvas.height, Math.floor(y + radius));
  
  // 创建临时缓冲区以提高性能
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = endX - startX;
  tempCanvas.height = endY - startY;
  const tempCtx = tempCanvas.getContext('2d');
  
  // 将当前区域复制到临时画布
  tempCtx.drawImage(
    canvas, 
    startX, startY, endX - startX, endY - startY,
    0, 0, endX - startX, endY - startY
  );
  
  // 获取像素数据
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;
  
  // 创建马赛克网格
  const gridSizeX = Math.ceil(tempCanvas.width / size);
  const gridSizeY = Math.ceil(tempCanvas.height / size);
  const grid = new Array(gridSizeY);
  
  // 初始化网格
  for (let i = 0; i < gridSizeY; i++) {
    grid[i] = new Array(gridSizeX);
    for (let j = 0; j < gridSizeX; j++) {
      grid[i][j] = { r: 0, g: 0, b: 0, a: 0, count: 0 };
    }
  }
  
  // 计算每个网格的平均颜色
  for (let i = 0; i < tempCanvas.height; i++) {
    for (let j = 0; j < tempCanvas.width; j++) {
      const pixelIndex = (i * tempCanvas.width + j) * 4;
      const gridX = Math.floor(j / size);
      const gridY = Math.floor(i / size);
      
      // 计算像素到中心的距离
      const distX = j + startX - x;
      const distY = i + startY - y;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // 只处理半径内的像素
      if (distance <= radius) {
        grid[gridY][gridX].r += data[pixelIndex];
        grid[gridY][gridX].g += data[pixelIndex + 1];
        grid[gridY][gridX].b += data[pixelIndex + 2];
        grid[gridY][gridX].a += data[pixelIndex + 3];
        grid[gridY][gridX].count++;
      }
    }
  }
  
  // 应用马赛克效果
  for (let i = 0; i < tempCanvas.height; i++) {
    for (let j = 0; j < tempCanvas.width; j++) {
      const pixelIndex = (i * tempCanvas.width + j) * 4;
      const gridX = Math.floor(j / size);
      const gridY = Math.floor(i / size);
      
      // 计算像素到中心的距离
      const distX = j + startX - x;
      const distY = i + startY - y;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // 只处理半径内的像素
      if (distance <= radius && grid[gridY][gridX].count > 0) {
        data[pixelIndex] = Math.round(grid[gridY][gridX].r / grid[gridY][gridX].count);
        data[pixelIndex + 1] = Math.round(grid[gridY][gridX].g / grid[gridY][gridX].count);
        data[pixelIndex + 2] = Math.round(grid[gridY][gridX].b / grid[gridY][gridX].count);
        data[pixelIndex + 3] = Math.round(grid[gridY][gridX].a / grid[gridY][gridX].count);
      }
    }
  }
  
  // 将处理后的像素数据放回临时画布
  tempCtx.putImageData(imageData, 0, 0);
  
  // 将临时画布绘制到主画布
  ctx.drawImage(tempCanvas, startX, startY);
  
  // 不要在每次应用马赛克后都更新原始图像，而是在鼠标释放时更新
  if (!isDrawing) {
    originalImage = new Image();
    originalImage.src = canvas.toDataURL('image/png');
  }
}

// 应用编辑
function applyEdits() {
  // 将编辑后的画布内容转换为数据URL
  screenshotDataUrl = canvas.toDataURL('image/png');
  
  // 更新原始图像
  const screenshotImg = document.getElementById('screenshotImg');
  screenshotImg.src = screenshotDataUrl;
  
  // 退出编辑模式
  exitEditMode();
  
  // 显示成功提示
  showNotification(getTranslation("notification.editApplied"), "success");
}

// 取消编辑
function cancelEdits() {
  // 恢复原始图像
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  
  // 退出编辑模式
  exitEditMode();
  
  // 显示提示
  showNotification(getTranslation("notification.editCanceled"), "info");
}

// 退出编辑模式
function exitEditMode() {
  isEditMode = false;
  currentTool = null;
  
  // 获取当前画布容器的滚动位置和样式
  const canvasContainer = document.querySelector('.canvas-container');
  const scrollLeft = canvasContainer.scrollLeft;
  const scrollTop = canvasContainer.scrollTop;
  
  // 获取画布的当前变换和样式
  const canvasTransform = window.getComputedStyle(canvas).transform;
  const canvasComputedStyle = window.getComputedStyle(canvas);
  
  console.log('退出编辑模式，当前画布变换:', canvasTransform);
  
  // 记录当前画布容器的样式
  const canvasContainerStyle = window.getComputedStyle(canvasContainer);
  
  // 移除所有工具按钮的active类
  document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.edit-tools').classList.remove('edit-active');
  
  // 隐藏所有工具设置
  document.querySelectorAll('.tool-settings > div').forEach(div => {
    div.style.display = 'none';
  });
  
  // 隐藏画布容器
  canvasContainer.style.display = 'none';
  
  // 显示图片容器并设置样式
  const imgContainer = document.querySelector('.img-container');
  
  // 复制画布容器的所有关键样式到图片容器
  imgContainer.style.width = canvasContainerStyle.width;
  imgContainer.style.height = canvasContainerStyle.height;
  imgContainer.style.maxWidth = canvasContainerStyle.maxWidth;
  imgContainer.style.maxHeight = canvasContainerStyle.maxHeight;
  imgContainer.style.margin = canvasContainerStyle.margin;
  imgContainer.style.padding = canvasContainerStyle.padding;
  imgContainer.style.overflow = canvasContainerStyle.overflow;
  imgContainer.style.display = 'flex';
  imgContainer.style.justifyContent = 'center';
  imgContainer.style.alignItems = 'center';
  
  // 设置图片容器的滚动位置与画布容器一致
  imgContainer.scrollLeft = scrollLeft;
  imgContainer.scrollTop = scrollTop;
  
  // 应用当前变换到图片，保持缩放和平移
  const screenshotImg = document.getElementById('screenshotImg');
  
  // 确保图片尺寸与画布一致
  screenshotImg.style.width = canvasComputedStyle.width;
  screenshotImg.style.height = canvasComputedStyle.height;
  screenshotImg.style.maxWidth = canvasComputedStyle.maxWidth;
  screenshotImg.style.maxHeight = canvasComputedStyle.maxHeight;
  screenshotImg.style.objectFit = canvasComputedStyle.objectFit;
  
  // 应用相同的变换
  screenshotImg.style.transform = canvasTransform;
  
  // 隐藏马赛克指示器
  const indicator = document.querySelector('.mosaic-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
  
  console.log('编辑模式已退出，图片变换:', canvasTransform);
  console.log('图片样式:', {
    width: screenshotImg.style.width,
    height: screenshotImg.style.height,
    transform: screenshotImg.style.transform
  });
  
  // 隐藏编辑模式控制按钮
  const editModeControls = document.querySelector('.edit-mode-controls');
  if (editModeControls) {
    editModeControls.style.display = 'none';
  }
}

// 保存截图
function saveScreenshot(saveAs) {
  if (isSaving) return;
  
  isSaving = true;
  
  // 显示保存中遮罩
  showSaveOverlay(saveAs ? getTranslation("saveAs") : getTranslation("save"));
  
  // 获取数据大小（以字节为单位）
  const base64Data = screenshotDataUrl.split(',')[1];
  const dataSize = base64Data ? base64Data.length * 0.75 : 0; // base64 字符串长度 * 0.75 ≈ 实际字节数
  
  console.log(`Screenshot data size: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
  
  // 直接使用 chrome.downloads API 保存图片
  // 生成文件名
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const filename = `screenshot_${timestamp}.png`;
  
  // 使用 chrome.downloads API 直接下载
  chrome.downloads.download({
    url: screenshotDataUrl,
    filename: filename,
    saveAs: saveAs
  }, function(downloadId) {
    hideSaveOverlay();
    isSaving = false;
    
    if (chrome.runtime.lastError) {
      console.error('Save failed:', chrome.runtime.lastError);
      showNotification(getTranslation("notification.saveFailed"), "error");
    } else {
      showNotification(saveAs ? getTranslation("notification.saveAsSuccess") : getTranslation("notification.saveSuccess"), "success");
    }
  });
}

// 监听保存完成消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "saveComplete") {
    hideSaveOverlay();
    isSaving = false;
    
    if (message.success) {
      showNotification(message.saveAs ? getTranslation("notification.saveAsSuccess") : getTranslation("notification.saveSuccess"), "success");
      // 延迟关闭窗口
      // setTimeout(() => {
      //   window.close();
      // }, 1500);
    } else {
      showNotification(getTranslation("notification.saveFailed"), "error");
    }
  }
});

// 显示保存遮罩
function showSaveOverlay(text) {
  const overlay = document.querySelector('.save-overlay');
  if (!overlay) {
    console.error('Save overlay element not found');
    return;
  }
  
  const textElement = overlay.querySelector('.save-text');
  if (textElement) {
    textElement.textContent = text === 'Preparing to save as...' ? 'Preparing to save as...' : 'Saving...';
  }
  
  overlay.classList.add('show');
}

// 隐藏保存遮罩
function hideSaveOverlay() {
  const overlay = document.querySelector('.save-overlay');
  if (!overlay) {
    console.error('Save overlay element not found');
    return;
  }
  
  overlay.classList.remove('show');
}

// 优化马赛克指示器
function initMosaicIndicator() {
  // 确保指示器存在
  let indicator = document.querySelector('.mosaic-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'mosaic-indicator';
    document.body.appendChild(indicator);
  }
  
  // 更新指示器样式
  indicator.style.width = `${mosaicRadius * 2 / scale}px`;
  indicator.style.height = `${mosaicRadius * 2 / scale}px`;
  indicator.style.display = 'none';
  
  // 添加样式确保指示器始终在视口内
  const style = document.createElement('style');
  style.textContent = `
    .mosaic-indicator {
      position: fixed;
      border: 2px solid white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.2);
      will-change: left, top;
      transition: width 0.2s, height 0.2s;
    }
    
    .canvas-container.mosaic {
      cursor: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // 使用节流函数优化鼠标移动事件处理
  let lastMoveTime = 0;
  document.addEventListener('mousemove', function(e) {
    const now = Date.now();
    // 限制更新频率为每16ms一次（约60fps）
    if (now - lastMoveTime < 16) return;
    lastMoveTime = now;
    
    if (currentTool === 'btnMosaic' && isEditMode) {
      const indicator = document.querySelector('.mosaic-indicator');
      if (!indicator) return;
      
      // 获取画布容器的位置和大小
      const canvasContainer = document.querySelector('.canvas-container');
      const containerRect = canvasContainer.getBoundingClientRect();
      
      // 检查鼠标是否在画布容器内
      if (
        e.clientX >= containerRect.left && 
        e.clientX <= containerRect.right && 
        e.clientY >= containerRect.top && 
        e.clientY <= containerRect.bottom
      ) {
        // 鼠标在画布内，显示指示器
        indicator.style.display = 'block';
        indicator.style.left = `${e.clientX}px`;
        indicator.style.top = `${e.clientY}px`;
        indicator.style.width = `${mosaicRadius * 2 / scale}px`;
        indicator.style.height = `${mosaicRadius * 2 / scale}px`;
      } else {
        // 鼠标不在画布内，隐藏指示器
        indicator.style.display = 'none';
      }
    }
  });
}

// 添加新函数，确保画布尺寸正确
function ensureCanvasSize() {
  // 获取原始图片
  const screenshotImg = document.getElementById('screenshotImg');
  
  // 确保画布尺寸与原始图片一致
  if (canvas.width !== screenshotImg.naturalWidth || 
      canvas.height !== screenshotImg.naturalHeight) {
    console.log('调整画布尺寸以匹配原始图片:', 
                {width: screenshotImg.naturalWidth, height: screenshotImg.naturalHeight});
    
    canvas.width = screenshotImg.naturalWidth;
    canvas.height = screenshotImg.naturalHeight;
    
    // 重新绘制原始图像
    ctx.drawImage(screenshotImg, 0, 0, canvas.width, canvas.height);
    
    // 更新原始图像
    originalImage = new Image();
    originalImage.src = canvas.toDataURL('image/png');
  }
}

// 添加 updateEditControlsStyles 函数定义
function updateEditControlsStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 编辑模式控制按钮 */
    .edit-mode-controls {
      display: none;
      gap: 10px;
      padding: 10px 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      margin-top: 10px;
      margin-bottom: 10px;
      z-index: 100;
      align-self: center;
    }
    
    .edit-active .edit-mode-controls {
      display: flex !important;
    }
    
    #btnApplyEdit, #btnCancelEdit {
      padding: 8px 15px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    #btnApplyEdit {
      background: linear-gradient(to right, #12c2e9, #c471ed);
      color: white;
    }
    
    #btnCancelEdit {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }
    
    #btnApplyEdit:hover, #btnCancelEdit:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
  `;
  document.head.appendChild(style);
  
  // 确保编辑模式控制按钮容器正确定位
  const editModeControls = document.querySelector('.edit-mode-controls');
  if (editModeControls) {
    // 设置样式，使其在工具栏下方显示
    editModeControls.style.marginTop = '10px';
    editModeControls.style.alignSelf = 'center';
    editModeControls.style.display = 'none'; // 初始隐藏
    
    // 确保编辑模式控制按钮在正确的位置
    const previewContainer = document.querySelector('.preview-container');
    const toolsContainer = document.querySelector('.tools-container');
    
    if (previewContainer && toolsContainer) {
      // 将编辑模式控制按钮移到工具栏下方
      previewContainer.insertBefore(editModeControls, toolsContainer.nextSibling);
    }
  }
  
  console.log('编辑控制按钮样式已更新');
}

// 添加iframe检测和处理
function detectIframes() {
  // 检查当前页面是否在iframe中
  const isInIframe = window !== window.top;
  
  if (isInIframe) {
    console.log('检测到在iframe中运行');
    
    // 添加额外的事件监听
    window.top.addEventListener('mouseup', function(e) {
      // 将顶层窗口的mouseup事件传递到当前窗口
      const newEvent = new MouseEvent('mouseup', {
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(newEvent);
    }, true);
    
    window.top.addEventListener('pointerup', function(e) {
      // 将顶层窗口的pointerup事件传递到当前窗口
      const newEvent = new PointerEvent('pointerup', {
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(newEvent);
    }, true);
  }
}
