// 全局变量
let isSelecting = false;
let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;
let overlay = null;
let selection = null;
let toolbar = null;
let isDrawing = false;
let currentLanguage = 'en'; // 默认语言

// 监听来自popup.js的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "captureVisible") {
    captureVisibleArea();
  } else if (request.action === "captureSelection") {
    startSelectionCapture();
  } else if (request.action === "captureFullPage") {
    captureFullPage();
  } else if (request.action === "setLanguage") {
    currentLanguage = request.language;
  }
});

// 初始化语言
function initLanguage() {
  // 获取当前语言设置
  chrome.storage.local.get('language', function(data) {
    if (data.language) {
      currentLanguage = data.language;
    } else {
      // 如果没有保存的设置，使用浏览器语言或默认为英语
      const browserLang = navigator.language;
      currentLanguage = window.languages[browserLang] ? browserLang : 'en';
      // 保存语言设置
      chrome.storage.local.set({ 'language': currentLanguage });
    }
  });
}

// 获取翻译
function getTranslation(key, defaultText = '') {
  // 确保当前语言存在，否则使用英语
  const lang = window.languages[currentLanguage] ? currentLanguage : 'en';
  
  try {
    // 分割键以访问嵌套对象
    const keys = key.split('.');
    let translation = window.languages[lang];
    
    // 遍历键路径
    for (const k of keys) {
      if (translation && translation[k] !== undefined) {
        translation = translation[k];
      } else {
        // 如果找不到翻译，返回英文版本或键本身
        let englishTranslation = window.languages['en'];
        for (const ek of keys) {
          if (englishTranslation && englishTranslation[ek] !== undefined) {
            englishTranslation = englishTranslation[ek];
          } else {
            return defaultText || key; // 如果英文版本也没有，返回默认文本或键本身
          }
        }
        return englishTranslation;
      }
    }
    
    return translation;
  } catch (error) {
    console.error('获取翻译时出错:', error);
    return defaultText || key;
  }
}

// 可视区域截屏
function captureVisibleArea() {
  // 获取当前可视区域的准确位置和尺寸
  const viewportLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const viewportTop = window.pageYOffset || document.documentElement.scrollTop;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  console.log('Capturing visible area:', {
    scrollPosition: { x: viewportLeft, y: viewportTop },
    viewportSize: { width: viewportWidth, height: viewportHeight }
  });
  
  // 临时隐藏任何截图相关的UI元素
  const screenshotElements = document.querySelectorAll('.screenshot-overlay, .screenshot-selection, .screenshot-toolbar, .screenshot-size-indicator, [data-iframe-overlay="true"]');
  const originalDisplays = [];
  
  screenshotElements.forEach(element => {
    originalDisplays.push(element.style.display);
    element.style.display = 'none';
  });
  
  // 使用setTimeout确保DOM更新后再截图
  setTimeout(() => {
    html2canvas(document.documentElement, {
      scale: window.devicePixelRatio,
      logging: false,
      useCORS: true,
      // 精确指定当前可视区域
      x: viewportLeft,
      y: viewportTop,
      width: viewportWidth,
      height: viewportHeight,
      // 忽略我们创建的元素
      ignoreElements: (element) => {
        return element.classList.contains('screenshot-overlay') || 
               element.classList.contains('screenshot-selection') ||
               element.classList.contains('screenshot-toolbar') ||
               element.classList.contains('screenshot-size-indicator') ||
               element.getAttribute('data-iframe-overlay') === 'true';
      },
      // 确保正确处理滚动
      scrollX: viewportLeft,
      scrollY: viewportTop,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight
    }).then(canvas => {
      // 恢复任何隐藏的元素
      screenshotElements.forEach((element, index) => {
        element.style.display = originalDisplays[index];
      });
      
      saveScreenshot(canvas.toDataURL('image/png'));
    }).catch(error => {
      console.error('Screenshot capture failed:', error);
      
      // 恢复任何隐藏的元素
      screenshotElements.forEach((element, index) => {
        element.style.display = originalDisplays[index];
      });
      
      // 显示错误通知
      const errorNotice = document.createElement('div');
      errorNotice.style.position = 'fixed';
      errorNotice.style.top = '50%';
      errorNotice.style.left = '50%';
      errorNotice.style.transform = 'translate(-50%, -50%)';
      errorNotice.style.padding = '15px 25px';
      errorNotice.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
      errorNotice.style.color = 'white';
      errorNotice.style.borderRadius = '8px';
      errorNotice.style.zIndex = '2147483647';
      errorNotice.style.textAlign = 'center';
      errorNotice.style.maxWidth = '80%';
      errorNotice.textContent = getTranslation('notification.loadFailed', 'Screenshot capture failed. Please try again.');
      
      document.body.appendChild(errorNotice);
      
      setTimeout(() => {
        if (errorNotice.parentNode) {
          errorNotice.parentNode.removeChild(errorNotice);
        }
      }, 3000);
    });
  }, 50);
}

