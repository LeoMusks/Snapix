# 代码结构

本页面详细介绍 Snapix 截图扩展的代码结构，帮助开发者理解各个文件的功能和相互关系。

## 核心文件

### manifest.json

扩展的配置文件，定义了扩展的基本信息、权限和组件。

```json
{
  "manifest_version": 3,
  "name": "Snapix - Screenshots in One Snap",
  "version": "1.2.0",
  "description": "Capture, edit and save screenshots with ease",
  "permissions": [
    "activeTab",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {...}
  },
  "background": {
    "service_worker": "background.js"
  },
  "icons": {...},
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["languages.js", "lib/html2canvas.min.js", "content.js"],
      "run_at": "document_end"
    }
  ],
  "web_accessible_resources": [...]
}
```

主要部分：
- **permissions**：扩展需要的权限
- **action**：定义点击扩展图标时的行为
- **background**：定义后台服务脚本
- **content_scripts**：定义在网页中运行的脚本

### popup.html / popup.js

弹出界面的 HTML 和 JavaScript 文件。

**popup.html** 定义了弹出界面的结构：
- 标题区域
- 截图选项按钮（可视区域、选择区域、整页）
- 语言设置选项

**popup.js** 实现了弹出界面的功能：
- 初始化语言设置
- 处理截图按钮点击事件
- 向内容脚本发送消息
- 管理语言切换

关键函数：
- `initLanguage()`：初始化语言设置
- `updatePageLanguage()`：更新页面文本
- `captureVisibleArea()`：捕获可视区域
- `captureSelectedArea()`：捕获选定区域
- `captureFullPage()`：捕获整个页面

### content.js

在网页中执行的内容脚本，负责实际的截图操作。

主要功能：
- 监听来自弹出界面的消息
- 实现不同的截图模式
- 创建选择区域的交互界面
- 将截图数据发送给后台服务

关键函数：
- `captureVisibleArea()`：捕获可视区域
- `startSelectionCapture()`：开始选择区域截图
- `captureFullPage()`：捕获整个页面
- `createOverlay()`：创建选择区域的遮罩
- `handleMouseDown/Move/Up()`：处理鼠标事件
- `captureScreenshot()`：使用 html2canvas 捕获截图

### background.js

扩展的后台服务，负责管理数据和处理保存操作。

主要功能：
- 存储和管理截图数据
- 创建预览标签页
- 处理保存请求
- 监听消息

关键函数：
- `showScreenshotPreview()`：显示截图预览
- `saveScreenshot()`：保存截图
- `notifyPreviewPage()`：通知预览页面保存结果
- `generateFilename()`：生成文件名

### preview.html / preview.js

截图预览和编辑界面。

**preview.html** 定义了预览界面的结构：
- 顶部工具栏（保存、另存为、取消）
- 左侧编辑工具栏
- 中央预览区域
- 编辑画布

**preview.js** 实现了预览和编辑功能：
- 显示截图
- 提供编辑工具（矩形、箭头、文本等）
- 处理编辑操作
- 发送保存请求

关键函数：
- `prepareCanvas()`：准备编辑画布
- `initEditTools()`：初始化编辑工具
- `handleToolClick()`：处理工具点击事件
- `drawRectangle/Arrow/Text()`：绘制各种图形
- `applyMosaic()`：应用马赛克效果
- `cropImage()`：裁剪图片
- `saveScreenshot()`：保存截图

### languages.js

多语言支持文件，包含不同语言的翻译。

结构：
```javascript
window.languages = {
  "en": {
    "appName": "Snapix - Screenshots in One Snap",
    "buttons": {
      "visibleArea": "Capture Visible Area",
      // ...
    },
    // ...
  },
  "zh-CN": {
    "appName": "Snapix - 一键截图工具",
    "buttons": {
      "visibleArea": "捕获可视区域",
      // ...
    },
    // ...
  },
  // 其他语言...
};
```

