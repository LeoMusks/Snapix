# API 文档

本文档介绍 Snapix 截图工具提供的 API，可用于与扩展进行交互或扩展其功能。

## 消息 API

Snapix 使用 Chrome 的消息传递 API 在不同组件之间通信。您可以使用这些消息与扩展交互。

### 发送消息到内容脚本

```javascript
// 发送消息到当前标签页的内容脚本
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {
    action: "actionName",
    // 其他参数...
  });
});
```

### 支持的消息操作

#### 截图操作

| 操作名称 | 描述 | 参数 | 示例 |
|---------|------|------|------|
| `captureVisible` | 捕获可视区域 | 无 | `{action: "captureVisible"}` |
| `captureSelection` | 选择区域截图 | 无 | `{action: "captureSelection"}` |
| `captureFullPage` | 捕获整个页面 | 无 | `{action: "captureFullPage"}` |
| `setLanguage` | 设置语言 | `language`: 语言代码 | `{action: "setLanguage", language: "zh-CN"}` |

#### 预览操作

| 操作名称 | 描述 | 参数 | 示例 |
|---------|------|------|------|
| `saveScreenshot` | 保存截图 | `dataUrl`: 图像数据 | `{action: "saveScreenshot", dataUrl: "data:image/png;base64,..."}` |
| `confirmSaveScreenshot` | 确认保存截图 | `dataUrl`: 图像数据<br>`saveAs`: 是否使用另存为 | `{action: "confirmSaveScreenshot", dataUrl: "...", saveAs: true}` |
| `directSaveScreenshot` | 直接保存截图 | `dataUrl`: 图像数据<br>`saveAs`: 是否使用另存为 | `{action: "directSaveScreenshot", dataUrl: "...", saveAs: false}` |
| `getScreenshotData` | 获取截图数据 | `dataId`: 数据ID | `{action: "getScreenshotData", dataId: "12345"}` |

### 监听消息

```javascript
// 监听来自扩展其他部分的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "actionName") {
    // 处理消息...
    
    // 发送响应（可选）
    sendResponse({success: true, data: "响应数据"});
  }
  
  // 返回 true 表示将异步发送响应
  return true;
});
```

## 存储 API

Snapix 使用 Chrome 的存储 API 保存设置和偏好。

### 保存数据

```javascript
// 保存数据到本地存储
chrome.storage.local.set({
  'key': value
}, function() {
  console.log('数据已保存');
});
```

### 读取数据

```javascript
// 从本地存储读取数据
chrome.storage.local.get('key', function(data) {
  console.log('获取的数据:', data.key);
});
```

### 存储的键

| 键名 | 类型 | 描述 | 默认值 |
|-----|------|------|-------|
| `language` | 字符串 | 用户选择的语言 | `"en"` |
| `tempScreenshot` | 字符串 | 临时存储的截图数据（Base64） | 无 |

## 扩展 API

### 添加新的编辑工具

您可以通过扩展 `preview.js` 中的工具定义来添加新的编辑工具：

```javascript
// 在 preview.js 中添加新工具
function initEditTools() {
  // 现有工具...
  
  // 添加新工具
  const newTool = {
    name: 'newTool',
    icon: '🔧',
    tooltip: getTranslation('edit.newTool', 'New Tool'),
    action: function() {
      currentTool = 'newTool';
      // 工具初始化逻辑...
    }
  };
  
  // 将新工具添加到工具栏
  toolbarItems.push(newTool);
  
  // 添加工具的事件处理
  canvas.addEventListener('mousedown', function(e) {
    if (currentTool === 'newTool') {
      // 处理鼠标按下事件...
    }
  });
  
  // 添加其他必要的事件处理...
}

// 实现工具的绘制逻辑
function drawNewTool(ctx, params) {
  // 绘制逻辑...
}
```

### 添加新的语言

您可以通过扩展 `languages.js` 中的语言定义来添加新的语言支持：

```javascript
// 在 languages.js 中添加新语言
window.languages["fr"] = {
  "appName": "Snapix - Captures d'écran en un clic",
  "preview": "Aperçu",
  "loading": "Chargement de la capture d'écran...",
  // 添加所有必要的翻译...
};
```

然后在 `popup.html` 中添加语言选项：

```html
<select id="languageSelector">
  <!-- 现有选项... -->
  <option value="fr">Français</option>
</select>
```

## 事件 API

Snapix 在不同的操作阶段触发自定义事件，您可以监听这些事件来扩展功能。

### 截图事件

```javascript
// 监听截图完成事件
document.addEventListener('snapix:screenshotTaken', function(e) {
  const screenshotData = e.detail.dataUrl;
  // 处理截图数据...
});
```

### 支持的事件

| 事件名称 | 触发时机 | 事件数据 | 示例 |
|---------|---------|---------|------|
| `snapix:screenshotTaken` | 截图完成时 | `dataUrl`: 截图数据 | `{dataUrl: "data:image/png;base64,..."}` |
| `snapix:editApplied` | 应用编辑时 | `editType`: 编辑类型 | `{editType: "rectangle"}` |
| `snapix:saveComplete` | 保存完成时 | `success`: 是否成功<br>`saveAs`: 是否使用另存为 | `{success: true, saveAs: false}` |

## 样式自定义

您可以通过 CSS 自定义扩展的外观：

```css
/* 自定义弹出窗口样式 */
.snapix-popup {
  /* 自定义样式... */
}

/* 自定义编辑工具样式 */
.snapix-toolbar {
  /* 自定义样式... */
}

/* 自定义预览界面样式 */
.snapix-preview {
  /* 自定义样式... */
}
```

## 集成示例

### 在网页中集成 Snapix

```javascript
// 在网页中添加截图按钮
const captureButton = document.createElement('button');
captureButton.textContent = 'Capture Screenshot';
captureButton.addEventListener('click', function() {
  // 向 Snapix 内容脚本发送消息
  window.postMessage({
    type: 'snapix:capture',
    action: 'captureVisible'
  }, '*');
});
document.body.appendChild(captureButton);

// 监听截图完成消息
window.addEventListener('message', function(event) {
  if (event.data.type === 'snapix:screenshotTaken') {
    const screenshotData = event.data.dataUrl;
    // 处理截图数据...
  }
});
```

### 在其他扩展中使用 Snapix

```javascript
// 在其他扩展中调用 Snapix
chrome.runtime.sendMessage('snapix_extension_id', {
  action: 'captureVisible'
}, function(response) {
  if (response && response.success) {
    const screenshotData = response.dataUrl;
    // 处理截图数据...
  }
});
```

## 错误处理

Snapix API 在出错时会返回错误信息：

```javascript
// 错误处理示例
chrome.runtime.sendMessage({
  action: 'getScreenshotData',
  dataId: 'invalid_id'
}, function(response) {
  if (response.error) {
    console.error('Error:', response.error);
    // 处理错误...
  } else {
    // 处理成功响应...
  }
});
```

## 限制和注意事项

1. **权限限制**：某些操作需要特定权限，确保您的扩展或网页有适当的权限
2. **跨域限制**：截图操作受到跨域限制，无法截取某些受保护的内容
3. **性能考虑**：处理大型截图时要注意内存使用
4. **安全考虑**：验证所有输入数据，特别是来自外部的消息

## 未来计划

我们计划在未来版本中提供更完善的公共 API，包括：

1. 更稳定的消息接口
2. 更多的自定义选项
3. 更好的错误处理和反馈机制
4. 插件系统，支持第三方开发者扩展功能

如果您有关于 API 的建议或需求，请通过 [GitHub Issues](https://github.com/LeoMusks/Snapix/issues) 提交反馈。 