# 盲拧联想词查询

三阶魔方盲拧「编码 → 联想词」字典的本地查询与管理工具。纯网页应用（HTML+JS），同时提供安卓 APK（Capacitor WebView 封装）。

## 使用方式

- **浏览器打开**：双击 `www/index.html` 即可（无需安装、无需服务器）。
- **安卓 APP**：下载安装 `bld-memo.apk`（见 GitHub Releases），首次安装需在系统设置中允许「安装未知来源应用」。

## 功能

- **查询**：输入字母对（如 `AB`）或粘贴整串字母序列（如 `AB CD EF G`），自动按两个字母分组；末尾的单个字母会单独查询其单字母联想词。显示联想词及读音（如 `Angelababy [bēi]`）。支持按联想词或读音关键词反查编码。
- **字母表**：默认 24 个字母（A–Z 去掉 U、V，对应「帆式全读」编码），可在「设置」中自定义（空格/逗号分隔，每个字母单个字符）。
- **联想词管理**：上方是「单字母编码」行，下方是「双字母编码（字母对）」网格（自身组合如 AA 不使用）。点击任一单元格即可编辑联想词与读音，回车保存、Esc 取消。
- **Excel 导入**：兼容 3 列（编码｜联想词｜读音）、6 列（两组「编码｜联想词｜读音」并排）与 2 列（编码｜联想词）格式，支持 `.xlsx` 与 `.csv`，导入前预览并校验。
- **Excel 导出 / JSON 导出**：浏览器下导出为 `.xlsx` / `.json` 文件；安卓 APP 内导出会唤起系统分享（CSV/JSON 文本，可存到文件或网盘）。

## Excel 格式说明

三列格式（推荐）：

| 编码 | 联想词 | 读音 |
| ---- | ------ | ---- |
| A    | 圣诞帽 |      |
| AB   | Angelababy | bēi |
| CD   | 菜刀   | dāo |

- 编码为 **1 个字母（单字母）** 或 **2 个字母（字母对）**；读音可留空（也可写 `0` 表示无读音）。
- 也支持 6 列（`编码｜联想词｜读音` 两组并排，如帆式全读的示例表）和 2 列（无读音列）。
- 表头行会自动跳过；空行自动忽略。
- 导入会**合并**到现有数据，同名编码以导入数据覆盖。

## 数据存储

- 数据自动保存在本地（浏览器为 `localStorage`，安卓 APP 为 WebView 存储），刷新/重开不丢失。
- 建议**定期「导出 JSON」备份**。

## 关于 SheetJS

`.xlsx` 的解析依赖 `lib/xlsx.full.min.js`（SheetJS 库）。若该文件缺失，仍可：
- 使用 `.csv` 格式导入（Excel 可「另存为 CSV UTF-8」）；
- 从 [SheetJS CDN](https://cdn.sheetjs.com/) 或 npm 下载 `xlsx.full.min.js` 放入 `lib/` 目录。

## 构建安卓 APK

本地无需 Android SDK，APK 由 GitHub Actions 云端构建：

1. 修改代码后提交到 GitHub 并打标签 `git tag v1.0.0 && git push --tags`。
2. 触发 `.github/workflows/build-apk.yml`，在 ubuntu runner 上 `npm ci → cap sync → gradlew assembleDebug`。
3. 生成的 `bld-memo.apk` 自动发布到 Releases。

本地仅做网页调试：浏览器打开 `www/index.html` 即可。

## 目录结构

```
www/                      网页应用（浏览器打开、WebView 加载）
  index.html              主页面
  css/style.css           样式
  js/store.js             数据模型与持久化
  js/excel.js             Excel/CSV 导入、导出与模板
  js/app.js               界面渲染与交互
  lib/xlsx.full.min.js    SheetJS 库（.xlsx 解析，可缺失）
capacitor.config.json     Capacitor 配置（appId、appName、webDir）
package.json              依赖（@capacitor/*）
android/                  安卓原生工程（gradle 构建）
.github/workflows/        云端构建 APK
```
