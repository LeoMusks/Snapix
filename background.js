// 添加内存存储对象
const screenshotCache = {};

// 监听来自content.js的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "saveScreenshot") {
    // 新开标签页显示预览
    showScreenshotPreview(request.dataUrl, sender.tab.id);
    return true;
  } else if (request.action === "confirmSaveScreenshot") {
    // 用户在预览页点击保存按钮后的保存操作
    saveScreenshot(request.dataUrl, request.saveAs, sender.tab.id);
    sendResponse({success: true});
    return true;
  } else if (request.action === "directSaveScreenshot") {
    // 生成文件名
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    const filename = `screenshot_${timestamp}.png`;
    
    // 直接使用 dataUrl 进行下载，不需要转换为 Blob
    chrome.downloads.download({
      url: request.dataUrl,
      filename: filename,
      saveAs: request.saveAs
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        // 通知预览页面保存失败
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "saveComplete",
          success: false,
          saveAs: request.saveAs
        });
      } else {
        // 通知预览页面保存成功
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "saveComplete",
          success: true,
          saveAs: request.saveAs
        });
      }
    });
    
    // 返回 true 以保持消息通道开放
    sendResponse({success: true});
    return true;
  } else if (request.action === "getScreenshotData") {
    const dataId = request.dataId;
    if (screenshotCache[dataId]) {
      sendResponse(screenshotCache[dataId]);
      // 数据已使用，可以删除
      delete screenshotCache[dataId];
    } else {
      sendResponse({error: "数据不存在或已过期"});
    }
    return true;
  }
});

// 监听来自预览页面的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "saveScreenshot") {
    // 保存截图
    // saveScreenshot(message.dataUrl, message.saveAs, message.tabId);
    // 立即返回，表示我们会异步处理
    sendResponse({received: true});
    return true;
  }
});

// 显示截图预览
function showScreenshotPreview(dataUrl, sourceTabId) {
  // 生成唯一ID
  const dataId = Date.now().toString();
  
  // 将数据存储在内存中
  screenshotCache[dataId] = {
    dataUrl: dataUrl,
    sourceTabId: sourceTabId,
    timestamp: Date.now()
  };
  
  // 创建新标签页显示预览，传递ID而不是数据
  chrome.tabs.create({
    url: chrome.runtime.getURL(`preview.html?id=${dataId}`),
    active: true
  });
  
  // 设置超时清理，防止内存泄漏
  setTimeout(() => {
    if (screenshotCache[dataId]) {
      delete screenshotCache[dataId];
    }
  }, 60000); // 1分钟后清理
}

// 保存截图
function saveScreenshot(dataUrl, saveAs, tabId) {
  // 生成文件名
  const date = new Date();
  const fileName = `screenshot_${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}_${padZero(date.getHours())}-${padZero(date.getMinutes())}-${padZero(date.getSeconds())}.png`;
  
  // 下载图片
  chrome.downloads.download({
    url: dataUrl,
    filename: fileName,
    saveAs: saveAs
  }, function(downloadId) {
    if (chrome.runtime.lastError) {
      notifyPreviewPage(tabId, false, saveAs);
      return;
    }

    // 监听下载完成事件
    chrome.downloads.onChanged.addListener(function downloadListener(delta) {
      if (delta.id === downloadId) {
        if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
          chrome.downloads.onChanged.removeListener(downloadListener);
          notifyPreviewPage(tabId, delta.state.current === 'complete', saveAs);
        }
      }
    });
  });
}

// 通知预览页面
function notifyPreviewPage(tabId, success, saveAs) {
  // 检查标签页是否存在
  try {
    chrome.tabs.get(tabId, function(tab) {
      if (chrome.runtime.lastError || !tab) {
        console.log('预览页面已关闭或不存在:', chrome.runtime.lastError);
        return;
      }
      
      console.log('准备发送消息到标签页:', tabId);
      
      // 直接发送消息，不检查URL
      // 因为我们已经知道这是预览页面的标签ID
      chrome.tabs.sendMessage(tabId, {
        action: "saveComplete",
        success: success,
        saveAs: saveAs
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('发送消息失败:', chrome.runtime.lastError);
        } else {
          console.log('消息发送成功，响应:', response);
        }
      });
    });
  } catch (error) {
    console.error('通知预览页面时出错:', error);
  }
}

// 补零函数
function padZero(num) {
  return num.toString().padStart(2, '0');
}

// 辅助函数：将 base64 转换为 Blob
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, {type: mimeType});
}

// 辅助函数：生成文件名
function generateFilename() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `screenshot_${year}${month}${day}_${hours}${minutes}${seconds}.png`;
}
