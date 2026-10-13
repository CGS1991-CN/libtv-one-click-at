# LibTV One-Click @ · LibTV 一键绑定 @

<img src="assets/icon.png" width="96" height="96" alt="LibTV One-Click @ icon">

把提示词中的明确编号转换成 LibTV 原生参考图片标签，不依赖语义猜图，也不自动开始生成。

**本项目包含 Chrome 扩展和 Codex 安装助手。助手自动准备文件，但首次加载到 Chrome 仍需用户确认。不是 LibTV 官方插件，也不是已上架 Chrome Web Store 或 OpenAI 公共插件目录的产品。**

## 功能

- 支持 `@image1`、`@image 1`、`@图片1`、`@图片 1`、`@图1`、`@图 1`，可混用、重复、乱序。
- 严格对应当前编辑器参考缩略图上的数字，而不是画布节点名称里的数字。
- 获取每张图片的原生引用标签并核对图片身份，再一次性转换原文。
- 缺图、无效编号、非图片素材或校验失败时停止，不猜测替换。
- 关闭当前编辑器的 AutoLink；支持在没有后续编辑的情况下撤销本次绑定。
- 不调用生成接口、不点击生成按钮、不发送 Enter；没有后台服务、遥测或账户令牌。

## 在 Codex 里说这一句话

> 请从 https://github.com/CGS1991-CN/libtv-one-click-at 安装并启用“LibTV 一键绑定 @”的 Codex 安装助手，自动准备并校验 Chrome 扩展文件，保留已有配置且不开始生成，只在 Chrome 必须人工加载时告诉我最短步骤。

Codex 可以处理下载、安装助手注册、校验、文件准备及旧文件备份。首次 **Load unpacked** 以及扩展更新后的 **Reload** 仍是 Chrome 的加载步骤；当前 Codex 浏览器工具不能操作 Chrome 系统页面，不支持绕过这项限制。安装过程中也可能出现平台要求的权限确认。

CLI 支持插件功能的用户可运行以下两条命令；先检查当前版本的 `codex plugin ... --help`，不要覆盖原有配置：

```sh
codex plugin marketplace add CGS1991-CN/libtv-one-click-at --ref v1.0.4
codex plugin add libtv-one-click-at@libtv-one-click-at-marketplace --json
```

安装助手不需要 LibTV OAuth、GitHub 私有仓库权限或任何 API Key。若新安装的 skill 暂未出现在当前对话，可让 Codex 直接读取仓库中的 [安装 skill](skills/libtv-one-click-at-install/SKILL.md) 并运行准备脚本，或在新对话使用。

## 直接安装 Chrome 扩展

1. 从 [Releases](https://github.com/CGS1991-CN/libtv-one-click-at/releases) 下载 `libtv-one-click-at-chrome-1.0.4.zip`，解压。
2. Chrome 打开 `chrome://extensions`，启用“开发者模式”，点“加载已解压的扩展程序”，选择含 `manifest.json` 的 `libtv-one-click-at` 目录。
3. 刷新 LibTV 画布，打开图片或视频生成节点。粘贴提示词后点击 **一键绑定 @**，检查完成提示，再自行决定何时生成。

也可以让 Codex 在本仓库执行：

```sh
node scripts/prepare-chrome-extension.cjs --json
```

脚本会输出稳定安装目录；可用 `--dry-run` 只检查，或 `--dest "指定目录"` 选择路径。已有同名扩展先备份，陌生目录、额外文件和符号链接拒绝覆盖。脚本不修改 Chrome 配置、系统策略或安全设置。

## 例子

```text
办公室参考 @图片 1，人物参考 @图2，手里的网兜参考 @image3。
同一个人物再次使用 @图片 2。
```

编号 1、2、3 必须是参考缩略图的实际编号。`@图一`、`@图片01` 等模糊写法不被猜测接受。混合图片/视频/音频参考时，指定编号必须指向图片。

## 开发与验证

无 npm 依赖，Node.js 18 或更新版本：

```sh
node --test tests/*.test.cjs
node --check extension/content.js
node scripts/prepare-chrome-extension.cjs --dry-run --json
```

浏览器夹具：在仓库根目录启动静态文件服务，打开 `tests/browser-fixture.html`，点击“运行浏览器验收”。这是复现原生编辑器结构的本地测试，不是真实账号画布。发布包不包含用户画布截图、项目标识、账户余额或认证数据。

修改扩展后执行 `node scripts/build-checksums.cjs` 并检查 diff；不要在安装过程中重新生成校验值来掩盖文件不一致。

发布者在检查并提交源码后可执行 `node scripts/package-release.cjs`，生成 Chrome ZIP、完整 Codex ZIP 和 `SHA256SUMS.txt`。需要 Git 与 zip；打包脚本拒绝未提交的工作区，以保持发布内容一致。

扩展及安装助手的验证边界见 [VALIDATION.md](VALIDATION.md)。网站编辑器结构变化时，转换可能停止并提示无法核实。撤销记录仅存在当前编辑器内存，刷新、关闭或全屏切换后会丢失。禁用扩展不会自动重新开启 AutoLink，可在 LibTV 设置中自行恢复。

## English

A minimal Chrome extension that converts explicit numbered image mentions into native LibTV reference tags. It never starts generation. A Codex skill and dependency-free preparation script are included. **Codex setup is not unattended Chrome installation:** first-time loading of the unpacked extension remains a user step, and system-page restrictions must not be bypassed.

Independent community project; not affiliated with LibTV, Google, or OpenAI. The icon was created with built-in ImageGen, not copied from LibTV branding.

## License

[MIT](LICENSE). Bug reports and compatibility issues: [GitHub Issues](https://github.com/CGS1991-CN/libtv-one-click-at/issues).

Official references: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [Chrome unpacked-extension loading](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-an-unpacked-extension).