// 将事件处理函数定义在全局作用域
let handlePointerMove, handlePointerUp;

// 选择区域截屏
function startSelectionCapture() {
  // 初始化语言
  initLanguage();
  
  // 直接创建选择UI，不需要等待语言文件加载
  createSelectionUI();
}

// 创建选择UI
function createSelectionUI() {
  // 创建遮罩层
  overlay = document.createElement('div');
  overlay.className = 'screenshot-overlay';
  
  // 添加样式确保遮罩层覆盖整个页面并接收所有事件
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.zIndex = '2147483647'; // 最高层级
  overlay.style.cursor = 'crosshair';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  document.body.appendChild(overlay);
  
  // 创建选择框
  selection = document.createElement('div');
  selection.className = 'screenshot-selection';
  selection.style.display = 'none';
  selection.style.position = 'fixed';
  selection.style.border = '2px dashed #fff';
  selection.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  selection.style.zIndex = '2147483647';
  selection.style.boxSizing = 'border-box';
  selection.style.pointerEvents = 'none'; // 防止选择框干扰鼠标事件
  document.body.appendChild(selection);
  
  // 创建尺寸指示器
  const sizeIndicator = document.createElement('div');
  sizeIndicator.className = 'screenshot-size-indicator';
  sizeIndicator.style.position = 'fixed';
  sizeIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  sizeIndicator.style.color = 'white';
  sizeIndicator.style.padding = '4px 8px';
  sizeIndicator.style.borderRadius = '4px';
  sizeIndicator.style.fontSize = '12px';
  sizeIndicator.style.zIndex = '2147483647';
  sizeIndicator.style.display = 'none';
  sizeIndicator.style.pointerEvents = 'none';
  document.body.appendChild(sizeIndicator);
  
  // 监听窗口大小变化，调整选择框和工具栏位置
  const resizeHandler = function() {
    if (selection && selection.style.display !== 'none') {
      // 确保选择框不超出视口
      const selLeft = parseInt(selection.style.left);
      const selTop = parseInt(selection.style.top);
      const selWidth = parseInt(selection.style.width);
      const selHeight = parseInt(selection.style.height);
      
      if (selLeft + selWidth > window.innerWidth) {
        selection.style.width = (window.innerWidth - selLeft) + 'px';
      }
      
      if (selTop + selHeight > window.innerHeight) {
        selection.style.height = (window.innerHeight - selTop) + 'px';
      }
    }
    
    if (toolbar) {
      // 重新计算工具栏位置
      const selectionRect = selection.getBoundingClientRect();
      
      let toolbarTop = selectionRect.bottom + 10;
      if (toolbarTop + 50 > window.innerHeight) {
        toolbarTop = selectionRect.top - 50 - 10;
      }
      
      let toolbarLeft = selectionRect.left;
      if (toolbarLeft + 200 > window.innerWidth) {
        toolbarLeft = window.innerWidth - 200 - 10;
      }
      
      toolbar.style.left = toolbarLeft + 'px';
      toolbar.style.top = toolbarTop + 'px';
    }
    
    // 重新处理iframe
    handleIframes();
  };
  
  window.addEventListener('resize', resizeHandler);
  
  // 当选择结束时移除resize监听器
  const cleanupResizeHandler = function() {
    window.removeEventListener('resize', resizeHandler);
    document.removeEventListener('mouseup', cleanupResizeHandler);
  };
  
  document.addEventListener('mouseup', cleanupResizeHandler, { once: true });
  
  // 使用指针事件和鼠标事件双重保障
  function handlePointerDown(e) {
    console.log('指针按下事件触发', e.type);
    
    // 如果工具栏存在，先安全移除它
    if (toolbar) {
      try {
        if (toolbar.parentNode) {
          toolbar.parentNode.removeChild(toolbar);
        }
      } catch (e) {
        console.error('移除工具栏失败:', e);
      }
      toolbar = null;
    }
    
    // 如果已经在选择中，先重置状态
    if (isSelecting) {
      // 保留遮罩层和选择框，但重置其他状态
      selection.style.display = 'none';
      
      // 移除尺寸指示器
      const existingIndicator = document.querySelector('.screenshot-size-indicator');
      if (existingIndicator) {
        existingIndicator.style.display = 'none';
      }
    }
    
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    selection.style.display = 'block';
    
    // 显示尺寸指示器
    let sizeIndicator = document.querySelector('.screenshot-size-indicator');
    if (!sizeIndicator) {
      sizeIndicator = document.createElement('div');
      sizeIndicator.className = 'screenshot-size-indicator';
      sizeIndicator.style.position = 'fixed';
      sizeIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      sizeIndicator.style.color = 'white';
      sizeIndicator.style.padding = '4px 8px';
      sizeIndicator.style.borderRadius = '4px';
      sizeIndicator.style.fontSize = '12px';
      sizeIndicator.style.zIndex = '2147483647';
      sizeIndicator.style.pointerEvents = 'none';
      document.body.appendChild(sizeIndicator);
    }
    
    sizeIndicator.style.display = 'block';
    sizeIndicator.style.left = (e.clientX + 10) + 'px';
    sizeIndicator.style.top = (e.clientY + 10) + 'px';
    sizeIndicator.textContent = '0 x 0';
    
    // 捕获指针以确保即使鼠标移出窗口也能接收事件
    try {
      overlay.setPointerCapture(e.pointerId);
    } catch (err) {
      console.log('不支持指针捕获', err);
    }
    
    // 阻止默认行为和事件冒泡
    e.preventDefault();
    e.stopPropagation();
  }
  
  // 将函数定义移到全局变量
  handlePointerMove = function(e) {
    if (!isSelecting) return;
    
    endX = e.clientX;
    endY = e.clientY;
    
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    // 更新选择框
    selection.style.left = Math.min(startX, endX) + 'px';
    selection.style.top = Math.min(startY, endY) + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
    
    // 更新尺寸指示器
    sizeIndicator.textContent = `${width} x ${height}`;
    
    // 根据鼠标位置调整尺寸指示器位置，避免超出屏幕
    const indicatorX = endX + 10;
    const indicatorY = endY + 10;
    
    // 确保指示器不超出屏幕右侧
    if (indicatorX + sizeIndicator.offsetWidth > window.innerWidth) {
      sizeIndicator.style.left = (endX - sizeIndicator.offsetWidth - 10) + 'px';
    } else {
      sizeIndicator.style.left = indicatorX + 'px';
    }
    
    // 确保指示器不超出屏幕底部
    if (indicatorY + sizeIndicator.offsetHeight > window.innerHeight) {
      sizeIndicator.style.top = (endY - sizeIndicator.offsetHeight - 10) + 'px';
    } else {
      sizeIndicator.style.top = indicatorY + 'px';
    }
    
    // 阻止默认行为和事件冒泡
    e.preventDefault();
    e.stopPropagation();
  };
  
  // 将函数定义移到全局变量
  handlePointerUp = function(e) {
    if (!isSelecting) return;
    
    console.log('指针释放事件触发', e.type);
    isSelecting = false;
    
    endX = e.clientX;
    endY = e.clientY;
    
    // 如果选择的区域太小，则取消选择
    if (Math.abs(endX - startX) < 10 || Math.abs(endY - startY) < 10) {
      console.log('选择区域太小，取消选择');
      cancelSelection();
      return;
    }
    
    console.log('选择区域大小:', Math.abs(endX - startX), Math.abs(endY - startY));
    
    // 隐藏尺寸指示器
    sizeIndicator.style.display = 'none';
    
    // 创建工具栏
    createToolbar();
    
    // 阻止默认行为和事件冒泡
    e.preventDefault();
    e.stopPropagation();
  };
  
  // 添加指针事件监听器（现代浏览器）
  overlay.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', handlePointerUp, true);
  document.addEventListener('pointercancel', handlePointerUp, true);
  
  // 添加鼠标事件监听器（兼容性保障）
  overlay.addEventListener('mousedown', function(e) {
    // 如果已经由指针事件处理，则跳过
    if (e.handled) return;
    e.handled = true;
    
    console.log('鼠标按下事件触发');
    handlePointerDown(e);
  }, true);
  
  // 定义事件处理函数引用
  const mouseMoveHandler = function(e) {
    if (e.handled) return;
    e.handled = true;
    handlePointerMove(e);
  };
  
  const mouseUpHandler = function(e) {
    if (e.handled) return;
    e.handled = true;
    console.log('鼠标释放事件触发');
    handlePointerUp(e);
  };
  
  const touchMoveHandler = function(e) {
    if (!isSelecting || e.touches.length !== 1) return;
    const touch = e.touches[0];
    handlePointerMove({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: function() { e.preventDefault(); },
      stopPropagation: function() { e.stopPropagation(); }
    });
  };
  
  const touchEndHandler = function(e) {
    if (!isSelecting) return;
    console.log('触摸结束事件触发');
    handlePointerUp({
      clientX: endX,
      clientY: endY,
      preventDefault: function() { e.preventDefault(); },
      stopPropagation: function() { e.stopPropagation(); }
    });
  };
  
  // 添加事件监听器，使用命名函数引用
  document.addEventListener('mousemove', mouseMoveHandler, true);
  document.addEventListener('mouseup', mouseUpHandler, true);
  document.addEventListener('touchmove', touchMoveHandler, true);
  document.addEventListener('touchend', touchEndHandler, true);
  
  // 存储事件处理函数引用，以便在 cancelSelection 中使用
  window._screenshotEventHandlers = {
    mouseMoveHandler,
    mouseUpHandler,
    touchMoveHandler,
    touchEndHandler
  };
  
  // 添加键盘事件监听器，支持ESC键取消
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      console.log('按下ESC键，取消选择');
      cancelSelection();
    }
  }, true);
  
  // 添加iframe检测和处理
  handleIframes();
  
  // 添加触摸事件支持
  overlay.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    
    console.log('触摸开始事件触发');
    const touch = e.touches[0];
    handlePointerDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: function() { e.preventDefault(); },
      stopPropagation: function() { e.stopPropagation(); }
    });
  }, true);
  
  document.addEventListener('touchmove', function(e) {
    if (!isSelecting || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    handlePointerMove({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: function() { e.preventDefault(); },
      stopPropagation: function() { e.stopPropagation(); }
    });
  }, true);
  
  document.addEventListener('touchend', function(e) {
    if (!isSelecting) return;
    
    console.log('触摸结束事件触发');
    // 使用最后一个已知的触摸位置
    handlePointerUp({
      clientX: endX,
      clientY: endY,
      preventDefault: function() { e.preventDefault(); },
      stopPropagation: function() { e.stopPropagation(); }
    });
  }, true);
  
  // 添加超时保护，防止事件丢失
  let selectionTimeout = null;
  
  function startSelectionTimeout() {
    // 清除之前的超时
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
    
    // 设置新的超时，如果10秒内没有完成选择，自动取消
    selectionTimeout = setTimeout(function() {
      if (isSelecting) {
        console.log('选择超时，自动取消');
        isSelecting = false;
        cancelSelection();
      }
    }, 10000);
  }
  
  // 开始选择超时保护
  startSelectionTimeout();
}

