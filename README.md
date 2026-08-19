# ChatGPT Message Navigator for Codex++

为 Codex Desktop 的 **ChatGPT 模式**补充类似 Codex 对话页的灰色消息导航条。

## 演示

<p align="center">
  <img src="https://raw.githubusercontent.com/Takizzl/chatgpt-message-navigator/efd75e6/assets/demo.png" alt="ChatGPT Message Navigator 演示" width="50%">
</p>

## 功能

- 从 ChatGPT 内部对话数据读取全部用户提问，包括尚未渲染到页面的较早消息
- 为每条用户提问生成灰色短线，不收录 GPT 回答
- 点击短线立即跳转到对应提问；较早消息会先自动加载再精确定位
- 悬停短线显示该条提问摘要，移开鼠标后立即隐藏
- 在导航条上滚动滚轮只切换预览选中项，不滚动或跳转聊天正文；预览会自动隐藏
- 使用普通鼠标指针，不显示额外历史面板或自定义滚动条
- 自动高亮当前阅读位置
- 新消息出现后自动更新，但不会主动弹出预览框
- 切换其他聊天再返回时保持在最后一条提问，避免回弹到最早历史
- 仅在 ChatGPT 模式显示，不与 Codex 原生导航条重叠
- 不修改聊天记录，不创建对话分支

## 环境要求

- Windows 版 Codex Desktop
- [Codex++](https://github.com/BigPizzaV3/CodexPlusPlus) 用户脚本管理功能

已验证环境：Codex Desktop `26.814.5167`、Codex++ `1.2.47`。

## 安装

### Codex++ 脚本市场

市场合并后，可在 Codex++ 的脚本市场中搜索 **ChatGPT Message Navigator** 并安装。

### 手动安装

1. 下载 [`chatgpt-message-navigator.js`](./chatgpt-message-navigator.js)。
2. 将文件放入：

   ```text
   %APPDATA%\Codex++\user_scripts\
   ```

3. 在 Codex++ 用户脚本页面启用该脚本。
4. 重新加载 Codex，切换到 ChatGPT 模式。

## 使用

导航条位于聊天内容区域左侧：

- 点击灰色短线：跳转到对应提问
- 悬停灰色短线：临时查看该条提问摘要
- 在导航条上滚动滚轮：逐条选择并预览提问；滚轮本身不会跳转正文
- 较深、较长的短线：当前阅读位置

## 兼容性说明

本脚本依赖 Codex Desktop 当前页面结构。Codex 更新界面后如果导航条失效，请提交 Issue，并附上 Codex 与 Codex++ 版本。

## License

[MIT](./LICENSE)