## 辅助文件

### styles/

包含 CSS 样式文件：
- **popup.css**：弹出界面样式
- **content.css**：内容脚本样式（选择区域遮罩等）

### images/

包含图标和图片资源：
- **icon16.png**、**icon48.png**、**icon128.png**：扩展图标
- **screenshot.png**：示例截图

### lib/

包含第三方库：
- **html2canvas.min.js**：用于网页截图的库

### fonts/

包含自定义字体文件（如果有）。

## 代码组织

### 模块化设计

Snapix 采用模块化设计，将不同功能分离到不同文件中：
- **UI 层**：popup.html/js 和 preview.html/js
- **业务逻辑层**：content.js 和 background.js
- **数据层**：background.js 中的数据管理
- **国际化**：languages.js

### 通信机制

组件之间通过 Chrome 消息传递 API 进行通信：

```javascript
// 发送消息
chrome.tabs.sendMessage(tabId, { action: "captureVisible" });

// 接收消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "captureVisible") {
    // 处理消息
  }
});
```

### 状态管理

- **临时状态**：使用变量存储在各个脚本中
- **持久状态**：使用 Chrome 存储 API 保存（如语言设置）

```javascript
// 保存设置
chrome.storage.local.set({ 'language': currentLanguage });

// 读取设置
chrome.storage.local.get('language', function(data) {
  if (data.language) {
    currentLanguage = data.language;
  }
});
```

## 代码流程

### 初始化流程

1. 用户安装扩展
2. background.js 加载并初始化
3. 用户点击扩展图标
4. popup.html 加载并显示
5. popup.js 初始化语言设置和事件监听器

### 截图流程

1. 用户在弹出界面选择截图模式
2. popup.js 向当前标签页发送消息
3. content.js 接收消息并执行相应的截图操作
4. content.js 将截图数据发送给 background.js
5. background.js 创建新标签页显示预览
6. preview.js 从 background.js 获取截图数据并显示

### 编辑流程

1. 用户在预览界面选择编辑工具
2. preview.js 激活相应的编辑模式
3. 用户在画布上进行编辑操作
4. preview.js 实时渲染编辑效果
5. 用户点击"应用编辑"按钮确认更改
6. preview.js 将编辑后的图像替换原始截图

### 保存流程

1. 用户点击"保存"或"另存为"按钮
2. preview.js 向 background.js 发送保存请求
3. background.js 使用 Chrome 下载 API 保存截图
4. background.js 通知 preview.js 保存结果
5. preview.js 显示保存成功或失败的消息

## 扩展点

### 添加新的编辑工具

1. 在 preview.js 中的 `initEditTools()` 函数中添加新工具
2. 实现工具的处理函数
3. 在 preview.html 中添加工具按钮
4. 在 languages.js 中添加工具的翻译

### 添加新的截图模式

1. 在 popup.html 中添加新的模式按钮
2. 在 popup.js 中添加按钮的事件处理
3. 在 content.js 中实现新的截图模式
4. 在 languages.js 中添加新模式的翻译

### 添加新的语言

在 languages.js 中添加新的语言对象：

```javascript
"fr": {
  "appName": "Snapix - Captures d'écran en un clic",
  "buttons": {
    "visibleArea": "Capturer la zone visible",
    // ...
  },
  // ...
}
```

## 性能优化

### 内存管理

- 使用 `URL.createObjectURL()` 代替大型 Base64 字符串
- 在不需要时释放资源：`URL.revokeObjectURL()`
- 使用 `setTimeout()` 延迟清理大型数据

### 渲染优化

- 使用 `requestAnimationFrame()` 进行平滑动画
- 避免在滚动或调整大小时进行复杂计算
- 使用 CSS 硬件加速（transform、opacity）

### 异步操作

- 使用 Promise 和 async/await 处理异步操作
- 避免阻塞主线程
- 使用消息传递进行组件间通信 