// 处理iframe
function handleIframes() {
  // 检查页面中的所有iframe
  const iframes = document.querySelectorAll('iframe');
  
  iframes.forEach(function(iframe) {
    try {
      // 创建一个透明覆盖层，防止iframe捕获鼠标事件
      const iframeOverlay = document.createElement('div');
      iframeOverlay.setAttribute('data-iframe-overlay', 'true');
      iframeOverlay.style.position = 'fixed';
      iframeOverlay.style.zIndex = '2147483646'; // 比主遮罩层低一级
      iframeOverlay.style.backgroundColor = 'transparent';
      iframeOverlay.style.pointerEvents = 'auto'; // 确保能接收鼠标事件
      
      // 获取iframe的位置
      const rect = iframe.getBoundingClientRect();
      
      // 设置覆盖层位置
      iframeOverlay.style.top = rect.top + 'px';
      iframeOverlay.style.left = rect.left + 'px';
      iframeOverlay.style.width = rect.width + 'px';
      iframeOverlay.style.height = rect.height + 'px';
      
      // 将覆盖层添加到body
      document.body.appendChild(iframeOverlay);
      
      // 当选择结束时移除覆盖层
      document.addEventListener('mouseup', function() {
        if (iframeOverlay.parentNode) {
          iframeOverlay.parentNode.removeChild(iframeOverlay);
        }
      }, { once: true });
      
    } catch (e) {
      console.log('处理iframe失败:', e);
    }
  });
}

