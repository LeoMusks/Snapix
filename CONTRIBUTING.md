# 贡献指南

感谢您考虑为 Snapix 截图扩展做出贡献！您的参与对我们非常重要，以下是一些指导方针，帮助您更好地参与项目。

## 行为准则

请尊重所有项目参与者，保持友好和建设性的交流。我们希望创建一个开放、包容的社区环境。

## 如何贡献

### 报告 Bug

如果您发现了 Bug，请通过 GitHub Issues 报告，并包含以下信息：

1. 清晰的 Bug 描述
2. 重现步骤
3. 预期行为与实际行为
4. 截图（如适用）
5. 浏览器版本和操作系统信息

### 提交功能请求

如果您有新功能的想法，请通过 GitHub Issues 提交，并包含：

1. 功能描述
2. 为什么这个功能对用户有价值
3. 可能的实现方式（如果您有想法）

### 提交代码

1. Fork 本仓库
2. 创建您的特性分支：`git checkout -b feature/amazing-feature`
3. 提交您的更改：`git commit -m 'Add some amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 代码风格指南

- 使用 2 空格缩进
- 使用有意义的变量和函数名
- 添加必要的注释，特别是对于复杂的逻辑
- 保持代码简洁，避免不必要的复杂性

## 开发设置

### 环境准备

1. 克隆仓库：
   ```
   git clone https://github.com/yourusername/snapix-extension.git
   cd snapix-extension
   ```

2. 在 Chrome 中加载扩展：
   - 打开 Chrome 浏览器，进入扩展管理页面 `chrome://extensions/`
   - 开启右上角的 "开发者模式"
   - 点击 "加载已解压的扩展程序"
   - 选择项目文件夹

### 测试

在提交代码前，请确保：

1. 扩展在不同网站上正常工作
2. 所有截图模式功能正常
3. 编辑功能正常运行
4. 多语言支持正常

## Pull Request 流程

1. 确保您的 PR 描述清晰地说明了更改内容和原因
2. 如果您的 PR 解决了某个 Issue，请在描述中引用该 Issue
3. 确保您的代码通过所有测试
4. 等待维护者审核您的 PR
5. 根据反馈进行必要的修改

## 版本控制

我们使用 [语义化版本控制](https://semver.org/lang/zh-CN/)。版本格式为：主版本号.次版本号.修订号

## 联系方式

如有任何问题，请通过以下方式联系我们：

- 官方网站：[www.gezicode.cn](https://www.gezicode.cn)
- QQ：312549912
- 微信：overabel

感谢您的贡献！ 