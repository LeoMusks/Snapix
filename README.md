# Snapix - 一键截图工具

<p align="center">
  <img src="images/icon128.png" alt="Snapix Logo" width="128" height="128">
</p>

<p align="center">
  一款功能强大的浏览器截图扩展，让您轻松捕获、编辑和保存网页截图
</p>

<p align="center">
  <a href="#功能特点">功能特点</a> •
  <a href="#安装方法">安装方法</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#技术架构">技术架构</a> •
  <a href="#贡献指南">贡献指南</a> •
  <a href="#许可证">许可证</a>
</p>

## 功能特点

### 多种截图模式
- **可视区域截图**：捕获当前浏览器窗口可见的内容
- **选择区域截图**：自由选择您想要截取的区域
- **整页截图**：捕获整个网页，包括滚动部分

### 强大的编辑功能
- **矩形标注**：绘制矩形突出显示重要内容
- **箭头指示**：添加箭头指向关键元素
- **文本注释**：在截图上添加文字说明
- **马赛克处理**：保护敏感信息
- **裁剪功能**：精确裁剪截图区域
- **拖动模式**：自由调整截图位置

### 其他特性
- **多语言支持**：支持英语、简体中文、日语和西班牙语
- **离线使用**：无需网络连接也能正常使用
- **快速保存**：一键保存或另存为指定格式
- **美观界面**：现代化UI设计，操作简单直观

## 安装方法

### Chrome 应用商店安装
1. 访问 [Chrome 网上应用店](https://chrome.google.com/webstore)（即将上线）
2. 搜索 "Snapix - 一键截图工具"
3. 点击 "添加至 Chrome"

### 开发者模式安装
1. 下载本仓库代码并解压
2. 打开 Chrome 浏览器，进入扩展管理页面 `chrome://extensions/`
3. 开启右上角的 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择解压后的文件夹

## 使用说明

### 基本使用
1. 点击浏览器工具栏中的 Snapix 图标
2. 从弹出菜单中选择截图模式：
   - 捕获可视区域
   - 选择区域截图
   - 捕获整个页面
3. 根据选择的模式进行操作
4. 在预览页面编辑截图（可选）
5. 点击 "保存" 或 "另存为" 按钮保存截图

### 编辑功能使用
在预览页面，您可以使用以下工具编辑截图：
- **矩形**：点击工具后在截图上拖动绘制矩形
- **箭头**：点击工具后拖动创建箭头
- **文本**：点击工具后点击截图添加文本
- **马赛克**：点击工具后在敏感信息上涂抹
- **裁剪**：点击工具后选择要保留的区域
- **拖动**：点击工具后可自由移动截图位置

### 快捷键
- 缩放预览：使用鼠标滚轮或触控板手势
- 取消编辑：按 ESC 键
- 确认编辑：按 Enter 键

## 技术架构

### 核心文件
- **manifest.json**：扩展配置文件
- **popup.html/popup.js**：弹出窗口界面和逻辑
- **content.js**：网页内容脚本，处理截图捕获
- **background.js**：后台服务，管理数据传输和存储
- **preview.html/preview.js**：预览和编辑界面
- **languages.js**：多语言支持

### 使用的技术
- HTML5 Canvas 用于图像编辑
- Chrome Extension API 用于跨页面通信
- html2canvas 库用于页面捕获
- 原生 JavaScript 实现所有功能，无外部依赖

## 贡献指南

我们欢迎所有形式的贡献，包括但不限于：
- 报告 Bug
- 提交功能请求
- 提交代码改进
- 完善文档

### 贡献步骤
1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 联系方式

- 官方网站：[www.gezicode.cn](https://www.gezicode.cn)
- QQ：312549912
- 微信：overabel

---

<p align="center">
  Made with ❤️ by <a href="https://www.gezicode.cn">Snapix Team</a>
</p>