// 取消选择 - 增强版
function cancelSelection() {
  console.log('取消选择');
  
  // 移除所有事件监听器
  try {
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('pointerup', handlePointerUp, true);
    document.removeEventListener('pointercancel', handlePointerUp, true);
    
    // 使用存储的引用移除事件监听器
    if (window._screenshotEventHandlers) {
      document.removeEventListener('mousemove', window._screenshotEventHandlers.mouseMoveHandler, true);
      document.removeEventListener('mouseup', window._screenshotEventHandlers.mouseUpHandler, true);
      document.removeEventListener('touchmove', window._screenshotEventHandlers.touchMoveHandler, true);
      document.removeEventListener('touchend', window._screenshotEventHandlers.touchEndHandler, true);
    }
  } catch (e) {
    console.log('移除事件监听器失败:', e);
  }
  
  // 重置绘图状态
  isDrawing = false;
  
  // 安全地移除元素
  function safeRemoveElement(element) {
    if (element && element.parentNode) {
      try {
        element.parentNode.removeChild(element);
      } catch (e) {
        console.error('移除元素失败:', e);
      }
    }
  }
  
  // 移除遮罩层
  safeRemoveElement(overlay);
  overlay = null;
  
  // 移除选择框
  safeRemoveElement(selection);
  selection = null;
  
  // 移除尺寸指示器
  const sizeIndicator = document.querySelector('.screenshot-size-indicator');
  safeRemoveElement(sizeIndicator);
  
  // 移除工具栏
  safeRemoveElement(toolbar);
  toolbar = null;
  
  // 移除所有iframe覆盖层
  const iframeOverlays = document.querySelectorAll('[data-iframe-overlay="true"]');
  iframeOverlays.forEach(function(overlay) {
    safeRemoveElement(overlay);
  });
  
  // 重置状态
  isSelecting = false;
}

