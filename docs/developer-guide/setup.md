# 开发环境设置

本文档介绍如何设置 Snapix 截图工具的开发环境，以便您可以修改和测试代码。

## 前提条件

在开始之前，请确保您的系统满足以下要求：

- **操作系统**：Windows、macOS 或 Linux
- **浏览器**：Chrome 88+ 或其他基于 Chromium 的浏览器（如 Edge、Brave）
- **开发工具**：
  - Git
  - 文本编辑器或 IDE（推荐 Visual Studio Code）
  - 基本的 Web 开发知识（HTML、CSS、JavaScript）

## 获取源代码

### 克隆仓库

```bash
git clone https://github.com/LeoMusks/Snapix.git
cd Snapix
```

### 目录结构

克隆完成后，您将看到以下目录结构：

```
Snapix/
├── .github/            # GitHub 相关配置
├── docs/               # 文档
├── fonts/              # 字体文件
├── images/             # 图标和图片
├── lib/                # 第三方库
├── styles/             # CSS 样式文件
├── background.js       # 后台服务脚本
├── content.js          # 内容脚本
├── languages.js        # 多语言支持
├── manifest.json       # 扩展配置文件
├── popup.html          # 弹出窗口 HTML
├── popup.js            # 弹出窗口脚本
├── preview.html        # 预览页面 HTML
├── preview.js          # 预览页面脚本
├── LICENSE             # 许可证文件
└── README.md           # 项目说明
```

## 安装扩展

### 开发者模式安装

1. 打开 Chrome 浏览器，进入扩展管理页面：
   - 在地址栏输入 `chrome://extensions/`
   - 或者点击菜单 -> 更多工具 -> 扩展程序

2. 开启右上角的 "开发者模式"

3. 点击 "加载已解压的扩展程序"

4. 选择您克隆的 Snapix 目录

5. 扩展应该会出现在您的扩展列表中，并在工具栏显示图标

## 开发工作流

### 修改代码

1. 使用您喜欢的编辑器打开项目目录
2. 修改相关文件
3. 保存更改

### 测试更改

1. 在 Chrome 扩展管理页面 (`chrome://extensions/`)
2. 找到 Snapix 扩展
3. 点击 "重新加载" 按钮（刷新图标）
4. 测试您的更改

对于某些更改（特别是 `manifest.json` 的更改），您可能需要完全重新加载扩展：
1. 在扩展管理页面点击 "删除"
2. 重新加载已解压的扩展程序

### 调试技巧

#### 调试弹出窗口

1. 右键点击 Snapix 图标
2. 选择 "检查弹出内容"
3. 将打开 Chrome 开发者工具，您可以查看控制台输出和调试 JavaScript

#### 调试内容脚本

1. 在网页上右键点击
2. 选择 "检查"
3. 在开发者工具中，转到 "控制台" 标签
4. 您可以看到 `content.js` 的日志输出

#### 调试后台脚本

1. 在扩展管理页面找到 Snapix
2. 点击 "背景页" 链接
3. 将打开开发者工具，您可以调试 `background.js`

#### 调试预览页面

1. 打开预览页面（通过截图操作）
2. 右键点击页面
3. 选择 "检查"
4. 使用开发者工具调试 `preview.js`

## 构建和打包

### 手动打包

1. 确保您的代码已经测试通过
2. 在扩展管理页面，点击 "打包扩展程序" 按钮
3. 选择 Snapix 目录
4. 点击 "打包扩展程序"
5. 将生成 `.crx` 文件和私钥文件

### 使用 web-ext 工具

您也可以使用 Mozilla 的 `web-ext` 工具来构建扩展：

1. 安装 Node.js 和 npm
2. 安装 web-ext：`npm install -g web-ext`
3. 在项目目录中运行：`web-ext build`
4. 打包后的扩展将在 `web-ext-artifacts` 目录中

## 贡献代码

### 创建分支

```bash
git checkout -b feature/your-feature-name
```

### 提交更改

```bash
git add .
git commit -m "Add your feature description"
```

### 推送到 GitHub

```bash
git push origin feature/your-feature-name
```

### 创建 Pull Request

1. 访问 [Snapix GitHub 仓库](https://github.com/LeoMusks/Snapix)
2. 点击 "Pull requests" 标签
3. 点击 "New pull request"
4. 选择您的分支
5. 填写 PR 描述
6. 提交 PR

## 常见问题

### 扩展无法加载

- 检查 `manifest.json` 是否有语法错误
- 确保所有必要的文件都存在
- 查看 Chrome 扩展管理页面的错误消息

### 内容脚本不工作

- 检查 `manifest.json` 中的 `content_scripts` 配置
- 确保目标网站不在排除列表中
- 在控制台中查找错误消息

### 权限问题

- 检查 `manifest.json` 中的 `permissions` 配置
- 确保请求了必要的权限
- 重新安装扩展以应用权限更改

## 下一步

- 查看 [架构概述](architecture.html) 了解代码结构
- 查看 [代码结构](code-structure.html) 了解各个文件的详细功能
- 查看 [API 文档](../api/index.html) 了解可用的 API 