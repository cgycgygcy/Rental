# 住得明白

面向港科大内地学生的租房资料比较工具。网站由静态 HTML、CSS 和 JavaScript 构成，适用于 GitHub Pages。

## 本地预览

在本目录运行：

```powershell
py -m http.server 8500 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:8500/>。

## OCR 与数据

房源截图由浏览器中的 Tesseract.js 识别；首次使用时会从 jsDelivr 加载识别运行库。截图和识别文字在当前浏览器中处理，不会上传到网站服务器。房源字段与收藏保存在当前浏览器的本地存储中，不会跨用户或浏览器同步。

## 发布

推送到 `main` 分支后，`.github/workflows/pages.yml` 会通过 GitHub Pages 发布站点。