// 创建工具栏
function createToolbar() {
  console.log('Creating toolbar');
  
  // 如果已存在工具栏，先移除
  if (toolbar) {
    try {
      if (toolbar.parentNode) {
        toolbar.parentNode.removeChild(toolbar);
      }
    } catch (e) {
      console.error('移除现有工具栏失败:', e);
    }
    toolbar = null;
  }
  
  // 创建新工具栏
  toolbar = document.createElement('div');
  toolbar.className = 'screenshot-toolbar';
  
  // 设置工具栏样式
  toolbar.style.position = 'fixed';
  toolbar.style.zIndex = '2147483647'; // 确保在最高层级
  toolbar.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  toolbar.style.borderRadius = '4px';
  toolbar.style.padding = '8px';
  toolbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
  toolbar.style.display = 'flex';
  toolbar.style.gap = '8px';
  
  // 计算工具栏位置
  const selectionRect = selection.getBoundingClientRect();
  
  // 确保工具栏不会超出屏幕底部
  let toolbarTop = selectionRect.bottom + 10;
  if (toolbarTop + 50 > window.innerHeight) { // 估计工具栏高度为50px
    toolbarTop = selectionRect.top - 50 - 10; // 放在选择区域上方
  }
  
  // 确保工具栏不会超出屏幕右侧
  let toolbarLeft = selectionRect.left;
  // 工具栏宽度估计为200px
  if (toolbarLeft + 200 > window.innerWidth) {
    toolbarLeft = window.innerWidth - 200 - 10;
  }
  
  toolbar.style.left = toolbarLeft + 'px';
  toolbar.style.top = toolbarTop + 'px';
  
  // 创建确认按钮
  const confirmButton = document.createElement('button');
  confirmButton.textContent = getTranslation("toolbar.confirmScreenshot", "Confirm Screenshot");
  confirmButton.style.backgroundColor = '#4CAF50';
  confirmButton.style.color = 'white';
  confirmButton.style.border = 'none';
  confirmButton.style.padding = '8px 12px';
  confirmButton.style.borderRadius = '4px';
  confirmButton.style.cursor = 'pointer';
  confirmButton.style.fontSize = '14px';
  confirmButton.addEventListener('click', captureSelectedArea);
  
  // 添加按钮悬停效果
  confirmButton.addEventListener('mouseover', function() {
    this.style.backgroundColor = '#45a049';
  });
  confirmButton.addEventListener('mouseout', function() {
    this.style.backgroundColor = '#4CAF50';
  });
  
  toolbar.appendChild(confirmButton);
  
    // 创建取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = getTranslation("cancel", "Cancel");
    cancelButton.className = 'cancel';
    cancelButton.style.backgroundColor = '#f44336';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.padding = '8px 12px';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontSize = '14px';
    cancelButton.addEventListener('click', cancelSelection);
    
    // 添加按钮悬停效果
    cancelButton.addEventListener('mouseover', function() {
      this.style.backgroundColor = '#d32f2f';
    });
    cancelButton.addEventListener('mouseout', function() {
      this.style.backgroundColor = '#f44336';
    });
    
    toolbar.appendChild(cancelButton);
    
    // 添加重新选择按钮
    const reselectButton = document.createElement('button');
    reselectButton.textContent = getTranslation("toolbar.reselect", "Reselect");
    reselectButton.style.backgroundColor = '#2196F3';
    reselectButton.style.color = 'white';
    reselectButton.style.border = 'none';
    reselectButton.style.padding = '8px 12px';
    reselectButton.style.borderRadius = '4px';
    reselectButton.style.cursor = 'pointer';
    reselectButton.style.fontSize = '14px';
    
      // 添加按钮悬停效果
  reselectButton.addEventListener('mouseover', function() {
    this.style.backgroundColor = '#0b7dda';
  });
  reselectButton.addEventListener('mouseout', function() {
    this.style.backgroundColor = '#2196F3';
  });
  
  // 重新选择按钮点击事件
  reselectButton.addEventListener('click', function() {
    // 移除工具栏
    if (toolbar && toolbar.parentNode) {
      toolbar.parentNode.removeChild(toolbar);
      toolbar = null;
    }
    
    // 隐藏选择框，但不移除它
    if (selection) {
      selection.style.display = 'none';
    }
    
    // 重置选择状态，但保留遮罩层
    isSelecting = false;
  });
  
  toolbar.insertBefore(reselectButton, cancelButton);
  
  // 将工具栏添加到DOM
  document.body.appendChild(toolbar);
  
  // 防止工具栏上的点击事件冒泡到遮罩层
  toolbar.addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });
  
  console.log('工具栏按钮已创建');
}

// 截取选择的区域
function captureSelectedArea() {
  const selectionRect = selection.getBoundingClientRect();
  
  // 临时隐藏遮罩和选择框，以便不会被截图
  const originalOverlayDisplay = overlay.style.display;
  const originalSelectionDisplay = selection.style.display;
  const originalToolbarDisplay = toolbar ? toolbar.style.display : 'none';
  
  // 隐藏所有截图相关元素
  overlay.style.display = 'none';
  selection.style.display = 'none';
  if (toolbar) toolbar.style.display = 'none';
  
  // 隐藏所有iframe覆盖层
  const iframeOverlays = document.querySelectorAll('[data-iframe-overlay="true"]');
  const originalIframeOverlaysDisplay = [];
  iframeOverlays.forEach(function(iframeOverlay) {
    originalIframeOverlaysDisplay.push(iframeOverlay.style.display);
    iframeOverlay.style.display = 'none';
  });
  
  // 隐藏尺寸指示器
  const sizeIndicator = document.querySelector('.screenshot-size-indicator');
  const originalSizeIndicatorDisplay = sizeIndicator ? sizeIndicator.style.display : 'none';
  if (sizeIndicator) sizeIndicator.style.display = 'none';
  
  // 使用setTimeout确保DOM更新后再截图
  setTimeout(() => {
    html2canvas(document.documentElement, {
      scale: window.devicePixelRatio,
      logging: false,
      useCORS: true,
      x: window.scrollX + selectionRect.left,
      y: window.scrollY + selectionRect.top,
      width: selectionRect.width,
      height: selectionRect.height,
      // 忽略我们创建的元素
      ignoreElements: (element) => {
        return element.classList.contains('screenshot-overlay') || 
               element.classList.contains('screenshot-selection') ||
               element.classList.contains('screenshot-toolbar') ||
               element.classList.contains('screenshot-size-indicator') ||
               element.getAttribute('data-iframe-overlay') === 'true';
      }
    }).then(canvas => {
      // 截图完成后，恢复元素显示状态（虽然之后会被移除）
      overlay.style.display = originalOverlayDisplay;
      selection.style.display = originalSelectionDisplay;
      if (toolbar) toolbar.style.display = originalToolbarDisplay;
      
      // 恢复iframe覆盖层显示状态
      iframeOverlays.forEach((overlay, index) => {
        overlay.style.display = originalIframeOverlaysDisplay[index];
      });
      
      // 恢复尺寸指示器显示状态
      if (sizeIndicator) sizeIndicator.style.display = originalSizeIndicatorDisplay;
      
      // 保存截图并取消选择
      saveScreenshot(canvas.toDataURL('image/png'));
      cancelSelection();
    });
  }, 50); // 短暂延迟确保DOM更新
}

// 整页截屏
function captureFullPage() {
  // 获取页面的完整高度
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  
  const scrollWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth
  );
  
  html2canvas(document.documentElement, {
    scale: window.devicePixelRatio,
    logging: false,
    useCORS: true,
    windowWidth: scrollWidth,
    windowHeight: scrollHeight,
    width: scrollWidth,
    height: scrollHeight
  }).then(canvas => {
    saveScreenshot(canvas.toDataURL('image/png'));
  });
}

// 保存截图
function saveScreenshot(dataUrl) {
  // 发送消息给background.js保存截图
  chrome.runtime.sendMessage({
    action: "saveScreenshot",
    dataUrl: dataUrl
  });
}
